import { TOOLS } from "./lib/tools";

async function main() {
	const result = await TOOLS.web_search({
		query: "what is the weather like today?",
	});
	console.log(result);
}

main();
