/**
 * Persistent status indicator for the polish extension.
 *
 * Uses `ctx.ui.setStatus("polish", text)` to publish a compact summary of the
 * currently active presets. The summary is rebuilt by `config.ts` whenever
 * the config changes and re-applied here.
 *
 * The status text surfaces in the footer: either pi's built-in footer (when
 * the custom footer preset is `default`) or the custom footer's status
 * segment (which renders `footerData.getExtensionStatuses()`).
 */

import type { ExtensionContext } from "@earendil-works/pi-coding-agent";

/** Whether the preset summary is published to the footer. */
export interface StatusConfig {
	preset: "on" | "off";
}

/** All valid status preset names, in menu/completion order. */
export const STATUS_PRESETS = ["on", "off"] as const;

export const DEFAULT_STATUS: StatusConfig = { preset: "off" };

/** The status key under which the polish summary is published. */
export const STATUS_KEY = "polish";

/**
 * Apply the status config: publish or clear the polish preset summary.
 *
 * `summary` is the pre-built label string (e.g. "msg:playful · ind:rainbow").
 */
export function applyStatus(config: StatusConfig, summary: string, ctx: ExtensionContext): void {
	if (config.preset === "off") {
		ctx.ui.setStatus(STATUS_KEY, undefined);
		return;
	}
	ctx.ui.setStatus(STATUS_KEY, summary);
}
