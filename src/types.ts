export type PostHogConfig = {
	apiKey: string;
	projectId: string;
	host: string;
	timeoutMs: number;
};

const DEFAULT_HOST = "https://eu.posthog.com";
const DEFAULT_TIMEOUT_MS = 30_000;

const ALLOWED_CONFIG_KEYS: readonly (keyof PostHogConfig)[] = [
	"apiKey",
	"projectId",
	"host",
	"timeoutMs",
];

function resolveEnvVars(value: string): string {
	return value.replace(/\$\{([^}]+)\}/g, (_, envVar) => {
		const envValue = process.env[envVar];
		if (!envValue) {
			throw new Error(`Environment variable ${envVar} is not set`);
		}
		return envValue;
	});
}

export function parseConfig(value: unknown): PostHogConfig {
	if (!value || typeof value !== "object" || Array.isArray(value)) {
		throw new Error("posthog config required");
	}
	const cfg = value as Record<string, unknown>;
	const unknown = Object.keys(cfg).filter(
		(k) => !ALLOWED_CONFIG_KEYS.includes(k as keyof PostHogConfig),
	);

	if (unknown.length > 0) {
		throw new Error(
			`posthog config has unknown keys: ${unknown.join(", ")}`,
		);
	}

	if (typeof cfg.apiKey !== "string" || !cfg.apiKey.trim()) {
		throw new Error("posthog apiKey is required");
	}

	if (typeof cfg.projectId !== "string" || !cfg.projectId.trim()) {
		throw new Error("posthog projectId is required");
	}

	let host = DEFAULT_HOST;
	if (typeof cfg.host === "string" && cfg.host.trim()) {
		host = cfg.host.trim().replace(/\/+$/, "");
	}

	const timeoutMs =
		typeof cfg.timeoutMs === "number"
			? Math.floor(cfg.timeoutMs)
			: DEFAULT_TIMEOUT_MS;
	if (timeoutMs < 5_000 || timeoutMs > 300_000) {
		throw new Error("posthog timeoutMs must be between 5000 and 300000");
	}

	return {
		apiKey: resolveEnvVars(cfg.apiKey),
		projectId: cfg.projectId.trim(),
		host,
		timeoutMs,
	};
}
