import os
import logging
import itertools
from typing import  List, Dict, Optional, Tuple, Iterable
from pathlib import Path
import torch
import gc
import pandas as pd
import io
import soundfile as sf
import numpy as np
from tqdm.auto import tqdm
from datasets import load_dataset
from concurrent.futures import ThreadPoolExecutor
from lhotse import CutSet, Recording, RecordingSet, SupervisionSegment, SupervisionSet
from lhotse.qa import fix_manifests
import argparse
import hashlib
import time
import uuid

try :
    from demucs import pretrained
    from demucs.apply import apply_model
    DEMUCS_AVAILABLE = True
except ImportError:
    DEMUCS_AVAILABLE = False
    logging.warning("Demucs not available. Install with: pip install demucs")


torch.set_num_threads(1)
torch.set_num_interop_threads(1)

# Generate a unique session ID for each run
_session_id = str(uuid.uuid4())[:8]
_run_timestamp = str(int(time.time()))

_demucs_model = None

def get_demucs_model():

    global _demucs_model
    if _demucs_model is None and DEMUCS_AVAILABLE:
        try :
            _demucs_model = pretrained.get_model("htdemucs_ft")
            _demucs_model.eval()
            _demucs_model = _demucs_model.cpu()
        except Exception as e:
            try :
                logging.info("Trying fallback to smaller mdx_extra model...")
                _demucs_model = pretrained.get_model('mdx_extra')
                _demucs_model.eval()
                _demucs_model = _demucs_model.cpu()
                logging.info("Demucs mdx_extra model loaded successfully as fallback")
            except Exception as e2:
                logging.error(f"Failed to load fallback model: {e2}")
                _demucs_model = False

    return _demucs_model if _demucs_model is not False else None

def denoise_audio(
    audio_data: np.ndarray,
    sampling_rate: int,
) -> np.ndarray:
    if not DEMUCS_AVAILABLE:
        logging.warning("Demucs not available, returning original audio")
        return audio_data
    
    model = get_demucs_model()
    if model is None:
        logging.warning("Demucs model not available, returning original audio")
        return audio_data
    
    if audio_data is None or len(audio_data) == 0 :
        logging.warning("Empty or None audio data, returning original")
        return audio_data

    maximal_duration = sampling_rate * 300 #GEt 5 minutes duration

    if len(audio_data) > maximal_duration :
        logging.warning(f"Audio too long ({len(audio_data)/sampling_rate:.1f}s), truncating to 5 minutes")
        audio_data = audio_data[:maximal_duration]

    try:
        if audio_data.dtype != np.float32:
            audio_data = audio_data.astype(np.float32)
        if np.max(np.abs(audio_data)) > 1.0:

            audio_data = audio_data / np.max(np.abs(audio_data))
        audio_tensor = torch.from_numpy(audio_data)
        if audio_tensor.dim() == 1: #Mono sequence
            audio_tensor = audio_tensor.unsqueeze(0).unsqueeze(0) #(1,1,T)
        elif audio_tensor.dim() == 2:
            if audio_tensor.shape[0] == 2:
                audio_tensor = audio_tensor.unsqueeze(0)
            else:
                audio_tensor = audio_tensor.T.unsqueeze(0)
        if audio_tensor.shape[1] == 1:
            audio_tensor = audio_tensor.repeat(1,2,1)
        with torch.no_grad():
            if torch.cuda.is_available():
                torch.cuda.empty_cache()
            gc.collect()

            separated_sources = apply_model(model, audio_tensor, device='cpu')
            del audio_tensor
            gc.collect()

        if separated_sources.shape[1] > 3:
            vocals_tensor = separated_sources[0, 3]  # Extract vocals channel
        else:
            # Fallback: use the last channel if we don't have enough channels
            vocals_tensor = separated_sources[0, -1]
            logging.warning(f"Using fallback channel for vocals (index {separated_sources.shape[1]-1})")
            
        vocals_audio = vocals_tensor.detach().cpu().numpy()
        del separated_sources, vocals_tensor
        gc.collect()


        original_max = np.max(np.abs(audio_data))
        vocals_max = np.max(np.abs(vocals_audio))
        logging.info(f"Original audio max: {original_max:.4f}, Vocals max: {vocals_max:.4f}")
        
        # If original was mono, convert stereo back to mono by averaging channels
        if audio_data.ndim == 1 and vocals_audio.shape[0] == 2:
            denoised_audio = np.mean(vocals_audio, axis=0)
        elif audio_data.ndim == 1:
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
        return audio_data

