---
name: posthog
description: "Product analytics: query PostHog event data, trends, funnels, retention, lifecycle, paths, event listings, and person lookups. Triggers on: 'analytics', 'posthog', 'event trends', 'conversion funnel', 'pageviews', 'user events', 'HogQL', 'product metrics', 'event volume', 'user lookup', 'retention', 'lifecycle', 'user paths'."
metadata: { "openclaw": { "always": true } }
---

# PostHog Analytics Skill

Query PostHog product analytics — event trends, conversion funnels, retention curves, user lifecycle, navigation paths, ad-hoc HogQL queries, event listings, and person lookups.

## Tool Selection Guide

| Question | Tool |
| --- | --- |
| "How many X over time?" | `posthog_trends` |
| "What % go A→B→C?" | `posthog_funnel` |
| "Do users come back after day 1/7/30?" | `posthog_retention` |
| "How many new vs returning vs dormant users?" | `posthog_lifecycle` |
| "What pages do users navigate between?" | `posthog_paths` |
| "Show me the last 20 sign_up events" | `posthog_events` |
| "Find user john@example.com" | `posthog_persons` |
| Custom SQL / complex aggregation | `posthog_query` (HogQL) |

## Tools

### posthog_query — HogQL Query

The most flexible tool. Write SQL-like queries against PostHog's HogQL engine.

**When to use:** When you need custom aggregations, complex filters, or anything not covered by the higher-level tools. Supports full HogQL syntax including JOINs, subqueries, and window functions. For standard time-series data use posthog_trends instead; for conversion analysis use posthog_funnel.

**HogQL Property Access Patterns:**
- Event properties: `properties.$browser`, `properties.$os`
- Person properties: `person.properties.email`, `person.properties.name`
- Date filtering: `WHERE timestamp > now() - INTERVAL 7 DAY`
- Date truncation: `toDate(timestamp)`, `toStartOfWeek(timestamp)`

**Examples:**
- Top events: `SELECT event, count() FROM events GROUP BY event ORDER BY count() DESC LIMIT 10`
- Daily active users: `SELECT toDate(timestamp) as day, count(DISTINCT distinct_id) FROM events WHERE timestamp > now() - INTERVAL 7 DAY GROUP BY day ORDER BY day`
- Property breakdown: `SELECT properties.$browser, count() FROM events WHERE event = '$pageview' GROUP BY properties.$browser ORDER BY count() DESC`
- Revenue by plan: `SELECT person.properties.plan as plan, sum(toFloat64(properties.amount)) as revenue FROM events WHERE event = 'purchase' AND timestamp > now() - INTERVAL 30 DAY GROUP BY plan ORDER BY revenue DESC`
- New users per day: `SELECT toDate(created_at) as day, count() FROM persons WHERE created_at > now() - INTERVAL 30 DAY GROUP BY day ORDER BY day`
- Pageviews per session: `SELECT properties.$session_id, count() as views FROM events WHERE event = '$pageview' AND timestamp > now() - INTERVAL 1 DAY GROUP BY properties.$session_id ORDER BY views DESC LIMIT 20`
- Event property distribution: `SELECT properties.$device_type, count() FROM events WHERE event = '$pageview' AND timestamp > now() - INTERVAL 7 DAY GROUP BY properties.$device_type ORDER BY count() DESC`
- Users by country: `SELECT person.properties.$geoip_country_name as country, count(DISTINCT distinct_id) FROM events WHERE timestamp > now() - INTERVAL 30 DAY GROUP BY country ORDER BY count(DISTINCT distinct_id) DESC LIMIT 20`
- Funnel timing via HogQL: `SELECT avg(dateDiff('second', first_ts, second_ts)) FROM (SELECT distinct_id, min(timestamp) as first_ts FROM events WHERE event = 'sign_up' GROUP BY distinct_id) a JOIN (SELECT distinct_id, min(timestamp) as second_ts FROM events WHERE event = 'purchase' GROUP BY distinct_id) b ON a.distinct_id = b.distinct_id`

**Returns:** Markdown table with query results.

### posthog_trends — Trend Analysis

High-level time-series data for event volumes.

