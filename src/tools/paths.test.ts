import { describe, expect, it, vi } from "vitest";
import { formatPathsResult, createPathsTool } from "./paths.js";
import type { PostHogClient, PathsResult } from "../client.js";

describe("formatPathsResult", () => {
	it("returns empty message for no results", () => {
		expect(formatPathsResult({ results: [] })).toBe(
			"Paths query returned no results.",
		);
	});

	it("formats path edges sorted by value", () => {
		const result: PathsResult = {
			results: [
				{ source: "/home", target: "/about", value: 50 },
				{ source: "/home", target: "/pricing", value: 150, source_dropoff: 20 },
				{ source: "/pricing", target: "/signup", value: 80 },
			],
		};

		const text = formatPathsResult(result);
		expect(text).toContain("## User Path Analysis");
		expect(text).toContain("Showing top 3 path edges");
		// Check sorted order: 150, 80, 50
		const lines = text.split("\n").filter((l) => l.startsWith("| /"));
		expect(lines[0]).toContain("150");
		expect(lines[1]).toContain("80");
		expect(lines[2]).toContain("50");
	});

	it("caps at 30 edges", () => {
		const edges = Array.from({ length: 50 }, (_, i) => ({
			source: `/page${i}`,
			target: `/page${i + 1}`,
			value: 50 - i,
		}));
		const result: PathsResult = { results: edges };

		const text = formatPathsResult(result);
		expect(text).toContain("of 50 total");
		const dataLines = text
			.split("\n")
			.filter((l) => l.startsWith("| /"));
		expect(dataLines.length).toBe(30);
	});

	it("shows drop-off when present", () => {
		const result: PathsResult = {
			results: [
				{ source: "/a", target: "/b", value: 100, source_dropoff: 25 },
			],
		};
		const text = formatPathsResult(result);
		expect(text).toContain("| 25 |");
	});

	it("shows — when drop-off is absent", () => {
		const result: PathsResult = {
			results: [{ source: "/a", target: "/b", value: 100 }],
		};
		const text = formatPathsResult(result);
		expect(text).toContain("| — |");
	});
});

describe("createPathsTool", () => {
	it("calls client.pathsQuery", async () => {
		const mockClient = {
			pathsQuery: vi.fn().mockResolvedValue({
				results: [
					{ source: "/", target: "/about", value: 10 },
				],
			}),
		} as unknown as PostHogClient;

		const tool = createPathsTool(mockClient);
		const result = await tool.execute("call-1", {
			date_from: "-7d",
		});

		expect(mockClient.pathsQuery).toHaveBeenCalledWith(
			expect.objectContaining({ date_from: "-7d" }),
		);
		expect(result.content[0]!.text).toContain("Path Analysis");
	});

	it("throws on missing date_from", async () => {
		const tool = createPathsTool({} as PostHogClient);
		await expect(
			tool.execute("call-1", { date_from: "" }),
		).rejects.toThrow("date_from is required");
	});
});
