/**
 * Custom footer for the polish extension.
 *
 * Replaces pi's bottom status bar with a configurable single line:
 *   model · git · ctx% · elapsed · extension statuses
 *
 * Token/context usage comes from `ctx.getContextUsage()`, git branch and
 * extension statuses come from `footerData` (not otherwise accessible to
 * extensions). Elapsed time is session-relative and ticks every second via a
 * render timer cleaned up in `dispose`.
 */

import type { ExtensionContext, Theme } from "@earendil-works/pi-coding-agent";
import { truncateToWidth, visibleWidth } from "@earendil-works/pi-tui";

/** Footer layout density. */
export interface FooterConfig {
	preset: "default" | "rich" | "minimal";
}

/** All valid footer preset names, in menu/completion order. */
export const FOOTER_PRESETS = ["default", "rich", "minimal"] as const;

export const DEFAULT_FOOTER: FooterConfig = { preset: "default" };

// `default` leaves pi's built-in footer untouched; only `rich`/`minimal` are
// custom layouts. The explicit check below also narrows the type so
// `buildSegments` receives only custom modes.

// ── Session elapsed time ─────────────────────────────────────────────────

let sessionStartedAt = Date.now();

/** Record the start of the current session for elapsed-time display. */
export function markSessionStart(): void {
	sessionStartedAt = Date.now();
}

function formatElapsed(ms: number): string {
	const sec = Math.floor(ms / 1000);
	if (sec < 60) return `${sec}s`;
	const min = Math.floor(sec / 60);
	const rem = sec % 60;
	if (min < 60) return `${min}m${String(rem).padStart(2, "0")}s`;
	const hr = Math.floor(min / 60);
	return `${hr}h${String(min % 60).padStart(2, "0")}m`;
}

// ── Segment builders ─────────────────────────────────────────────────────

interface FooterSegment {
	text: string;
	width: number;
}

function buildSegments(
	mode: "rich" | "minimal",
	ctx: ExtensionContext,
	theme: Theme,
	footerData: {
		getGitBranch(): string | null;
		getExtensionStatuses(): ReadonlyMap<string, string>;
	},
): FooterSegment[] {
	const segments: FooterSegment[] = [];

	// Model
	const modelId = ctx.model?.id ?? "no-model";
	segments.push({ text: theme.fg("accent", modelId), width: visibleWidth(modelId) });

	// Git branch
	const branch = footerData.getGitBranch();
	if (branch) {
		segments.push({ text: theme.fg("muted", branch), width: visibleWidth(branch) });
	}

	// Context window usage
	const usage = ctx.getContextUsage();
	if (usage?.percent != null) {
		const pct = usage.percent;
		const color = pct >= 80 ? "error" : pct >= 50 ? "warning" : "success";
		const label = `ctx ${pct}%`;
		segments.push({ text: theme.fg(color, label), width: visibleWidth(label) });
	}

	// Elapsed (rich only)
	if (mode === "rich") {
		const elapsed = formatElapsed(Date.now() - sessionStartedAt);
		segments.push({ text: theme.fg("dim", elapsed), width: visibleWidth(elapsed) });
	}

	// Extension statuses (so setStatus indicators remain visible)
	const statuses = footerData.getExtensionStatuses();
	if (statuses.size > 0) {
		const statusText = [...statuses.values()].join(" ");
		segments.push({ text: theme.fg("dim", statusText), width: visibleWidth(statusText) });
	}

	return segments;
}

// ── Apply ────────────────────────────────────────────────────────────────

/**
 * Apply the footer config to the current session.
 *
 * `default` restores pi's built-in footer. `rich`/`minimal` install a custom
 * single-line footer that re-renders on git branch change and every second
 * (for the live elapsed clock).
 */
export function applyFooter(config: FooterConfig, ctx: ExtensionContext): void {
	if (config.preset !== "rich" && config.preset !== "minimal") {
		ctx.ui.setFooter(undefined);
		return;
	}

	const mode = config.preset;

	ctx.ui.setFooter((tui, theme, footerData) => {
		const unsubBranch = footerData.onBranchChange(() => tui.requestRender());
		// Live-tick the elapsed clock each second.
		const timer = setInterval(() => tui.requestRender(), 1000);

		return {
			dispose: () => {
				unsubBranch();
				clearInterval(timer);
			},
			invalidate() {},
			render(width: number): string[] {
				const segments = buildSegments(mode, ctx, theme, footerData);
				if (segments.length === 0) return [];

				const sep = theme.fg("dim", " · ");
				const sepWidth = 3;

				// Greedy fit: keep leading segments until the next would overflow,
				// so we drop trailing segments instead of slicing mid-ANSI.
				let line = "";
				let used = 0;
				for (let i = 0; i < segments.length; i++) {
					const seg = segments[i]!;
					const next = used === 0 ? seg.width : sepWidth + seg.width;
					if (used + next > width) break;
					if (used > 0) {
						line += sep;
						used += sepWidth;
					}
					line += seg.text;
					used += seg.width;
				}

				return [truncateToWidth(line, width, "")];
			},
		};
	});
}
