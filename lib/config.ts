import { resolve } from "node:path";

/**
 * Global application configuration
 */
export const CONFIG = {
	API_BASE: process.env.API_BASE || "http://localhost:8000/v1",
	API_EMBEDDING_URL:
		process.env.API_EMBEDDING_URL || "http://localhost:8889/v1/embeddings",
	MODEL: process.env.MODEL || "gpt-oss-120b",
	DEFAULT_PROMPT: process.env.SYSTEM_PROMPT ?? "I am a helpful AI assistant.",
	HISTORY_DIR: "history",
	RAG_ENABLED: process.env.RAG_ENABLED === "true",
	VECTOR_DIMENSION: parseInt(process.env.POSTGRES_VECTOR_DIM || "768", 10),
	TTS_ENABLED: process.env.TTS_ENABLED === "true",
	TTS_URL: process.env.TTS_URL || "http://localhost:8000",
	TTS_VOICE: process.env.TTS_VOICE || "joe-biden",
	WORKSPACE: resolve(process.env.WORKSPACE || "./workspace"),
	PG: {
		host: process.env.POSTGRES_HOST || "localhost",
		port: parseInt(process.env.POSTGRES_PORT || "5432", 10),
		database: process.env.POSTGRES_DB || "vectordb",
		user: process.env.POSTGRES_USER || "vectoruser",
		password: process.env.POSTGRES_PASSWORD || "vectorpass",
	},
};

/**
 * Generates a dynamic system prompt with the current time and workspace state.
 */
export function getSystemPrompt(base?: string) {
	const prompt = `${base || CONFIG.DEFAULT_PROMPT}

You are an agentic AI assistant with access to the user's workspace via specialized tools:
- read_file(path): Read contents from the workspace.
- write_file(path, content): Create or update files in the workspace.
- run_command(command): Execute shell commands inside the workspace.

Current Workspace: ${CONFIG.WORKSPACE}
Use these tools whenever the user asks for file or system operations.
Be transparent and include relevant technical outputs (like shell STDOUT/STDERR) in your responses when appropriate.
Current time: ${new Date().toLocaleString()}.`;
	return prompt;
}
