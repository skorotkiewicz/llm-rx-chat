/**
 * Core conversation message structure.
 */
export interface ChatMessage {
	role: "system" | "user" | "assistant";
	content: string;
}
