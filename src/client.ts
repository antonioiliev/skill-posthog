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

export type EventRecord = Record<string, unknown>;

export type PersonRecord = Record<string, unknown>;

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

export type ListEventsParams = {
	event?: string;
	person_id?: string;
	properties?: string;
	limit?: number;
};

export type ListPersonsParams = {
	search?: string;
	properties?: string;
	limit?: number;
};

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

	async listEvents(params: ListEventsParams): Promise<EventRecord[]> {
		const searchParams = new URLSearchParams();
		if (params.event) searchParams.set("event", params.event);
		if (params.person_id) searchParams.set("person_id", params.person_id);
		if (params.properties) searchParams.set("properties", params.properties);
		searchParams.set("limit", String(params.limit ?? 20));

		const qs = searchParams.toString();
		const url = this.projectUrl(`/events${qs ? `?${qs}` : ""}`);
		const data = await this.get<{ results: EventRecord[] }>(url);
		return data.results;
	}

	async listPersons(params: ListPersonsParams): Promise<PersonRecord[]> {
		const searchParams = new URLSearchParams();
		if (params.search) searchParams.set("search", params.search);
		if (params.properties) searchParams.set("properties", params.properties);
		searchParams.set("limit", String(params.limit ?? 10));

		const qs = searchParams.toString();
		const url = this.projectUrl(`/persons${qs ? `?${qs}` : ""}`);
		const data = await this.get<{ results: PersonRecord[] }>(url);
		return data.results;
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
		const controller = new AbortController();
		const timer = setTimeout(() => controller.abort(), this.cfg.timeoutMs);

		try {
			const res = await fetch(url, {
				...init,
				headers: this.headers(),
				signal: controller.signal,
			});

			if (!res.ok) {
				await this.handleErrorResponse(res);
			}

			return (await res.json()) as T;
		} finally {
			clearTimeout(timer);
		}
	}

	private async handleErrorResponse(res: Response): Promise<never> {
		let detail = "";
		try {
			const text = await res.text();
			detail = text.slice(0, 500);
		} catch {
			// ignore
		}

		switch (res.status) {
			case 401:
				throw new Error("PostHog auth failed: invalid API key");
			case 403:
				throw new Error(
					`PostHog access denied: insufficient permissions. ${detail}`,
				);
			case 404:
				throw new Error(`PostHog resource not found. ${detail}`);
			case 429:
				throw new Error(`PostHog rate limited. ${detail}`);
			default:
				throw new Error(
					`PostHog API error (${res.status}): ${detail || res.statusText}`,
				);
		}
	}
}
