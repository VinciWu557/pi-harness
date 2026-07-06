/**
 * Indicator presets for the polish extension.
 *
 * Each preset produces a `WorkingIndicatorOptions` object (or `undefined`
 * for the "default" preset) that configures the streaming working indicator.
 */

import type { Theme, WorkingIndicatorOptions } from "@earendil-works/pi-coding-agent";

/** Configuration for the indicator preset. */
export interface IndicatorConfig {
	preset: "default" | "wave" | "spinner" | "rainbow" | "dot" | "pulse" | "none";
}

// ── Wave animation (migrated from wave.ts) ───────────────────────────────

const WAVE_WIDTH = 8;
const WAVE_TAIL = ["▓", "▒", "░"];

function createWaveFrames(): string[] {
	const forward = Array.from({ length: WAVE_WIDTH }, (_, pos) => {
		let line = "";
		for (let i = 0; i < WAVE_WIDTH; i++) {
			const dist = Math.abs(i - pos);
			if (dist === 0) line += "█";
			else if (dist <= WAVE_TAIL.length) line += WAVE_TAIL[dist - 1]!;
			else line += "░";
		}
		return line;
	});

	// 从右到左折返，去掉首尾避免在两端重复停留
	const backward = forward.slice(1, -1).reverse();
	return [...forward, ...backward];
}

// ── Braille spinner ──────────────────────────────────────────────────────

const SPINNER_FRAMES = ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"];

// ── Pastel rainbow colors ────────────────────────────────────────────────

const PASTEL_RAINBOW = [
	"\x1b[38;2;255;179;186m",
	"\x1b[38;2;255;223;186m",
	"\x1b[38;2;255;255;186m",
	"\x1b[38;2;186;255;201m",
	"\x1b[38;2;186;225;255m",
	"\x1b[38;2;218;186;255m",
];
const RESET_FG = "\x1b[39m";

function colorize(text: string, color: string): string {
	return `${color}${text}${RESET_FG}`;
}

// ── Preset factories ─────────────────────────────────────────────────────

type IndicatorFactory = (theme: Theme) => WorkingIndicatorOptions | undefined;

const factories: Record<IndicatorConfig["preset"], IndicatorFactory> = {
	default: () => undefined,

	wave: (theme) => ({
		frames: createWaveFrames().map((frame) => theme.fg("accent", frame)),
		intervalMs: 120,
	}),

	spinner: (theme) => ({
		frames: SPINNER_FRAMES.map((frame) => theme.fg("accent", frame)),
		intervalMs: 80,
	}),

	rainbow: () => ({
		frames: SPINNER_FRAMES.map((frame, index) =>
			colorize(frame, PASTEL_RAINBOW[index % PASTEL_RAINBOW.length]!),
		),
		intervalMs: 80,
	}),

	dot: (theme) => ({
		frames: [theme.fg("accent", "●")],
	}),

	pulse: (theme) => ({
		frames: [
			theme.fg("dim", "·"),
			theme.fg("muted", "•"),
			theme.fg("accent", "●"),
			theme.fg("muted", "•"),
		],
		intervalMs: 120,
	}),

	none: () => ({
		frames: [],
	}),
};

/**
 * Create working indicator options based on the given config.
 *
 * Returns `undefined` for the "default" preset, which means "don't touch
 * pi's built-in working indicator".
 */
export function createIndicator(
	config: IndicatorConfig,
	theme: Theme,
): WorkingIndicatorOptions | undefined {
	const factory = factories[config.preset];
	if (!factory) {
		return undefined;
	}
	return factory(theme);
}
