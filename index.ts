import { resolve } from "node:path";
import * as readline from "node:readline/promises";
import { clr } from "./lib/colors";
import { type ChatState, handleCommand } from "./lib/commands";
import { CONFIG, getSystemPrompt } from "./lib/config";
import { rag } from "./lib/rag";
import { loadHistory, saveHistory } from "./lib/session";
import { iterTokens, rxWrite } from "./lib/stream";
import { TOOL_DEFINITIONS, TOOLS } from "./lib/tools";
import { speak } from "./lib/tts";
import type { ChatMessage, CompleteToolCall, ToolCall } from "./lib/types";

// Configuration
const historyDir = CONFIG.HISTORY_DIR;

async function startChat() {
	const rl = readline.createInterface({
		input: process.stdin,
		output: process.stdout,
	});

	// Handle graceful exit
	rl.on("SIGINT", () => {
		console.log(`\n${clr.system("Goodbye!")}`);
		process.exit(0);
	});

	// Determine session name (Optional)
	const sIdx = process.argv.indexOf("-s");
	const sessionArg = sIdx !== -1 ? process.argv[sIdx + 1] : undefined;
	const initialSession = sessionArg || null;

	const wIdx = process.argv.indexOf("-w");
	if (wIdx !== -1 && process.argv[wIdx + 1]) {
		CONFIG.WORKSPACE = resolve(process.argv[wIdx + 1] || ".");
		console.log(`${clr.system(`[Workspace set to: ${CONFIG.WORKSPACE}]`)}\n`);
	}

	// Initialize Chat State (Mutable object for modular updates)
	const state: ChatState = {
		sessionName: initialSession,
		historyDir: historyDir,
		messages: [],
	};

	if (state.sessionName) {
		state.messages = await loadHistory(
			state.sessionName,
			state.historyDir,
			getSystemPrompt(),
		);
		console.log(
			`${clr.user(`\n[Session '${state.sessionName}' loaded (${state.messages.length} messages)]`)}\n`,
		);
	} else {
		// First version style: Volatile, in-memory only
		state.messages = [{ role: "system", content: getSystemPrompt() }];
	}

	// Initialize RAG (Optional)
	const hotwords = new Set<string>();
	if (CONFIG.RAG_ENABLED) {
		await rag.init();
		const extracted = await rag.getKeywords();
		for (const w of Array.from(extracted)) {
			hotwords.add(w);
		}
	} else {
		console.log(`${clr.warn("[Status: RAG Intelligence Disabled]")}\n`);
	}

	console.log(`${clr.system("--- LLM Chat (Type /help for commands) ---")}\n`);

	try {
		while (true) {
			const prompt = await rl.question(`${clr.user("User:")} `);
			const input = prompt.trim();

			if (!input) continue;

			// Modular Command Handling
			if (input.startsWith("/")) {
				const cmdAction = await handleCommand(input, state);
				if (cmdAction === "break") break;
				if (cmdAction === "continue") {
					// Reload hotwords in case they changed
					if (CONFIG.RAG_ENABLED) {
						hotwords.clear();
						const extracted = await rag.getKeywords();
						for (const w of Array.from(extracted)) {
							hotwords.add(w);
						}
					}
					continue;
				}
			}

			state.messages.push({ role: "user", content: input });

			// Autonomous RAG (Optional)
			const apiMessages = [...state.messages];
			const inputWords = input.toLowerCase().split(/\s+/);
			const hasHotword = inputWords.some((w) => hotwords.has(w));

			if (CONFIG.RAG_ENABLED && (hasHotword || inputWords.length >= 6)) {
				const context = await rag.search(input);
				if (context.length > 0) {
					process.stdout.write(
						`${clr.system(`[Knowledge Search: Found ${context.length} relevant chunks]`)}\n`,
					);
					const ragContext = `[KNOWLEDGE BASE CONTEXT]\n${context.join("\n---\n")}`;
					apiMessages.splice(apiMessages.length - 1, 0, {
						role: "system",
						content: ragContext,
					});
				}
			}

			let fullAssistantResponse = "";
			let sentenceBuffer = "";

			const callLLM = async (messages: ChatMessage[]): Promise<Response> => {
				const res = await fetch(`${CONFIG.API_BASE}/chat/completions`, {
					method: "POST",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify({
						model: CONFIG.MODEL,
						messages: messages,
						stream: true,
						tools: TOOL_DEFINITIONS,
						tool_choice: "auto",
						stop: ["<|im_end|>"],
					}),
				});
				if (!res.ok) throw new Error(`API Error: ${res.statusText}`);
				return res;
			};

			let currentResponse = await callLLM(apiMessages);
			process.stdout.write(`${clr.ai("AI:")} `);

			while (true) {
				const toolCallMap = new Map<number, ToolCall>();
				fullAssistantResponse = "";

				for await (const token of iterTokens(currentResponse)) {
					if (Array.isArray(token)) {
						for (const tc of token) {
							const idx = tc.index ?? 0;
							let entry = toolCallMap.get(idx);
							if (!entry) {
								entry = {
									id: "",
									type: "function",
									function: { name: "", arguments: "" },
								};
								toolCallMap.set(idx, entry);
							}

							if (tc.id) entry.id = tc.id;
							if (tc.type) entry.type = tc.type;
							const ef = entry.function;
							if (tc.function && ef) {
								if (tc.function.name) ef.name = tc.function.name;
								if (tc.function.arguments) {
									ef.arguments = (ef.arguments || "") + tc.function.arguments;
								}
							}
						}
						continue;
					}

					const t = typeof token === "string" ? token : "";
					rxWrite(t);
					fullAssistantResponse += t;
					sentenceBuffer += t;

					if (CONFIG.TTS_ENABLED) {
						const isSentenceEnd = /[.!?\n]/.test(t);
						if (isSentenceEnd) {
							const s = sentenceBuffer.trim();
							const isAbbreviation =
								/\b(mr|ms|mrs|dr|prof|vs|st|rd|oz|kg|lb)\.$/i.test(s);
							if (s.length > 5 && !isAbbreviation) {
								speak(s);
								sentenceBuffer = "";
							}
						}
					}
				}

				const toolCalls = Array.from(
					toolCallMap.values(),
				) as CompleteToolCall[];
				if (toolCalls.length === 0) break;

				// Process Tools
				const assistantMsg: ChatMessage = {
					role: "assistant",
					content: fullAssistantResponse,
					tool_calls: toolCalls,
				};
				apiMessages.push(assistantMsg);
				state.messages.push(assistantMsg);

				for (const call of toolCalls) {
					if (!call.function) continue;
					const name = call.function.name as keyof typeof TOOLS;
					let args: Record<string, unknown>;
					try {
						args = JSON.parse(call.function.arguments || "{}");
					} catch {
						process.stdout.write(
							`${clr.error(`\n[Failed to parse arguments for ${name}: ${call.function.arguments}]`)}\n`,
						);
						continue;
					}

					process.stdout.write(
						`${clr.system(`\n[Executing ${name}(${JSON.stringify(args)})]`)}\n`,
					);

					const result = await (
						TOOLS[name] as (args: Record<string, unknown>) => Promise<string>
					)(args as Record<string, unknown>);
					const toolMsg: ChatMessage = {
						role: "tool",
						tool_call_id: call.id || "",
						name: name,
						content: result,
					};
					apiMessages.push(toolMsg);
					state.messages.push(toolMsg);
				}

				// Get next turn from AI with tool results
				process.stdout.write(`${clr.ai("\nAI:")} `);
				currentResponse = await callLLM(apiMessages);
			}

			// Final flush
			if (sentenceBuffer.trim()) {
				speak(sentenceBuffer.trim());
			}

			// Add final assistant message content
			state.messages.push({
				role: "assistant",
				content: fullAssistantResponse,
			});
			process.stdout.write("\n\n");

			// Persistent auto-save (Only if in a session)
			if (state.sessionName) {
				await saveHistory(state.sessionName, state.historyDir, state.messages);
			}
		}
	} catch (err) {
		console.error(
			`${clr.error("Error:")}`,
			err instanceof Error ? err.message : err,
		);
	} finally {
		console.log(`\n${clr.system("Goodbye!")}`);
		rl.close();
	}
}

startChat();
