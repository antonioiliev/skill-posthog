import { describe, expect, it, vi } from "vitest";
import { formatQueryResult, createHogqlQueryTool } from "./hogql-query.js";
import type { PostHogClient } from "../client.js";

describe("formatQueryResult", () => {
	it("returns empty message for no results", () => {
		expect(formatQueryResult({ columns: [], results: [] })).toBe(
			"Query returned no results.",
		);
	});

	it("formats a markdown table", () => {
		const result = formatQueryResult({
			columns: ["event", "count"],
			results: [
				["$pageview", 100],
				["sign_up", 42],
			],
		});
		expect(result).toContain("## HogQL Query Results");
		expect(result).toContain("**Rows:** 2");
		expect(result).toContain("| event | count |");
		expect(result).toContain("| $pageview | 100 |");
		expect(result).toContain("| sign_up | 42 |");
	});

	it("handles null/undefined cells", () => {
		const result = formatQueryResult({
			columns: ["a"],
			results: [[null], [undefined]],
		});
		expect(result).toContain("|  |");
	});
});

describe("createHogqlQueryTool", () => {
	it("calls client.hogqlQuery and returns formatted content", async () => {
		const mockClient = {
			hogqlQuery: vi.fn().mockResolvedValue({
				columns: ["event"],
				results: [["$pageview"]],
			}),
		} as unknown as PostHogClient;

		const tool = createHogqlQueryTool(mockClient);
		const result = await tool.execute("call-1", {
			query: "SELECT event FROM events LIMIT 1",
		});

		expect(mockClient.hogqlQuery).toHaveBeenCalledWith(
			"SELECT event FROM events LIMIT 1",
			100,
		);
		expect(result.content[0]!.text).toContain("$pageview");
		expect(result.details.columns).toEqual(["event"]);
	});

	it("throws on empty query", async () => {
		const mockClient = {} as PostHogClient;
		const tool = createHogqlQueryTool(mockClient);
		await expect(tool.execute("call-1", { query: "" })).rejects.toThrow(
			"query is required",
		);
	});

	it("clamps limit", async () => {
		const mockClient = {
			hogqlQuery: vi.fn().mockResolvedValue({
				columns: [],
				results: [],
			}),
		} as unknown as PostHogClient;

		const tool = createHogqlQueryTool(mockClient);
		await tool.execute("call-1", { query: "SELECT 1", limit: 99999 });
		expect(mockClient.hogqlQuery).toHaveBeenCalledWith("SELECT 1", 10_000);
	});
});
