import { describe, expect, it, vi } from "vitest";
import {
	formatFunnelsResult,
	formatDuration,
	createFunnelTool,
} from "./funnel.js";
import type { PostHogClient, FunnelsResult } from "../client.js";

describe("formatDuration", () => {
	it("returns — for null/undefined/zero", () => {
		expect(formatDuration(null)).toBe("—");
		expect(formatDuration(undefined)).toBe("—");
		expect(formatDuration(0)).toBe("—");
		expect(formatDuration(-5)).toBe("—");
	});

	it("formats seconds", () => {
		expect(formatDuration(42)).toBe("42s");
	});

	it("formats minutes", () => {
		expect(formatDuration(300)).toBe("5.0m");
	});

	it("formats hours", () => {
		expect(formatDuration(4320)).toBe("1.2h");
	});

	it("formats days", () => {
		expect(formatDuration(198720)).toBe("2.3d");
	});
});

describe("formatFunnelsResult", () => {
	it("returns empty message for no results", () => {
		expect(formatFunnelsResult({ results: [] })).toBe(
			"Funnel query returned no results.",
		);
	});

	it("formats funnel table with conversion time", () => {
		const result: FunnelsResult = {
			results: [
				{
					action_id: "1",
					name: "sign_up",
					order: 0,
					count: 1000,
					average_conversion_time: 120,
				},
				{
					action_id: "2",
					name: "purchase",
					order: 1,
					count: 200,
					average_conversion_time: 3600,
				},
			],
		};

		const text = formatFunnelsResult(result);
		expect(text).toContain("## Funnel Analysis");
		expect(text).toContain("Avg Time to Next");
		expect(text).toContain("| 1 | sign_up | 1000 | 100%");
		expect(text).toContain("2.0m"); // 120s = 2.0m for step 0
		expect(text).toContain("| 2 | purchase | 200 |");
		// Last step shows — for time
		expect(text).toMatch(/purchase.*\| — \|$/m);
	});
});

describe("createFunnelTool", () => {
	it("calls client.funnelsQuery and returns formatted content", async () => {
		const mockClient = {
			funnelsQuery: vi.fn().mockResolvedValue({
				results: [
					{ action_id: "1", name: "a", order: 0, count: 100 },
					{ action_id: "2", name: "b", order: 1, count: 50 },
				],
			}),
		} as unknown as PostHogClient;

		const tool = createFunnelTool(mockClient);
		const result = await tool.execute("call-1", {
			steps: ["a", "b"],
			date_from: "-30d",
		});

		expect(mockClient.funnelsQuery).toHaveBeenCalled();
		expect(result.content[0]!.text).toContain("Funnel Analysis");
	});

	it("throws on fewer than 2 steps", async () => {
		const tool = createFunnelTool({} as PostHogClient);
		await expect(
			tool.execute("call-1", { steps: ["one"], date_from: "-7d" }),
		).rejects.toThrow("at least 2 event names");
	});
});
