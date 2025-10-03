# import os
# import logging
# import itertools
# from typing import List, Dict, Optional, Tuple, Iterable

# from concurrent.futures import ThreadPoolExecutor

# from pathlib import Path

# import torch
# import soundfile as sf
# from tqdm.auto import tqdm
# from dotenv import load_dotenv

# from huggingface_hub import login
# from datasets import load_dataset

# from lhotse import CutSet, Recording, RecordingSet, SupervisionSegment, SupervisionSet
# from lhotse.qa import fix_manifests
# import argparse
# torch.set_num_threads(1)
# torch.set_num_interop_threads(1)

# TOTAL_DURATION = 0

# def process_item(
#     item: Dict,
#     audio_dir : Path,
#     idx: int
# ) ->  Optional[Tuple[Recording, SupervisionSegment]]:
#     global TOTAL_DURATION
#     try :

#         text = item["text"]
#         speaker_id = item["speakerID"]
#         audio_data = item["audio"]["array"]
#         sampling_rate = item["audio"]["sampling_rate"]

#         # Tạo một ID duy nhất cho audio
#         audio_id = f"{speaker_id}-{hash(text)}"

#         if not text.strip():
#             logging.warning(f"Skipping item-{idx} due to empty text")
#             return None

#         wav_path = audio_dir / f"{audio_id}.wav"
#         wav_path.parent.mkdir(parents = True, exist_ok = True)
#         sf.write(wav_path, audio_data, sampling_rate)
#         duration = len(audio_data)/ sampling_rate
#         TOTAL_DURATION += duration

#         recording = Recording.from_file(wav_path, recording_id = audio_id)

#         supervision = SupervisionSegment(
#             id=audio_id,
#             recording_id=audio_id,
#             start=0.0,
#             duration=duration,
#             text=text.strip(),
#             speaker=speaker_id,
#         )

#         if idx % 100 == 0 :
#             logging.info(f"Processed {idx} items, current total duration: {TOTAL_DURATION/3600:.2f} hours")

#         return recording, supervision
    
#     except Exception as e:
#         logging.error(f"Error processing item-{idx}: {e}")
#         return None
# def prepare_vimd(
#     output_dir :Path,
#     audio_dir: Path,
#     num_jobs : int,
#     max_items: Optional[int] = None,
#     validation_ratio:float = 0.1
# ):
#     logging.info("Loading VIMD dataset from HuggingFace Hub...")
#     output_dir.mkdir(parents = True, exist_ok=True)

#     train_manifest_path = output_dir / "vimd_cuts_train.jsonl.gz"
#     valid_manifest_path = output_dir / "vimd_cuts_validation.jsonl.gz"

#     if train_manifest_path.exists() and valid_manifest_path.exists():
#         logging.info("ViMD train and validation manifests already exist. Skipping.")
#         return

#     # Đăng nhập Hugging Face
#     # load_dotenv()
#     # access_token = os.getenv("ACCESS_TOKEN")
#     # if not access_token:
#     #     raise ValueError("ACCESS_TOKEN not found in .env file.")
#     # login(token=access_token)

#     # Tải dataset ở chế độ streaming
#     logging.info("Loading streaming dataset 'nguyendv02/ViMD_Dataset' from Hugging Face...")
#     streaming_dataset = load_dataset(
#         "nguyendv02/ViMD_Dataset", split="train", streaming=True
#     )

#     if max_items:
#         logging.info(f"Processing a maximum of {max_items} items.")
#         streaming_dataset = streaming_dataset.take(max_items)

#     dataset_iter = iter(streaming_dataset)
#     total_items = max_items if max_items else 10000


#     validation_size = int(validation_ratio * total_items)
#     validation_iter = itertools.islice(dataset_iter, validation_size)
#     train_iter = dataset_iter

#     #(.venv) hiepquoc@LAPTOP-HVDMQOFI:~/ZipVoice$ python3 ./zipvoice/bin/load_vimd.py --output-dir data/vimd/manifests --audio-dir data/vimd/audio --num-jobs 4 --max-items 100

#      # Tạo thư mục audio
#     train_audio_dir = audio_dir / "train"
#     valid_audio_dir = audio_dir / "validation"
#     train_audio_dir.mkdir(parents=True, exist_ok=True)
#     valid_audio_dir.mkdir(parents=True, exist_ok=True)

#     def process_split(
#         dataset_iter: Iterable,
#         audio_dir: Path,
#         desc: str
#     ) -> CutSet:
#         recordings = []
#         supervisions = []
#         with ThreadPoolExecutor(max_workers=num_jobs) as executor:
#             futures = [
#                 executor.submit(process_item, item, audio_dir, idx)
#                 for idx, item in enumerate(dataset_iter, start=1)
#             ]
#             for future in tqdm(futures, desc=desc):
#                 result = future.result()
#                 if result:
#                     recordings.append(result[0])
#                     supervisions.append(result[1])

