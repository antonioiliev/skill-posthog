import { Type } from "@sinclair/typebox";
import type { PostHogClient, EventRecord } from "../client.js";

export function createEventsTool(client: PostHogClient) {
	return {
		name: "posthog_events",
		label: "PostHog Events",
		description:
			"List recent individual event records from PostHog. Filter by event name, person ID, or custom properties.",
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
		}),

		async execute(_toolCallId: string, params: Record<string, unknown>) {
			let limit =
				typeof params.limit === "number" ? Math.floor(params.limit) : 20;
			limit = Math.max(1, Math.min(limit, 100));

			const events: EventRecord[] = await client.listEvents({
				event: params.event ? String(params.event) : undefined,
				person_id: params.person_id ? String(params.person_id) : undefined,
				properties: params.properties
					? String(params.properties)
					: undefined,
				limit,
			});

			const text = formatEvents(events);

			return {
				content: [{ type: "text" as const, text }],
				details: { events },
			};
		},
	};
}

function formatEvents(events: EventRecord[]): string {
	if (!events || events.length === 0) {
		return "No events found.";
	}

	const lines: string[] = [
		`## Events (${events.length})`,
		"",
	];

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

		// Show a few useful properties
		const props = event.properties as Record<string, unknown> | undefined;
		if (props) {
			const interesting = [
				"$browser",
				"$os",
				"$device_type",
				"$referrer",
				"$pathname",
			];
			const shown: string[] = [];
			for (const key of interesting) {
				if (props[key] != null) {
					shown.push(`${key}: ${props[key]}`);
				}
			}
			if (shown.length > 0) {
				lines.push(`- **Properties:** ${shown.join(", ")}`);
			}
		}

		lines.push("");
	}

	return lines.join("\n");
}
