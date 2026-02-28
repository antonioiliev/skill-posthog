# PostHog Skill for OpenClaw

Read-only PostHog analytics tools for querying event data, trends, funnels, retention, lifecycle, paths, and person lookups — all from within OpenClaw.

## Overview

This skill exposes 8 tools that let an AI agent query PostHog product analytics data:

| Tool | Purpose |
| --- | --- |
| `posthog_query` | Ad-hoc HogQL (SQL-like) queries |
| `posthog_trends` | Time-series event volume trends |
| `posthog_funnel` | Multi-step conversion funnels |
| `posthog_retention` | Cohort retention curves |
| `posthog_lifecycle` | User lifecycle stages (new/returning/resurrecting/dormant) |
| `posthog_paths` | User navigation path analysis |
| `posthog_events` | Browse individual event records |
| `posthog_persons` | Search and list user profiles |

All tools are **read-only** — they cannot create events, modify persons, or change PostHog settings.

## Setup

### Configuration

Add to your OpenClaw plugin config:

```json
{
  "apiKey": "phx_your_personal_api_key",
  "projectId": "12345",
  "host": "https://eu.posthog.com",
  "timeoutMs": 30000
}
```

| Field | Required | Default | Description |
| --- | --- | --- | --- |
| `apiKey` | Yes | — | PostHog personal API key. Supports `${ENV_VAR}` interpolation. |
| `projectId` | Yes | — | PostHog project ID |
| `host` | No | `https://eu.posthog.com` | PostHog instance URL |
| `timeoutMs` | No | `30000` | Request timeout in ms (5,000–300,000) |

### Environment Variable Interpolation

API keys can reference environment variables:

```json
{
  "apiKey": "${POSTHOG_API_KEY}",
  "projectId": "12345"
}
```

## Tools Reference

### posthog_query — HogQL Query

Run arbitrary SQL-like queries against PostHog's HogQL engine.

**Parameters:**

| Param | Type | Required | Description |
| --- | --- | --- | --- |
| `query` | string | Yes | HogQL SQL query |
| `limit` | number | No | Max rows (default: 100, max: 10,000) |

**Example output:**

```
## HogQL Query Results
**Rows:** 3

| event | count |
| --- | --- |
| $pageview | 12450 |
| sign_up | 342 |
| purchase | 89 |
```

### posthog_trends — Trend Analysis

Time-series event counts with optional breakdowns.

**Parameters:**

| Param | Type | Required | Description |
| --- | --- | --- | --- |
| `events` | string[] | Yes | Event names to query |
| `date_from` | string | Yes | Start date (`-7d`, `-30d`, `2024-01-01`) |
| `date_to` | string | No | End date (defaults to now) |
| `interval` | string | No | `hour`, `day`, `week`, or `month` |
| `breakdown_by` | string | No | Property to break down by |
| `breakdown_type` | string | No | `event`, `person`, or `session` |
| `filter_test_accounts` | boolean | No | Exclude test accounts |

### posthog_funnel — Funnel Analysis

Multi-step conversion with drop-off rates and average time between steps.

**Parameters:**

| Param | Type | Required | Description |
| --- | --- | --- | --- |
| `steps` | string[] | Yes | Ordered event names (min 2) |
| `date_from` | string | Yes | Start date |
| `date_to` | string | No | End date |
| `funnel_window_days` | number | No | Conversion window in days (default: 14) |
| `breakdown_by` | string | No | Property to break down by |
| `breakdown_type` | string | No | `event`, `person`, or `session` |
| `filter_test_accounts` | boolean | No | Exclude test accounts |

**Example output:**

```
## Funnel Analysis

| Step | Event | Count | Conversion | Drop-off | Avg Time to Next |
| --- | --- | --- | --- | --- | --- |
| 1 | $pageview | 1000 | 100% (100.0% overall) | — | 2.5m |
| 2 | sign_up | 200 | 20.0% (20.0% overall) | 800 | 1.2h |
| 3 | purchase | 50 | 25.0% (5.0% overall) | 150 | — |
```

### posthog_retention — Retention Analysis

Cohort retention grids showing what % of users return over time.

**Parameters:**

| Param | Type | Required | Description |
| --- | --- | --- | --- |
| `target_entity` | string | Yes | Event defining cohort entry |
| `returning_entity` | string | No | Event counting as return (defaults to target) |
| `date_from` | string | Yes | Start date |
| `date_to` | string | No | End date |
| `period` | string | No | `Day`, `Week`, or `Month` |
| `retention_type` | string | No | `retention_first_time` or `retention_recurring` |
| `filter_test_accounts` | boolean | No | Exclude test accounts |

