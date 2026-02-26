import { afterEach, describe, expect, it, vi } from "vitest";
import { parseConfig } from "./types.js";

describe("parseConfig", () => {
	afterEach(() => vi.unstubAllEnvs());

	it("accepts valid config with defaults", () => {
		const cfg = parseConfig({ apiKey: "phx_test123", projectId: "42" });
		expect(cfg.apiKey).toBe("phx_test123");
		expect(cfg.projectId).toBe("42");
		expect(cfg.host).toBe("https://eu.posthog.com");
		expect(cfg.timeoutMs).toBe(30_000);
	});

	it("accepts custom host and timeoutMs", () => {
		const cfg = parseConfig({
			apiKey: "key",
			projectId: "1",
			host: "https://us.posthog.com/",
			timeoutMs: 60_000,
		});
		expect(cfg.host).toBe("https://us.posthog.com");
		expect(cfg.timeoutMs).toBe(60_000);
	});

	it("strips trailing slashes from host", () => {
		const cfg = parseConfig({
			apiKey: "key",
			projectId: "1",
			host: "https://app.posthog.com///",
		});
		expect(cfg.host).toBe("https://app.posthog.com");
	});

	it("throws on missing apiKey", () => {
		expect(() => parseConfig({ projectId: "1" })).toThrow(
			"posthog apiKey is required",
		);
	});

	it("throws on empty apiKey", () => {
		expect(() => parseConfig({ apiKey: "  ", projectId: "1" })).toThrow(
			"posthog apiKey is required",
		);
	});

	it("throws on missing projectId", () => {
		expect(() => parseConfig({ apiKey: "key" })).toThrow(
			"posthog projectId is required",
		);
	});

	it("throws on empty projectId", () => {
		expect(() => parseConfig({ apiKey: "key", projectId: "  " })).toThrow(
			"posthog projectId is required",
		);
	});

	it("resolves environment variable substitution in apiKey", () => {
		vi.stubEnv("MY_PH_KEY", "resolved-posthog-key");
		const cfg = parseConfig({ apiKey: "${MY_PH_KEY}", projectId: "1" });
		expect(cfg.apiKey).toBe("resolved-posthog-key");
	});

	it("throws on unresolvable environment variable", () => {
		delete process.env.NONEXISTENT_VAR;
		expect(() =>
			parseConfig({ apiKey: "${NONEXISTENT_VAR}", projectId: "1" }),
		).toThrow("Environment variable NONEXISTENT_VAR is not set");
	});

	it("throws on unknown config keys", () => {
		expect(() =>
			parseConfig({ apiKey: "key", projectId: "1", badKey: "val" }),
		).toThrow("posthog config has unknown keys: badKey");
	});

	it("throws on non-object config", () => {
		expect(() => parseConfig(null)).toThrow("posthog config required");
		expect(() => parseConfig("string")).toThrow("posthog config required");
		expect(() => parseConfig([1, 2])).toThrow("posthog config required");
	});

	it("throws on timeoutMs out of range", () => {
		expect(() =>
			parseConfig({ apiKey: "key", projectId: "1", timeoutMs: 1000 }),
		).toThrow("posthog timeoutMs must be between 5000 and 300000");
		expect(() =>
			parseConfig({ apiKey: "key", projectId: "1", timeoutMs: 500_000 }),
		).toThrow("posthog timeoutMs must be between 5000 and 300000");
	});
});
