import { Type } from "@sinclair/typebox";
import type { PostHogClient, QueryResult } from "../client.js";

export function createHogqlQueryTool(client: PostHogClient) {
	return {
		name: "posthog_query",
		label: "PostHog HogQL Query",
		description:
			"Run a HogQL (SQL-like) query against PostHog analytics data. Use this for flexible, ad-hoc queries — event counts, property breakdowns, or any custom aggregation. For time-series trends use posthog_trends; for conversion funnels use posthog_funnel; for retention curves use posthog_retention.",
		parameters: Type.Object({
			query: Type.String({
				description:
					"HogQL SQL query string, e.g. SELECT event, count() FROM events GROUP BY event ORDER BY count() DESC LIMIT 10",
			}),
			limit: Type.Optional(
				Type.Number({
					description:
						"Maximum number of rows to return (default 100, max 10000)",
				}),
			),
		}),

		async execute(_toolCallId: string, params: Record<string, unknown>) {
			const query = String(params.query ?? "").trim();
			if (!query) throw new Error("query is required");

			let limit =
				typeof params.limit === "number" ? Math.floor(params.limit) : 100;
			limit = Math.max(1, Math.min(limit, 10_000));

			const result: QueryResult = await client.hogqlQuery(query, limit);

			const text = formatQueryResult(result);

			return {
				content: [{ type: "text" as const, text }],
				details: { columns: result.columns, results: result.results },
			};
		},
	};
}

export function formatQueryResult(result: QueryResult): string {
	const { columns, results } = result;

	if (!results || results.length === 0) {
		return "Query returned no results.";
	}

	const lines: string[] = [
		`## HogQL Query Results`,
		`**Rows:** ${results.length}`,
		"",
	];

	// Build markdown table
	lines.push(`| ${columns.join(" | ")} |`);
	lines.push(`| ${columns.map(() => "---").join(" | ")} |`);

	for (const row of results) {
		const cells = row.map((cell) =>
			cell === null || cell === undefined ? "" : String(cell),
		);
		lines.push(`| ${cells.join(" | ")} |`);
	}

	return lines.join("\n");
}
