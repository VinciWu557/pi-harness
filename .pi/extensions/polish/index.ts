import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import type {
	ExtensionAPI,
	ExtensionCommandContext,
	ExtensionContext,
} from "@earendil-works/pi-coding-agent";
import { DynamicBorder, getSettingsListTheme } from "@earendil-works/pi-coding-agent";
import { Container, Key, matchesKey, type SelectItem, SelectList, type SettingItem, SettingsList, Text } from "@earendil-works/pi-tui";
import config from "./polish.json" with { type: "json" };
import { createMessage, type MessageConfig } from "./messages.js";
import { createIndicator, type IndicatorConfig } from "./indicators.js";

// ── Config types ──────────────────────────────────────────────────────────

interface PolishConfig {
	message: MessageConfig;
	indicator: IndicatorConfig;
}

const DEFAULT_CONFIG: PolishConfig = {
	message: {
		preset: "default",
		customVerbs: [],
	},
	indicator: {
		preset: "default",
	},
};

const MESSAGE_PRESETS = ["default", "playful", "professional", "custom", "minimal"] as const;
const INDICATOR_PRESETS = [
	"default",
	"wave",
	"spinner",
	"rainbow",
	"dot",
	"pulse",
	"heartbeat",
	"none",
] as const;

// ── Mutable config state ──────────────────────────────────────────────────

let currentConfig: PolishConfig = structuredClone(config as PolishConfig);

const configPath = join(dirname(fileURLToPath(import.meta.url)), "polish.json");

// ── Persistence & application ─────────────────────────────────────────────

function saveConfig(): void {
	writeFileSync(configPath, JSON.stringify(currentConfig, null, "\t") + "\n", "utf-8");
}

function applyConfig(ctx: ExtensionContext): void {
	const message = createMessage(currentConfig.message);
	ctx.ui.setWorkingMessage(message);

	const indicator = createIndicator(currentConfig.indicator, ctx.ui.theme);
	ctx.ui.setWorkingIndicator(indicator);
}

// ── Command handler ───────────────────────────────────────────────────────

async function handlePolishCommand(args: string, ctx: ExtensionCommandContext): Promise<void> {
	if (!ctx.hasUI) {
		ctx.ui.notify("Polish requires interactive TUI support", "error");
		return;
	}

	const parts = args.trim().split(/\s+/);
	const subcommand = parts[0] ?? "";

	switch (subcommand) {
		case "":
			await interactiveMenu(ctx);
			break;
		case "message":
			await setMessagePreset(parts.slice(1).join(" "), ctx);
			break;
		case "indicator":
			await setIndicatorPreset(parts.slice(1).join(" "), ctx);
			break;
		case "set":
			await handleSetCommand(parts.slice(1).join(" "), ctx);
			break;
		case "verbs":
			await setCustomVerbs(parts.slice(1).join(" "), ctx);
			break;
		case "show":
			showConfig(ctx);
			break;
		case "reset":
			await resetConfig(ctx);
			break;
		default:
			ctx.ui.notify(
				`Unknown subcommand: ${subcommand}\nUsage: /polish [message|indicator|verbs|show|reset]`,
				"warning",
			);
	}
}

// ── Interactive menu ──────────────────────────────────────────────────────

async function interactiveMenu(ctx: ExtensionCommandContext): Promise<void> {
	const items: SelectItem[] = [
		{ value: "preset", label: "Presets", description: "Configure message and indicator style" },
		{ value: "verbs", label: "Custom Verbs", description: "Set verb list for the custom message preset" },
		{ value: "show", label: "Show Config", description: "Display current active settings" },
		{ value: "reset", label: "Reset", description: "Restore all settings to defaults" },
	];

	while (true) {
		const choice = await ctx.ui.custom<string | null>((tui, theme, _kb, done) => {
			const container = new Container();

			container.addChild(new DynamicBorder((s: string) => theme.fg("accent", s)));
			container.addChild(
				new Text(theme.fg("accent", theme.bold(" Polish Config")), 1, 0),
			);

			const selectList = new SelectList(items, Math.min(items.length + 1, 8), {
				selectedPrefix: (t: string) => theme.fg("accent", t),
				selectedText: (t: string) => theme.fg("accent", t),
				description: (t: string) => theme.fg("muted", t),
				scrollInfo: (t: string) => theme.fg("dim", t),
				noMatch: (t: string) => theme.fg("warning", t),
			});
			selectList.onSelect = (item: SelectItem) => done(item.value);
			selectList.onCancel = () => done(null);
			container.addChild(selectList);

			container.addChild(
				new Text(theme.fg("dim", "↑↓ navigate • enter select • esc back"), 1, 0),
			);
			container.addChild(new DynamicBorder((s: string) => theme.fg("accent", s)));

			return {
				render: (w: number) => container.render(w),
				invalidate: () => container.invalidate(),
				handleInput: (data: string) => {
					selectList.handleInput(data);
					tui.requestRender();
				},
			};
		});

		if (choice === null) break;

		switch (choice) {
			case "preset":
				await interactiveSimultaneousPreset(ctx);
				break;
			case "verbs":
				await interactiveCustomVerbs(ctx);
				break;
			case "show":
				showConfig(ctx);
				break;
			case "reset":
				await resetConfig(ctx);
				break;
		}
	}
}
async function interactiveCustomVerbs(ctx: ExtensionCommandContext): Promise<void> {
	const current = currentConfig.message.customVerbs?.join(", ") ?? "";
	const input = await ctx.ui.input("Enter custom verbs (comma-separated)", current);
	if (input === undefined) return;

	const verbs = input
		.split(",")
		.map((v) => v.trim())
		.filter((v) => v.length > 0);
	currentConfig.message.customVerbs = verbs;
	saveConfig();
	applyConfig(ctx);
	ctx.ui.notify(`Custom verbs set to: ${verbs.join(", ") || "(empty)"}`, "info");
}

