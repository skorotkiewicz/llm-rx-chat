import { mkdir, readdir, readFile, unlink, writeFile } from "node:fs/promises";
import { basename, extname, join } from "node:path";
import { decode, stringify } from "@creationix/rx";
import type { ChatMessage } from "./types";

/**
 * Lists all existing .rx session files in the sessions directory.
 */
export async function listSessions(sessionDir: string): Promise<string[]> {
	try {
		await mkdir(sessionDir, { recursive: true });
		const files = await readdir(sessionDir);
		return files
			.filter((f) => extname(f) === ".rx")
			.map((f) => basename(f, ".rx"));
	} catch {
		return [];
	}
}

/**
 * Loads and converts a REXC session history file into a mutable JS array.
 */
export async function loadHistory(
	sessionName: string,
	sessionDir: string,
	defaultContent: string,
): Promise<ChatMessage[]> {
	const path = join(sessionDir, `${sessionName}.rx`);
	await mkdir(sessionDir, { recursive: true });
	try {
		const data = await readFile(path);
		const loaded = decode(data);
		if (Array.isArray(loaded)) {
			// Convert read-only Proxy to mutable array
			return JSON.parse(JSON.stringify(loaded));
		}
	} catch {
		// New session
	}
	return [{ role: "system", content: defaultContent }];
}

/**
 * Persists session history using REXC binary format.
 */
export async function saveHistory(
	sessionName: string,
	sessionDir: string,
	messages: ChatMessage[],
) {
	const path = join(sessionDir, `${sessionName}.rx`);
	await writeFile(path, stringify(messages));
}

/**
 * Permanently deletes a session file.
 */
export async function deleteSession(sessionName: string, sessionDir: string) {
	const path = join(sessionDir, `${sessionName}.rx`);
	try {
		await unlink(path);
	} catch (err) {
		throw new Error(
			`Could not delete session '${sessionName}': ${err instanceof Error ? err.message : err}`,
		);
	}
}