**When to use:** When the agent needs to see how event counts change over time, compare multiple events, or break down trends by a property. Simpler than writing HogQL for standard trend queries. NOT for conversion funnels (use posthog_funnel), retention curves (use posthog_retention), or user lifecycle (use posthog_lifecycle).

**Parameters:**
- `events`: Array of event names (required)
- `date_from`: Start date, e.g. `-7d`, `-30d`, `2024-01-01` (required)
- `date_to`: End date (optional, defaults to now)
- `interval`: `hour`, `day`, `week`, or `month`
- `breakdown_by`: Property to break down by
- `filter_test_accounts`: Exclude test users

**Returns:** Per-event totals and interval-level counts as markdown tables.

### posthog_funnel — Funnel Analysis

Multi-step conversion measurement with average time between steps.

**When to use:** When measuring conversion rates between sequential user actions — e.g., page view → sign up → purchase. NOT for time-series trends (use posthog_trends), retention curves (use posthog_retention), or navigation paths (use posthog_paths).

**Parameters:**
- `steps`: Ordered list of event names (min 2, required)
- `date_from`: Start date (required)
- `funnel_window_days`: Days users have to complete the funnel (default 14)
- `breakdown_by`: Property to break down by

**Returns:** Step-by-step conversion rates, drop-off counts, and average time to next step.

### posthog_retention — Retention Analysis

Cohort retention — what % of users return over time.

**When to use:** When measuring if users who performed a target event come back to perform a returning event over subsequent days/weeks/months. NOT for lifecycle stages (use posthog_lifecycle) or time-series counts (use posthog_trends).

**Parameters:**
- `target_entity`: Event that defines cohort entry (required)
- `returning_entity`: Event that counts as a return (defaults to target_entity)
- `date_from`: Start date (required)
- `date_to`: End date (optional)
- `period`: `Day`, `Week`, or `Month` (default: Day)
- `retention_type`: `retention_first_time` or `retention_recurring`
- `filter_test_accounts`: Exclude test users

**Returns:** Cohort retention grid with % of users returning per period.

### posthog_lifecycle — User Lifecycle

User lifecycle stages: new, returning, resurrecting, dormant.

**When to use:** When you want to understand the composition of active users — how many are new, how many are returning, how many came back after being dormant (resurrecting), and how many became dormant. NOT for retention curves (use posthog_retention) or raw event counts (use posthog_trends).

**Parameters:**
- `events`: Array of event names that define activity (required)
- `date_from`: Start date (required)
- `date_to`: End date (optional)
- `interval`: `day`, `week`, or `month`
- `breakdown_by`: Property to break down by
- `filter_test_accounts`: Exclude test users

**Returns:** Summary counts per lifecycle status and interval breakdown.

### posthog_paths — User Paths

User navigation path analysis — which pages/screens/events users move between.

**When to use:** When you want to discover how users navigate through your product — common paths, entry points, and where users drop off. NOT for measuring conversion between specific steps (use posthog_funnel) or time-series counts (use posthog_trends).

**Parameters:**
- `date_from`: Start date (required)
- `date_to`: End date (optional)
- `path_type`: `$pageview`, `$screen`, `custom_event`, or `hogql` (default: $pageview)
- `start_point`: Only paths starting from this page/screen/event
- `end_point`: Only paths ending at this page/screen/event
- `step_limit`: Max steps per path (default: 5)
- `filter_test_accounts`: Exclude test users

**Returns:** Top path edges (from → to → count) as a markdown table, capped at 30 edges.

### posthog_events — List Events

Browse individual event records.

**When to use:** When you need to see raw event data — recent occurrences of an event, events from a specific user, or events matching property filters. Supports pagination for browsing large result sets. NOT for aggregate counts (use posthog_trends) or conversion analysis (use posthog_funnel).

**Parameters:**
- `event`: Event name filter
- `person_id`: Filter by person/user
- `properties`: JSON property filter string
- `limit`: Number of events (default 20, max 100)
- `cursor`: Pagination cursor from previous response's `next_cursor`

**Pagination:** When more results exist, the response includes a `next_cursor` value. Pass it as the `cursor` parameter to fetch the next page. When using `cursor`, other filter params are ignored (the cursor URL is self-contained).