// ── Simultaneous preset selector (message + indicator on one screen) ─────

/** Generate preview text for a message preset. */
function getMessagePreview(preset: string): string {
	const tempConfig: MessageConfig = {
		...currentConfig.message,
		preset: preset as MessageConfig["preset"],
	};
	const msg = createMessage(tempConfig);
	return msg ?? "(default)";
}

/** Get a representative indicator frame for a preset. */
function getIndicatorPreview(preset: string): string {
	const previews: Record<string, string> = {
		default: "(default)",
		wave: "█▓▒░░░░░",
		spinner: "▀ ▄",
		rainbow: "┃┃┃┃┃┃",
		dot: "⣿⢷⡇",
		pulse: "─═━",
		heartbeat: "▁▁▂▆▁▇▃▁",
		none: "(none)",
	};
	return previews[preset] ?? "?";
}

async function interactiveSimultaneousPreset(ctx: ExtensionCommandContext): Promise<void> {
	// Snapshot current config for rollback on Esc
	const snapshot: PolishConfig = structuredClone(currentConfig);

	const items: SettingItem[] = [
		{
			id: "indicator",
			label: "Indicator Preset",
			description: getIndicatorPreview(currentConfig.indicator.preset),
			currentValue: currentConfig.indicator.preset,
			values: [...INDICATOR_PRESETS],
		},
		{
			id: "message",
			label: "Message Preset",
			description: getMessagePreview(currentConfig.message.preset),
			currentValue: currentConfig.message.preset,
			values: [...MESSAGE_PRESETS],
		},
	];

	const saved = await ctx.ui.custom<boolean>((_tui, theme, _kb, done) => {
		const container = new Container();
		container.addChild(new DynamicBorder((s: string) => theme.fg("accent", s)));
		container.addChild(new Text(theme.fg("accent", theme.bold("Presets")), 1, 0));

		const settingsList = new SettingsList(
			items,
			items.length + 2,
			getSettingsListTheme(),
			(id: string, newValue: string) => {
				if (id === "indicator") {
					currentConfig.indicator.preset = newValue as IndicatorConfig["preset"];
					const item = items.find((i) => i.id === "indicator")!;
					item.description = getIndicatorPreview(newValue);
				} else if (id === "message") {
					currentConfig.message.preset = newValue as MessageConfig["preset"];
					const item = items.find((i) => i.id === "message")!;
					item.description = getMessagePreview(newValue);
				}
				// Live preview (not persisted)
				applyConfig(ctx);
			},
			() => done(false), // Esc = discard
		);
		container.addChild(settingsList);

		container.addChild(
			new Text(theme.fg("dim", "Ctrl+S save • esc cancel"), 1, 0),
		);
		container.addChild(new DynamicBorder((s: string) => theme.fg("accent", s)));

		return {
			render: (w: number) => container.render(w),
			invalidate: () => container.invalidate(),
			handleInput: (data: string) => {
				if (matchesKey(data, Key.ctrl("s"))) {
					done(true); // Ctrl+S = save
					return;
				}
				settingsList.handleInput(data);
				_tui.requestRender();
			},
		};
	});

	if (saved) {
		saveConfig();
		ctx.ui.notify("Preset config saved", "info");
	} else {
		// Rollback to snapshot
		currentConfig.indicator.preset = snapshot.indicator.preset;
		currentConfig.message.preset = snapshot.message.preset;
		applyConfig(ctx);
	}
}

// ── Combined set command (message + indicator + verbs in one call) ────────

