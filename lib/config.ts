/**
 * Global application configuration
 */
export const CONFIG = {
	API_BASE: process.env.API_BASE || "http://localhost:8000/v1",
	MODEL: process.env.MODEL || "gpt-oss-120b",
	DEFAULT_PROMPT: process.env.SYSTEM_PROMPT ?? "I am a helpful AI assistant.",
	HISTORY_DIR: "history",
};

/**
 * Generates a dynamic system prompt with the current time.
 */
export function getSystemPrompt(base?: string) {
	return `${base || CONFIG.DEFAULT_PROMPT}\n\nCurrent time: ${new Date().toLocaleString()}.`;
}
