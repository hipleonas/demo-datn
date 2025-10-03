import os
import logging

import itertools
from typing import List, Dict, Optional, Tuple, Iterable

from pathlib import Path
import torch
import soundfile as sf
import numpy as np

from tqdm.auto import tqdm
from datasets import load_dataset

from concurrent.futures import ThreadPoolExecutor
from lhotse import CutSet, Recording, RecordingSet, SupervisionSegment, SupervisionSet
from lhotse.qa import fix_manifests

import argparse
import hashlib

# Demucs imports for audio denoising
try:
    from demucs import pretrained
    from demucs.apply import apply_model
    DEMUCS_AVAILABLE = True
except ImportError:
    DEMUCS_AVAILABLE = False
    logging.warning("Demucs not available. Install with: pip install demucs")

torch.set_num_threads(1)
torch.set_num_interop_threads(1)

# Global variable to hold the Demucs model
_demucs_model = None

def get_demucs_model():
    """Initialize and return the Demucs model for audio denoising."""
    global _demucs_model
    if _demucs_model is None and DEMUCS_AVAILABLE:
        try:
            # Load a smaller, more memory-efficient model
            # htdemucs_ft is fine-tuned and more memory efficient than htdemucs
            _demucs_model = pretrained.get_model('htdemucs_ft')
            _demucs_model.eval()
            
            # Move to CPU and enable memory optimization
            _demucs_model = _demucs_model.cpu()
            
            logging.info("Demucs htdemucs_ft model loaded successfully for audio denoising")
        except Exception as e:
            logging.error(f"Failed to load Demucs model: {e}")
            try:
                # Fallback to an    even smaller model
                logging.info("Trying fallback to smaller mdx_extra model...")
                _demucs_model = pretrained.get_model('mdx_extra')
                _demucs_model.eval()
                _demucs_model = _demucs_model.cpu()
                logging.info("Demucs mdx_extra model loaded successfully as fallback")
            except Exception as e2:
                logging.error(f"Failed to load fallback model: {e2}")
                _demucs_model = False  # Mark as failed to avoid retrying
    return _demucs_model if _demucs_model is not False else None

def denoise_audio(audio_data: np.ndarray, sampling_rate: int) -> np.ndarray:
    """
    Denoise audio using Demucs model with memory optimization.
    Note: Uses source separation and extracts the vocals component for denoising.
    
    Args:
        audio_data: Audio data as numpy array
        sampling_rate: Sampling rate of the audio
        
    Returns:
        Denoised audio data as numpy array
    """
    if not DEMUCS_AVAILABLE:
        logging.warning("Demucs not available, returning original audio")
        return audio_data
    
    model = get_demucs_model()
    if model is None:
        logging.warning("Demucs model not available, returning original audio")
        return audio_data
    
    try:
        # Check audio length and skip very long audio to prevent OOM
        # max_length = 30 * sampling_rate  # 30 seconds max
        # if len(audio_data) > max_length:
        #     logging.warning(f"Audio too long ({len(audio_data)/sampling_rate:.1f}s), skipping denoising")
        #     return audio_data
        
        # Ensure audio is float32 and in the correct range
        if audio_data.dtype != np.float32:
            audio_data = audio_data.astype(np.float32)
        
        # Normalize audio to [-1, 1] range if needed
        if np.max(np.abs(audio_data)) > 1.0:
            audio_data = audio_data / np.max(np.abs(audio_data))
        
        # Convert to tensor and add batch dimension
        audio_tensor = torch.from_numpy(audio_data).unsqueeze(0)
        
        # Ensure we have the right number of dimensions and channels
        if audio_tensor.dim() == 2:
            # Add channel dimension for mono audio
            audio_tensor = audio_tensor.unsqueeze(1)
        
        # htdemucs expects stereo input (2 channels), so duplicate mono to stereo if needed
        if audio_tensor.shape[1] == 1:
            audio_tensor = audio_tensor.repeat(1, 2, 1)
        
        # Apply source separation with memory management
        with torch.no_grad():
            # Clear cache before processing
            if torch.cuda.is_available():
                torch.cuda.empty_cache()
            
            separated_sources = apply_model(model, audio_tensor, device= 'cpu')
            
            # Clear intermediate tensors
            del audio_tensor
        
        # htdemucs outputs 4 sources: [vocals, drums, bass, other]
        # separated_sources shape: [batch, sources, channels, samples]
        logging.info(f"Separated sources shape: {separated_sources.shape}")
        
        # For denoising speech, we want the vocals component (source index 0)
        vocals_tensor = separated_sources[0, 3]  # [batch=0, source=vocals, all_channels, all_samples]
        
        # Convert back to numpy
        vocals_audio = vocals_tensor.cpu().numpy()
        
        # Clear separated sources to free memory
        del separated_sources, vocals_tensor
        
        # Debug: check volume levels
        original_max = np.max(np.abs(audio_data))


        vocals_max = np.max(np.abs(vocals_audio))
        logging.info(f"Original audio max: {original_max:.4f}, Vocals max: {vocals_max:.4f}")
        
        # If original was mono, convert stereo back to mono by averaging channels
        if audio_data.ndim == 1 and vocals_audio.shape[0] == 2:
            denoised_audio = np.mean(vocals_audio, axis=0)
        elif audio_data.ndim == 1:
            # If somehow we still have a single channel, just squeeze
            denoised_audio = vocals_audio.squeeze()
        else:
            # Keep stereo if original was stereo
            denoised_audio = vocals_audio
        
        # Normalize the denoised audio to have similar volume as original
        if np.max(np.abs(denoised_audio)) > 0:
            # Scale to match original volume but cap at reasonable level
            target_max = min(original_max, 0.95)  # Don't go above 0.95 to avoid clipping
            current_max = np.max(np.abs(denoised_audio))
            scale_factor = target_max / current_max
            denoised_audio = denoised_audio * scale_factor
            logging.info(f"Applied scale factor: {scale_factor:.4f}")
        else:
            logging.warning("Denoised audio is silent, returning original")
            return audio_data
        
        return denoised_audio
        
    except Exception as e:
        logging.error(f"Error during audio denoising: {e}")
        return audio_data  # Return original audio if denoising fails


