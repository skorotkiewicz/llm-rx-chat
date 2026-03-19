import { mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import { basename, extname, join } from "node:path";
import { decode, stringify } from "@creationix/rx";
import type { ChatMessage } from "./types";

/**
 * Lists all existing .rx session files in the history directory.
 */
export async function listSessions(historyDir: string): Promise<string[]> {
	try {
		await mkdir(historyDir, { recursive: true });
		const files = await readdir(historyDir);
		return files
			.filter((f) => extname(f) === ".rx")
			.map((f) => basename(f, ".rx"));
	} catch {
		return [];
	}
}

/**
 * Loads and converts a REXC history file into a mutable JS array.
 */
export async function loadHistory(
	sessionName: string,
	historyDir: string,
	defaultContent: string,
): Promise<ChatMessage[]> {
	const path = join(historyDir, `${sessionName}.rx`);
	await mkdir(historyDir, { recursive: true });
	try {
		const data = await readFile(path);
		const loaded = decode(data);
		if (Array.isArray(loaded)) {
			// Convert read-only Proxy to mutable array
			return JSON.parse(JSON.stringify(loaded));
		}
	} catch {
		// Silent catch for new sessions
	}
	return [{ role: "system", content: defaultContent }];
}

/**
 * Persists history using REXC binary format.
 */
export async function saveHistory(
	sessionName: string,
	historyDir: string,
	messages: ChatMessage[],
) {
	const path = join(historyDir, `${sessionName}.rx`);
	await writeFile(path, stringify(messages));
}
