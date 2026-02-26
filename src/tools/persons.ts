import { Type } from "@sinclair/typebox";
import type { PostHogClient, PersonRecord } from "../client.js";

export function createPersonsTool(client: PostHogClient) {
	return {
		name: "posthog_persons",
		label: "PostHog Persons",
		description:
			"Search and list persons (users) in PostHog. Find users by name, email, or distinct ID, or filter by custom properties.",
		parameters: Type.Object({
			search: Type.Optional(
				Type.String({
					description:
						"Search by name, email, or distinct ID",
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
		}),

		async execute(_toolCallId: string, params: Record<string, unknown>) {
			let limit =
				typeof params.limit === "number" ? Math.floor(params.limit) : 10;
			limit = Math.max(1, Math.min(limit, 100));

			const persons: PersonRecord[] = await client.listPersons({
				search: params.search ? String(params.search) : undefined,
				properties: params.properties
					? String(params.properties)
					: undefined,
				limit,
			});

			const text = formatPersons(persons);

			return {
				content: [{ type: "text" as const, text }],
				details: { persons },
			};
		},
	};
}

function formatPersons(persons: PersonRecord[]): string {
	if (!persons || persons.length === 0) {
		return "No persons found.";
	}

	const lines: string[] = [
		`## Persons (${persons.length})`,
		"",
	];

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
			lines.push(`- **Distinct IDs:** ${distinctIds.slice(0, 5).join(", ")}`);
		}
		if (createdAt) lines.push(`- **Created:** ${createdAt}`);

		// Show custom properties (skip internal $ ones)
		const customProps: string[] = [];
		for (const [key, val] of Object.entries(props)) {
			if (!key.startsWith("$") && key !== "email" && key !== "name" && val != null) {
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

	return lines.join("\n");
}