**Returns:** Formatted event list with timestamps and key properties.

### posthog_persons — Search Persons

Find and list users.

**When to use:** When looking up specific users by name, email, or distinct ID, or browsing user profiles. Supports pagination for browsing large result sets. NOT for event data (use posthog_events) or aggregate analytics (use posthog_trends).

**Parameters:**
- `search`: Name, email, or distinct ID
- `properties`: JSON property filter string
- `limit`: Number of persons (default 10, max 100)
- `cursor`: Pagination cursor from previous response's `next_cursor`

**Pagination:** Same as posthog_events — pass `next_cursor` as `cursor` to get the next page.

**Returns:** Person profiles with emails, distinct IDs, and custom properties.

## Use Cases

These are common scenarios where the agent should reach for PostHog tools. Each shows the user intent, which tool(s) to use, and a multi-step workflow when applicable.

### Growth & Activation

**"How is our sign-up funnel performing this month?"**
1. `posthog_funnel` with steps `[$pageview, sign_up, onboarding_complete]` and `date_from: -30d`
2. Check the conversion rates and "Avg Time to Next" column
3. If a step has high drop-off, use `posthog_trends` to break that event down by `$browser` or `$os` to find device-specific issues

**"Are we retaining users after sign-up?"**
1. `posthog_retention` with `target_entity: sign_up`, `period: Week`, `date_from: -60d`
2. If Week 1 retention is low, follow up with `posthog_lifecycle` on `$pageview` to see how many users are dormant vs resurrecting

**"What does our user growth look like — new vs returning?"**
1. `posthog_lifecycle` with `events: [$pageview]`, `date_from: -30d`, `interval: week`
2. Compare new vs returning vs dormant counts to assess growth health

### Product Usage & Navigation

**"What are the most common user journeys from the homepage?"**
1. `posthog_paths` with `start_point: /`, `path_type: $pageview`, `date_from: -14d`
2. Review the top edges to see where users go after landing

**"Which pages get the most traffic?"**
1. `posthog_trends` with `events: [$pageview]`, `breakdown_by: $pathname`, `date_from: -7d`
2. Or use HogQL: `SELECT properties.$pathname, count() FROM events WHERE event = '$pageview' AND timestamp > now() - INTERVAL 7 DAY GROUP BY properties.$pathname ORDER BY count() DESC LIMIT 20`

**"What did a specific user do on the site?"**
1. `posthog_persons` with `search: john@example.com` to find the person and their distinct ID
2. `posthog_events` with `person_id: <their_id>`, `limit: 50` to see their activity timeline

### Debugging & Investigation

**"We saw a spike in errors yesterday — what happened?"**
1. `posthog_trends` with `events: [error_event]`, `date_from: -3d`, `interval: hour` to pinpoint the spike window
2. `posthog_events` with `event: error_event` and a property filter for the timeframe to inspect individual errors
3. Break down by `$browser` or `$os` using `posthog_trends` to check if the spike is device-specific

**"Why are users dropping off at checkout?"**
1. `posthog_funnel` with steps `[add_to_cart, checkout_started, payment_submitted, order_confirmed]`, `date_from: -30d`
2. Identify the biggest drop-off step
3. `posthog_paths` with `start_point: /checkout` to see where users actually go instead
4. `posthog_events` with the drop-off event to inspect individual sessions

### Revenue & Business Metrics

**"What's our revenue breakdown by plan?"**
1. HogQL: `SELECT person.properties.plan, sum(toFloat64(properties.amount)) as revenue FROM events WHERE event = 'purchase' AND timestamp > now() - INTERVAL 30 DAY GROUP BY person.properties.plan ORDER BY revenue DESC`

**"How does purchase conversion differ by acquisition channel?"**
1. `posthog_funnel` with steps `[$pageview, purchase]`, `breakdown_by: $referring_domain`, `date_from: -30d`

### Custom / Ad-hoc Analysis

**"Give me a query I can't do with the higher-level tools"**
Use `posthog_query` for anything requiring JOINs, subqueries, window functions, or custom aggregations. Examples:
- Median session duration
- Cohort-level LTV
- Event sequences that don't fit a strict funnel
- Cross-entity queries joining events with persons

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
