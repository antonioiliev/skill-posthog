import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { PostHogClient, parseRetryAfterHeader } from "./client.js";
import type { PostHogConfig } from "./types.js";

const cfg: PostHogConfig = {
	apiKey: "phx_test",
	projectId: "42",
	host: "https://eu.posthog.com",
	timeoutMs: 30_000,
};

function mockFetchOk(body: unknown) {
	return vi.fn().mockResolvedValue({
		ok: true,
		json: () => Promise.resolve(body),
	});
}

function mockFetchError(status: number, body = "", headers?: Record<string, string>) {
	return vi.fn().mockResolvedValue({
		ok: false,
		status,
		statusText: "Error",
		text: () => Promise.resolve(body),
		headers: new Headers(headers),
	});
}

describe("parseRetryAfterHeader", () => {
	it("returns default 5s for null", () => {
		expect(parseRetryAfterHeader(null)).toBe(5_000);
	});

	it("parses integer seconds", () => {
		expect(parseRetryAfterHeader("10")).toBe(10_000);
	});

	it("caps at 30s", () => {
		expect(parseRetryAfterHeader("60")).toBe(30_000);
	});

	it("returns default for non-numeric string", () => {
		expect(parseRetryAfterHeader("not-a-number")).toBe(5_000);
	});
});

