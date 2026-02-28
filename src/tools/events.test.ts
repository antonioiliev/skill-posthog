import { describe, expect, it, vi } from "vitest";
import {
	selectDisplayProperties,
	formatEvents,
	createEventsTool,
} from "./events.js";
import type { PostHogClient } from "../client.js";

describe("selectDisplayProperties", () => {
	it("returns tier 1 properties first", () => {
		const props = {
			$current_url: "https://example.com",
			$pathname: "/home",
			$browser: "Chrome",
			$os: "Mac",
			$referrer: "https://google.com",
		};
		const result = selectDisplayProperties(props, 3);
		expect(result[0]).toContain("$current_url");
		expect(result[1]).toContain("$pathname");
		expect(result[2]).toContain("$browser");
	});

	it("fills remaining slots with custom properties", () => {
		const props = {
			$current_url: "https://example.com",
			plan: "pro",
			role: "admin",
		};
		const result = selectDisplayProperties(props, 8);
		expect(result).toContainEqual(expect.stringContaining("plan"));
		expect(result).toContainEqual(expect.stringContaining("role"));
	});

	it("skips internal properties", () => {
		const props = {
			$ip: "127.0.0.1",
			$lib: "posthog-js",
			$insert_id: "abc",
			$session_id: "xyz",
			$current_url: "https://example.com",
		};
		const result = selectDisplayProperties(props);
		expect(result.join(",")).not.toContain("$ip");
		expect(result.join(",")).not.toContain("$lib");
		expect(result.join(",")).not.toContain("$insert_id");
	});

	it("respects maxProps limit", () => {
		const props = {
			$current_url: "a",
			$pathname: "b",
			$host: "c",
			$browser: "d",
			$os: "e",
			$device_type: "f",
			$referrer: "g",
			$referring_domain: "h",
			custom1: "i",
		};
		const result = selectDisplayProperties(props, 4);
		expect(result.length).toBe(4);
	});
});

describe("formatEvents", () => {
	it("returns empty message for no events", () => {
		expect(formatEvents([])).toBe("No events found.");
	});

	it("formats event list", () => {
		const events = [
			{
				event: "$pageview",
				timestamp: "2024-01-01T00:00:00Z",
				distinct_id: "user-1",
				properties: {
					$current_url: "https://example.com",
					$browser: "Chrome",
				},
			},
		];
		const text = formatEvents(events);
		expect(text).toContain("## Events (1)");
		expect(text).toContain("### $pageview");
		expect(text).toContain("**Time:** 2024-01-01T00:00:00Z");
		expect(text).toContain("**Distinct ID:** user-1");
		expect(text).toContain("$browser: Chrome");
	});

	it("includes pagination note when cursor is present", () => {
		const text = formatEvents(
			[{ event: "test", timestamp: "now" }],
			"https://example.com/next",
		);
		expect(text).toContain("More results available");
		expect(text).toContain("https://example.com/next");
	});
});

describe("createEventsTool", () => {
	it("calls client.listEvents and returns formatted content", async () => {
		const mockClient = {
			listEvents: vi.fn().mockResolvedValue({
				results: [{ event: "$pageview", timestamp: "now" }],
				nextCursor: null,
			}),
		} as unknown as PostHogClient;

		const tool = createEventsTool(mockClient);
		const result = await tool.execute("call-1", { limit: 5 });

		expect(mockClient.listEvents).toHaveBeenCalledWith(
			expect.objectContaining({ limit: 5 }),
		);
		expect(result.content[0]!.text).toContain("$pageview");
		expect(result.details.next_cursor).toBeNull();
	});

	it("passes cursor to client", async () => {
		const mockClient = {
			listEvents: vi.fn().mockResolvedValue({
				results: [],
				nextCursor: null,
			}),
		} as unknown as PostHogClient;

		const tool = createEventsTool(mockClient);
		await tool.execute("call-1", { cursor: "https://example.com/next" });

		expect(mockClient.listEvents).toHaveBeenCalledWith(
			expect.objectContaining({ cursor: "https://example.com/next" }),
		);
	});
});
