/**
 * Indicator presets for the polish widget.
 *
 * Each preset produces a `WorkingIndicatorOptions` object (or `undefined`
 * for the "default" preset) that configures the streaming working indicator.
 *
 * This is the animation component of the streaming widget (shown above the
 * editor while the agent is responding). See `widget/index.ts` for the
 * combined widget abstraction.
 */

import type { Theme, WorkingIndicatorOptions } from "@earendil-works/pi-coding-agent";

/** Configuration for the indicator preset. */
export interface IndicatorConfig {
	preset: "default" | "wave" | "spinner" | "rainbow" | "dot" | "pulse" | "heartbeat" | "none";
}

/** All valid indicator preset names, in menu/completion order. */
export const INDICATOR_PRESETS = [
	"default",
	"wave",
	"spinner",
	"rainbow",
	"dot",
	"pulse",
	"heartbeat",
	"none",
] as const;

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

	// Reverse (skip first/last to avoid lingering at edges)
	const backward = forward.slice(1, -1).reverse();
	return [...forward, ...backward];
}

// ── Bouncing bar (replaces spinner) ───────────────────────────────────────

const BOUNCING_BAR_FRAMES = ["▀ ", " ▀", " ▄", "▄ ", "▀ ", " ▀", " ▄", "▄ "];

// ── Rainbow bar ──────────────────────────────────────────────────────────

const RAINBOW_BAR = "┃┃┃┃┃┃";

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

/** Create rainbow bar frames by rotating color offset across the bar characters. */
function createRainbowBarFrames(): string[] {
	const chars = [...RAINBOW_BAR];
	return Array.from({ length: PASTEL_RAINBOW.length }, (_, offset) =>
		chars
			.map((ch, i) => colorize(ch, PASTEL_RAINBOW[(i + offset) % PASTEL_RAINBOW.length]!))
			.join(""),
	);
}

// ── Braille dots (flowing animation) ─────────────────────────────────────

const BRAILLE_DOT_FRAMES = ["⣿", "⢷", "⡇", "⠇", "⡇", "⢷", "⣿"];

// ── Breathe line (thickness pulsing) ─────────────────────────────────────

const BREATHE_LINE_FRAMES = ["──", "══", "━━", "══", "──"];

// ── Heartbeat / ECG (scrolling pulse) ───────────────────────────────────

const HEARTBEAT_WIDTH = 8;
const HEARTBEAT_PULSE = ["▂", "▆", "▁", "▇", "▃"];
const HEARTBEAT_FLAT = "▁";

function createHeartbeatFrames(): string[] {
	// Build full sequence: flat + heartbeat pulse + flat
	const seq = [
		...Array<string>(HEARTBEAT_WIDTH).fill(HEARTBEAT_FLAT),
		...HEARTBEAT_PULSE,
		...Array<string>(HEARTBEAT_WIDTH).fill(HEARTBEAT_FLAT),
	];

	// Sliding window frames, deduplicate consecutive flat frames (keep 2 as pause)
	const allFrames: string[] = [];
	for (let i = 0; i <= seq.length - HEARTBEAT_WIDTH; i++) {
		allFrames.push(seq.slice(i, i + HEARTBEAT_WIDTH).join(""));
	}

	const flatFrame = HEARTBEAT_FLAT.repeat(HEARTBEAT_WIDTH);
	const frames: string[] = [];
	let flatCount = 0;

	for (const frame of allFrames) {
		if (frame === flatFrame) {
			flatCount++;
			if (flatCount <= 2) frames.push(frame);
		} else {
			flatCount = 0;
			frames.push(frame);
		}
	}

	return frames;
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
		frames: BOUNCING_BAR_FRAMES.map((frame) => theme.fg("accent", frame)),
		intervalMs: 100,
	}),

	rainbow: () => ({
		frames: createRainbowBarFrames(),
		intervalMs: 120,
	}),

	dot: (theme) => ({
		frames: BRAILLE_DOT_FRAMES.map((frame) => theme.fg("accent", frame)),
		intervalMs: 100,
	}),

	pulse: (theme) => ({
		frames: BREATHE_LINE_FRAMES.map((frame) => theme.fg("accent", frame)),
		intervalMs: 150,
	}),

	heartbeat: (theme) => ({
		frames: createHeartbeatFrames().map((frame) => theme.fg("accent", frame)),
		intervalMs: 100,
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
