import { basename } from "node:path";
import { clr } from "./colors";
import { CONFIG, getSystemPrompt } from "./config";
import { rag } from "./rag";
import {
	deleteSession,
	listSessions,
	loadHistory,
	saveHistory,
} from "./session";
import type { ChatMessage } from "./types";

export interface ChatState {
	messages: ChatMessage[];
	sessionName: string | null;
	readonly historyDir: string;
}

export type CommandResult = "continue" | "break" | "none";

/**
 * Handles slash commands. Returns an action for the main loop.
 */
export async function handleCommand(
	input: string,
	state: ChatState,
): Promise<CommandResult> {
	if (!input.startsWith("/")) return "none";

	const parts = input.split(" ");
	const cmd = (parts[0] || "").toLowerCase();
	if (!cmd) return "none";
	const args = parts.slice(1);

	if (cmd === "/help") {
		console.log(
			`${clr.system("\n--- Commands ---")}\n/help           - This menu\n/info           - Session status\n/sessions       - List available histories\n/load <name>    - Switch conversation\n/del <name>     - Delete a session\n/voice          - Toggle TTS voice\n/add-rag <url>  - Index a website\n/del-rag <url>  - Remove indexed content\n/list-rag       - Show indexed docs & hotwords\n/system <p>     - Change persona\n/clear          - Reset context\n/save           - Force save\n/exit           - Quit\n`,
		);
		return "continue";
	}

	if (cmd === "/sessions") {
		const sessions = await listSessions(state.historyDir);
		if (sessions.length === 0) {
			console.log(`${clr.warn("\nNo sessions found.")}\n`);
		} else {
			console.log(`${clr.system("\n--- Available Sessions ---")}`);
			sessions.forEach((s) => {
				console.log(`- ${s}`);
			});
			console.log("");
		}
		return "continue";
	}

	if (cmd === "/load") {
		const nameArg = args[0];
		if (!nameArg) {
			console.log(
				`${clr.error("Provide a session name. Example: /load home")}\n`,
			);
			return "continue";
		}
		const name = basename(nameArg);

		const loaded = await loadHistory(name, state.historyDir, getSystemPrompt());
		state.messages.splice(0, state.messages.length, ...loaded);
		state.sessionName = name;

		console.log(
			`${clr.user(`\n[Session '${name}' loaded (${state.messages.length} messages)]`)}\n`,
		);
		return "continue";
	}

	if (cmd === "/del" || cmd === "/delete") {
		const nameArg = args[0];
		if (!nameArg) {
			console.log(
				`${clr.error("Provide a session name. Example: /del home")}\n`,
			);
			return "continue";
		}
		const name = basename(nameArg);

		try {
			await deleteSession(name, state.historyDir);
			if (state.sessionName === name) {
				state.sessionName = null; // Revert to volatile if deleted current
			}
			console.log(`${clr.warn(`\n[Session '${name}' deleted]`)}\n`);
		} catch (err) {
			console.log(
				`${clr.error(`\n${err instanceof Error ? err.message : err}`)}\n`,
			);
		}
		return "continue";
	}

	if (cmd === "/info") {
		console.log(
			`${clr.system(`\n[Session: ${state.sessionName || "None (Volatile)"}]`)}\n[Model: ${CONFIG.MODEL}]\n[Context: ${state.messages.length} messages]\n`,
		);
		return "continue";
	}

	if (cmd === "/system") {
		const newPrompt = args.join(" ");
		if (!newPrompt) {
			console.log(
				`${clr.error("Provide a prompt. Example: /system You are a pirate.")}\n`,
			);
			return "continue";
		}
		if (state.messages[0]) {
			state.messages[0].content = getSystemPrompt(newPrompt);
			console.log(`${clr.warn("\nSystem prompt updated.")}\n`);
		}
		return "continue";
	}

	if (cmd === "/clear") {
		state.messages.splice(0, state.messages.length, {
			role: "system",
			content: getSystemPrompt(),
		});
		console.log(`${clr.warn("\nContext cleared.")}\n`);
		return "continue";
	}

	if (cmd === "/voice") {
		CONFIG.TTS_ENABLED = !CONFIG.TTS_ENABLED;
		console.log(
			`${clr.warn(`\n[Voice output: ${CONFIG.TTS_ENABLED ? "ENABLED" : "DISABLED"}]`)}\n`,
		);
		return "continue";
	}

	if (cmd === "/save") {
		if (!state.sessionName) {
			console.log(
				`${clr.error("\nNo session active. Use -s to enable saving.")}\n`,
			);
			return "continue";
		}
		await saveHistory(state.sessionName, state.historyDir, state.messages);
		console.log(`${clr.warn("\nSaved.")}\n`);
		return "continue";
	}

	if (cmd === "/add-rag") {
		if (!CONFIG.RAG_ENABLED) {
			console.log(`${clr.warn("RAG is currently disabled in .env")}\n`);
			return "continue";
		}
		const url = args[0];
		if (!url) {
			process.stdout.write(`${clr.warn("Usage: /add-rag <url|path>")}\n`);
			return "continue";
		}
		process.stdout.write(`${clr.system(`Indexing ${url}...`)} `);
		try {
			// Ensure initialized
			await rag.init();
			const count = await rag.indexSource(url);
			process.stdout.write(`${clr.warn(`Done. [${count} chunks indexed]`)}\n`);
		} catch (err) {
			process.stdout.write(
				`${clr.error(`Failed: ${err instanceof Error ? err.message : err}`)}\n`,
			);
		}
		return "continue";
	}

	if (cmd === "/list-rag") {
		if (!CONFIG.RAG_ENABLED) {
			console.log(`${clr.warn("RAG is currently disabled in .env")}\n`);
			return "continue";
		}
		const sources = await rag.listSources();
		console.log(`${clr.system("\n--- Indexed Knowledge ---")}`);
		if (sources.length === 0) {
			console.log("No documents indexed.");
		} else {
			for (const s of sources) {
				console.log(`- ${s}`);
			}
		}

		const kws = Array.from(await rag.getKeywords());
		console.log(`${clr.system("\n--- Active Hotwords ---")}`);
		if (kws.length === 0) {
			console.log("No technical terms mapped.");
		} else {
			console.log(kws.join(", "));
		}
		console.log("");
		return "continue";
	}

	if (cmd === "/del-rag") {
		if (!CONFIG.RAG_ENABLED) {
			console.log(`${clr.warn("RAG is currently disabled in .env")}\n`);
			return "continue";
		}
		const url = args[0];
		if (!url) {
			process.stdout.write(`${clr.warn("Usage: /del-rag <url|path>")}\n`);
			return "continue";
		}
		try {
			await rag.deleteSource(url);
			console.log(
				`${clr.warn(`\n[Knowledge Source '${url}' purged from RAG]`)}\n`,
			);
		} catch (err) {
			process.stdout.write(
				`${clr.error(`Failed: ${err instanceof Error ? err.message : err}`)}\n`,
			);
		}
		return "continue";
	}

	if (cmd === "/exit" || cmd === "/quit") return "break";

	console.log(`${clr.error("Unknown command. Type /help")}\n`);
	return "continue";
}