#         recording_set = RecordingSet.from_recordings(recordings)
#         supervision_set = SupervisionSet.from_segments(supervisions)
#         recording_set, supervision_set = fix_manifests(recording_set, supervision_set)
#         cut_set = CutSet.from_manifests(
#             recordings=recording_set, supervisions=supervision_set
#         ).trim_to_supervisions(keep_overlapping=False)
#         return cut_set
    
#      # Xử lý tập validation
#     logging.info("--- Processing Validation Split ---")
#     validation_cuts = process_split(validation_iter, valid_audio_dir, "Processing validation")
#     logging.info(f"Saving validation manifest to {valid_manifest_path}")
#     validation_cuts.to_file(valid_manifest_path)

#     # Xử lý tập train
#     logging.info("--- Processing Training Split ---")
#     train_cuts = process_split(train_iter, train_audio_dir, "Processing training")
#     logging.info(f"Saving training manifest to {train_manifest_path}")
#     train_cuts.to_file(train_manifest_path)
    
#     print(f"Total duration of processed audio: {TOTAL_DURATION / 3600:.2f} hours")
#     logging.info("--- ViMD Preparation Done! ---")



# if __name__ == "__main__":

#     formatter = "%(asctime)s %(levelname)s [%(filename)s:%(lineno)d] %(message)s"
#     logging.basicConfig(level=logging.INFO, format=formatter)

#     parser = argparse.ArgumentParser(description="Prepare ViMD dataset for ZipVoice.")
#     parser.add_argument(
#         "--output-dir", type=str, default="data/vimd/manifests",
#         help="Directory to save the output manifests."
#     )
#     parser.add_argument(
#         "--audio-dir", type=str, default="data/vimd/audio",
#         help="Directory to save the downloaded audio files."
#     )
#     parser.add_argument(
#         "--num-jobs", type=int, default=16,
#         help="Number of parallel jobs to download and process audio."
#     )
#     parser.add_argument(
#         "--max-items", type=int, default=None,
#         help="Maximum number of items to process from the dataset (for testing)."
#     )
    
#     args = parser.parse_args()

#     prepare_vimd(
#         output_dir=Path(args.output_dir),
#         audio_dir=Path(args.audio_dir),
#         num_jobs=args.num_jobs,
#         max_items=args.max_items,
#     )

#https://docs.pytorch.org/audio/main/tutorials/hybrid_demucs_tutorial.html

import os
import logging
import itertools
from typing import List, Dict, Optional, Tuple, Iterable
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
import torch
import soundfile as sf
from tqdm.auto import tqdm
from datasets import load_dataset
from lhotse import CutSet, Recording, RecordingSet, SupervisionSegment, SupervisionSet
from lhotse.qa import fix_manifests
import argparse
import hashlib


torch.set_num_threads(1)
torch.set_num_interop_threads(1)

def process_item(
    item: Dict,
    audio_dir: Path,
    idx: int
) -> Optional[Tuple[Recording, SupervisionSegment, str]]:
    
    try:
        text = item["text"]
        speaker_id = item["speakerID"]
        audio_data = item["audio"]["array"]
        sampling_rate = item["audio"]["sampling_rate"]

        if not text or not text.strip():
            logging.warning(f"Skipping item-{idx} due to empty text")
            return None
        
        unique_hash = hashlib.md5((speaker_id + text).encode()).hexdigest()[:12]

        audio_id = f"{speaker_id}-{idx}-{unique_hash}"
        wav_path = audio_dir / f"{audio_id}.wav"
        wav_path.parent.mkdir(parents=True, exist_ok=True)
        sf.write(wav_path, audio_data, sampling_rate)
        duration = len(audio_data) / sampling_rate

        
        recording = Recording.from_file(wav_path.resolve(), recording_id = audio_id)

        supervision = SupervisionSegment(
            id=audio_id,
            recording_id=audio_id,
            start=0.0,
            duration=duration,
            text=text.strip(),
            speaker=speaker_id,
        )
        
        # Tạo dòng TSV với đường dẫn tuyệt đối
        tsv_line = f"{audio_id}\t{text.strip()}\t{wav_path.resolve()}\n"

       

        return recording, supervision, tsv_line

    
    except Exception as e:
        logging.error(f"Lỗi khi xử lý item-{idx}: {e}")
        return None
    
