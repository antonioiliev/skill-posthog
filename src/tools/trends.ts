import { Type } from "@sinclair/typebox";
import { optionalStringEnum } from "openclaw/plugin-sdk";
import { BREAKDOWN_TYPES, type PostHogClient, type TrendsResult } from "../client.js";

const INTERVALS = ["hour", "day", "week", "month"] as const;

export function createTrendsTool(client: PostHogClient) {
	return {
		name: "posthog_trends",
		label: "PostHog Trends",
		description:
			"Get time-series trend data for one or more events. Use this to see event volumes over time, compare events, or break down by properties.",
		parameters: Type.Object({
			events: Type.Array(
				Type.String({
					description: "Event name, e.g. $pageview",
				}),
				{
					description: "List of event names to query trends for",
					minItems: 1,
				},
			),
			date_from: Type.String({
				description:
					"Start date — relative like -7d, -30d, -1m or absolute YYYY-MM-DD",
			}),
			date_to: Type.Optional(
				Type.String({
					description:
						"End date — relative or absolute. Defaults to now.",
				}),
			),
			interval: optionalStringEnum(INTERVALS, {
				description:
					"Time bucket interval: hour, day, week, or month (default: day)",
			}),
			breakdown_by: Type.Optional(
				Type.String({
					description:
						"Property name to break down by, e.g. $browser or $os",
				}),
			),
			breakdown_type: optionalStringEnum(BREAKDOWN_TYPES, {
				description:
					"Breakdown property source: event, person, or session (default: event)",
			}),
			filter_test_accounts: Type.Optional(
				Type.Boolean({
					description: "Exclude internal/test accounts (default: false)",
				}),
			),
		}),

		async execute(_toolCallId: string, params: Record<string, unknown>) {
			const events = params.events as string[];
			if (!Array.isArray(events) || events.length === 0) {
				throw new Error("events array is required and must be non-empty");
			}

			const date_from = String(params.date_from ?? "").trim();
			if (!date_from) throw new Error("date_from is required");

			const result: TrendsResult = await client.trendsQuery({
				events,
				date_from,
				date_to: params.date_to ? String(params.date_to) : undefined,
				interval: params.interval ? String(params.interval) : undefined,
				breakdown_by: params.breakdown_by
					? String(params.breakdown_by)
					: undefined,
				breakdown_type: params.breakdown_type
					? String(params.breakdown_type)
					: undefined,
				filter_test_accounts: params.filter_test_accounts === true,
			});

			const text = formatTrendsResult(result);

			return {
				content: [{ type: "text" as const, text }],
				details: { results: result.results },
			};
		},
	};
}

function formatTrendsResult(result: TrendsResult): string {
	if (!result.results || result.results.length === 0) {
		return "Trends query returned no results.";
	}

	const lines: string[] = [
		"## Trend Analysis",
		"",
		"### Summary",
		"",
		"| Event | Total Count |",
		"| --- | --- |",
	];

	for (const series of result.results) {
		lines.push(`| ${series.label} | ${series.count} |`);
	}

	// Show interval data for each series
	for (const series of result.results) {
		if (series.labels && series.data && series.labels.length > 0) {
			lines.push("");
			lines.push(`### ${series.label} — Interval Breakdown`);
			lines.push("");
			lines.push("| Date | Count |");
			lines.push("| --- | --- |");

			for (let i = 0; i < series.labels.length; i++) {
				const label = series.days?.[i] ?? series.labels[i];
				const value = series.data[i] ?? 0;
				lines.push(`| ${label} | ${value} |`);
			}
		}
	}

	return lines.join("\n");
}
