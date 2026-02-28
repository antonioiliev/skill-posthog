import type { PostHogConfig } from "./types.js";

export const BREAKDOWN_TYPES = ["event", "person", "session"] as const;

export type QueryResult = {
	columns: string[];
	results: unknown[][];
};

export type TrendsResult = {
	results: Array<{
		label: string;
		count: number;
		data: number[];
		labels: string[];
		days: string[];
	}>;
};

export type FunnelsResult = {
	results: Array<{
		action_id: string;
		name: string;
		custom_name?: string;
		order: number;
		count: number;
		media_count?: number;
		average_conversion_time?: number;
	}>;
};

export type RetentionResult = {
	results: Array<{
		date: string;
		label: string;
		values: Array<{ count: number }>;
	}>;
};

export type LifecycleResult = {
	results: Array<{
		status: string;
		label: string;
		data: number[];
		days: string[];
		count: number;
	}>;
};

export type PathsResult = {
	results: Array<{
		source: string;
		target: string;
		value: number;
		source_dropoff?: number;
	}>;
};

export type EventRecord = Record<string, unknown>;

export type PersonRecord = Record<string, unknown>;

export type PaginatedResult<T> = {
	results: T[];
	nextCursor: string | null;
};

type InsightFilterParams = {
	breakdown_by?: string;
	breakdown_type?: string;
	filter_test_accounts?: boolean;
};

export type TrendsParams = InsightFilterParams & {
	events: string[];
	date_from: string;
	date_to?: string;
	interval?: string;
};

export type FunnelsParams = InsightFilterParams & {
	steps: string[];
	date_from: string;
	date_to?: string;
	funnel_window_days?: number;
};

export type RetentionParams = {
	target_entity: string;
	returning_entity?: string;
	date_from: string;
	date_to?: string;
	period?: "Day" | "Week" | "Month";
	retention_type?: "retention_first_time" | "retention_recurring";
	filter_test_accounts?: boolean;
};

export type LifecycleParams = InsightFilterParams & {
	events: string[];
	date_from: string;
	date_to?: string;
	interval?: string;
};

export type PathsParams = {
	date_from: string;
	date_to?: string;
	path_type?: "hogql" | "$pageview" | "$screen" | "custom_event";
	start_point?: string;
	end_point?: string;
	step_limit?: number;
	filter_test_accounts?: boolean;
};

export type ListEventsParams = {
	event?: string;
	person_id?: string;
	properties?: string;
	limit?: number;
	cursor?: string;
};

export type ListPersonsParams = {
	search?: string;
	properties?: string;
	limit?: number;
	cursor?: string;
};

/** Parse the Retry-After header value into milliseconds. */
export function parseRetryAfterHeader(
	header: string | null,
): number {
	if (!header) return 5_000;
	const seconds = Number(header);
	if (!Number.isNaN(seconds) && seconds > 0) {
		return Math.min(seconds * 1_000, 30_000);
	}
	// Try HTTP-date format
	const date = Date.parse(header);
	if (!Number.isNaN(date)) {
		const ms = Math.max(0, date - Date.now());
		return Math.min(ms, 30_000);
	}
	return 5_000;
}

export class PostHogClient {
	private readonly cfg: PostHogConfig;

	constructor(cfg: PostHogConfig) {
		this.cfg = cfg;
	}

	private headers(): Record<string, string> {
		return {
			Authorization: `Bearer ${this.cfg.apiKey}`,
			"Content-Type": "application/json",
		};
	}

	private projectUrl(path: string): string {
		return `${this.cfg.host}/api/projects/${encodeURIComponent(this.cfg.projectId)}${path}`;
	}

	async hogqlQuery(query: string, limit: number): Promise<QueryResult> {
		return await this.postQuery<QueryResult>({
			kind: "HogQLQuery",
			query,
			limit,
		});
	}

