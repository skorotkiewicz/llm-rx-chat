import { CONFIG } from "./config";

let speakQueue = Promise.resolve();

/**
 * Handles Text-to-Speech output via local player
 */
export function speak(text: string): Promise<void> {
	if (!CONFIG.TTS_ENABLED || !text.trim()) return Promise.resolve();

	// Push task to the queue to ensure sequential playback
	speakQueue = speakQueue.then(async () => {
		try {
			const res = await fetch(`${CONFIG.TTS_URL}/v1/audio/speech`, {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					input: text,
					voice: CONFIG.TTS_VOICE,
					response_format: "mp3",
				}),
			});

			if (!res.ok) throw new Error(`TTS API Error: ${res.statusText}`);

			const buffer = await res.arrayBuffer();

			const proc = Bun.spawn(["mpv", "--no-video", "--no-terminal", "-"], {
				stdin: new Uint8Array(buffer),
				stdout: "ignore",
				stderr: "ignore",
			});
			await proc.exited;
		} catch {
			// Silent fail for background tasks
		}
	});

	return speakQueue;
}
