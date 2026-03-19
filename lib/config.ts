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
	PG: {
		host: process.env.POSTGRES_HOST || "localhost",
		port: parseInt(process.env.POSTGRES_PORT || "5432", 10),
		database: process.env.POSTGRES_DB || "vectordb",
		user: process.env.POSTGRES_USER || "vectoruser",
		password: process.env.POSTGRES_PASSWORD || "vectorpass",
	},
};

/**
 * Generates a dynamic system prompt with the current time.
 */
export function getSystemPrompt(base?: string) {
	return `${base || CONFIG.DEFAULT_PROMPT}\n\nCurrent time: ${new Date().toLocaleString()}.`;
}