	async trendsQuery(params: TrendsParams): Promise<TrendsResult> {
		const series = params.events.map((event) => ({
			kind: "EventsNode",
			event,
		}));

		const body: Record<string, unknown> = {
			kind: "TrendsQuery",
			series,
			dateRange: {
				date_from: params.date_from,
				...(params.date_to && { date_to: params.date_to }),
			},
		};

		if (params.interval) {
			body.interval = params.interval;
		}

		this.applyInsightFilters(body, params);
		return await this.postQuery<TrendsResult>(body);
	}

	async funnelsQuery(params: FunnelsParams): Promise<FunnelsResult> {
		const series = params.steps.map((event) => ({
			kind: "EventsNode",
			event,
		}));

		const body: Record<string, unknown> = {
			kind: "FunnelsQuery",
			series,
			dateRange: {
				date_from: params.date_from,
				...(params.date_to && { date_to: params.date_to }),
			},
			funnelsFilter: {
				funnelWindowIntervalUnit: "day",
				funnelWindowInterval: params.funnel_window_days ?? 14,
			},
		};

		this.applyInsightFilters(body, params);
		return await this.postQuery<FunnelsResult>(body);
	}

	private applyInsightFilters(
		body: Record<string, unknown>,
		params: InsightFilterParams,
	): void {
		if (params.breakdown_by) {
			body.breakdownFilter = {
				breakdowns: [
					{
						property: params.breakdown_by,
						type: params.breakdown_type ?? "event",
					},
				],
			};
		}

		if (params.filter_test_accounts) {
			body.filterTestAccounts = true;
		}
	}

	async listEvents(
		params: ListEventsParams,
	): Promise<PaginatedResult<EventRecord>> {
		if (params.cursor) {
			const data = await this.get<{
				results: EventRecord[];
				next: string | null;
			}>(params.cursor);
			return {
				results: data.results,
				nextCursor: data.next ?? null,
			};
		}

		const searchParams = new URLSearchParams();
		if (params.event) searchParams.set("event", params.event);
		if (params.person_id) searchParams.set("person_id", params.person_id);
		if (params.properties) searchParams.set("properties", params.properties);
		searchParams.set("limit", String(params.limit ?? 20));

		const qs = searchParams.toString();
		const url = this.projectUrl(`/events${qs ? `?${qs}` : ""}`);
		const data = await this.get<{
			results: EventRecord[];
			next: string | null;
		}>(url);
		return { results: data.results, nextCursor: data.next ?? null };
	}

	async listPersons(
		params: ListPersonsParams,
	): Promise<PaginatedResult<PersonRecord>> {
		if (params.cursor) {
			const data = await this.get<{
				results: PersonRecord[];
				next: string | null;
			}>(params.cursor);
			return {
				results: data.results,
				nextCursor: data.next ?? null,
			};
		}

		const searchParams = new URLSearchParams();
		if (params.search) searchParams.set("search", params.search);
		if (params.properties) searchParams.set("properties", params.properties);
		searchParams.set("limit", String(params.limit ?? 10));

		const qs = searchParams.toString();
		const url = this.projectUrl(`/persons${qs ? `?${qs}` : ""}`);
		const data = await this.get<{
			results: PersonRecord[];
			next: string | null;
		}>(url);
		return { results: data.results, nextCursor: data.next ?? null };
	}

	async retentionQuery(params: RetentionParams): Promise<RetentionResult> {
		const body: Record<string, unknown> = {
			kind: "RetentionQuery",
			retentionFilter: {
				targetEntity: { id: params.target_entity, type: "events" },
				returningEntity: {
					id: params.returning_entity ?? params.target_entity,
					type: "events",
				},
				period: params.period ?? "Day",
				retentionType:
					params.retention_type ?? "retention_first_time",
			},
			dateRange: {
				date_from: params.date_from,
				...(params.date_to && { date_to: params.date_to }),
			},
		};
		if (params.filter_test_accounts) {
			body.filterTestAccounts = true;
		}
		return await this.postQuery<RetentionResult>(body);
	}

