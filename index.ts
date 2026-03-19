import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import * as readline from "node:readline/promises";
import { decode, stringify } from "@creationix/rx";
import { clr } from "./lib/colors";

// Configuration
const API_BASE = process.env.API_BASE || "http://localhost:8000/v1";
const MODEL = process.env.MODEL || "gpt-oss-120b";
const SYSTEM_PROMPT = `${process.env.SYSTEM_PROMPT ?? "You are a helpful AI assistant."}\n\nCurrent time is ${new Date().toLocaleString()}.
`;

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

	// Initialize session
	if (sessionPath) {
		await mkdir(historyDir, { recursive: true });
		try {
			const data = await readFile(sessionPath);
			const loaded = decode(data) as ChatMessage[];
			if (Array.isArray(loaded)) {
				// Convert REXC proxy into mutable JS array
				messages = JSON.parse(JSON.stringify(loaded));
				console.log(
					`${clr.user(`[Session '${sessionName}' loaded (${messages.length} messages)]`)}\n`,
				);
			}
		} catch {
			console.log(`${clr.warn(`[Starting new session: ${sessionName}]`)}\n`);
		}
	}

	console.log(
		`${clr.system("--- LLM Chat (Type 'exit' or 'quit' to end) ---")}\n`,
	);

	try {
		while (true) {
			const prompt = await rl.question(`${clr.user("User:")} `);

			if (
				!prompt ||
				["exit", "quit", "q"].includes(prompt.toLowerCase().trim())
			) {
				console.log(`\n${clr.system("Goodbye!")}`);
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

			if (!response.body) throw new Error("API returned an empty body.");

			process.stdout.write(`${clr.ai("AI:")} `);

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
	} catch (err) {
		console.error(
			`${clr.error("Error:")}`,
			err instanceof Error ? err.message : err,
		);
	} finally {
		rl.close();
	}
}

startChat();
