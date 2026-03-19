/**
 * OpenAI-compatible Tool Call structure.
 */
export interface ToolCall {
	id?: string;
	index?: number;
	type?: "function";
	function?: {
		name?: string;
		arguments?: string;
	};
}

/**
 * A specialized version for when the tool call is fully assembled.
 */
export interface CompleteToolCall extends ToolCall {
	id: string;
	type: "function";
	function: {
		name: string;
		arguments: string;
	};
}

/**
 * Core conversation message structure.
 */
export interface ChatMessage {
	role: "system" | "user" | "assistant" | "tool";
	content: string;
	name?: string;
	tool_call_id?: string;
	tool_calls?: ToolCall[];
}