	async lifecycleQuery(params: LifecycleParams): Promise<LifecycleResult> {
		const series = params.events.map((event) => ({
			kind: "EventsNode",
			event,
		}));

		const body: Record<string, unknown> = {
			kind: "LifecycleQuery",
			series,
			dateRange: {
				date_from: params.date_from,
				...(params.date_to && { date_to: params.date_to }),
			},
		};
		if (params.interval) {
			body.interval = params.interval;
		}
		this.applyInsightFilters(body, params);
		return await this.postQuery<LifecycleResult>(body);
	}

	async pathsQuery(params: PathsParams): Promise<PathsResult> {
		const body: Record<string, unknown> = {
			kind: "PathsQuery",
			pathsFilter: {
				pathType: params.path_type ?? "$pageview",
				...(params.start_point && { startPoint: params.start_point }),
				...(params.end_point && { endPoint: params.end_point }),
				stepLimit: params.step_limit ?? 5,
			},
			dateRange: {
				date_from: params.date_from,
				...(params.date_to && { date_to: params.date_to }),
			},
		};
		if (params.filter_test_accounts) {
			body.filterTestAccounts = true;
		}
		return await this.postQuery<PathsResult>(body);
	}

	private async postQuery<T>(body: Record<string, unknown>): Promise<T> {
		const url = this.projectUrl("/query");
		return this.request<T>(url, {
			method: "POST",
			body: JSON.stringify({ query: body }),
		});
	}

	private async get<T>(url: string): Promise<T> {
		return this.request<T>(url, { method: "GET" });
	}

	private async request<T>(
		url: string,
		init: { method: string; body?: string },
	): Promise<T> {
		const attempt = async (): Promise<T> => {
			const controller = new AbortController();
			const timer = setTimeout(
				() => controller.abort(),
				this.cfg.timeoutMs,
			);

			try {
				const res = await fetch(url, {
					...init,
					headers: this.headers(),
					signal: controller.signal,
				});

				if (!res.ok) {
					await this.handleErrorResponse(res, { url });
				}

				return (await res.json()) as T;
			} finally {
				clearTimeout(timer);
			}
		};

		try {
			return await attempt();
		} catch (err) {
			// Retry once on 429 rate limit
			if (
				err instanceof Error &&
				err.message.startsWith("PostHog rate limited")
			) {
				const retryMs =
					(err as Error & { retryAfterMs?: number }).retryAfterMs ??
					5_000;
				await sleep(retryMs);
				return await attempt();
			}

			// Retry once on network errors (fetch throws TypeError)
			if (err instanceof TypeError) {
				await sleep(1_000);
				return await attempt();
			}

			throw err;
		}
	}

	private async handleErrorResponse(
		res: Response,
		context?: { url: string },
	): Promise<never> {
		let detail = "";
		try {
			const text = await res.text();
			detail = text.slice(0, 500);
		} catch {
			// ignore
		}

		const urlPath = context?.url
			? ` (${new URL(context.url).pathname})`
			: "";

		switch (res.status) {
			case 401:
				throw new Error("PostHog auth failed: invalid API key");
			case 403:
				throw new Error(
					`PostHog access denied${urlPath}: insufficient permissions. ${detail}`,
				);
			case 404:
				throw new Error(
					`PostHog resource not found${urlPath}. ${detail}`,
				);
			case 429: {
				const retryMs = parseRetryAfterHeader(
					res.headers.get("Retry-After"),
				);
				const err = new Error(
					`PostHog rate limited${urlPath}. ${detail}`,
				);
				(err as Error & { retryAfterMs: number }).retryAfterMs =
					retryMs;
				throw err;
			}
			default:
				throw new Error(
					`PostHog API error (${res.status})${urlPath}: ${detail || res.statusText}`,
				);
		}
	}
}

function sleep(ms: number): Promise<void> {
	return new Promise((resolve) => setTimeout(resolve, ms));
}
