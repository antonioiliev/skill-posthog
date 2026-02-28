import { Type } from "@sinclair/typebox";
import type {
	PostHogClient,
	PersonRecord,
	PaginatedResult,
} from "../client.js";

export function createPersonsTool(client: PostHogClient) {
	return {
		name: "posthog_persons",
		label: "PostHog Persons",
		description:
			"Search and list persons (users) in PostHog. Find users by name, email, or distinct ID, or filter by custom properties. Supports pagination via cursor. NOT for event data (use posthog_events) or aggregate analytics (use posthog_trends).",
		parameters: Type.Object({
			search: Type.Optional(
				Type.String({
					description: "Search by name, email, or distinct ID",
				}),
			),
			properties: Type.Optional(
				Type.String({
					description:
						'JSON string of property filters, e.g. [{"key":"email","value":"@example.com","operator":"icontains"}]',
				}),
			),
			limit: Type.Optional(
				Type.Number({
					description:
						"Number of persons to return (default 10, max 100)",
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
				typeof params.limit === "number"
					? Math.floor(params.limit)
					: 10;
			limit = Math.max(1, Math.min(limit, 100));

			const result: PaginatedResult<PersonRecord> =
				await client.listPersons({
					search: params.search ? String(params.search) : undefined,
					properties: params.properties
						? String(params.properties)
						: undefined,
					limit,
					cursor: params.cursor ? String(params.cursor) : undefined,
				});

			const text = formatPersons(result.results, result.nextCursor);

			return {
				content: [{ type: "text" as const, text }],
				details: {
					persons: result.results,
					next_cursor: result.nextCursor,
				},
			};
		},
	};
}

export function formatPersons(
	persons: PersonRecord[],
	nextCursor?: string | null,
): string {
	if (!persons || persons.length === 0) {
		return "No persons found.";
	}

	const lines: string[] = [`## Persons (${persons.length})`, ""];

	for (const person of persons) {
		const props =
			(person.properties as Record<string, unknown> | undefined) ?? {};
		const name =
			props.name ?? props.$name ?? props.username ?? person.name ?? "—";
		const email = props.email ?? props.$email ?? "";
		const distinctIds = person.distinct_ids as string[] | undefined;
		const createdAt = person.created_at ?? "";

		lines.push(`### ${name}`);
		if (email) lines.push(`- **Email:** ${email}`);
		if (distinctIds && distinctIds.length > 0) {
			lines.push(
				`- **Distinct IDs:** ${distinctIds.slice(0, 5).join(", ")}`,
			);
		}
		if (createdAt) lines.push(`- **Created:** ${createdAt}`);

		// Show custom properties (skip internal $ ones)
		const customProps: string[] = [];
		for (const [key, val] of Object.entries(props)) {
			if (
				!key.startsWith("$") &&
				key !== "email" &&
				key !== "name" &&
				val != null
			) {
				customProps.push(`${key}: ${val}`);
			}
		}
		if (customProps.length > 0) {
			lines.push(
				`- **Properties:** ${customProps.slice(0, 10).join(", ")}`,
			);
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
