import * as readline from "node:readline/promises";
import { clr } from "./lib/colors";
import { type ChatState, handleCommand } from "./lib/commands";
import { CONFIG, getSystemPrompt } from "./lib/config";
import { loadHistory, saveHistory } from "./lib/session";
import { iterTokens, rxWrite } from "./lib/stream";

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
				if (cmdAction === "continue") continue;
			}

			state.messages.push({ role: "user", content: input });

			const response = await fetch(`${CONFIG.API_BASE}/chat/completions`, {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					model: CONFIG.MODEL,
					messages: state.messages,
					stream: true,
					stop: ["<|im_end|>"],
				}),
			});

			if (!response.body || !response.ok) {
				throw new Error(`API Error: ${response.statusText}`);
			}

			process.stdout.write(`${clr.ai("AI:")} `);

			let fullAssistantResponse = "";
			for await (const token of iterTokens(response)) {
				rxWrite(token);
				fullAssistantResponse += token;
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
		rl.close();
	}
}

startChat();