/** Parse "key=value" pairs from a space-separated argument string. */
function parseKeyValuePairs(args: string): Record<string, string> {
	const result: Record<string, string> = {};
	const tokens = args.trim().split(/\s+/);
	for (const token of tokens) {
		const eqIdx = token.indexOf("=");
		if (eqIdx === -1) continue;
		const key = token.slice(0, eqIdx);
		const value = token.slice(eqIdx + 1);
		result[key] = value;
	}
	return result;
}

async function handleSetCommand(args: string, ctx: ExtensionCommandContext): Promise<void> {
	const pairs = parseKeyValuePairs(args);
	const keys = Object.keys(pairs);

	if (keys.length === 0) {
		showConfig(ctx);
		ctx.ui.notify(
			"Usage: /polish set message=<preset> indicator=<preset> [verbs=<verbs>]\n" +
				`Message presets: ${MESSAGE_PRESETS.join(", ")}\n` +
				`Indicator presets: ${INDICATOR_PRESETS.join(", ")}`,
			"warning",
		);
		return;
	}

	const updates: string[] = [];

	if ("message" in pairs) {
		const val = pairs.message!;
		if (!MESSAGE_PRESETS.includes(val as (typeof MESSAGE_PRESETS)[number])) {
			ctx.ui.notify(`Invalid message preset: ${val}\nOptions: ${MESSAGE_PRESETS.join(", ")}`, "error");
			return;
		}
		currentConfig.message.preset = val as MessageConfig["preset"];
		updates.push(`message: ${val}`);
	}

	if ("indicator" in pairs) {
		const val = pairs.indicator!;
		if (!INDICATOR_PRESETS.includes(val as (typeof INDICATOR_PRESETS)[number])) {
			ctx.ui.notify(
				`Invalid indicator preset: ${val}\nOptions: ${INDICATOR_PRESETS.join(", ")}`,
				"error",
			);
			return;
		}
		currentConfig.indicator.preset = val as IndicatorConfig["preset"];
		updates.push(`indicator: ${val}`);
	}

	if ("verbs" in pairs) {
		const verbs = pairs
			.verbs!.split(",")
			.map((v) => v.trim())
			.filter((v) => v.length > 0);
		currentConfig.message.customVerbs = verbs;
		updates.push(`verbs: ${verbs.join(", ") || "(empty)"}`);
	}

	if (updates.length > 0) {
		saveConfig();
		applyConfig(ctx);
		ctx.ui.notify(`Config updated: ${updates.join("  ")}`, "info");
	}
}

// ── Direct parameter mode ─────────────────────────────────────────────────

async function setMessagePreset(preset: string, ctx: ExtensionCommandContext): Promise<void> {
	if (!preset) {
		ctx.ui.notify(
			`Usage: /polish message <preset>\nOptions: ${MESSAGE_PRESETS.join(", ")}`,
			"warning",
		);
		return;
	}

	if (!MESSAGE_PRESETS.includes(preset as MessageConfig["preset"])) {
		ctx.ui.notify(`Invalid message preset: ${preset}\nOptions: ${MESSAGE_PRESETS.join(", ")}`, "error");
		return;
	}

	currentConfig.message.preset = preset as MessageConfig["preset"];
	saveConfig();
	applyConfig(ctx);
	ctx.ui.notify(`Message preset set to: ${preset}`, "info");
}

async function setIndicatorPreset(preset: string, ctx: ExtensionCommandContext): Promise<void> {
	if (!preset) {
		ctx.ui.notify(
			`Usage: /polish indicator <preset>\nOptions: ${INDICATOR_PRESETS.join(", ")}`,
			"warning",
		);
		return;
	}

	if (!INDICATOR_PRESETS.includes(preset as IndicatorConfig["preset"])) {
		ctx.ui.notify(
			`Invalid indicator preset: ${preset}\nOptions: ${INDICATOR_PRESETS.join(", ")}`,
			"error",
		);
		return;
	}

	currentConfig.indicator.preset = preset as IndicatorConfig["preset"];
	saveConfig();
	applyConfig(ctx);
	ctx.ui.notify(`Indicator preset set to: ${preset}`, "info");
}

async function setCustomVerbs(verbsStr: string, ctx: ExtensionCommandContext): Promise<void> {
	if (!verbsStr) {
		ctx.ui.notify("Usage: /polish verbs <verb1,verb2,...>", "warning");
		return;
	}

	const verbs = verbsStr
		.split(",")
		.map((v) => v.trim())
		.filter((v) => v.length > 0);
	currentConfig.message.customVerbs = verbs;
	saveConfig();
	applyConfig(ctx);
	ctx.ui.notify(`Custom verbs set to: ${verbs.join(", ") || "(empty)"}`, "info");
}

