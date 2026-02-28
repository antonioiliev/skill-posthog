import { Type } from "@sinclair/typebox";
import type {
	PostHogClient,
	EventRecord,
	PaginatedResult,
} from "../client.js";

/** Internal properties to skip in display. */
const SKIP_PROPS = new Set([
	"$ip",
	"$lib",
	"$lib_version",
	"$insert_id",
	"$session_id",
	"$window_id",
	"$set",
	"$set_once",
	"$sent_at",
	"$geoip_disable",
	"$group_0",
	"$group_1",
	"$group_2",
	"$group_3",
	"$group_4",
	"distinct_id",
]);

const TIER1 = ["$current_url", "$pathname", "$host"];
const TIER2 = ["$browser", "$os", "$device_type"];
const TIER3 = ["$referrer", "$referring_domain"];

/**
 * Select the most useful properties to display, up to `maxProps`.
 * Priority: navigation > device > acquisition > custom (non-$) alphabetical.
 */
export function selectDisplayProperties(
	props: Record<string, unknown>,
	maxProps = 8,
): string[] {
	const selected: string[] = [];

	for (const tier of [TIER1, TIER2, TIER3]) {
		for (const key of tier) {
			if (selected.length >= maxProps) return selected;
			if (props[key] != null) {
				selected.push(`${key}: ${props[key]}`);
			}
		}
	}

	// Fill remaining with non-$ custom properties, alphabetical
	const customKeys = Object.keys(props)
		.filter((k) => !k.startsWith("$") && !SKIP_PROPS.has(k) && props[k] != null)
		.sort();

	for (const key of customKeys) {
		if (selected.length >= maxProps) break;
		selected.push(`${key}: ${props[key]}`);
	}

	return selected;
}

export function createEventsTool(client: PostHogClient) {
	return {
		name: "posthog_events",
		label: "PostHog Events",
		description:
			"List recent individual event records from PostHog. Filter by event name, person ID, or custom properties. Supports pagination via cursor. NOT for aggregate counts (use posthog_trends) or conversion analysis (use posthog_funnel).",
		parameters: Type.Object({
			event: Type.Optional(
				Type.String({
					description:
						"Filter by event name, e.g. $pageview or sign_up",
				}),
			),
			person_id: Type.Optional(
				Type.String({
					description: "Filter events by a specific person/user ID",
				}),
			),
			properties: Type.Optional(
				Type.String({
					description:
						'JSON string of property filters, e.g. [{"key":"$browser","value":"Chrome","operator":"exact"}]',
				}),
			),
			limit: Type.Optional(
				Type.Number({
					description:
						"Number of events to return (default 20, max 100)",
				}),
			),
			cursor: Type.Optional(
				Type.String({
					description:
						"Pagination cursor from a previous response's next_cursor field. When set, other filter params are ignored.",
				}),
			),
		}),

		async execute(_toolCallId: string, params: Record<string, unknown>) {
			let limit =
				typeof params.limit === "number" ? Math.floor(params.limit) : 20;
			limit = Math.max(1, Math.min(limit, 100));

			const result: PaginatedResult<EventRecord> =
				await client.listEvents({
					event: params.event ? String(params.event) : undefined,
					person_id: params.person_id
						? String(params.person_id)
						: undefined,
					properties: params.properties
						? String(params.properties)
						: undefined,
					limit,
					cursor: params.cursor ? String(params.cursor) : undefined,
				});

			const text = formatEvents(result.results, result.nextCursor);

			return {
				content: [{ type: "text" as const, text }],
				details: {
					events: result.results,
					next_cursor: result.nextCursor,
				},
			};
		},
	};
}

export function formatEvents(
	events: EventRecord[],
	nextCursor?: string | null,
): string {
	if (!events || events.length === 0) {
		return "No events found.";
	}

	const lines: string[] = [`## Events (${events.length})`, ""];

	for (const event of events) {
		const name = event.event ?? "unknown";
		const timestamp = event.timestamp ?? "";
		const distinctId =
			event.distinct_id ??
			(event.properties as Record<string, unknown> | undefined)
				?.distinct_id ??
			"";
		const url =
			(event.properties as Record<string, unknown> | undefined)?.[
				"$current_url"
			] ?? "";

		lines.push(`### ${name}`);
		lines.push(`- **Time:** ${timestamp}`);
		if (distinctId) lines.push(`- **Distinct ID:** ${distinctId}`);
		if (url) lines.push(`- **URL:** ${url}`);

		const props = event.properties as
			| Record<string, unknown>
			| undefined;
		if (props) {
			const shown = selectDisplayProperties(props);
			if (shown.length > 0) {
				lines.push(`- **Properties:** ${shown.join(", ")}`);
			}
		}

		lines.push("");
	}

	if (nextCursor) {
		lines.push(
			`> **More results available.** Pass \`cursor: "${nextCursor}"\` to fetch the next page.`,
		);
		lines.push("");
	}

	return lines.join("\n");
}
