/**
 * Central config for the polish extension.
 *
 * Owns the `PolishConfig` shape (widget + footer + status), persistence to
 * `polish.json`, and the `applyConfig` dispatcher that fans out to each
 * region's apply function.
 *
 * The config is nested to mirror the TUI layout abstraction:
 *
 *   widget  -> editor-adjacent streaming display (message + indicator)
 *   footer  -> bottom status bar (footer layout + status slot)
 */

import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import type { ExtensionContext } from "@earendil-works/pi-coding-agent";

import config from "./polish.json" with { type: "json" };
import {
	applyFooter,
	applyStatus,
	DEFAULT_FOOTER,
	DEFAULT_STATUS,
	type FooterConfig,
	type StatusConfig,
} from "./footer/index.js";
import { applyWidget, DEFAULT_WIDGET, type WidgetConfig } from "./widget/index.js";

// ── Config types ─────────────────────────────────────────────────────────

/** Top-level polish config, grouped by TUI region. */
export interface PolishConfig {
	widget: WidgetConfig;
	footer: FooterConfig;
	status: StatusConfig;
}

export const DEFAULT_CONFIG: PolishConfig = {
	widget: structuredClone(DEFAULT_WIDGET),
	footer: structuredClone(DEFAULT_FOOTER),
	status: structuredClone(DEFAULT_STATUS),
};

// ── Mutable config state ─────────────────────────────────────────────────

export let currentConfig: PolishConfig = normalize(config as Partial<PolishConfig>);

const configPath = join(dirname(fileURLToPath(import.meta.url)), "polish.json");

/**
 * Coerce a persisted/partial config into a complete `PolishConfig`, filling
 * missing regions or fields with defaults. Accepts both the current nested
 * shape (`widget.message`/`widget.indicator`) and the pre-refactor flat
 * shape (`message`/`indicator` at the top level) so old configs migrate.
 */
function normalize(raw: Partial<PolishConfig> & Record<string, unknown>): PolishConfig {
	const base = structuredClone(DEFAULT_CONFIG);

	// widget: nested under `widget`, or legacy flat `message`/`indicator`.
	const widgetSrc = (raw.widget ?? {
		message: raw.message,
		indicator: raw.indicator,
	}) as Partial<WidgetConfig>;
	if (widgetSrc.message) {
		base.widget.message = { ...base.widget.message, ...widgetSrc.message };
	}
	if (widgetSrc.indicator) {
		base.widget.indicator = { ...base.widget.indicator, ...widgetSrc.indicator };
	}

	if (raw.footer) base.footer = { ...base.footer, ...raw.footer };
	if (raw.status) base.status = { ...base.status, ...raw.status };

	return base;
}

// ── Persistence ──────────────────────────────────────────────────────────

export function saveConfig(): void {
	writeFileSync(configPath, JSON.stringify(currentConfig, null, "\t") + "\n", "utf-8");
}

export function resetConfigState(): void {
	currentConfig = structuredClone(DEFAULT_CONFIG);
}

// ── Status summary ───────────────────────────────────────────────────────

/**
 * Build the compact preset summary published via `setStatus`.
 *
 * Only non-default presets are listed (defaults are omitted to keep the
 * summary short). Returns "default" when nothing custom is active.
 */
export function buildStatusSummary(cfg: PolishConfig = currentConfig): string {
	const parts: string[] = [];

	if (cfg.widget.message.preset !== "default") {
		parts.push(`msg:${cfg.widget.message.preset}`);
	}
	if (cfg.widget.indicator.preset !== "default") {
		parts.push(`ind:${cfg.widget.indicator.preset}`);
	}
	if (cfg.footer.preset !== "default") {
		parts.push(`ft:${cfg.footer.preset}`);
	}

	return parts.length > 0 ? parts.join(" · ") : "default";
}

// ── Apply ────────────────────────────────────────────────────────────────

/**
 * Apply the current config to the session: widget + footer + status.
 *
 * Called on `session_start` and after every config change.
 */
export function applyConfig(ctx: ExtensionContext): void {
	applyWidget(currentConfig.widget, ctx);
	applyFooter(currentConfig.footer, ctx);
	applyStatus(currentConfig.status, buildStatusSummary(), ctx);
}
