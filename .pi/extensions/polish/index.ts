/**
 * Polish extension entry point.
 *
 * Routes `/polish` subcommands to direct setters or the interactive menu.
 * UI menus live in `menu.ts`, completions in `completions.ts`, and the
 * per-region apply logic in `widget/` and `footer/`. Config state and
 * persistence live in `config.ts`.
 */

import type { ExtensionAPI, ExtensionCommandContext } from "@earendil-works/pi-coding-agent";

import { applyConfig, currentConfig, saveConfig, type PolishConfig } from "./config.js";
import { INDICATOR_PRESETS, MESSAGE_PRESETS } from "./widget/index.js";
import { FOOTER_PRESETS, markSessionStart, STATUS_PRESETS } from "./footer/index.js";
import { interactiveMenu, resetConfig, showConfig } from "./menu.js";
import { getArgumentCompletions } from "./completions.js";

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
		case "footer":
			await setFooterPreset(parts.slice(1).join(" "), ctx);
			break;
		case "status":
			await setStatusPreset(parts.slice(1).join(" "), ctx);
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
				`Unknown subcommand: ${subcommand}\nUsage: /polish [message|indicator|footer|status|verbs|show|reset]`,
				"warning",
			);
	}
}

// ── Combined set command (all presets + verbs in one call) ───────────────

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
			"Usage: /polish set message=<preset> indicator=<preset> footer=<preset> status=<preset> [verbs=<verbs>]\n" +
				`Message presets: ${MESSAGE_PRESETS.join(", ")}\n` +
				`Indicator presets: ${INDICATOR_PRESETS.join(", ")}\n` +
				`Footer presets: ${FOOTER_PRESETS.join(", ")}\n` +
				`Status presets: ${STATUS_PRESETS.join(", ")}`,
			"warning",
		);
		return;
	}

	const updates: string[] = [];

	if ("message" in pairs) {
		const val = pairs.message!;
		if (!MESSAGE_PRESETS.includes(val as (typeof MESSAGE_PRESETS)[number])) {
			ctx.ui.notify(
				`Invalid message preset: ${val}\nOptions: ${MESSAGE_PRESETS.join(", ")}`,
				"error",
			);
			return;
		}
		currentConfig.widget.message.preset = val as PolishConfig["widget"]["message"]["preset"];
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
		currentConfig.widget.indicator.preset =
			val as PolishConfig["widget"]["indicator"]["preset"];
		updates.push(`indicator: ${val}`);
	}

	if ("footer" in pairs) {
		const val = pairs.footer!;
		if (!FOOTER_PRESETS.includes(val as (typeof FOOTER_PRESETS)[number])) {
			ctx.ui.notify(
				`Invalid footer preset: ${val}\nOptions: ${FOOTER_PRESETS.join(", ")}`,
				"error",
			);
			return;
		}
		currentConfig.footer.preset = val as PolishConfig["footer"]["preset"];
		updates.push(`footer: ${val}`);
	}

	if ("status" in pairs) {
		const val = pairs.status!;
		if (!STATUS_PRESETS.includes(val as (typeof STATUS_PRESETS)[number])) {
			ctx.ui.notify(
				`Invalid status preset: ${val}\nOptions: ${STATUS_PRESETS.join(", ")}`,
				"error",
			);
			return;
		}
		currentConfig.status.preset = val as PolishConfig["status"]["preset"];
		updates.push(`status: ${val}`);
	}

	if ("verbs" in pairs) {
		const verbs = pairs
			.verbs!.split(",")
			.map((v) => v.trim())
			.filter((v) => v.length > 0);
		currentConfig.widget.message.customVerbs = verbs;
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

	if (!MESSAGE_PRESETS.includes(preset as PolishConfig["widget"]["message"]["preset"])) {
		ctx.ui.notify(
			`Invalid message preset: ${preset}\nOptions: ${MESSAGE_PRESETS.join(", ")}`,
			"error",
		);
		return;
	}

	currentConfig.widget.message.preset = preset as PolishConfig["widget"]["message"]["preset"];
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

	if (!INDICATOR_PRESETS.includes(preset as PolishConfig["widget"]["indicator"]["preset"])) {
		ctx.ui.notify(
			`Invalid indicator preset: ${preset}\nOptions: ${INDICATOR_PRESETS.join(", ")}`,
			"error",
		);
		return;
	}

	currentConfig.widget.indicator.preset = preset as PolishConfig["widget"]["indicator"]["preset"];
	saveConfig();
	applyConfig(ctx);
	ctx.ui.notify(`Indicator preset set to: ${preset}`, "info");
}

async function setFooterPreset(preset: string, ctx: ExtensionCommandContext): Promise<void> {
	if (!preset) {
		ctx.ui.notify(
			`Usage: /polish footer <preset>\nOptions: ${FOOTER_PRESETS.join(", ")}`,
			"warning",
		);
		return;
	}

	if (!FOOTER_PRESETS.includes(preset as PolishConfig["footer"]["preset"])) {
		ctx.ui.notify(
			`Invalid footer preset: ${preset}\nOptions: ${FOOTER_PRESETS.join(", ")}`,
			"error",
		);
		return;
	}

	currentConfig.footer.preset = preset as PolishConfig["footer"]["preset"];
	saveConfig();
	applyConfig(ctx);
	ctx.ui.notify(`Footer preset set to: ${preset}`, "info");
}

async function setStatusPreset(preset: string, ctx: ExtensionCommandContext): Promise<void> {
	if (!preset) {
		ctx.ui.notify(
			`Usage: /polish status <preset>\nOptions: ${STATUS_PRESETS.join(", ")}`,
			"warning",
		);
		return;
	}

	if (!STATUS_PRESETS.includes(preset as PolishConfig["status"]["preset"])) {
		ctx.ui.notify(
			`Invalid status preset: ${preset}\nOptions: ${STATUS_PRESETS.join(", ")}`,
			"error",
		);
		return;
	}

	currentConfig.status.preset = preset as PolishConfig["status"]["preset"];
	saveConfig();
	applyConfig(ctx);
	ctx.ui.notify(`Status preset set to: ${preset}`, "info");
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
	currentConfig.widget.message.customVerbs = verbs;
	saveConfig();
	applyConfig(ctx);
	ctx.ui.notify(`Custom verbs set to: ${verbs.join(", ") || "(empty)"}`, "info");
}

// ── Extension entry ───────────────────────────────────────────────────────

export default function (pi: ExtensionAPI) {
	pi.on("session_start", (_event, ctx) => {
		markSessionStart();
		applyConfig(ctx);
	});

	pi.registerCommand("polish", {
		description: "Configure polish widget, footer, and status presets",
		handler: handlePolishCommand,
		getArgumentCompletions,
	});
}
