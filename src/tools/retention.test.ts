import { describe, expect, it, vi } from "vitest";
import { formatRetentionResult, createRetentionTool } from "./retention.js";
import type { PostHogClient, RetentionResult } from "../client.js";

describe("formatRetentionResult", () => {
	it("returns empty message for no results", () => {
		expect(formatRetentionResult({ results: [] })).toBe(
			"Retention query returned no results.",
		);
	});

	it("formats retention grid with percentages", () => {
		const result: RetentionResult = {
			results: [
				{
					date: "2024-01-01",
					label: "Jan 1",
					values: [{ count: 100 }, { count: 80 }, { count: 60 }],
				},
				{
					date: "2024-01-02",
					label: "Jan 2",
					values: [{ count: 50 }, { count: 40 }],
				},
			],
		};

		const text = formatRetentionResult(result);
		expect(text).toContain("## Retention Analysis");
		expect(text).toContain("Period 0");
		expect(text).toContain("Period 1");
		expect(text).toContain("Period 2");
		expect(text).toContain("| Jan 1 | 100 |");
		expect(text).toContain("80.0%");
		expect(text).toContain("60.0%");
		// Second cohort padded with —
		expect(text).toContain("— |");
	});
});

describe("createRetentionTool", () => {
	it("calls client.retentionQuery", async () => {
		const mockClient = {
			retentionQuery: vi.fn().mockResolvedValue({
				results: [
					{
						date: "2024-01-01",
						label: "Jan 1",
						values: [{ count: 100 }],
					},
				],
			}),
		} as unknown as PostHogClient;

		const tool = createRetentionTool(mockClient);
		const result = await tool.execute("call-1", {
			target_entity: "sign_up",
			date_from: "-30d",
		});

		expect(mockClient.retentionQuery).toHaveBeenCalledWith(
			expect.objectContaining({
				target_entity: "sign_up",
				date_from: "-30d",
			}),
		);
		expect(result.content[0]!.text).toContain("Retention Analysis");
	});

	it("throws on missing target_entity", async () => {
		const tool = createRetentionTool({} as PostHogClient);
		await expect(
			tool.execute("call-1", {
				target_entity: "",
				date_from: "-30d",
			}),
		).rejects.toThrow("target_entity is required");
	});
});