def process_split(
    dataset_iter: Iterable,
    audio_dir: Path,
    tsv_path: Path,
    split_name: str
) -> CutSet:
    """
    Xử lý một phần của dataset (train/validation).
    """
    recordings = []
    supervisions = []
    tsv_lines = []
    
    num_jobs = int(os.cpu_count() * 0.8) # Sử dụng 80% số CPU cores

    with ThreadPoolExecutor(max_workers=num_jobs) as executor:
        futures = [
            executor.submit(process_item, item, audio_dir, idx)
            for idx, item in enumerate(dataset_iter, start=1)
        ]
        for future in tqdm(futures, desc=f"Đang xử lý {split_name}"):
            result = future.result()
            if result:
                recording, supervision, tsv_line = result
                recordings.append(recording)
                supervisions.append(supervision)
                tsv_lines.append(tsv_line)

    # Ghi file TSV
    logging.info(f"Đang ghi {len(tsv_lines)} dòng vào file TSV: {tsv_path}")
    with open(tsv_path, "w", encoding="utf-8") as f:
        f.writelines(tsv_lines)

    # Tạo Lhotse CutSet
    recording_set = RecordingSet.from_recordings(recordings)
    supervision_set = SupervisionSet.from_segments(supervisions)
    recording_set, supervision_set = fix_manifests(recording_set, supervision_set)
    cut_set = CutSet.from_manifests(
        recordings=recording_set, supervisions=supervision_set
    ).trim_to_supervisions(keep_overlapping=False)
    
    return cut_set

def prepare_vimd(
    output_dir: Path,
    audio_dir: Path,
    num_jobs: int, # num_jobs is now passed but not directly used in ThreadPoolExecutor
    max_items: Optional[int] = None,
    validation_ratio: float = 0.1 # Giảm tỷ lệ validation xuống 1%
):
    logging.info("Tải dataset VIMD từ HuggingFace Hub...")
    output_dir.mkdir(parents=True, exist_ok=True)

    train_manifest_path = output_dir / "vimd_cuts_train.jsonl.gz"
    valid_manifest_path = output_dir / "vimd_cuts_validation.jsonl.gz"
    
    # Tạo thư mục cho file TSV
    tsv_dir = output_dir / "tsv"
    tsv_dir.mkdir(parents=True, exist_ok=True)
    train_tsv_path = tsv_dir / "train.tsv"
    valid_tsv_path = tsv_dir / "validation.tsv"

    # if train_manifest_path.exists() and valid_manifest_path.exists():
    #     logging.info("Manifests của ViMD đã tồn tại. Bỏ qua.")
    #     return

    logging.info("Tải dataset 'nguyendv02/ViMD_Dataset' ở chế độ streaming...")
    streaming_dataset = load_dataset("nguyendv02/ViMD_Dataset", split="train", streaming=True)

    if max_items:
        logging.info(f"Chỉ xử lý tối đa {max_items} mục.")
        streaming_dataset = streaming_dataset.take(max_items)

    # Ước tính tổng số lượng (chỉ mang tính tham khảo)
    total_items = max_items if max_items else 200000 # Ước tính số lượng items trong VIMD
    validation_size = int(validation_ratio * total_items)

    dataset_iter = iter(streaming_dataset)
    validation_iter = itertools.islice(dataset_iter, validation_size)
    train_iter = dataset_iter

    train_audio_dir = audio_dir / "train"
    valid_audio_dir = audio_dir / "validation"
    train_audio_dir.mkdir(parents=True, exist_ok=True)
    valid_audio_dir.mkdir(parents=True, exist_ok=True)

    # Xử lý tập validation
    logging.info("--- Bắt đầu xử lý tập Validation ---")
    validation_cuts = process_split(validation_iter, valid_audio_dir, valid_tsv_path, "validation")
    logging.info(f"Lưu manifest validation vào: {valid_manifest_path}")
    validation_cuts.to_file(valid_manifest_path)

    # Xử lý tập train
    logging.info("--- Bắt đầu xử lý tập Train ---")
    train_cuts = process_split(train_iter, train_audio_dir, train_tsv_path, "train")
    logging.info(f"Lưu manifest training vào: {train_manifest_path}")
    train_cuts.to_file(train_manifest_path)
    
    logging.info("--- Hoàn tất chuẩn bị ViMD! ---")

if __name__ == "__main__":
    formatter = "%(asctime)s %(levelname)s [%(filename)s:%(lineno)d] %(message)s"
    logging.basicConfig(level=logging.INFO, format=formatter)

    parser = argparse.ArgumentParser(description="Chuẩn bị dataset ViMD cho ZipVoice.")
    parser.add_argument("--output-dir", type=str, default="data/vimd/manifests", help="Thư mục lưu manifest đầu ra.")
    parser.add_argument("--audio-dir", type=str, default="data/vimd/audio", help="Thư mục lưu file âm thanh.")
    parser.add_argument("--num-jobs", type=int, default=16, help="Số luồng xử lý song song.")
    parser.add_argument("--max-items", type=int, default=None, help="Số lượng mục tối đa để xử lý (dùng để test).")
    
    args = parser.parse_args()

    prepare_vimd(
        output_dir=Path(args.output_dir),
        audio_dir=Path(args.audio_dir),
        num_jobs=args.num_jobs,
        max_items=args.max_items,
    )


    