def parse_single_item(
    item: Dict,
    audio_dir: Path,
    idx: int,
    enable_denoising: bool = False
)->Optional[Tuple[Recording, SupervisionSegment, str]]:
    try:
        prompt_text = item["text"]
        speaker_id = item["speakerID"]
        audio_data = item["audio"]["array"]
        sampling_rate = item["audio"]["sampling_rate"]

        if not prompt_text or not prompt_text.strip():
            logging.warning(f"Skipping item-{idx} due to empty text")
            return None

        # Apply denoising if enabled
        # if enable_denoising:
        logging.info(f"Applying denoising to audio item-{idx}")
        audio_data = denoise_audio(audio_data, sampling_rate)

        unique_hashing = hashlib.md5((speaker_id + prompt_text).encode()).hexdigest()[:12]
        audio_id = f"{speaker_id}-{idx}-{unique_hashing}"
        wav_path = audio_dir / f"{audio_id}.wav"
        wav_path.parent.mkdir(parents= True, exist_ok= True)

        sf.write(wav_path, audio_data, sampling_rate)

        duration = len(audio_data) / sampling_rate

        recording = Recording.from_file(wav_path.resolve(), recording_id = audio_id)

        supervision = SupervisionSegment(
            id = audio_id,
            recording_id = audio_id,
            start = 0.0,
            duration = duration,
            text = prompt_text.strip(),
            speaker = speaker_id
        )

        tsv_line = f"{audio_id}\t{prompt_text.strip()}\t{wav_path.resolve()}\n"

        return recording, supervision, tsv_line


    except Exception as e:
        logging.error(f"Error processing item-{idx}: {e}")

