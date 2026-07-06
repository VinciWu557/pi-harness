import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import type {
	ExtensionAPI,
	ExtensionCommandContext,
	ExtensionContext,
} from "@earendil-works/pi-coding-agent";
import { DynamicBorder } from "@earendil-works/pi-coding-agent";
import { Container, matchesKey, Text } from "@earendil-works/pi-tui";
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
const INDICATOR_PRESETS = ["default", "wave", "spinner", "rainbow", "dot", "pulse", "none"] as const;

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
		ctx.ui.notify("Polish 配置需要交互式 TUI 支持", "error");
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
				`未知子命令: ${subcommand}\n用法: /polish [message|indicator|verbs|show|reset]`,
				"warning",
			);
	}
}

// ── Interactive menu ──────────────────────────────────────────────────────

async function interactiveMenu(ctx: ExtensionCommandContext): Promise<void> {
	while (true) {
		const choice = await ctx.ui.select("Polish 配置", [
			"预设配置",
			"自定义动词",
			"查看当前配置",
			"重置为默认",
		]);

		if (choice === undefined) break;

		switch (choice) {
			case "预设配置":
				await interactiveCombinedPreset(ctx);
				break;
			case "自定义动词":
				await interactiveCustomVerbs(ctx);
				break;
			case "查看当前配置":
				showConfig(ctx);
				break;
			case "重置为默认":
				await resetConfig(ctx);
				break;
		}
	}
}

async function interactiveMessagePreset(ctx: ExtensionCommandContext): Promise<void> {
	const preset = await ctx.ui.select("选择消息预设", [...MESSAGE_PRESETS]);
	if (preset === undefined) return;

	currentConfig.message.preset = preset as MessageConfig["preset"];
	saveConfig();
	applyConfig(ctx);
	ctx.ui.notify(`消息预设已设置为: ${preset}`, "info");
}

async function interactiveIndicatorPreset(ctx: ExtensionCommandContext): Promise<void> {
	const preset = await ctx.ui.select("选择指示器预设", [...INDICATOR_PRESETS]);
	if (preset === undefined) return;

	currentConfig.indicator.preset = preset as IndicatorConfig["preset"];
	saveConfig();
	applyConfig(ctx);
	ctx.ui.notify(`指示器预设已设置为: ${preset}`, "info");
}

async function interactiveCustomVerbs(ctx: ExtensionCommandContext): Promise<void> {
	const current = currentConfig.message.customVerbs?.join(", ") ?? "";
	const input = await ctx.ui.input("输入自定义动词（逗号分隔）", current);
	if (input === undefined) return;

	const verbs = input
		.split(",")
		.map((v) => v.trim())
		.filter((v) => v.length > 0);
	currentConfig.message.customVerbs = verbs;
	saveConfig();
	applyConfig(ctx);
	ctx.ui.notify(`自定义动词已设置为: ${verbs.join(", ") || "（空）"}`, "info");
}

// ── Combined preset selector (message + indicator with preview) ──────────

/** Generate preview text for a message preset. */
function getMessagePreview(preset: string): string {
	const tempConfig: MessageConfig = { ...currentConfig.message, preset: preset as MessageConfig["preset"] };
	const msg = createMessage(tempConfig);
	return msg ?? "(默认)";
}

/** Get a representative indicator frame for a preset. */
function getIndicatorPreview(preset: string): string {
	const previews: Record<string, string> = {
		default: "(默认)",
		wave: "█▓▒░░░░░",
		spinner: "⠋",
		rainbow: "⠋",
		dot: "●",
		pulse: "●",
		none: "(无)",
	};
	return previews[preset] ?? "?";
}

/**
 * Show a custom selection list with a live preview line.
 * User presses ↑/↓ to navigate, preview updates in real time,
 * Enter to confirm, Esc to cancel.
 * Returns the selected value or null if cancelled.
 */
async function selectWithPreview(
	ctx: ExtensionCommandContext,
	title: string,
	options: readonly string[],
	currentValue: string,
	getPreview: (value: string) => string,
): Promise<string | null> {
	const startIdx = Math.max(0, options.indexOf(currentValue));

	return ctx.ui.custom<string | null>((tui, theme, _kb, done) => {
		let highlightedIndex = startIdx;
		const container = new Container();

		const rebuild = () => {
			container.clear();
			container.addChild(new DynamicBorder((s: string) => theme.fg("accent", s)));

			// Title
			container.addChild(new Text(theme.fg("accent", theme.bold(title)), 1, 0));

			// Preview line — reflects the currently highlighted option
			const currentOpt = options[highlightedIndex]!;
			container.addChild(new Text(theme.fg("dim", `预览: ${getPreview(currentOpt)}`), 1, 0));

			// Render all options
			for (let i = 0; i < options.length; i++) {
				const opt = options[i]!;
				const isHighlighted = i === highlightedIndex;
				container.addChild(
					new Text(
						isHighlighted
							? theme.fg("accent", `→ ${opt}`)
							: ` ${opt}`,
						1,
						0,
					),
				);
			}

			// Footer hint
			container.addChild(new Text(theme.fg("dim", "↑↓ 导航 • Enter 选择 • Esc 返回"), 1, 0));

			container.addChild(new DynamicBorder((s: string) => theme.fg("accent", s)));
		};

		rebuild();

		return {
			render: (w: number) => container.render(w),
			invalidate: () => {
				container.invalidate();
				rebuild();
			},
			handleInput: (data: string) => {
				if (matchesKey(data, "up") || matchesKey(data, "k")) {
					highlightedIndex = Math.max(0, highlightedIndex - 1);
					rebuild();
					tui.requestRender();
					return;
				}
				if (matchesKey(data, "down") || matchesKey(data, "j")) {
					highlightedIndex = Math.min(options.length - 1, highlightedIndex + 1);
					rebuild();
					tui.requestRender();
					return;
				}
				if (matchesKey(data, "enter")) {
					done(options[highlightedIndex]!);
					return;
				}
				if (matchesKey(data, "escape")) {
					done(null);
					return;
				}
			},
		};
	});
}

