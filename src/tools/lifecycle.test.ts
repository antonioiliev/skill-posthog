import { describe, expect, it, vi } from "vitest";
import { formatLifecycleResult, createLifecycleTool } from "./lifecycle.js";
import type { PostHogClient, LifecycleResult } from "../client.js";

describe("formatLifecycleResult", () => {
	it("returns empty message for no results", () => {
		expect(formatLifecycleResult({ results: [] })).toBe(
			"Lifecycle query returned no results.",
		);
	});

	it("formats lifecycle summary and interval tables", () => {
		const result: LifecycleResult = {
			results: [
				{
					status: "new",
					label: "$pageview - new",
					count: 100,
					data: [30, 40, 30],
					days: ["2024-01-01", "2024-01-02", "2024-01-03"],
				},
				{
					status: "returning",
					label: "$pageview - returning",
					count: 200,
					data: [60, 70, 70],
					days: ["2024-01-01", "2024-01-02", "2024-01-03"],
				},
			],
		};

		const text = formatLifecycleResult(result);
		expect(text).toContain("## User Lifecycle Analysis");
		expect(text).toContain("| new | 100 |");
		expect(text).toContain("| returning | 200 |");
		expect(text).toContain("### new — Interval Breakdown");
		expect(text).toContain("| 2024-01-01 | 30 |");
	});
});

describe("createLifecycleTool", () => {
	it("calls client.lifecycleQuery", async () => {
		const mockClient = {
			lifecycleQuery: vi.fn().mockResolvedValue({
				results: [
					{
						status: "new",
						label: "new",
						count: 10,
						data: [10],
						days: ["2024-01-01"],
					},
				],
			}),
		} as unknown as PostHogClient;

		const tool = createLifecycleTool(mockClient);
		const result = await tool.execute("call-1", {
			events: ["$pageview"],
			date_from: "-30d",
		});

		expect(mockClient.lifecycleQuery).toHaveBeenCalledWith(
			expect.objectContaining({
				events: ["$pageview"],
				date_from: "-30d",
			}),
		);
		expect(result.content[0]!.text).toContain("Lifecycle Analysis");
	});

	it("throws on empty events", async () => {
		const tool = createLifecycleTool({} as PostHogClient);
		await expect(
			tool.execute("call-1", { events: [], date_from: "-30d" }),
		).rejects.toThrow("events array is required");
	});
});
