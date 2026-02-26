import { Type } from "@sinclair/typebox";
import { optionalStringEnum } from "openclaw/plugin-sdk";
import { BREAKDOWN_TYPES, type PostHogClient, type FunnelsResult } from "../client.js";

export function createFunnelTool(client: PostHogClient) {
	return {
		name: "posthog_funnel",
		label: "PostHog Funnel",
		description:
			"Analyze a multi-step conversion funnel. Provide an ordered list of event names to measure drop-off between steps.",
		parameters: Type.Object({
			steps: Type.Array(
				Type.String({
					description: "Event name for this funnel step",
				}),
				{
					description:
						"Ordered list of event names defining the funnel steps (minimum 2)",
					minItems: 2,
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
			funnel_window_days: Type.Optional(
				Type.Number({
					description:
						"Conversion window in days — how long a user has to complete the funnel (default: 14)",
				}),
			),
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
			const steps = params.steps as string[];
			if (!Array.isArray(steps) || steps.length < 2) {
				throw new Error("steps array requires at least 2 event names");
			}

			const date_from = String(params.date_from ?? "").trim();
			if (!date_from) throw new Error("date_from is required");

			const result: FunnelsResult = await client.funnelsQuery({
				steps,
				date_from,
				date_to: params.date_to ? String(params.date_to) : undefined,
				funnel_window_days:
					typeof params.funnel_window_days === "number"
						? Math.floor(params.funnel_window_days)
						: undefined,
				breakdown_by: params.breakdown_by
					? String(params.breakdown_by)
					: undefined,
				breakdown_type: params.breakdown_type
					? String(params.breakdown_type)
					: undefined,
				filter_test_accounts: params.filter_test_accounts === true,
			});

			const text = formatFunnelsResult(result);

			return {
				content: [{ type: "text" as const, text }],
				details: { results: result.results },
			};
		},
	};
}

function formatFunnelsResult(result: FunnelsResult): string {
	if (!result.results || result.results.length === 0) {
		return "Funnel query returned no results.";
	}

	const steps = result.results;
	const firstCount = steps[0]?.count ?? 0;

	const lines: string[] = [
		"## Funnel Analysis",
		"",
		"| Step | Event | Count | Conversion | Drop-off |",
		"| --- | --- | --- | --- | --- |",
	];

	for (let i = 0; i < steps.length; i++) {
		const step = steps[i]!;
		const name = step.custom_name ?? step.name ?? step.action_id;
		const count = step.count;
		const overallRate =
			firstCount > 0
				? ((count / firstCount) * 100).toFixed(1) + "%"
				: "—";
		const prevCount = i > 0 ? (steps[i - 1]?.count ?? 0) : count;
		const stepRate =
			prevCount > 0
				? ((count / prevCount) * 100).toFixed(1) + "%"
				: "—";
		const dropoff = i > 0 ? prevCount - count : 0;

		lines.push(
			`| ${i + 1} | ${name} | ${count} | ${i === 0 ? "100%" : stepRate} (${overallRate} overall) | ${i === 0 ? "—" : dropoff} |`,
		);
	}

	return lines.join("\n");
}