/**
 * Step-by-step wizard: first choose message preset, then indicator preset.
 * Each step shows a preview of what the current selection produces.
 */
async function interactiveCombinedPreset(ctx: ExtensionCommandContext): Promise<void> {
	// Step 1: Select message preset with preview
	const messagePreset = await selectWithPreview(
		ctx,
		"📨 选择消息预设",
		MESSAGE_PRESETS,
		currentConfig.message.preset,
		(preset) => getMessagePreview(preset),
	);
	if (messagePreset == null) return; // User cancelled

	// Apply message preset temporarily so step 2 preview shows the combined effect
	const prevMessagePreset = currentConfig.message.preset;
	currentConfig.message.preset = messagePreset as MessageConfig["preset"];
	applyConfig(ctx);

	// Step 2: Select indicator preset with combined preview
	const indicatorPreset = await selectWithPreview(
		ctx,
		"🎯 选择指示器预设",
		INDICATOR_PRESETS,
		currentConfig.indicator.preset,
		(preset) => `${getMessagePreview(messagePreset!)}  ${getIndicatorPreview(preset)}`,
	);

	if (indicatorPreset == null) {
		// Revert message preset
		currentConfig.message.preset = prevMessagePreset as MessageConfig["preset"];
		applyConfig(ctx);
		return;
	}

	currentConfig.indicator.preset = indicatorPreset as IndicatorConfig["preset"];
	saveConfig();
	applyConfig(ctx);
	ctx.ui.notify(
		`预设配置已更新: 消息=${currentConfig.message.preset}  指示器=${currentConfig.indicator.preset}`,
		"info",
	);
}

// ── Direct parameter mode ─────────────────────────────────────────────────

async function setMessagePreset(preset: string, ctx: ExtensionCommandContext): Promise<void> {
	if (!preset) {
		ctx.ui.notify(
			`用法: /polish message <preset>\n可选: ${MESSAGE_PRESETS.join(", ")}`,
			"warning",
		);
		return;
	}

	if (!MESSAGE_PRESETS.includes(preset as MessageConfig["preset"])) {
		ctx.ui.notify(
			`无效的消息预设: ${preset}\n可选: ${MESSAGE_PRESETS.join(", ")}`,
			"error",
		);
		return;
	}

	currentConfig.message.preset = preset as MessageConfig["preset"];
	saveConfig();
	applyConfig(ctx);
	ctx.ui.notify(`消息预设已设置为: ${preset}`, "info");
}

async function setIndicatorPreset(preset: string, ctx: ExtensionCommandContext): Promise<void> {
	if (!preset) {
		ctx.ui.notify(
			`用法: /polish indicator <preset>\n可选: ${INDICATOR_PRESETS.join(", ")}`,
			"warning",
		);
		return;
	}

	if (!INDICATOR_PRESETS.includes(preset as IndicatorConfig["preset"])) {
		ctx.ui.notify(
			`无效的指示器预设: ${preset}\n可选: ${INDICATOR_PRESETS.join(", ")}`,
			"error",
		);
		return;
	}

	currentConfig.indicator.preset = preset as IndicatorConfig["preset"];
	saveConfig();
	applyConfig(ctx);
	ctx.ui.notify(`指示器预设已设置为: ${preset}`, "info");
}

async function setCustomVerbs(verbsStr: string, ctx: ExtensionCommandContext): Promise<void> {
	if (!verbsStr) {
		ctx.ui.notify("用法: /polish verbs <verb1,verb2,...>", "warning");
		return;
	}

	const verbs = verbsStr
		.split(",")
		.map((v) => v.trim())
		.filter((v) => v.length > 0);
	currentConfig.message.customVerbs = verbs;
	saveConfig();
	applyConfig(ctx);
	ctx.ui.notify(`自定义动词已设置为: ${verbs.join(", ") || "（空）"}`, "info");
}

function showConfig(ctx: ExtensionCommandContext): void {
	const lines = [
		`消息预设: ${currentConfig.message.preset}`,
		`自定义动词: ${currentConfig.message.customVerbs?.join(", ") || "（无）"}`,
		`指示器预设: ${currentConfig.indicator.preset}`,
	];
	ctx.ui.notify(lines.join("\n"), "info");
}

async function resetConfig(ctx: ExtensionCommandContext): Promise<void> {
	const ok = await ctx.ui.confirm("重置配置", "将所有配置重置为默认值，是否继续？");
	if (!ok) return;

	currentConfig = structuredClone(DEFAULT_CONFIG);
	saveConfig();
	applyConfig(ctx);
	ctx.ui.notify("配置已重置为默认值", "info");
}

// ── Argument completions ──────────────────────────────────────────────────

function getArgumentCompletions(prefix: string) {
	const subcommands = [
		{ value: "message", label: "message", description: "设置消息预设" },
		{ value: "indicator", label: "indicator", description: "设置指示器预设" },
		{ value: "verbs", label: "verbs", description: "设置自定义动词" },
		{ value: "show", label: "show", description: "查看当前配置" },
		{ value: "reset", label: "reset", description: "重置为默认配置" },
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

	return null;
}

// ── Extension entry ───────────────────────────────────────────────────────

export default function (pi: ExtensionAPI) {
	pi.on("session_start", (_event, ctx) => {
		applyConfig(ctx);
	});

	pi.registerCommand("polish", {
		description: "配置 polish 工作消息和指示器预设",
		handler: handlePolishCommand,
		getArgumentCompletions,
	});
}
