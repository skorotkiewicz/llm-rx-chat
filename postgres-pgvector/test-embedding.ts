import { CONFIG } from "../lib/config";

async function main() {
	console.log(`Connecting to: ${CONFIG.API_EMBEDDING_URL}`);
	try {
		const res = await fetch(CONFIG.API_EMBEDDING_URL, {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({
				input: "Hello world",
				model: "text-embedding-3-small",
			}),
		});

		const data = (await res.json()) as {
			data: { embedding: number[] }[];
		};
		const len = data.data?.[0]?.embedding?.length || 0;
		console.log(`Success! Embedding length: ${len}`);
	} catch (err) {
		console.error(`Failed: ${err instanceof Error ? err.message : err}`);
		console.log(
			"\nHelp: Check if your Embedding Server is running and reachable.",
		);
	}
}

main();
