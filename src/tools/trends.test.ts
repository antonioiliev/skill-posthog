import { describe, expect, it, vi } from "vitest";
import { formatTrendsResult, createTrendsTool } from "./trends.js";
import type { PostHogClient, TrendsResult } from "../client.js";

describe("formatTrendsResult", () => {
	it("returns empty message for no results", () => {
		expect(formatTrendsResult({ results: [] })).toBe(
			"Trends query returned no results.",
		);
	});

	it("formats summary and interval tables", () => {
		const result: TrendsResult = {
			results: [
				{
					label: "$pageview",
					count: 300,
					data: [100, 200],
					labels: ["2024-01-01", "2024-01-02"],
					days: ["2024-01-01", "2024-01-02"],
				},
			],
		};

		const text = formatTrendsResult(result);
		expect(text).toContain("## Trend Analysis");
		expect(text).toContain("| $pageview | 300 |");
		expect(text).toContain("### $pageview — Interval Breakdown");
		expect(text).toContain("| 2024-01-01 | 100 |");
		expect(text).toContain("| 2024-01-02 | 200 |");
	});
});

describe("createTrendsTool", () => {
	it("calls client.trendsQuery and returns formatted content", async () => {
		const mockClient = {
			trendsQuery: vi.fn().mockResolvedValue({
				results: [
					{
						label: "sign_up",
						count: 50,
						data: [50],
						labels: ["2024-01-01"],
						days: ["2024-01-01"],
					},
				],
			}),
		} as unknown as PostHogClient;

		const tool = createTrendsTool(mockClient);
		const result = await tool.execute("call-1", {
			events: ["sign_up"],
			date_from: "-7d",
		});

		expect(mockClient.trendsQuery).toHaveBeenCalledWith(
			expect.objectContaining({
				events: ["sign_up"],
				date_from: "-7d",
			}),
		);
		expect(result.content[0]!.text).toContain("sign_up");
	});

	it("throws on empty events", async () => {
		const tool = createTrendsTool({} as PostHogClient);
		await expect(
			tool.execute("call-1", { events: [], date_from: "-7d" }),
		).rejects.toThrow("events array is required");
	});

	it("throws on missing date_from", async () => {
		const tool = createTrendsTool({} as PostHogClient);
		await expect(
			tool.execute("call-1", { events: ["$pageview"], date_from: "" }),
		).rejects.toThrow("date_from is required");
	});
});
