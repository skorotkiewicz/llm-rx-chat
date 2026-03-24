# LLM-RX-CHAT

A terminal-based AI chat application powered by Bun and Pocket TTS. With a fully autonomous Agentic Workspace with secure tool-execution logic.

## Key Features
- Agentic Tools: Autonomous read_file, write_file, delete_file, run_command, and **web_search**.
- Secure Sandbox: Every action is strictly confined to a designated workspace/ room with built-in path-traversal guards.
- Pocket TTS: Low-latency, human-like voice responses with voice-cloning capabilities based on Kokoro-82M.
- RAG-Ready: Integrated document indexing and similarity search using PostgreSQL and pgvector.
- History Sync: Persistent conversation history for multi-session Memory.

## Setup (Ground Up)

### System Dependency (Arch Linux)
```bash
sudo pacman -S mpv
```

### Project Dependencies
Install the main chat client and sync the speech backend:
```bash
# Chat Client (Bun)
bun install

# Speech Server (Python + uv)
cd tts-server
uv sync
uv run main.py
```

### 2. Launch AI (within its room)
In your main project folder:
```bash
# Start (default ./workspace)
bun index.ts -w workspace

# Start with a session (./history/<session-name>)
bun index.ts -s <session-name>

# Start with a session and workspace
bun index.ts -s <session-name> -w <workspace>
```

## Configuration (.env)
Create a .env in the root:
```env
API_BASE=http://localhost:8000/v1
MODEL=local

# Agentic Persona
SYSTEM_PROMPT="You are Lucifer... Tired, clever, occasionally moody... You have surgical TOOLS to read, write, and delete files."

# Workspace Path
WORKSPACE=./workspace

# TTS Configuration
TTS_ENABLED=false
TTS_URL=http://localhost:8000
TTS_VOICE=joe-biden

# RAG Configuration
RAG_ENABLED=false
API_EMBEDDING_URL=http://localhost:8889/v1/embeddings
POSTGRES_VECTOR_DIM=768
POSTGRES_DB=vectordb
POSTGRES_USER=vectoruser
POSTGRES_PASSWORD=vectorpass
```

## Admin & CRUD
See ADMIN.md for specialized recovery strings, including:
- pkill mpv - Immediate voice silence
- /delete_file <path> - Remove project data
- sed room-sync logic for restricted enclaves

---
*Built with rhythmic precision and high-performance logic.*
