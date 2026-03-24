import { existsSync, mkdirSync } from "node:fs";
import { dirname, relative, resolve } from "node:path";
import { CONFIG } from "./config";

/**
 * Securely resolves a path within the workspace
 */
function resolvePath(p: string): string {
	const absolutePath = resolve(CONFIG.WORKSPACE, p);
	const rel = relative(CONFIG.WORKSPACE, absolutePath);
	if (rel.startsWith("..") || rel.startsWith("/")) {
		throw new Error(
			`Permission Denied: Path is outside workspace boundaries (${p})`,
		);
	}
	return absolutePath;
}

/**
 * Tool Implementations
 */
export const TOOLS = {
	read_file: async ({ path }: { path: string }) => {
		const fullPath = resolvePath(path);
		if (!existsSync(fullPath)) return `Error: File not found: ${path}`;
		return await Bun.file(fullPath).text();
	},
	write_file: async ({ path, content }: { path: string; content: string }) => {
		const fullPath = resolvePath(path);
		const parent = dirname(fullPath);
		if (!existsSync(parent)) {
			mkdirSync(parent, { recursive: true });
		}
		await Bun.write(fullPath, content);
		return `Success: Wrote to ${path}`;
	},
	run_command: async ({ command }: { command: string }) => {
		if (command.includes("..") || command.trim().startsWith("/")) {
			return "Permission Denied: Command is restricted to workspace.";
		}
		try {
			const proc = Bun.spawn(["sh", "-c", command], {
				cwd: CONFIG.WORKSPACE,
			});
			const out = await new Response(proc.stdout).text();
			const err = await new Response(proc.stderr).text();
			return `[STDOUT]\n${out}\n[STDERR]\n${err}`;
		} catch (e) {
			return `Error: ${e instanceof Error ? e.message : String(e)}`;
		}
	},
	delete_file: async ({ path }: { path: string }) => {
		const fullPath = resolvePath(path);
		if (!existsSync(fullPath)) return `Error: File not found: ${path}`;
		const { rmSync } = await import("node:fs");
		rmSync(fullPath);
		return `Success: Deleted ${path}`;
	},
	web_search: async ({ query }: { query: string }) => {
		try {
			const { load } = await import("cheerio");
			const url = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`;
			const response = await fetch(url, {
				headers: { "User-Agent": "Mozilla/5.0" },
			});
			const html = await response.text();
			const $ = load(html);
			const results: string[] = [];
			$(".result")
				.slice(0, 5)
				.each((i, el) => {
					const title = $(el).find(".result__title").text().trim();
					const snippet = $(el).find(".result__snippet").text().trim();
					const link = $(el).find(".result__url").text().trim();
					results.push(`[${i + 1}] ${title}\n${snippet}\nLink: ${link}`);
				});
			return results.length > 0 ? results.join("\n\n") : "No results found.";
		} catch (e) {
			return `Error: ${e instanceof Error ? e.message : String(e)}`;
		}
	},
	speak: async ({ text }: { text: string }) => {
		const { speak: ttsSpeak } = await import("./tts");
		await ttsSpeak(text);
		return `Success: Spoke "${text}"`;
	},
};

/**
 * Tool Definitions
 */
export const TOOL_DEFINITIONS = [
	{
		type: "function",
		function: {
			name: "read_file",
			description: "Read a file from the workspace",
			parameters: {
				type: "object",
				properties: { path: { type: "string" } },
				required: ["path"],
			},
		},
	},
	{
		type: "function",
		function: {
			name: "write_file",
			description: "Write content to a file",
			parameters: {
				type: "object",
				properties: { path: { type: "string" }, content: { type: "string" } },
				required: ["path", "content"],
			},
		},
	},
	{
		type: "function",
		function: {
			name: "run_command",
			description: "Run a shell command",
			parameters: {
				type: "object",
				properties: { command: { type: "string" } },
				required: ["command"],
			},
		},
	},
	{
		type: "function",
		function: {
			name: "delete_file",
			description: "Delete a file",
			parameters: {
				type: "object",
				properties: { path: { type: "string" } },
				required: ["path"],
			},
		},
	},
	{
		type: "function",
		function: {
			name: "web_search",
			description: "Search the web",
			parameters: {
				type: "object",
				properties: { query: { type: "string" } },
				required: ["query"],
			},
		},
	},
	{
		type: "function",
		function: {
			name: "speak",
			description: "Vocalize text using the TTS system.",
			parameters: {
				type: "object",
				properties: { text: { type: "string" } },
				required: ["text"],
			},
		},
	},
];
