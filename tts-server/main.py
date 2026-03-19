import os
import io
import base64
import json
import asyncio
from pathlib import Path
from typing import Optional, List, Dict, Any

from fastapi import FastAPI, HTTPException, UploadFile, File, Form
from fastapi.responses import StreamingResponse, JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
import uvicorn
import scipy.io.wavfile
import numpy as np

# Optional pydub for MP3 conversion
try:
    from pydub import AudioSegment
    PYDUB_AVAILABLE = True
except ImportError:
    PYDUB_AVAILABLE = False

# pocket_tts for high-quality voice cloning
try:
    from pocket_tts import TTSModel
    POCKET_TTS_AVAILABLE = True
except ImportError:
    POCKET_TTS_AVAILABLE = False
    print("[WARNING] pocket_tts not installed. Voice generation will be disabled.")

app = FastAPI(title="Pocket TTS Hub", version="1.0.0")

# Enable CORS for local cross-service communication
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Configuration & Cache
VOICES_DIR = Path("voices-celebrities")
VOICES_DIR.mkdir(exist_ok=True)
voice_cache = {}
tts_model = None

if POCKET_TTS_AVAILABLE:
    try:
        print("[INFO] Initializing TTS Model...")
        tts_model = TTSModel.load_model()
        print(f"[INFO] TTS Model Ready ({tts_model.sample_rate}Hz)")
    except Exception as e:
        print(f"[ERROR] Failed to load TTS model: {e}")

def get_voice_state(voice_id: str):
    """Load or retrieve voice state for a specific ID."""
    if voice_id in voice_cache:
        return voice_cache[voice_id]
    
    voice_path = VOICES_DIR / f"{voice_id}.wav"
    if not voice_path.exists():
        # Fallback to any wav if requested not found
        any_wav = next(VOICES_DIR.glob("*.wav"), None)
        if any_wav:
            voice_path = any_wav
        else:
            return None

    try:
        if tts_model:
            state = tts_model.get_state_for_audio_prompt(str(voice_path))
            voice_cache[voice_id] = state
            return state
    except Exception as e:
        print(f"[WARNING] Voice load failed ('{voice_id}'): {e}")
    return None

class TTSSpeechRequest(BaseModel):
    input: str
    voice: str = "default"
    response_format: str = "mp3"
    speed: float = 1.0

@app.post("/v1/audio/speech")
async def create_speech(request: TTSSpeechRequest):
    """OpenAI-compatible speech generation endpoint."""
    if not tts_model:
        raise HTTPException(status_code=503, detail="TTS Model not initialized.")
    
    voice_state = get_voice_state(request.voice)
    if not voice_state:
        raise HTTPException(status_code=400, detail=f"Voice '{request.voice}' not found and no defaults available.")

    try:
        # 1. Generate Raw Audio
        audio = tts_model.generate_audio(voice_state, request.input)
        audio_np = audio.numpy()

        # 2. To WAV in memory
        wav_buffer = io.BytesIO()
        scipy.io.wavfile.write(wav_buffer, tts_model.sample_rate, audio_np)
        wav_buffer.seek(0)
        audio_data = wav_buffer.read()

        # 3. Optional MP3 conversion
        if request.response_format == "mp3" and PYDUB_AVAILABLE:
            audio_seg = AudioSegment.from_wav(io.BytesIO(audio_data))
            mp3_buffer = io.BytesIO()
            audio_seg.export(mp3_buffer, format="mp3")
            mp3_buffer.seek(0)
            audio_data = mp3_buffer.read()

        return StreamingResponse(
            io.BytesIO(audio_data),
            media_type=f"audio/{request.response_format}",
            headers={"Content-Disposition": f"attachment; filename=speech.{request.response_format}"}
        )
    except Exception as e:
        print(f"[ERROR] Speech generation failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/v1/audio/voices")
async def list_voices():
    """List all cloned voices available on the server."""
    voices = []
    for f in VOICES_DIR.glob("*.wav"):
        voices.append({
            "voice_id": f.stem,
            "name": f.stem.replace("-", " ").title(),
            "type": "cloned"
        })
    return {"voices": voices}

@app.post("/api/voices/upload")
async def upload_voice(file: UploadFile = File(...), name: str = Form(...)):
    """Upload a new voice prompt for cloning."""
    safe_name = "".join(c for c in name if c.isalnum() or c in "-_").lower()
    save_path = VOICES_DIR / f"{safe_name}.wav"
    
    content = await file.read()
    with open(save_path, "wb") as f:
        f.write(content)
    
    # Invalidate cache
    if safe_name in voice_cache:
        del voice_cache[safe_name]
        
    return {"status": "success", "voice_id": safe_name}

@app.get("/health")
async def health():
    return {"status": "ok", "tts": tts_model is not None}

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8000)