def generate_speaker_id(text: str) -> str:
    return hashlib.md5((text).encode()).hexdigest()[:12]

def generate_unique_audio_id(speaker_id: str, idx: int, prompt_text: str) -> str:
    """Generate a unique audio ID that includes session and timestamp info to ensure uniqueness across runs."""
    global _session_id, _run_timestamp
    
    # Combine speaker_id, index, session_id, timestamp, and a hash of the text
    text_hash = hashlib.md5(prompt_text.encode()).hexdigest()[:8]
    unique_components = f"{speaker_id}-{idx}-{_session_id}-{_run_timestamp}-{text_hash}"
    
    # Create a final hash to keep the ID manageable but unique
    final_hash = hashlib.md5(unique_components.encode()).hexdigest()[:16]
    
    return f"{speaker_id}-{idx}-{final_hash}"

def append_cuts_to_manifest(cuts: CutSet, manifest_path: Path) -> None:
    """Append new cuts to existing manifest file, or create new one if it doesn't exist."""
    if manifest_path.exists():
        logging.info(f"Appending cuts to existing manifest: {manifest_path}")
        # Load existing cuts
        existing_cuts = CutSet.from_file(manifest_path)
        
        # Convert cuts to list to work with lazy iterators and get length
        cuts_list = list(cuts)
        logging.info(f"Processing {len(cuts_list)} new cuts")
        
        # Check for potential duplicates by ID (though should be rare with unique IDs)
        existing_ids = set(cut.id for cut in existing_cuts)
        new_cuts = [cut for cut in cuts_list if cut.id not in existing_ids]
        
        if len(new_cuts) < len(cuts_list):
            skipped = len(cuts_list) - len(new_cuts)
            logging.warning(f"Skipped {skipped} cuts with duplicate IDs")
        
        if new_cuts:
            # Combine with new cuts
            combined_cuts = CutSet.from_cuts(list(existing_cuts) + new_cuts)
            # Save combined cuts
            combined_cuts.to_file(manifest_path)
            logging.info(f"Added {len(new_cuts)} new cuts. Total cuts in manifest: {len(combined_cuts)}")
        else:
            logging.info("No new cuts to add (all were duplicates)")
    else:
        # Convert to list to get length safely
        cuts_list = list(cuts)
        logging.info(f"Creating new manifest with {len(cuts_list)} cuts: {manifest_path}")
        CutSet.from_cuts(cuts_list).to_file(manifest_path)

def parse_single_item(
    item: Dict,
    audio_dir: Path,
    idx: int,
    enable_denoising: bool = False,
    is_parquet_data: bool = False
)->Optional[Tuple[Recording, SupervisionSegment, str]]:

    try:
        gc.collect()

        if is_parquet_data:
            prompt_text = item["transcription"]
            audio_data = None
            sampling_rate = None
            if "audio" in item and item["audio"] is not None:
                audio_info = item["audio"]
                if isinstance(audio_info, dict):
                    audio_keys = list(audio_info.keys())
                    
                    if "array" in audio_info:
                        audio_data = audio_info["array"]
                        sampling_rate = audio_info.get("sampling_rate", 16000)
                    elif "bytes" in audio_info:
                        audio_bytes  = audio_info["bytes"]
                        audio_data, sampling_rate = sf.read(io.BytesIO(audio_bytes))

                    elif "path" in audio_info and "array" in audio_info:
                        # Some HF datasets store both path and array
                        audio_data = audio_info["array"]
                        sampling_rate = audio_info.get("sampling_rate", 16000)
                    else:
                        # Try to find any key that might contain audio data
                        possible_keys = ["data", "waveform", "signal", "samples"]
                        audio_data = None
                        for key in possible_keys:
                            if key in audio_info:
                                audio_data = audio_info[key]
                                sampling_rate = audio_info.get("sampling_rate", 16000)
                                logging.info(f"Found audio data in key '{key}' for item-{idx}")
                                break
                        if audio_data is None:
                            logging.warning(f"Skipping item-{idx} - audio dict keys: {audio_keys}. Expected 'array', 'bytes', or similar.")
                            return None
                else:
                    logging.warning(f"Skipping item-{idx} due to unexpected audio format: {type(audio_info)}")
                    return None
            elif "audio_bytes" in item and item["audio_bytes"] is not None:
                # Handle raw audio bytes
                audio_bytes = item["audio_bytes"]
                audio_data, sampling_rate = sf.read(io.BytesIO(audio_bytes))
            else:
                logging.warning(f"Skipping item-{idx} due to missing audio data (no 'audio' or 'audio_bytes' column)")
                return None
        else:
            # Handle HuggingFace dataset format
            prompt_text = item["transcription"]
            audio_data = item["audio"]["array"]
            sampling_rate = item["audio"]["sampling_rate"]
            
        if not prompt_text or not prompt_text.strip():
            logging.warning(f"Skipping item-{idx} due to empty text")
            return None
            
        # Validate audio data
        if audio_data is None or len(audio_data) == 0:
            logging.warning(f"Skipping item-{idx} due to empty audio data")
            return None
            
        # Ensure audio_data is numpy array
        if not isinstance(audio_data, np.ndarray):
            audio_data = np.array(audio_data)
            
        # Validate sampling rate
        if sampling_rate is None or sampling_rate <= 0:
            logging.warning(f"Invalid sampling rate for item-{idx}: {sampling_rate}, using default 16000")
            sampling_rate = 16000

        # Apply denoising if enabled
        if enable_denoising:
            logging.info(f"Applying denoising to audio item-{idx}")
            audio_data = denoise_audio(audio_data, sampling_rate)

        speaker_id = generate_speaker_id(prompt_text)
        audio_id = generate_unique_audio_id(speaker_id, idx, prompt_text)
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
        return None