function showConfig(ctx: ExtensionCommandContext): void {
	const lines = [
		`Message preset: ${currentConfig.message.preset}`,
		`Custom verbs: ${currentConfig.message.customVerbs?.join(", ") || "(none)"}`,
		`Indicator preset: ${currentConfig.indicator.preset}`,
	];
	ctx.ui.notify(lines.join("\n"), "info");
}

async function resetConfig(ctx: ExtensionCommandContext): Promise<void> {
	const ok = await ctx.ui.confirm("Reset Config", "Reset all settings to defaults?");
	if (!ok) return;

	currentConfig = structuredClone(DEFAULT_CONFIG);
	saveConfig();
	applyConfig(ctx);
	ctx.ui.notify("Config reset to defaults", "info");
}

// ── Argument completions ──────────────────────────────────────────────────

function getArgumentCompletions(prefix: string) {
	const subcommands = [
		{ value: "message", label: "message", description: "Set message preset" },
		{ value: "indicator", label: "indicator", description: "Set indicator preset" },
		{ value: "set", label: "set", description: "Set message and indicator at once (key=value)" },
		{ value: "verbs", label: "verbs", description: "Set custom verbs" },
		{ value: "show", label: "show", description: "Show current config" },
		{ value: "reset", label: "reset", description: "Reset to defaults" },
	];

	const trimmed = prefix.trim();
	const parts = trimmed.length > 0 ? trimmed.split(/\s+/) : [];
	const hasTrailingSpace = prefix.endsWith(" ");

	// No subcommand yet: empty, just spaces, or single word with no trailing space
	if (parts.length === 0 || (parts.length === 1 && !hasTrailingSpace)) {
		const typed = parts[0] ?? "";
		return subcommands.filter((s) => s.value.startsWith(typed));
	}

	// After subcommand name (space typed): presets for message/indicator
	const sub = parts[0] ?? "";
	const typedPreset = parts[1] ?? "";

	if (sub === "message" && parts.length <= 2) {
		return MESSAGE_PRESETS.filter((p) => p.startsWith(typedPreset)).map((p) => ({
			value: p,
			label: p,
		}));
	}

	if (sub === "indicator" && parts.length <= 2) {
		return INDICATOR_PRESETS.filter((p) => p.startsWith(typedPreset)).map((p) => ({
			value: p,
			label: p,
		}));
	}

	// set subcommand key=value completions
	if (sub === "set" && parts.length <= 5) {
		return getSetCompletions(parts, hasTrailingSpace);
	}

	return null;
}

function getSetCompletions(parts: string[], hasTrailingSpace: boolean) {
	const typedArg = parts[parts.length - 1] ?? "";

	// Collect already-used keys from earlier tokens
	const usedKeys = new Set<string>();
	for (let i = 1; i < parts.length - 1; i++) {
		const eqIdx = parts[i]!.indexOf("=");
		if (eqIdx !== -1) usedKeys.add(parts[i]!.slice(0, eqIdx));
	}
	if (!hasTrailingSpace) {
		const eqIdx = typedArg.indexOf("=");
		if (eqIdx !== -1 && eqIdx < typedArg.length - 1) {
			usedKeys.add(typedArg.slice(0, eqIdx));
		}
	}

	// If current arg contains "=" and user is typing a value
	if (typedArg.includes("=")) {
		const eqIdx = typedArg.indexOf("=");
		const key = typedArg.slice(0, eqIdx);
		const partialValue = typedArg.slice(eqIdx + 1);

		if (key === "message") {
			return MESSAGE_PRESETS.filter((p) => p.startsWith(partialValue)).map((p) => ({
				value: p,
				label: p,
			}));
		}
		if (key === "indicator") {
			return INDICATOR_PRESETS.filter((p) => p.startsWith(partialValue)).map((p) => ({
				value: p,
				label: p,
			}));
		}
	}

	// Suggest remaining keys
	const availableKeys = [
		{ key: "message=", label: "message=", description: "Message preset" },
		{ key: "indicator=", label: "indicator=", description: "Indicator preset" },
		{ key: "verbs=", label: "verbs=", description: "Custom verbs" },
	].filter((k) => {
		const keyName = k.key.slice(0, -1);
		return !usedKeys.has(keyName);
	});

	return availableKeys
		.filter((k) => k.key.startsWith(typedArg))
		.map((k) => ({ value: k.key, label: k.label, description: k.description }));
}

// ── Extension entry ───────────────────────────────────────────────────────

export default function (pi: ExtensionAPI) {
	pi.on("session_start", (_event, ctx) => {
		applyConfig(ctx);
	});

	pi.registerCommand("polish", {
		description: "Configure polish working message and indicator presets",
		handler: handlePolishCommand,
		getArgumentCompletions,
	});
}
