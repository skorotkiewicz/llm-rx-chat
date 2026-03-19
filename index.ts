import * as readline from "node:readline/promises";
import { clr } from "./lib/colors";
import { type ChatState, handleCommand } from "./lib/commands";
import { CONFIG, getSystemPrompt } from "./lib/config";
import { rag } from "./lib/rag";
import { loadHistory, saveHistory } from "./lib/session";
import { iterTokens, rxWrite } from "./lib/stream";
import { speak } from "./lib/tts";

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
		for (const w of extracted) {
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
						for (const w of extracted) {
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

			const response = await fetch(`${CONFIG.API_BASE}/chat/completions`, {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					model: CONFIG.MODEL,
					messages: apiMessages,
					stream: true,
					stop: ["<|im_end|>"],
				}),
			});

			if (!response.body || !response.ok) {
				throw new Error(`API Error: ${response.statusText}`);
			}

			process.stdout.write(`${clr.ai("AI:")} `);

			let fullAssistantResponse = "";
			let sentenceBuffer = "";
			for await (const token of iterTokens(response)) {
				rxWrite(token);
				fullAssistantResponse += token;
				sentenceBuffer += token;

				// Speak on sentence end but don't block
				const isSentenceEnd = /[.!?\n]/.test(token);
				if (isSentenceEnd) {
					const s = sentenceBuffer.trim();
					// Ignore common short abbreviations to prevent choppy speech
					const isAbbreviation =
						/\b(mr|ms|mrs|dr|prof|vs|st|rd|oz|kg|lb)\.$/i.test(s);
					if (s.length > 5 && !isAbbreviation) {
						speak(s); // Background task
						sentenceBuffer = "";
					}
				}
			}

			// Final flush
			if (sentenceBuffer.trim()) {
				speak(sentenceBuffer.trim());
			}

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