def parse_split_segment(
    dataset_iter:Iterable,
    audio_dir: Path,
    tsv_path: Path,
    split_name: str,
    enable_denoising: bool = False,
    is_parquet_data: bool = False
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
        job_workers = 1  # Use single worker for denoising to prevent memory issues
        logging.info(f"Using {job_workers} worker for denoising (single-threaded to prevent OOM)")
    else:
        job_workers = min(4, int(os.cpu_count() * 0.5))  # Reduced from 0.8 to prevent memory issues

    with ThreadPoolExecutor(max_workers = job_workers) as executor:
        futures = [
            executor.submit(
                parse_single_item, item, audio_dir, idx, enable_denoising, is_parquet_data
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
    # Append to existing TSV file for train and validation splits, overwrite for others
    if split_name.lower() in ["train", "validation"]:
        mode = "a" if tsv_path.exists() else "w"
        action = "Appending to" if tsv_path.exists() else "Creating"
        logging.info(f"{action} TSV file for {split_name} split")
    else:
        mode = "w"
        logging.info(f"Overwriting TSV file for {split_name} split")
    
    with open(tsv_path, mode, encoding="utf-8") as f:
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

def prepare_parquet_dataset(
    parquet_file: Path,
    output_dir: Path,
    audio_dir: Path,
    num_jobs: int,
    max_items: Optional[int] = None,
    split: str = "train",
    enable_denoising: bool = False,
):
    """Process dataset from parquet file containing audio and transcription data."""
    global _session_id, _run_timestamp
    logging.info(f"Loading dataset from parquet file: {parquet_file}")
    logging.info(f"Session ID: {_session_id}, Timestamp: {_run_timestamp}")
    output_dir.mkdir(parents=True, exist_ok=True)

    manifest_path_split = output_dir / f"vlsp100_cuts_{split}.jsonl.gz"

    # Create directory for TSV files
    tsv_dir = output_dir / "tsv"
    tsv_dir.mkdir(parents=True, exist_ok=True)

    tsv_path = tsv_dir / f"{split}.tsv"

    # Load parquet file
    df = pd.read_parquet(parquet_file)
    logging.info(f"Loaded {len(df)} items from parquet file")
    
    # if max_items:
    #     logging.info(f"Limiting to maximum {max_items} items")
    #     df = df.head(max_items)
    
    # Convert DataFrame to list of dictionaries for processing
    dataset_iter = df.to_dict('records')

    audio_dir = audio_dir / split
    audio_dir.mkdir(parents=True, exist_ok=True)
    
    logging.info(f"Processing {split} set from parquet...")
    if enable_denoising:
        logging.info(f"Denoising enabled for {split} set")
        
    cuts = parse_split_segment(
        dataset_iter, 
        audio_dir, 
        tsv_path, 
        split, 
        enable_denoising, 
        is_parquet_data=True
    )
    
    logging.info(f"Saving {split} manifest to {manifest_path_split}")
    # Append to existing manifest for train and validation splits, overwrite for others
    if split.lower() in ["train", "validation"]:
        append_cuts_to_manifest(cuts, manifest_path_split)
    else:
        cuts.to_file(manifest_path_split)
    logging.info(f"Complete {split} set!")


def prepare_vlsp_dataset(
    output_dir: Path,
    audio_dir: Path,
    num_jobs: int,
    max_items : Optional[int] = None,
    validation_ratio: float = 0.1,
    split: str = "train",
    enable_denoising: bool = False,
):
    global _session_id, _run_timestamp
    logging.info("Tải dataset VLSP từ HuggingFace Hub...")
    logging.info(f"Session ID: {_session_id}, Timestamp: {_run_timestamp}")
    output_dir.mkdir(parents=True, exist_ok=True)

    manifest_path_split = output_dir / f"vlsp_cuts_{split}.jsonl.gz"

    # Tạo thư mục cho file TSV
    tsv_dir = output_dir / "tsv"
    tsv_dir.mkdir(parents=True, exist_ok=True)

    tsv_path = tsv_dir / f"{split}.tsv"

    logging.info("Loading dataset 'doof-ferb/vlsp2020_vinai_100h' in streaming mode...")
    streaming_dataset = load_dataset("doof-ferb/vlsp2020_vinai_100h", split=split, streaming=True)

    # if max_items:
    #     logging.info(f"Only handle maximum {max_items} items.")
    #     streaming_dataset = streaming_dataset.take(max_items)

    dataset_iter = iter(streaming_dataset)

    audio_dir = audio_dir / split
    audio_dir.mkdir(parents=True, exist_ok=True)
    logging.info(f"Processing {split} set...")
    if enable_denoising:
        logging.info("Denoising enabled for {split} set")
    cuts = parse_split_segment(dataset_iter, audio_dir, tsv_path, split, enable_denoising, is_parquet_data=False)
    logging.info(f"Saving {split} manifest to {manifest_path_split}")
    # Append to existing manifest for train and validation splits, overwrite for others
    if split.lower() in ["train", "validation"]:
        append_cuts_to_manifest(cuts, manifest_path_split)
    else:
        cuts.to_file(manifest_path_split)
    logging.info(f"Complete {split} set!")

  

if __name__ == "__main__":
    formatter = "%(asctime)s %(levelname)s [%(filename)s:%(lineno)d] %(message)s"
    logging.basicConfig(level=logging.INFO, format=formatter)

    parser = argparse.ArgumentParser(description="Chuẩn bị dataset ViMD/VLSP hoặc parquet cho ZipVoice.")
    parser.add_argument("--output-dir", type=str, default="data/vimd/manifests", help="Thư mục lưu manifest đầu ra.")
    parser.add_argument("--audio-dir", type=str, default="data/vimd/audio", help="Thư mục lưu file âm thanh.")
    parser.add_argument("--num-jobs", type=int, default=16, help="Số luồng xử lý song song.")
    parser.add_argument("--max-items", type=int, default=None, help="Số lượng mục tối đa để xử lý (dùng để test).")
    parser.add_argument("--split", type = str, default = "train", help = "Tập huấn luyện hoặc kiểm định.")
    parser.add_argument("--enable-denoising", action="store_true", help="Bật tính năng khử nhiễu âm thanh bằng Demucs DNS64.")
    parser.add_argument("--parquet-file", type=str, default=None, help="Đường dẫn tới file parquet chứa audio và transcription.")
    args = parser.parse_args()

    if args.parquet_file:
        # Process parquet file
        prepare_parquet_dataset(
            parquet_file=Path(args.parquet_file),
            output_dir=Path(args.output_dir),
            audio_dir=Path(args.audio_dir),
            num_jobs=args.num_jobs,
            max_items=args.max_items,
            split=args.split,
            enable_denoising=args.enable_denoising
        )
    else:
        # Process HuggingFace dataset
        prepare_vlsp_dataset(
            output_dir=Path(args.output_dir),
            audio_dir=Path(args.audio_dir),
            num_jobs=args.num_jobs,
            max_items=args.max_items,
            split = args.split,
            enable_denoising=args.enable_denoising
        )