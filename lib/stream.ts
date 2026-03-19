import { stringify } from "@creationix/rx";

/**
 * SSE Token Parsing
 */
export function parseToken(line: string): string | null {
	if (!line.startsWith("data: ")) return null;
	if (line === "data: [DONE]") return null;
	try {
		const data = JSON.parse(line.slice(6));
		return data.choices[0]?.delta?.content || null;
	} catch {
		return null;
	}
}

/**
 * Async Generator for tokens from a ReadableStream
 */
export async function* iterTokens(response: Response) {
	const reader = response.body?.getReader();
	if (!reader) return;

	const decoder = new TextDecoder();
	let buffer = "";

	while (true) {
		const { done, value } = await reader.read();
		if (done) break;

		buffer += decoder.decode(value, { stream: true });
		const lines = buffer.split("\n");
		buffer = lines.pop() || "";

		for (const line of lines) {
			const token = parseToken(line.trim());
			if (token) yield token;
		}
	}
}

/**
 * Filtered REXC string output
 */
export function rxWrite(s: string) {
	stringify(s, {
		onChunk: (c) => {
			if (!c.startsWith(",")) {
				process.stdout.write(c);
			}
		},
	});
}
