import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import * as readline from "node:readline/promises";
import { decode, stringify } from "@creationix/rx";

// Configuration
const API_BASE = "http://192.168.0.124:8888/v1";
const SYSTEM_PROMPT = "You are a helpful AI assistant.";
const MODEL = "gpt-3.5-turbo";

interface ChatMessage {
	role: "system" | "user" | "assistant";
	content: string;
}

// Parse session flag
const sessionArgIndex = process.argv.indexOf("-s");
const sessionName =
	sessionArgIndex !== -1 ? process.argv[sessionArgIndex + 1] : null;
const historyDir = "history";
const sessionPath = sessionName ? join(historyDir, `${sessionName}.rx`) : null;

async function startChat() {
	const rl = readline.createInterface({
		input: process.stdin,
		output: process.stdout,
	});

	let messages: ChatMessage[] = [{ role: "system", content: SYSTEM_PROMPT }];

	// Load existing session if applicable
	if (sessionPath) {
		await mkdir(historyDir, { recursive: true });
		try {
			const data = await readFile(sessionPath);
			const loaded = decode(data) as ChatMessage[];
			if (Array.isArray(loaded)) {
				// Convert the read-only REXC proxy into a mutable JS array
				messages = JSON.parse(JSON.stringify(loaded));
				console.log(
					`\x1b[1;32m[Session '${sessionName}' loaded (${messages.length} messages)]\x1b[0m\n`,
				);
			}
		} catch {
			console.log(`\x1b[1;33m[Starting new session: ${sessionName}]\x1b[0m\n`);
		}
	}

	console.log(
		"\x1b[1;35m--- LLM Chat (Type 'exit' or 'quit' to end) ---\x1b[0m\n",
	);

	try {
		while (true) {
			const prompt = await rl.question("\x1b[1;32mUser:\x1b[0m ");

			if (
				!prompt ||
				["exit", "quit", "q"].includes(prompt.toLowerCase().trim())
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
			const decoderTool = new TextDecoder();
			let buffer = "";
			let fullAssistantResponse = "";

			while (true) {
				const { done, value } = await reader.read();
				if (done) break;

				buffer += decoderTool.decode(value, { stream: true });
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
							// Skip partial chunks
						}
					}
				}
			}

			messages.push({ role: "assistant", content: fullAssistantResponse });
			process.stdout.write("\n\n");

			// Auto-save session after each exchange
			if (sessionPath) {
				const rxData = stringify(messages);
				await writeFile(sessionPath, rxData);
			}
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

startChat();
