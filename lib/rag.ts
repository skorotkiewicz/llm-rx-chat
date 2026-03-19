import { readFile } from "node:fs/promises";
import * as cheerio from "cheerio";
import pg from "pg";
import { registerType } from "pgvector/pg";
import { clr } from "./colors";
import { CONFIG } from "./config";

const { Pool } = pg;

export class RAG {
	private pool: pg.Pool;
	private initialized = false;

	constructor() {
		this.pool = new Pool(CONFIG.PG);
	}

	/**
	 * Ensures the extension and table exist.
	 */
	async init() {
		if (this.initialized) return;
		const client = await this.pool.connect();
		try {
			await client.query("CREATE EXTENSION IF NOT EXISTS vector");
			await registerType(client);
			await client.query(`
				CREATE TABLE IF NOT EXISTS rag_documents (
					id SERIAL PRIMARY KEY,
					url TEXT,
					content TEXT,
					embedding VECTOR(${CONFIG.VECTOR_DIMENSION})
				);
			`);
			this.initialized = true;
		} finally {
			client.release();
		}
	}

	/**
	 * Generates a vector for a given string.
	 */
	async embed(input: string): Promise<number[]> {
		const res = await fetch(CONFIG.API_EMBEDDING_URL, {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ input, model: "text-embedding-3-small" }),
		});
		const data = (await res.json()) as {
			data: { embedding: number[] }[];
		};
		if (!data.data?.[0]?.embedding) {
			throw new Error("Failed to generate embedding: Invalid API response");
		}
		return data.data[0].embedding;
	}

	/**
	 * Indexes a source (URL or file path).
	 */
	async indexSource(source: string) {
		let text = "";
		if (source.startsWith("http")) {
			const res = await fetch(source);
			const html = await res.text();
			const $ = cheerio.load(html);
			$("script, style, nav, footer").remove();
			text = $("body").text().replace(/\s+/g, " ").trim();
		} else {
			text = await readFile(source, "utf-8");
		}

		// Basic Chunking
		const chunks = this.chunkText(text, 1000);

		// Clean old chunks for the same source
		await this.pool.query("DELETE FROM rag_documents WHERE url = $1", [source]);

		for (const chunk of chunks) {
			const vector = await this.embed(chunk);
			await this.pool.query(
				"INSERT INTO rag_documents (url, content, embedding) VALUES ($1, $2, $3::vector)",
				[source, chunk, JSON.stringify(vector)],
			);
		}
		return chunks.length;
	}

	private chunkText(text: string, size: number): string[] {
		const chunks: string[] = [];
		for (let i = 0; i < text.length; i += size - 100) {
			chunks.push(text.slice(i, i + size));
		}
		return chunks;
	}

	/**
	 * Searches for the most relevant context for a query.
	 */
	async search(query: string, limit = 3): Promise<string[]> {
		try {
			const vector = await this.embed(query);
			const { rows } = await this.pool.query(
				`SELECT content FROM rag_documents 
				 ORDER BY embedding <=> $1::vector 
				 LIMIT $2`,
				[JSON.stringify(vector), limit],
			);
			return rows.map((r) => r.content);
		} catch (err) {
			process.stdout.write(
				`${clr.warn(`[RAG Warning: ${err instanceof Error ? err.message : err}]`)}\n`,
			);
			return [];
		}
	}
	/**
	 * Extracts technical keywords from the knowledge base for selective retrieval.
	 */
	async getKeywords(): Promise<Set<string>> {
		try {
			const { rows } = await this.pool.query(
				"SELECT content FROM rag_documents LIMIT 50",
			);
			const keywords = new Set<string>();
			for (const row of rows) {
				const words = row.content.match(/[A-Z][a-zA-Z0-9]{3,}/g) || [];
				for (const w of words) {
					keywords.add(w.toLowerCase());
				}
			}
			return keywords;
		} catch {
			return new Set();
		}
	}
	/**
	 * Removes all chunks associated with a specific URL or path from the database.
	 */
	async deleteSource(url: string): Promise<void> {
		try {
			await this.pool.query("DELETE FROM rag_documents WHERE url = $1", [url]);
		} catch (err) {
			throw new Error(`Failed to delete source: ${err instanceof Error ? err.message : err}`);
		}
	}

	/**
	 * Lists all unique document sources (URLs or paths) in the database.
	 */
	async listSources(): Promise<string[]> {
		try {
			const { rows } = await this.pool.query(
				"SELECT DISTINCT url FROM rag_documents ORDER BY url ASC",
			);
			return rows.map((r: { url: string }) => r.url);
		} catch {
			return [];
		}
	}
}

export const rag = new RAG();
