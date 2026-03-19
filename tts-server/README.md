# 🎙️ Pocket TTS Hub

A high-performance, real-time Text-to-Speech (TTS) server featuring high-fidelity voice cloning using [pocket-tts](https://github.com/kyutai-labs/pocket-tts). This server is designed as a dedicated audio engine for the **llm-rx-chat** project.

## ✨ Features

- **OpenAI Compatible**: Drop-in support for any application expecting `/v1/audio/speech`.
- **High-Fidelity Cloning**: Clone any voice with just 20 seconds of audio.
- **Sequential Playback**: Sentence-by-sentence streaming for natural interaction.
- **REST API**: Simple endpoints for voice listing and model management.

## 🚀 Quick Start

### 1. Installation
Install and sync the required Python dependencies:
```bash
uv sync
```

### 2. Prepare Voices
Place WAV samples (15-20 seconds) in the `voices-celebrities/` directory. Each file name becomes the `voice_id`.

### 3. Launch
Start the Speech Hub using uv:
```bash
uv run main.py
```

## 🔌 API Endpoints

- **POST `/v1/audio/speech`**: Standard Text-to-Speech generation.
- **GET `/v1/audio/voices`**: List all available voice personas.
- **POST `/api/voices/upload`**: Upload new samples for instant cloning.
- **GET `/health`**: Verify server and model status.

---
*Optimized for real-time LLM response reading.*
