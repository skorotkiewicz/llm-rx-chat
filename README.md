# llm-rx-chat

An elegant LLM chat interface featuring high-performance binary session persistence via [REXC](https://github.com/creationix/rx).

## Features

- **Continuous Sessions**: Interactive terminal-based chat with conversation memory.
- **REXC Persistence**: High-velocity binary storage for session history using `@creationix/rx`.
- **Autonomous RAG**: Private knowledge search using `pgvector` with smart selective retrieval—it triggers only for technical topics it has automatically learned from your docs.
- **Real-Time Voice**: High-fidelity Text-to-Speech integration for seamless conversational flow.
- **Slash Commands**: Workspace control via `/load`, `/voice`, `/add-rag`, `/list-rag`, `/del-rag`, `/system`, etc.
- **Pure Streaming**: Real-time token output with metadata filtering for clean reading.
- **Flexible & Lightweight**: Built for Bun and compatible with any OpenAI-compatible API.

## Installation

```bash
bun install
```

## Usage

### Simple Chat
Start a new conversation:
```bash
bun index.ts
```

### Managed Sessions
Load, switch, or save specific sessions (`history/<name>.rx`):
```bash
bun index.ts -s my-research
```

### Integrated Commands
Use slash commands directly in the chat to manage your workspace:
- `/add-rag <url|path>`: Index source into vector store.
- `/del-rag <url|path>`: Purge a specific source from RAG.
- `/list-rag`: View all indexed document sources and active "Hotwords."
- `/voice`: Toggle real-time speech output on/off.
- `/sessions`: List all available conversation histories.
- `/load <name>`: Switch conversation context instantly.
- `/system <prompt>`: Update the AI's persona.
- `/info`: View context and model status.

## Database Setup (pgvector)
Run the following to start the private knowledge store:
```bash
# 1. Build the vector engine (from postgres-pgvector/)
docker build -t postgres-pgvector .

# 2. Start the container
docker run -d --name pg-vector-chat -p 5432:5432 postgres-pgvector

# 3. Control the container
docker start/stop/restart pg-vector-chat
```

## Voice Setup (Pocket TTS)
Run the following to start the dedicated speech engine:
```bash
# 1. Enter the server directory
cd tts-server

# 2. Sync dependencies
uv sync

# 3. Start the Speech Hub
uv run main.py
```
*(Requires `mpv` installed on the system for playback)*

## Configuration
Create a `.env` file with these exact keys:
```env
API_BASE=http://localhost:8000/v1
MODEL=local
SYSTEM_PROMPT="Assistant."

# RAG Configuration
RAG_ENABLED=true             # Set to false to disable RAG completely
API_EMBEDDING_URL=http://localhost:8889/v1/embeddings
POSTGRES_VECTOR_DIM=768      # Vector dimension (e.g. 768 or 1536)
POSTGRES_HOST=localhost
POSTGRES_PORT=5432
POSTGRES_DB=vectordb
POSTGRES_USER=vectoruser
POSTGRES_PASSWORD=vectorpass

# TTS Configuration
TTS_ENABLED=false            # Set to true for auto-voice responses
TTS_URL=http://localhost:8000
TTS_VOICE=joe-biden          # Available: 'donald-trump', 'joe-biden'
```

---
*Powered by @creationix/rx and pgvector for zero-friction LLM interactions.*