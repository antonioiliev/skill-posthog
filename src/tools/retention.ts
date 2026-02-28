import { Type } from "@sinclair/typebox";
import { optionalStringEnum } from "openclaw/plugin-sdk";
import type { PostHogClient, RetentionResult } from "../client.js";

const PERIODS = ["Day", "Week", "Month"] as const;
const RETENTION_TYPES = [
	"retention_first_time",
	"retention_recurring",
] as const;

export function createRetentionTool(client: PostHogClient) {
	return {
		name: "posthog_retention",
		label: "PostHog Retention",
		description:
			"Analyze cohort retention — what percentage of users who performed a target event return to perform a returning event over subsequent periods. NOT for time-series counts (use posthog_trends) or conversion funnels (use posthog_funnel).",
		parameters: Type.Object({
			target_entity: Type.String({
				description:
					"Event name that defines the cohort entry, e.g. sign_up or $pageview",
			}),
			returning_entity: Type.Optional(
				Type.String({
					description:
						"Event name that counts as a return. Defaults to the target_entity.",
				}),
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
			period: optionalStringEnum(PERIODS, {
				description:
					"Retention period granularity: Day, Week, or Month (default: Day)",
			}),
			retention_type: optionalStringEnum(RETENTION_TYPES, {
				description:
					"retention_first_time (first occurrence only) or retention_recurring (any occurrence). Default: retention_first_time",
			}),
			filter_test_accounts: Type.Optional(
				Type.Boolean({
					description: "Exclude internal/test accounts (default: false)",
				}),
			),
		}),

		async execute(_toolCallId: string, params: Record<string, unknown>) {
			const target_entity = String(params.target_entity ?? "").trim();
			if (!target_entity) throw new Error("target_entity is required");

			const date_from = String(params.date_from ?? "").trim();
			if (!date_from) throw new Error("date_from is required");

			const result: RetentionResult = await client.retentionQuery({
				target_entity,
				returning_entity: params.returning_entity
					? String(params.returning_entity)
					: undefined,
				date_from,
				date_to: params.date_to ? String(params.date_to) : undefined,
				period: params.period as "Day" | "Week" | "Month" | undefined,
				retention_type: params.retention_type as
					| "retention_first_time"
					| "retention_recurring"
					| undefined,
				filter_test_accounts: params.filter_test_accounts === true,
			});

			const text = formatRetentionResult(result);

			return {
				content: [{ type: "text" as const, text }],
				details: { results: result.results },
			};
		},
	};
}

export function formatRetentionResult(result: RetentionResult): string {
	if (!result.results || result.results.length === 0) {
		return "Retention query returned no results.";
	}

	const cohorts = result.results;
	const maxPeriods = Math.max(
		...cohorts.map((c) => c.values.length),
	);

	const periodHeaders = Array.from(
		{ length: maxPeriods },
		(_, i) => `Period ${i}`,
	);

	const lines: string[] = [
		"## Retention Analysis",
		"",
		`| Cohort | Size | ${periodHeaders.join(" | ")} |`,
		`| --- | --- | ${periodHeaders.map(() => "---").join(" | ")} |`,
	];

	for (const cohort of cohorts) {
		const size = cohort.values[0]?.count ?? 0;
		const cells = cohort.values.map((v, i) => {
			if (i === 0) return String(v.count);
			return size > 0
				? `${((v.count / size) * 100).toFixed(1)}%`
				: "0%";
		});
		// Pad if fewer periods
		while (cells.length < maxPeriods) cells.push("—");
		lines.push(`| ${cohort.label} | ${size} | ${cells.join(" | ")} |`);
	}

	return lines.join("\n");
}
