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
const INDICATOR_PRESETS = [
	"default",
	"wave",
	"spinner",
	"rainbow",
	"dot",
	"pulse",
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
				await interactiveSimultaneousPreset(ctx);
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

// ── Simultaneous preset selector (message + indicator on one screen) ─────

/** Generate preview text for a message preset. */
function getMessagePreview(preset: string): string {
	const tempConfig: MessageConfig = {
		...currentConfig.message,
		preset: preset as MessageConfig["preset"],
	};
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
 * Single-screen preset selector: shows message and indicator options
 * side by side. Use TAB to switch columns, ↑↓ to select, Enter to confirm.
 */
async function interactiveSimultaneousPreset(ctx: ExtensionCommandContext): Promise<void> {
	const msgStartIdx = Math.max(
		0,
		MESSAGE_PRESETS.indexOf(currentConfig.message.preset as (typeof MESSAGE_PRESETS)[number]),
	);
	const indStartIdx = Math.max(
		0,
		INDICATOR_PRESETS.indexOf(
			currentConfig.indicator.preset as (typeof INDICATOR_PRESETS)[number],
		),
	);

	const COL_WIDTH = 22;

	// padEnd based on visible length, ignoring ANSI escape sequences
	const padEndVisible = (s: string, width: number) => {
		const esc = String.fromCharCode(27);
		const visible = s.replace(new RegExp(esc + "\\[[\\d;]*m", "g"), "").length;
		return s + " ".repeat(Math.max(0, width - visible));
	};

	const result = await ctx.ui.custom<{ message: string; indicator: string } | null>(
		(tui, theme, _kb, done) => {
			let activeColumn: "message" | "indicator" = "indicator";
			let msgIdx = msgStartIdx;
			let indIdx = indStartIdx;

			const container = new Container();

			const rebuild = () => {
				container.clear();
				container.addChild(new DynamicBorder((s: string) => theme.fg("accent", s)));

				// Title
				container.addChild(new Text(theme.fg("accent", theme.bold("预设配置")), 1, 0));

				// Preview line — updates in real time as both selections change
				const msgPreview = getMessagePreview(MESSAGE_PRESETS[msgIdx]!);
				const indPreview = getIndicatorPreview(INDICATOR_PRESETS[indIdx]!);
				container.addChild(
					new Text(theme.fg("dim", `预览: ${indPreview}  ${msgPreview}`), 1, 0),
				);
				container.addChild(new Text("", 1, 0));

				// Column headers — highlight the active column
				const indHeader =
					activeColumn === "indicator"
						? theme.fg("accent", theme.bold("指示器预设"))
						: "指示器预设";
				const msgHeader =
					activeColumn === "message"
						? theme.fg("accent", theme.bold("消息预设"))
						: "消息预设";
				container.addChild(
					new Text(`${padEndVisible(indHeader, COL_WIDTH)}${msgHeader}`, 1, 0),
				);

				// Options — two columns rendered side by side
				const maxRows = Math.max(INDICATOR_PRESETS.length, MESSAGE_PRESETS.length);
				for (let i = 0; i < maxRows; i++) {
					let left = "";
					if (i < INDICATOR_PRESETS.length) {
						const opt = INDICATOR_PRESETS[i]!;
						if (i === indIdx && activeColumn === "indicator") {
							left = theme.fg("accent", `→ ${opt}`);
						} else if (i === indIdx) {
							left = `· ${opt}`;
						} else {
							left = `  ${opt}`;
						}
					}

					let right = "";
					if (i < MESSAGE_PRESETS.length) {
						const opt = MESSAGE_PRESETS[i]!;
						if (i === msgIdx && activeColumn === "message") {
							right = theme.fg("accent", `→ ${opt}`);
						} else if (i === msgIdx) {
							right = `· ${opt}`;
						} else {
							right = `  ${opt}`;
						}
					}

					container.addChild(new Text(`${padEndVisible(left, COL_WIDTH)}${right}`, 1, 0));
				}

				// Footer
				container.addChild(
					new Text(theme.fg("dim", "TAB 切换列 • ↑↓ 选择 • Enter 确认 • Esc 返回"), 1, 0),
				);

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
					if (matchesKey(data, "tab")) {
						activeColumn = activeColumn === "message" ? "indicator" : "message";
						rebuild();
						tui.requestRender();
						return;
					}
					if (matchesKey(data, "up") || matchesKey(data, "k")) {
						if (activeColumn === "message") {
							msgIdx = Math.max(0, msgIdx - 1);
						} else {
							indIdx = Math.max(0, indIdx - 1);
						}
						rebuild();
						tui.requestRender();
						return;
					}
					if (matchesKey(data, "down") || matchesKey(data, "j")) {
						if (activeColumn === "message") {
							msgIdx = Math.min(MESSAGE_PRESETS.length - 1, msgIdx + 1);
						} else {
							indIdx = Math.min(INDICATOR_PRESETS.length - 1, indIdx + 1);
						}
						rebuild();
						tui.requestRender();
						return;
					}
					if (matchesKey(data, "enter")) {
						const msg = MESSAGE_PRESETS[msgIdx];
						const ind = INDICATOR_PRESETS[indIdx];
						if (!msg || !ind) return;
						done({ message: msg, indicator: ind });
						return;
					}
					if (matchesKey(data, "escape")) {
						done(null);
						return;
					}
				},
			};
		},
	);

	if (result == null) return;

	currentConfig.message.preset = result.message as MessageConfig["preset"];
	currentConfig.indicator.preset = result.indicator as IndicatorConfig["preset"];
	saveConfig();
	applyConfig(ctx);
	ctx.ui.notify(`预设配置已更新: 消息=${result.message}  指示器=${result.indicator}`, "info");
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
			"用法: /polish set message=<preset> indicator=<preset> [verbs=<verbs>]\n" +
				`消息预设: ${MESSAGE_PRESETS.join(", ")}\n` +
				`指示器预设: ${INDICATOR_PRESETS.join(", ")}`,
			"warning",
		);
		return;
	}

	const updates: string[] = [];

	if ("message" in pairs) {
		const val = pairs.message!;
		if (!MESSAGE_PRESETS.includes(val as (typeof MESSAGE_PRESETS)[number])) {
			ctx.ui.notify(`无效的消息预设: ${val}\n可选: ${MESSAGE_PRESETS.join(", ")}`, "error");
			return;
		}
		currentConfig.message.preset = val as MessageConfig["preset"];
		updates.push(`消息: ${val}`);
	}

	if ("indicator" in pairs) {
		const val = pairs.indicator!;
		if (!INDICATOR_PRESETS.includes(val as (typeof INDICATOR_PRESETS)[number])) {
			ctx.ui.notify(
				`无效的指示器预设: ${val}\n可选: ${INDICATOR_PRESETS.join(", ")}`,
				"error",
			);
			return;
		}
		currentConfig.indicator.preset = val as IndicatorConfig["preset"];
		updates.push(`指示器: ${val}`);
	}

	if ("verbs" in pairs) {
		const verbs = pairs
			.verbs!.split(",")
			.map((v) => v.trim())
			.filter((v) => v.length > 0);
		currentConfig.message.customVerbs = verbs;
		updates.push(`动词: ${verbs.join(", ") || "（空）"}`);
	}

	if (updates.length > 0) {
		saveConfig();
		applyConfig(ctx);
		ctx.ui.notify(`配置已更新: ${updates.join("  ")}`, "info");
	}
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
		ctx.ui.notify(`无效的消息预设: ${preset}\n可选: ${MESSAGE_PRESETS.join(", ")}`, "error");
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
		{ value: "set", label: "set", description: "同时设置消息和指示器 (key=value)" },
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

	// set 子命令的 key=value 补全
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
		{ key: "message=", label: "message=", description: "消息预设" },
		{ key: "indicator=", label: "indicator=", description: "指示器预设" },
		{ key: "verbs=", label: "verbs=", description: "自定义动词" },
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
		description: "配置 polish 工作消息和指示器预设",
		handler: handlePolishCommand,
		getArgumentCompletions,
	});
}