describe("PostHogClient", () => {
	let client: PostHogClient;

	beforeEach(() => {
		client = new PostHogClient(cfg);
	});

	afterEach(() => {
		vi.restoreAllMocks();
		vi.unstubAllGlobals();
	});

	describe("hogqlQuery", () => {
		it("sends correct request and returns result", async () => {
			const body = { columns: ["event"], results: [["$pageview"]] };
			vi.stubGlobal("fetch", mockFetchOk(body));

			const result = await client.hogqlQuery("SELECT event FROM events LIMIT 1", 100);
			expect(result).toEqual(body);

			const call = vi.mocked(fetch).mock.calls[0]!;
			expect(call[0]).toBe(
				"https://eu.posthog.com/api/projects/42/query",
			);
			const parsed = JSON.parse(call[1]!.body as string);
			expect(parsed.query.kind).toBe("HogQLQuery");
			expect(parsed.query.query).toBe("SELECT event FROM events LIMIT 1");
			expect(parsed.query.limit).toBe(100);
		});
	});

	describe("trendsQuery", () => {
		it("builds correct body", async () => {
			const body = { results: [] };
			vi.stubGlobal("fetch", mockFetchOk(body));

			await client.trendsQuery({
				events: ["$pageview"],
				date_from: "-7d",
				interval: "day",
			});

			const parsed = JSON.parse(
				vi.mocked(fetch).mock.calls[0]![1]!.body as string,
			);
			expect(parsed.query.kind).toBe("TrendsQuery");
			expect(parsed.query.series).toEqual([
				{ kind: "EventsNode", event: "$pageview" },
			]);
			expect(parsed.query.interval).toBe("day");
		});
	});

	describe("funnelsQuery", () => {
		it("builds correct body with window days", async () => {
			vi.stubGlobal("fetch", mockFetchOk({ results: [] }));

			await client.funnelsQuery({
				steps: ["sign_up", "purchase"],
				date_from: "-30d",
				funnel_window_days: 7,
			});

			const parsed = JSON.parse(
				vi.mocked(fetch).mock.calls[0]![1]!.body as string,
			);
			expect(parsed.query.kind).toBe("FunnelsQuery");
			expect(parsed.query.funnelsFilter.funnelWindowInterval).toBe(7);
		});
	});

	describe("retentionQuery", () => {
		it("builds correct body", async () => {
			vi.stubGlobal("fetch", mockFetchOk({ results: [] }));

			await client.retentionQuery({
				target_entity: "sign_up",
				date_from: "-30d",
				period: "Week",
			});

			const parsed = JSON.parse(
				vi.mocked(fetch).mock.calls[0]![1]!.body as string,
			);
			expect(parsed.query.kind).toBe("RetentionQuery");
			expect(parsed.query.retentionFilter.targetEntity).toEqual({
				id: "sign_up",
				type: "events",
			});
			expect(parsed.query.retentionFilter.period).toBe("Week");
		});
	});

	describe("lifecycleQuery", () => {
		it("builds correct body", async () => {
			vi.stubGlobal("fetch", mockFetchOk({ results: [] }));

			await client.lifecycleQuery({
				events: ["$pageview"],
				date_from: "-30d",
			});

			const parsed = JSON.parse(
				vi.mocked(fetch).mock.calls[0]![1]!.body as string,
			);
			expect(parsed.query.kind).toBe("LifecycleQuery");
		});
	});

	describe("pathsQuery", () => {
		it("builds correct body", async () => {
			vi.stubGlobal("fetch", mockFetchOk({ results: [] }));

			await client.pathsQuery({
				date_from: "-30d",
				path_type: "$screen",
				step_limit: 3,
			});

			const parsed = JSON.parse(
				vi.mocked(fetch).mock.calls[0]![1]!.body as string,
			);
			expect(parsed.query.kind).toBe("PathsQuery");
			expect(parsed.query.pathsFilter.pathType).toBe("$screen");
			expect(parsed.query.pathsFilter.stepLimit).toBe(3);
		});
	});

	describe("listEvents", () => {
		it("returns paginated result", async () => {
			const data = {
				results: [{ event: "$pageview" }],
				next: "https://eu.posthog.com/api/projects/42/events?cursor=abc",
			};
			vi.stubGlobal("fetch", mockFetchOk(data));

			const result = await client.listEvents({ limit: 10 });
			expect(result.results).toEqual([{ event: "$pageview" }]);
			expect(result.nextCursor).toBe(data.next);
		});

		it("uses cursor URL directly when provided", async () => {
			const cursorUrl =
				"https://eu.posthog.com/api/projects/42/events?cursor=abc";
			vi.stubGlobal(
				"fetch",
				mockFetchOk({ results: [], next: null }),
			);

			await client.listEvents({ cursor: cursorUrl });
			expect(vi.mocked(fetch).mock.calls[0]![0]).toBe(cursorUrl);
		});
	});

	describe("listPersons", () => {
		it("returns paginated result", async () => {
			const data = {
				results: [{ name: "Test User" }],
				next: null,
			};
			vi.stubGlobal("fetch", mockFetchOk(data));

			const result = await client.listPersons({ search: "test" });
			expect(result.results).toEqual([{ name: "Test User" }]);
			expect(result.nextCursor).toBeNull();
		});
	});

	describe("error handling", () => {
		it("throws on 401", async () => {
			vi.stubGlobal("fetch", mockFetchError(401));
			await expect(client.hogqlQuery("SELECT 1", 1)).rejects.toThrow(
				"PostHog auth failed: invalid API key",
			);
		});

		it("throws on 403 with URL path", async () => {
			vi.stubGlobal("fetch", mockFetchError(403, "forbidden"));
			await expect(client.hogqlQuery("SELECT 1", 1)).rejects.toThrow(
				/PostHog access denied.*\/api\/projects\/42\/query/,
			);
		});

		it("throws on 404 with URL path", async () => {
			vi.stubGlobal("fetch", mockFetchError(404, "not found"));
			await expect(client.hogqlQuery("SELECT 1", 1)).rejects.toThrow(
				/PostHog resource not found.*\/api\/projects\/42\/query/,
			);
		});

		it("throws generic error with status code", async () => {
			vi.stubGlobal("fetch", mockFetchError(500, "internal"));
			await expect(client.hogqlQuery("SELECT 1", 1)).rejects.toThrow(
				/PostHog API error \(500\)/,
			);
		});
	});

	describe("retry logic", () => {
		it("retries once on 429 with Retry-After header", async () => {
			const rateLimitRes = {
				ok: false,
				status: 429,
				statusText: "Too Many Requests",
				text: () => Promise.resolve("rate limited"),
				headers: new Headers({ "Retry-After": "1" }),
			};
			const okRes = {
				ok: true,
				json: () =>
					Promise.resolve({ columns: ["x"], results: [[1]] }),
			};

			const mockFn = vi
				.fn()
				.mockResolvedValueOnce(rateLimitRes)
				.mockResolvedValueOnce(okRes);
			vi.stubGlobal("fetch", mockFn);

			const result = await client.hogqlQuery("SELECT 1", 1);
			expect(result).toEqual({ columns: ["x"], results: [[1]] });
			expect(mockFn).toHaveBeenCalledTimes(2);
		});

		it("retries once on network error (TypeError)", async () => {
			const okRes = {
				ok: true,
				json: () =>
					Promise.resolve({ columns: ["x"], results: [[1]] }),
			};

			const mockFn = vi
				.fn()
				.mockRejectedValueOnce(new TypeError("fetch failed"))
				.mockResolvedValueOnce(okRes);
			vi.stubGlobal("fetch", mockFn);

			const result = await client.hogqlQuery("SELECT 1", 1);
			expect(result).toEqual({ columns: ["x"], results: [[1]] });
			expect(mockFn).toHaveBeenCalledTimes(2);
		});

		it("does not retry on non-retryable errors", async () => {
			vi.stubGlobal("fetch", mockFetchError(401));
			await expect(client.hogqlQuery("SELECT 1", 1)).rejects.toThrow(
				"PostHog auth failed",
			);
			expect(vi.mocked(fetch)).toHaveBeenCalledTimes(1);
		});
	});
});