### posthog_lifecycle — User Lifecycle

Breakdown of active users into new, returning, resurrecting, and dormant.

**Parameters:**

| Param | Type | Required | Description |
| --- | --- | --- | --- |
| `events` | string[] | Yes | Events that define user activity |
| `date_from` | string | Yes | Start date |
| `date_to` | string | No | End date |
| `interval` | string | No | `day`, `week`, or `month` |
| `breakdown_by` | string | No | Property to break down by |
| `breakdown_type` | string | No | `event`, `person`, or `session` |
| `filter_test_accounts` | boolean | No | Exclude test accounts |

### posthog_paths — User Paths

Discover how users navigate between pages, screens, or events.

**Parameters:**

| Param | Type | Required | Description |
| --- | --- | --- | --- |
| `date_from` | string | Yes | Start date |
| `date_to` | string | No | End date |
| `path_type` | string | No | `$pageview`, `$screen`, `custom_event`, or `hogql` |
| `start_point` | string | No | Filter to paths starting from this point |
| `end_point` | string | No | Filter to paths ending at this point |
| `step_limit` | number | No | Max steps per path (default: 5) |
| `filter_test_accounts` | boolean | No | Exclude test accounts |

### posthog_events — List Events

Browse individual event records with pagination.

**Parameters:**

| Param | Type | Required | Description |
| --- | --- | --- | --- |
| `event` | string | No | Event name filter |
| `person_id` | string | No | Filter by person ID |
| `properties` | string | No | JSON property filter |
| `limit` | number | No | Results per page (default: 20, max: 100) |
| `cursor` | string | No | Pagination cursor from previous response |

### posthog_persons — Search Persons

Find and list user profiles with pagination.

**Parameters:**

| Param | Type | Required | Description |
| --- | --- | --- | --- |
| `search` | string | No | Search by name, email, or distinct ID |
| `properties` | string | No | JSON property filter |
| `limit` | number | No | Results per page (default: 10, max: 100) |
| `cursor` | string | No | Pagination cursor from previous response |

## Use Cases

Real-world scenarios showing what you can accomplish with this skill and which tools to combine.

### Growth & Activation

**Sign-up funnel health check** — Use `posthog_funnel` with steps like `$pageview → sign_up → onboarding_complete` over the last 30 days. The output shows conversion rates, drop-off counts, and average time between steps. If a specific step has high drop-off, follow up with `posthog_trends` broken down by `$browser` or `$os` to surface device-specific issues.

**User retention after sign-up** — Use `posthog_retention` with `target_entity: sign_up` and `period: Week` to see what percentage of new users come back each week. Pair with `posthog_lifecycle` to understand whether your active user base is growing (more new users) or shrinking (more dormant users).

**New vs returning user composition** — Use `posthog_lifecycle` with `events: [$pageview]` and `interval: week` to see the breakdown of new, returning, resurrecting, and dormant users over time. This answers "is our growth healthy?" at a glance.

### Product Usage & Navigation

**Common user journeys** — Use `posthog_paths` with a `start_point` (e.g., `/`) to discover the most common navigation flows from a specific page. Useful for understanding how users explore your product and where they drop off.

**Top pages by traffic** — Use `posthog_trends` with `breakdown_by: $pathname` or write a HogQL query grouping `$pageview` events by `properties.$pathname`. Both approaches rank pages by visit count.

**Individual user investigation** — First use `posthog_persons` to find a user by email or name, then use `posthog_events` with their `person_id` to see their full activity timeline. Pagination lets you browse through their entire event history.

### Debugging & Investigation

**Error spike analysis** — Use `posthog_trends` with your error event and `interval: hour` to pinpoint when a spike occurred. Then use `posthog_events` to inspect individual error records during that window. Break down by `$browser` or `$os` to check if the issue is device-specific.

**Checkout drop-off diagnosis** — Use `posthog_funnel` to measure the full checkout flow, identify the highest drop-off step, then use `posthog_paths` starting from that step to see where users actually go instead. Drill into individual events with `posthog_events` for session-level detail.

### Revenue & Business Metrics

