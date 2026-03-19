import * as readline from "node:readline/promises";
import { stringify } from "@creationix/rx";

// Configuration - matches your requested endpoint
const API_BASE = "http://192.168.0.124:8888/v1";
const SYSTEM_PROMPT = "You are a helpful AI assistant.";
const MODEL = "gpt-3.5-turbo"; // or the ID of your local model

interface ChatMessage {
	role: "system" | "user" | "assistant";
	content: string;
}

async function startChat() {
	const rl = readline.createInterface({
		input: process.stdin,
		output: process.stdout,
	});

	const messages: ChatMessage[] = [{ role: "system", content: SYSTEM_PROMPT }];

	console.log(
		"\x1b[1;35m--- LLM Chat (Type 'exit' or 'quit' to end) ---\x1b[0m\n",
	);

	try {
		while (true) {
			const prompt = await rl.question("\x1b[1;32mUser:\x1b[0m ");

			if (
				prompt.toLowerCase() === "exit" ||
				prompt.toLowerCase() === "quit" ||
				prompt.toLowerCase() === "q"
			) {
				console.log("\n\x1b[1;35mGoodbye!\x1b[0m");
				break;
			}

			if (!prompt.trim()) continue;

			messages.push({ role: "user", content: prompt });

			const response = await fetch(`${API_BASE}/chat/completions`, {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					model: MODEL,
					messages,
					stream: true,
				}),
			});

			if (!response.body) {
				throw new Error("API returned an empty body.");
			}

			process.stdout.write("\x1b[1;36mAI:\x1b[0m ");

			const reader = response.body.getReader();
			const decoder = new TextDecoder();
			let buffer = "";
			let fullAssistantResponse = "";

			while (true) {
				const { done, value } = await reader.read();
				if (done) break;

				// Decode the raw chunk and add to buffer
				buffer += decoder.decode(value, { stream: true });

				// Process lines (OpenAI streams are data-only SSE)
				const lines = buffer.split("\n");
				buffer = lines.pop() || "";

				for (const line of lines) {
					const trimmed = line.trim();
					if (!trimmed || trimmed === "data: [DONE]") continue;

					if (trimmed.startsWith("data: ")) {
						try {
							const data = JSON.parse(trimmed.slice(6));
							const token = data.choices[0]?.delta?.content;

							if (token) {
								/**
								 * WE USE @creationix/rx HERE:
								 * Filtered stream to remove metadata numbers while keeping stringify pattern.
								 */
								stringify(token, {
									onChunk: (chunk) => {
										if (!chunk.startsWith(",")) {
											process.stdout.write(chunk);
										}
									},
								});
								fullAssistantResponse += token;
							}
						} catch {
							// Partial JSON chunk, skip
						}
					}
				}
			}

			messages.push({ role: "assistant", content: fullAssistantResponse });
			process.stdout.write("\n\n");
		}
	} catch (error) {
		console.error(
			"\x1b[1;31mError:\x1b[0m",
			error instanceof Error ? error.message : error,
		);
	} finally {
		rl.close();
	}
}

// Start the interactive session
startChat();
