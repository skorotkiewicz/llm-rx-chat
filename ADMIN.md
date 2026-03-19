# ADMIN

### Setup (Ground Up)
```bash
# System Deps (Linux)
sudo apt install mpv postgresql

# Project Dependencies
bun install

# TTS Backend Setup
cd tts-server && uv sync
```

### Infrastructure (Run)
```bash
# 1. Start TTS Engine
cd tts-server && uv run main.py

# 2. Launch AI (Default /workspace room)
bun index.ts

# 3. Launch AI (Custom path)
bun index.ts -w ./my-project
```

### Emergency / Stop
```bash
# Silence Voice
pkill mpv

# Kill AI & Voice
pkill -f index.ts && pkill mpv
```

### Workspace Logic
```bash
# Reset Sandbox
rm -rf workspace/*

# Re-Sync Room Logic (if copied lib)
sed -i 's|"./|"../lib/|g' workspace/*.ts
```

### In-Chat Commands
- `/voice` - Toggle TTS
- `/add-rag <url>` - Index Site
- `/list-rag` - Show Knowledge
- `/delete_file <path>` - Remove file
- `/web_search <query>` - Browse DuckDuckGo
- `/clear` - Reset context
- `/save` - Save history
