import subprocess
import os
import shutil
import uuid
import time
from flask import Flask, request, jsonify, send_from_directory
from flask_cors import CORS
import click
# --- CẤU HÌNH ---
SAVED_VOICES_DIR = "./saved_voices"
TEMP_AUDIO_DIR = "./temp_audio"  # Thư mục   lưu các chunk audio tạm thời

app = Flask(__name__, static_folder=TEMP_AUDIO_DIR, static_url_path='/audio')

# Enable CORS for all routes
CORS(app)

# Global counter for sequential audio filenames
_audio_counter = 0
_counter_lock = None

def _get_next_audio_number():
    """Get next sequential audio number (thread-safe)"""
    global _audio_counter
    _audio_counter += 1
    return _audio_counter

def _run_inference(text_to_speak, output_filename, prompt_wav, prompt_text):
    """
    Hàm nội bộ để thực thi câu lệnh inference của ZipVoice.
    Trả về True nếu thành công, False nếu có lỗi.
    """
    cmd = [
        "python3", "-m", "zipvoice.bin.infer_zipvoice",
        "--model-dir", "./zip_2500",
        "--checkpoint-name", "iter-525000-avg-2.pt",
        "--prompt-wav", prompt_wav,
        "--prompt-text", prompt_text,
        "--text", text_to_speak,
        "--res-wav-path", output_filename,
        "--tokenizer", "espeak",
        "--lang", "vi"
    ]
    try:
        result = subprocess.run(
            cmd,
            check=True,
            capture_output=True,
            text=True,
            encoding='utf-8',
            # stderr=subprocess.PIPE
        )
        if result.returncode == 0:
            return True
    except subprocess.CalledProcessError as e:
        print("!!!!!!LỖI THỰC THI TRÊN SERVER !!!!!!")
        print(f"Lỗi khi xử lý chunk với văn bản: '{text_to_speak[:50]}...'")
        print("Error (stderr):", e.stderr)
        return False
    return False

def register_speaker(speaker_id, prompt_wav, prompt_text):
    """
    Hàm đăng ký một giọng nói mới bằng cách lưu file wav và text mẫu.
    """
    os.makedirs(SAVED_VOICES_DIR, exist_ok=True)
    saved_prompt_wav_path = os.path.join(SAVED_VOICES_DIR, f"{speaker_id}.wav")
    saved_prompt_text_path = os.path.join(SAVED_VOICES_DIR, f"{speaker_id}.txt")

    if not os.path.exists(prompt_wav):      
        print(f"Lỗi: Không tìm thấy file audio nguồn tại '{prompt_wav}'")
        return False

    shutil.copy(prompt_wav, saved_prompt_wav_path)
    with open(saved_prompt_text_path, 'w', encoding='utf-8') as f:
        f.write(prompt_text)
    return True

@app.cli.command("register")
@click.argument("speaker_id")
@click.argument("prompt_wav_path", type=click.Path(exists=True))
@click.argument("prompt_text")
def register_command(speaker_id, prompt_wav_path, prompt_text):
    """Đăng ký một giọng nói mới từ command line."""
    if register_speaker(speaker_id, prompt_wav_path, prompt_text):
        click.echo(f"Đăng ký thành công speaker '{speaker_id}'.")
    else:
        click.echo(f"Đăng ký thất bại.")

@app.route('/')
def index():
    """Root endpoint"""
    return jsonify({
        "message": "TTS Service is running", 
        "status": "healthy",
        "endpoints": {
            "synthesize": "POST /synthesize",
            "health": "GET /health"
        }
    })

@app.route('/health')
def health():
    """Health check endpoint"""
    return jsonify({"status": "healthy", "service": "TTS Service"})

@app.route('/register', methods=['POST'])
def register_speaker_endpoint():
    """API endpoint để đăng ký một giọng nói mới."""
    try:
        # Check if request has file upload
        if 'audio_file' not in request.files:
            return jsonify({"success": False, "error": "Không tìm thấy file audio"}), 400
        
        audio_file = request.files['audio_file']
        speaker_id = request.form.get('speaker_id')
        prompt_text = request.form.get('prompt_text')
        
        if not speaker_id or not prompt_text:
            return jsonify({"success": False, "error": "Thiếu speaker_id hoặc prompt_text"}), 400
        
        if audio_file.filename == '':
            return jsonify({"success": False, "error": "File audio không được chọn"}), 400
        
        # Save uploaded file temporarily
        temp_audio_path = os.path.join(TEMP_AUDIO_DIR, f"temp_{speaker_id}_{uuid.uuid4()}.wav")
        audio_file.save(temp_audio_path)
        
        # Register the speaker
        success = register_speaker(speaker_id, temp_audio_path, prompt_text)
        
        # Clean up temp file
        if os.path.exists(temp_audio_path):
            os.remove(temp_audio_path)
        
        if success:
            return jsonify({"success": True, "message": f"Đăng ký thành công speaker '{speaker_id}'"})
        else:
            return jsonify({"success": False, "error": "Lỗi khi đăng ký speaker"}), 500
            
    except Exception as e:
        return jsonify({"success": False, "error": f"Lỗi server: {str(e)}"}), 500

@app.route('/synthesize', methods=['POST'])
def synthesize():
    """API endpoint để tổng hợp một chunk văn bản."""
    data = request.get_json()
    text_chunk = data.get('text_chunk')
    speaker_id = data.get('speaker_id')

    if not text_chunk or not speaker_id:
        return jsonify({"success": False, "error": "Thiếu text_chunk hoặc speaker_id"}), 400

    saved_prompt_wav_path = os.path.join(SAVED_VOICES_DIR, f"{speaker_id}.wav")
    saved_prompt_text_path = os.path.join(SAVED_VOICES_DIR, f"{speaker_id}.txt")

    if not os.path.exists(saved_prompt_wav_path):
        return jsonify({"success": False, "error": f"Giọng đọc '{speaker_id}' chưa được đăng ký."}), 404

    with open(saved_prompt_text_path, 'r', encoding='utf-8') as f:
        prompt_text = f.read().strip()

    # Use sequential number instead of UUID for easier management
    audio_number = _get_next_audio_number()
    chunk_filename = f"audio_{audio_number:04d}.wav"  # e.g., audio_0001.wav, audio_0002.wav
    output_filepath = os.path.join(TEMP_AUDIO_DIR, chunk_filename)

    success = _run_inference(text_chunk, output_filepath, saved_prompt_wav_path, prompt_text)

    if success:
        audio_url = f"/audio/{chunk_filename}"
        return jsonify({
            "success": True, 
            "url": audio_url,
            "audio_number": audio_number,  # Return audio number for reference
            "filename": chunk_filename
        })
    else:
        return jsonify({"success": False, "error": "Lỗi khi tổng hợp âm thanh."}), 500

if __name__ == '__main__':
    os.makedirs(SAVED_VOICES_DIR, exist_ok=True)
    os.makedirs(TEMP_AUDIO_DIR, exist_ok=True)
    app.run(port=5000, debug=False)


