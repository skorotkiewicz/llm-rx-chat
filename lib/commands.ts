import { basename } from "node:path";
import { clr } from "./colors";
import { CONFIG, getSystemPrompt } from "./config";
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

	const [cmd, ...args] = input.toLowerCase().split(" ");

	if (cmd === "/help") {
		console.log(
			`${clr.system("\n--- Commands ---")}\n/help           - This menu\n/info           - Session status\n/sessions       - List available histories\n/load <name>    - Switch conversation\n/del <name>     - Delete a session\n/system <p>     - Change persona\n/clear          - Reset context\n/save           - Force save\n/exit           - Quit\n`,
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

	if (cmd === "/exit" || cmd === "/quit") return "break";

	console.log(`${clr.error("Unknown command. Type /help")}\n`);
	return "continue";
}
