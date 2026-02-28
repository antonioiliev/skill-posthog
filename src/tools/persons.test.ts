import { describe, expect, it, vi } from "vitest";
import { formatPersons, createPersonsTool } from "./persons.js";
import type { PostHogClient } from "../client.js";

describe("formatPersons", () => {
	it("returns empty message for no persons", () => {
		expect(formatPersons([])).toBe("No persons found.");
	});

	it("formats person list", () => {
		const persons = [
			{
				name: "Test User",
				created_at: "2024-01-01",
				distinct_ids: ["user-1", "user-2"],
				properties: {
					email: "test@example.com",
					$name: "Test",
					plan: "pro",
				},
			},
		];
		const text = formatPersons(persons);
		expect(text).toContain("## Persons (1)");
		expect(text).toContain("**Email:** test@example.com");
		expect(text).toContain("**Distinct IDs:** user-1, user-2");
		expect(text).toContain("plan: pro");
	});

	it("includes pagination note when cursor is present", () => {
		const text = formatPersons(
			[{ name: "User", properties: {} }],
			"https://example.com/next",
		);
		expect(text).toContain("More results available");
	});

	it("omits pagination note when cursor is null", () => {
		const text = formatPersons([{ name: "User", properties: {} }], null);
		expect(text).not.toContain("More results available");
	});
});

describe("createPersonsTool", () => {
	it("calls client.listPersons and returns formatted content", async () => {
		const mockClient = {
			listPersons: vi.fn().mockResolvedValue({
				results: [
					{ name: "User", properties: { email: "u@e.com" } },
				],
				nextCursor: "https://example.com/next",
			}),
		} as unknown as PostHogClient;

		const tool = createPersonsTool(mockClient);
		const result = await tool.execute("call-1", { search: "user" });

		expect(mockClient.listPersons).toHaveBeenCalledWith(
			expect.objectContaining({ search: "user" }),
		);
		expect(result.content[0]!.text).toContain("User");
		expect(result.details.next_cursor).toBe("https://example.com/next");
	});

	it("passes cursor to client", async () => {
		const mockClient = {
			listPersons: vi.fn().mockResolvedValue({
				results: [],
				nextCursor: null,
			}),
		} as unknown as PostHogClient;

		const tool = createPersonsTool(mockClient);
		await tool.execute("call-1", { cursor: "https://example.com/next" });

		expect(mockClient.listPersons).toHaveBeenCalledWith(
			expect.objectContaining({ cursor: "https://example.com/next" }),
		);
	});
});