**Revenue by plan** — Use `posthog_query` (HogQL) to write `SELECT person.properties.plan, sum(toFloat64(properties.amount)) as revenue FROM events WHERE event = 'purchase' ...`. HogQL gives you full SQL flexibility for financial aggregations that the higher-level tools don't cover.

**Conversion by acquisition channel** — Use `posthog_funnel` with `breakdown_by: $referring_domain` to compare funnel performance across traffic sources.

### Custom Ad-hoc Analysis

For anything requiring JOINs, subqueries, window functions, or custom aggregations that don't fit the higher-level tools, use `posthog_query` with HogQL. Examples include median session duration, cohort-level LTV calculations, event sequences that aren't strict funnels, and cross-entity queries joining events with person properties.

## Architecture

### Plugin Loading

The plugin exports a `register(api)` function that:
1. Parses and validates the config (with env var substitution)
2. Creates a single `PostHogClient` instance
3. Registers all 8 tools as optional tools

### Client Design

`PostHogClient` handles all HTTP communication with PostHog's API:

- **Query API** (`POST /api/projects/{id}/query`): Used by HogQL, trends, funnels, retention, lifecycle, and paths tools
- **Events API** (`GET /api/projects/{id}/events`): Used by the events tool
- **Persons API** (`GET /api/projects/{id}/persons`): Used by the persons tool

### Retry Behavior

The client retries failed requests once in two cases:

- **429 Rate Limit**: Parses the `Retry-After` header, waits (capped at 30s, fallback 5s), then retries once
- **Network Error**: On `TypeError` from `fetch()` (connection failures), waits 1s then retries once

Non-retryable errors (401, 403, 404, 5xx) are thrown immediately.

### Pagination

The events and persons tools support cursor-based pagination. When more results exist, the response includes a `next_cursor` value. Passing this as the `cursor` parameter fetches the next page — the cursor URL is self-contained, so other filter parameters are ignored.

## HogQL Examples

```sql
-- Top events by count
SELECT event, count() FROM events
GROUP BY event ORDER BY count() DESC LIMIT 10

-- Daily active users (last 7 days)
SELECT toDate(timestamp) as day, count(DISTINCT distinct_id) FROM events
WHERE timestamp > now() - INTERVAL 7 DAY
GROUP BY day ORDER BY day

-- Revenue by plan (last 30 days)
SELECT person.properties.plan as plan, sum(toFloat64(properties.amount)) as revenue
FROM events WHERE event = 'purchase' AND timestamp > now() - INTERVAL 30 DAY
GROUP BY plan ORDER BY revenue DESC

-- Browser breakdown for pageviews
SELECT properties.$browser, count() FROM events
WHERE event = '$pageview' GROUP BY properties.$browser
ORDER BY count() DESC

-- New users per day
SELECT toDate(created_at) as day, count() FROM persons
WHERE created_at > now() - INTERVAL 30 DAY
GROUP BY day ORDER BY day

-- Top pages by unique visitors
SELECT properties.$pathname as path, count(DISTINCT distinct_id) as visitors
FROM events WHERE event = '$pageview' AND timestamp > now() - INTERVAL 7 DAY
GROUP BY path ORDER BY visitors DESC LIMIT 20
```

## Development

### Project Structure

```
skill-posthog/
├── index.ts                    # Plugin entry point
├── SKILL.md                    # Agent-facing documentation
├── README.md                   # Human-facing documentation (this file)
├── openclaw.plugin.json        # Plugin config schema
├── package.json
├── vitest.config.ts
└── src/
    ├── client.ts               # PostHogClient (HTTP, retry, pagination)
    ├── client.test.ts
    ├── types.ts                # Config parsing
    ├── types.test.ts
    └── tools/
        ├── hogql-query.ts      # posthog_query tool
        ├── hogql-query.test.ts
        ├── trends.ts           # posthog_trends tool
        ├── trends.test.ts
        ├── funnel.ts           # posthog_funnel tool
        ├── funnel.test.ts
        ├── retention.ts        # posthog_retention tool
        ├── retention.test.ts
        ├── lifecycle.ts        # posthog_lifecycle tool
        ├── lifecycle.test.ts
        ├── paths.ts            # posthog_paths tool
        ├── paths.test.ts
        ├── events.ts           # posthog_events tool
        ├── events.test.ts
        ├── persons.ts          # posthog_persons tool
        └── persons.test.ts
```

### Running Tests

```bash
cd skill-posthog
pnpm test
```

### Type Checking

```bash
pnpm tsc --noEmit
```
