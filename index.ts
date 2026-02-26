import type { AnyAgentTool, OpenClawPluginApi } from "openclaw/plugin-sdk";
import { parseConfig } from "./src/types.js";
import { PostHogClient } from "./src/client.js";
import { createHogqlQueryTool } from "./src/tools/hogql-query.js";
import { createTrendsTool } from "./src/tools/trends.js";
import { createFunnelTool } from "./src/tools/funnel.js";
import { createEventsTool } from "./src/tools/events.js";
import { createPersonsTool } from "./src/tools/persons.js";

export default function register(api: OpenClawPluginApi) {
	const cfg = parseConfig(api.pluginConfig);
	const client = new PostHogClient(cfg);

	const tools = [
		createHogqlQueryTool(client),
		createTrendsTool(client),
		createFunnelTool(client),
		createEventsTool(client),
		createPersonsTool(client),
	];

	for (const tool of tools) {
		api.registerTool(tool as unknown as AnyAgentTool, { optional: true });
	}
}