def parse_split_segment(
    dataset_iter:Iterable,
    audio_dir: Path,
    tsv_path: Path,
    split_name: str,
    enable_denoising: bool = False
)->CutSet:
    """
    The audio itself (from a Recording)

    Timing info (start, duration, end)

    Supervisions (transcripts, speaker, language, etc.)

    Features (e.g. spectrograms, embeddings) if precomputed.
    """

    supervisions = []
    recordings = []
    tsv_lines = []

    # Reduce workers when denoising is enabled to prevent OOM
    if enable_denoising:
        job_workers = min(2, int(os.cpu_count() * 0.3))  # Much fewer workers for denoising
        logging.info(f"Using {job_workers} workers for denoising (reduced to prevent OOM)")
    else:
        job_workers = int(os.cpu_count() * 0.8)

    with ThreadPoolExecutor(max_workers = job_workers) as executor:
        futures = [
            executor.submit(
                parse_single_item, item, audio_dir, idx, enable_denoising
            ) for idx, item in enumerate(dataset_iter, start = 1)
        ]

        for fut in tqdm(futures, desc=f"Đang xử lý {split_name}"):
            ans = fut.result()
            if ans:
                recording, supervision, tsv_line = ans
                recordings.append(recording)
                supervisions.append(supervision)
                tsv_lines.append(tsv_line)

    logging.info(f"Đang ghi {len(tsv_lines)} dòng vào file TSV: {tsv_path}")
    with open(tsv_path, "w", encoding="utf-8") as f:
        f.writelines(tsv_lines)

    #Creating LHotse Cutting Set

    recording_set = RecordingSet.from_recordings(
        recordings
    )
    supervision_set = SupervisionSet.from_segments(
        supervisions
    )
    recording_set, supervision_set = fix_manifests(recording_set, supervision_set)
    cut_set = CutSet.from_manifests(
        recordings=recording_set, supervisions=supervision_set
    ).trim_to_supervisions(keep_overlapping=False)

    return cut_set

def prepare_vimd_dataset(
    output_dir: Path,
    audio_dir: Path,
    num_jobs: int,
    max_items : Optional[int] = None,
    validation_ratio: float = 0.1,
    split: str = "train",
    enable_denoising: bool = False,
):
    logging.info("Tải dataset VIMD từ HuggingFace Hub...")
    output_dir.mkdir(parents=True, exist_ok=True)

    manifest_path_split = output_dir / f"vimd_cuts_{split}.jsonl.gz"

    # Tạo thư mục cho file TSV
    tsv_dir = output_dir / "tsv"
    tsv_dir.mkdir(parents=True, exist_ok=True)

    tsv_path = tsv_dir / f"{split}.tsv"

    logging.info("Loading dataset 'nguyendv02/ViMD_Dataset' in streaming mode...")
    streaming_dataset = load_dataset("nguyendv02/ViMD_Dataset", split=split, streaming=True)

    if max_items:
        logging.info(f"Only handle maximum {max_items} items.")
        streaming_dataset = streaming_dataset.take(max_items)

    # total_items = max_items if max_items else 200000 # Ước tính số lượng items trong VIMD
    dataset_iter = iter(streaming_dataset)

    audio_dir = audio_dir / split
    audio_dir.mkdir(parents=True, exist_ok=True)
    logging.info(f"Processing {split} set...")
    if enable_denoising:
        logging.info("Denoising enabled for {split} set")
    cuts = parse_split_segment(dataset_iter, audio_dir, tsv_path, split, enable_denoising)
    logging.info(f"Saving {split} manifest to {manifest_path_split}")
    cuts.to_file(manifest_path_split)
    logging.info(f"Complete {split} set!")

  
    

if __name__ == "__main__":
    formatter = "%(asctime)s %(levelname)s [%(filename)s:%(lineno)d] %(message)s"
    logging.basicConfig(level=logging.INFO, format=formatter)

    parser = argparse.ArgumentParser(description="Chuẩn bị dataset ViMD cho ZipVoice.")
    parser.add_argument("--output-dir", type=str, default="data/vimd/manifests", help="Thư mục lưu manifest đầu ra.")
    parser.add_argument("--audio-dir", type=str, default="data/vimd/audio", help="Thư mục lưu file âm thanh.")
    parser.add_argument("--num-jobs", type=int, default=16, help="Số luồng xử lý song song.")
    parser.add_argument("--max-items", type=int, default=None, help="Số lượng mục tối đa để xử lý (dùng để test).")
    parser.add_argument("--split", type = str, default = "train", help = "Tập huấn luyện hoặc kiểm định.")
    parser.add_argument("--enable-denoising", action="store_true", help="Bật tính năng khử nhiễu âm thanh bằng Demucs DNS64.")
    args = parser.parse_args()

    prepare_vimd_dataset(
        output_dir=Path(args.output_dir),
        audio_dir=Path(args.audio_dir),
        num_jobs=args.num_jobs,
        max_items=args.max_items,
        split = args.split,
        enable_denoising=args.enable_denoising
    )