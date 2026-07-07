/**
 * Footer region abstraction for the polish extension.
 *
 * The "footer" is the bottom status bar. It has two customization points:
 *
 * - **footer**: the bar itself, replaced via `setFooter` (model / git / ctx% /
 *   elapsed / extension statuses).
 * - **status**: a persistent status slot published via `setStatus`, surfaced
 *   inside the footer's extension-statuses segment.
 *
 * Both belong to the same on-screen region, so this module re-exports them
 * together. The status summary is built in `config.ts` (which sees the full
 * config) and passed into `applyStatus`.
 */

export type { FooterConfig } from "./footer.js";
export type { StatusConfig } from "./status.js";
export { DEFAULT_FOOTER, FOOTER_PRESETS, applyFooter, markSessionStart } from "./footer.js";
export { DEFAULT_STATUS, STATUS_KEY, STATUS_PRESETS, applyStatus } from "./status.js";
