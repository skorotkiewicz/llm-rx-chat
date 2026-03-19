# llm-rx-chat

An elegant LLM chat interface featuring high-performance binary session persistence via [REXC](https://github.com/creationix/rx).

## Features

- **Continuous Sessions**: Interactive terminal-based chat with conversation memory.
- **REXC Persistence**: High-velocity binary storage for session history using `@creationix/rx`.
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
Load or save a specific session to `history/<name>.rx`:
```bash
bun index.ts -s my-research
```

---
*Powered by @creationix/rx for near-zero heap pressure data handling.*
