import { Type } from "@sinclair/typebox";
import { optionalStringEnum } from "openclaw/plugin-sdk";
import {
	BREAKDOWN_TYPES,
	type PostHogClient,
	type LifecycleResult,
} from "../client.js";

const INTERVALS = ["day", "week", "month"] as const;

export function createLifecycleTool(client: PostHogClient) {
	return {
		name: "posthog_lifecycle",
		label: "PostHog Lifecycle",
		description:
			"Analyze user lifecycle stages over time: new, returning, resurrecting, and dormant users. Shows how your active user base is composed. NOT for retention curves (use posthog_retention) or raw event counts (use posthog_trends).",
		parameters: Type.Object({
			events: Type.Array(
				Type.String({
					description: "Event name, e.g. $pageview",
				}),
				{
					description:
						"Event(s) that define user activity (minimum 1)",
					minItems: 1,
				},
			),
			date_from: Type.String({
				description:
					"Start date — relative like -30d or absolute YYYY-MM-DD",
			}),
			date_to: Type.Optional(
				Type.String({
					description: "End date — relative or absolute. Defaults to now.",
				}),
			),
			interval: optionalStringEnum(INTERVALS, {
				description:
					"Time bucket interval: day, week, or month (default: day)",
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

			const result: LifecycleResult = await client.lifecycleQuery({
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

			const text = formatLifecycleResult(result);

			return {
				content: [{ type: "text" as const, text }],
				details: { results: result.results },
			};
		},
	};
}

export function formatLifecycleResult(result: LifecycleResult): string {
	if (!result.results || result.results.length === 0) {
		return "Lifecycle query returned no results.";
	}

	const lines: string[] = [
		"## User Lifecycle Analysis",
		"",
		"### Summary by Status",
		"",
		"| Status | Total |",
		"| --- | --- |",
	];

	for (const series of result.results) {
		lines.push(`| ${series.status} | ${series.count} |`);
	}

	// Show interval breakdown per status
	for (const series of result.results) {
		if (series.days && series.data && series.days.length > 0) {
			lines.push("");
			lines.push(`### ${series.status} — Interval Breakdown`);
			lines.push("");
			lines.push("| Date | Count |");
			lines.push("| --- | --- |");

			for (let i = 0; i < series.days.length; i++) {
				lines.push(
					`| ${series.days[i]} | ${series.data[i] ?? 0} |`,
				);
			}
		}
	}

	return lines.join("\n");
}
