import { stringify } from "@creationix/rx";

/**
 * Premium LLM Chat using @creationix/rx for reactive streaming output.
 */

// Configuration - matches your requested endpoint
const API_BASE = "http://192.168.0.124:8888/v1";
const SYSTEM_PROMPT = "You are a helpful AI assistant.";
const MODEL = "gpt-3.5-turbo"; // or the ID of your local model

interface ChatMessage {
	role: "system" | "user" | "assistant";
	content: string;
}

async function startChat(prompt: string) {
	const messages: ChatMessage[] = [
		{ role: "system", content: SYSTEM_PROMPT },
		{ role: "user", content: prompt },
	];

	try {
		const response = await fetch(`${API_BASE}/chat/completions`, {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({
				model: MODEL,
				messages,
				stream: true,
			}),
		});

		if (!response.body) {
			throw new Error("API returned an empty body.");
		}

		console.log("\x1b[1;36mAI:\x1b[0m ");

		const reader = response.body.getReader();
		const decoder = new TextDecoder();
		let buffer = "";

		while (true) {
			const { done, value } = await reader.read();
			if (done) break;

			// Decode the raw chunk and add to buffer
			buffer += decoder.decode(value, { stream: true });

			// Process lines (OpenAI streams are data-only SSE)
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
							/**
							 * WE USE @creationix/rx HERE:
							 * We use the stringify onChunk pattern but filter out chunks
							 * starting with the ',' tag to "Remove numbers" from the output.
							 */
							stringify(token, {
								onChunk: (chunk) => {
									if (!chunk.startsWith(",")) {
										process.stdout.write(chunk);
									}
								},
							});
						}
					} catch (e) {
						// Partial JSON chunk, skip and wait for more data
					}
				}
			}
		}
		process.stdout.write("\n\n");
	} catch (error) {
		console.error(
			"\x1b[1;31mError:\x1b[0m",
			error instanceof Error ? error.message : error,
		);
	}
}

// Get prompt from CLI args
const userQuery =
	process.argv.slice(2).join(" ") || "Explain the REXC format briefly.";
console.log(`\x1b[1;32mUser:\x1b[0m ${userQuery}`);
startChat(userQuery);
