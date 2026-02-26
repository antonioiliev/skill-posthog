---
name: posthog
description: "Product analytics: query PostHog event data, trends, funnels, event listings, and person lookups. Triggers on: 'analytics', 'posthog', 'event trends', 'conversion funnel', 'pageviews', 'user events', 'HogQL', 'product metrics', 'event volume', 'user lookup'."
metadata: { "openclaw": { "always": true } }
---

# PostHog Analytics Skill

Query PostHog product analytics — event trends, conversion funnels, ad-hoc HogQL queries, event listings, and person lookups.

## Tools

### posthog_query — HogQL Query

The most flexible tool. Write SQL-like queries against PostHog's HogQL engine.

**When to use:** When you need custom aggregations, complex filters, or anything not covered by the higher-level tools. Supports full HogQL syntax including JOINs, subqueries, and window functions.

**Examples:**
- Top events: `SELECT event, count() FROM events GROUP BY event ORDER BY count() DESC LIMIT 10`
- Daily active users: `SELECT toDate(timestamp) as day, count(DISTINCT distinct_id) FROM events WHERE timestamp > now() - INTERVAL 7 DAY GROUP BY day ORDER BY day`
- Property breakdown: `SELECT properties.$browser, count() FROM events WHERE event = '$pageview' GROUP BY properties.$browser ORDER BY count() DESC`

**Returns:** Markdown table with query results.

### posthog_trends — Trend Analysis

High-level time-series data for event volumes.

**When to use:** When the agent needs to see how event counts change over time, compare multiple events, or break down trends by a property. Simpler than writing HogQL for standard trend queries.

**Parameters:**
- `events`: Array of event names (required)
- `date_from`: Start date, e.g. `-7d`, `-30d`, `2024-01-01` (required)
- `date_to`: End date (optional, defaults to now)
- `interval`: `hour`, `day`, `week`, or `month`
- `breakdown_by`: Property to break down by
- `filter_test_accounts`: Exclude test users

**Returns:** Per-event totals and interval-level counts as markdown tables.

### posthog_funnel — Funnel Analysis

Multi-step conversion measurement.

**When to use:** When measuring conversion rates between sequential user actions — e.g., page view → sign up → purchase.

**Parameters:**
- `steps`: Ordered list of event names (min 2, required)
- `date_from`: Start date (required)
- `funnel_window_days`: Days users have to complete the funnel (default 14)
- `breakdown_by`: Property to break down by

**Returns:** Step-by-step conversion rates and drop-off counts.

### posthog_events — List Events

Browse individual event records.

**When to use:** When you need to see raw event data — recent occurrences of an event, events from a specific user, or events matching property filters.

**Parameters:**
- `event`: Event name filter
- `person_id`: Filter by person/user
- `properties`: JSON property filter string
- `limit`: Number of events (default 20, max 100)

**Returns:** Formatted event list with timestamps and key properties.

### posthog_persons — Search Persons

Find and list users.

**When to use:** When looking up specific users by name, email, or distinct ID, or browsing user profiles.

**Parameters:**
- `search`: Name, email, or distinct ID
- `properties`: JSON property filter string
- `limit`: Number of persons (default 10, max 100)

**Returns:** Person profiles with emails, distinct IDs, and custom properties.

## Agent Delegation

The PostHog skill is designed for the **data/analytics agent** to use directly. The main agent should delegate analytics questions to a sub-agent that has access to these tools.

**Routing pattern:**
1. User asks a product analytics question (e.g., "How many sign-ups last week?")
2. Main agent delegates to analytics sub-agent
3. Sub-agent selects the right PostHog tool and queries the data
4. Sub-agent formats the answer and returns it

## When NOT to Use

- **Real-time dashboards**: These tools fetch point-in-time snapshots, not live streams
- **Data mutations**: These tools are read-only — they cannot create events, update persons, or modify PostHog settings
- **Feature flags / experiments**: Use the PostHog UI or dedicated feature flag APIs instead
