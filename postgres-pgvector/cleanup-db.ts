import pg from "pg";

const { Pool } = pg;

import { CONFIG } from "../lib/config";

async function main() {
	const pool = new Pool(CONFIG.PG);
	const client = await pool.connect();
	try {
		console.log("Cleanup: Dropping knowledge table 'rag_documents'...");
		await client.query("DROP TABLE IF EXISTS rag_documents CASCADE;");
		console.log("Cleanup: Knowledge store has been reset.");
		process.exit(0);
	} catch (err) {
		console.error("Cleanup failed:", err instanceof Error ? err.message : err);
		process.exit(1);
	} finally {
		client.release();
		await pool.end();
	}
}

main();
