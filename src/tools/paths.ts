import { Type } from "@sinclair/typebox";
import { optionalStringEnum } from "openclaw/plugin-sdk";
import type { PostHogClient, PathsResult } from "../client.js";

const PATH_TYPES = [
	"$pageview",
	"$screen",
	"custom_event",
	"hogql",
] as const;

export function createPathsTool(client: PostHogClient) {
	return {
		name: "posthog_paths",
		label: "PostHog Paths",
		description:
			"Analyze user navigation paths — which pages/screens/events users move between and how often. Shows edges (from → to → count). NOT for conversion rates between specific steps (use posthog_funnel) or time-series counts (use posthog_trends).",
		parameters: Type.Object({
			date_from: Type.String({
				description:
					"Start date — relative like -30d or absolute YYYY-MM-DD",
			}),
			date_to: Type.Optional(
				Type.String({
					description: "End date — relative or absolute. Defaults to now.",
				}),
			),
			path_type: optionalStringEnum(PATH_TYPES, {
				description:
					"Type of path: $pageview, $screen, custom_event, or hogql (default: $pageview)",
			}),
			start_point: Type.Optional(
				Type.String({
					description:
						"Only show paths starting from this page/screen/event",
				}),
			),
			end_point: Type.Optional(
				Type.String({
					description:
						"Only show paths ending at this page/screen/event",
				}),
			),
			step_limit: Type.Optional(
				Type.Number({
					description:
						"Maximum number of steps in each path (default: 5)",
				}),
			),
			filter_test_accounts: Type.Optional(
				Type.Boolean({
					description: "Exclude internal/test accounts (default: false)",
				}),
			),
		}),

		async execute(_toolCallId: string, params: Record<string, unknown>) {
			const date_from = String(params.date_from ?? "").trim();
			if (!date_from) throw new Error("date_from is required");

			const result: PathsResult = await client.pathsQuery({
				date_from,
				date_to: params.date_to ? String(params.date_to) : undefined,
				path_type: params.path_type as
					| "hogql"
					| "$pageview"
					| "$screen"
					| "custom_event"
					| undefined,
				start_point: params.start_point
					? String(params.start_point)
					: undefined,
				end_point: params.end_point
					? String(params.end_point)
					: undefined,
				step_limit:
					typeof params.step_limit === "number"
						? Math.floor(params.step_limit)
						: undefined,
				filter_test_accounts: params.filter_test_accounts === true,
			});

			const text = formatPathsResult(result);

			return {
				content: [{ type: "text" as const, text }],
				details: { results: result.results },
			};
		},
	};
}

const MAX_EDGES = 30;

export function formatPathsResult(result: PathsResult): string {
	if (!result.results || result.results.length === 0) {
		return "Paths query returned no results.";
	}

	// Sort by value descending and cap at MAX_EDGES
	const edges = [...result.results]
		.sort((a, b) => b.value - a.value)
		.slice(0, MAX_EDGES);

	const lines: string[] = [
		"## User Path Analysis",
		"",
		`Showing top ${edges.length} path edges${result.results.length > MAX_EDGES ? ` (of ${result.results.length} total)` : ""}.`,
		"",
		"| From | To | Count | Drop-off |",
		"| --- | --- | --- | --- |",
	];

	for (const edge of edges) {
		const dropoff =
			edge.source_dropoff != null ? String(edge.source_dropoff) : "—";
		lines.push(
			`| ${edge.source} | ${edge.target} | ${edge.value} | ${dropoff} |`,
		);
	}

	return lines.join("\n");
}
