/**
 * Interactive menus for the polish extension.
 *
 * Owns the TUI menus (SelectList main menu, SettingsList preset picker, custom
 * verbs input) plus the show/reset helpers. All UI lives here so `index.ts`
 * stays focused on command routing.
 *
 * Imports config + region modules (widget/footer) but is imported only by
 * `index.ts`, so there are no cycles.
 */

import type { ExtensionCommandContext } from "@earendil-works/pi-coding-agent";
import { DynamicBorder, getSettingsListTheme } from "@earendil-works/pi-coding-agent";
import {
	Container,
	Key,
	matchesKey,
	type SelectItem,
	SelectList,
	type SettingItem,
	SettingsList,
	Text,
} from "@earendil-works/pi-tui";

import {
	applyConfig,
	buildStatusSummary,
	currentConfig,
	resetConfigState,
	saveConfig,
	type PolishConfig,
} from "./config.js";
import { createMessage, INDICATOR_PRESETS, MESSAGE_PRESETS } from "./widget/index.js";
import { FOOTER_PRESETS, STATUS_PRESETS } from "./footer/index.js";

// ── Main menu ─────────────────────────────────────────────────────────────

export async function interactiveMenu(ctx: ExtensionCommandContext): Promise<void> {
	const items: SelectItem[] = [
		{
			value: "preset",
			label: "Presets",
			description: "Configure widget, footer, and status presets",
		},
		{
			value: "verbs",
			label: "Custom Verbs",
			description: "Set verb list for the custom message preset",
		},
		{ value: "show", label: "Show Config", description: "Display current active settings" },
		{ value: "reset", label: "Reset", description: "Restore all settings to defaults" },
	];

	while (true) {
		const choice = await ctx.ui.custom<string | null>((tui, theme, _kb, done) => {
			const container = new Container();

			container.addChild(new DynamicBorder((s: string) => theme.fg("accent", s)));
			container.addChild(new Text(theme.fg("accent", theme.bold(" Polish Config")), 1, 0));

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

export async function interactiveCustomVerbs(ctx: ExtensionCommandContext): Promise<void> {
	const current = currentConfig.widget.message.customVerbs?.join(", ") ?? "";
	const input = await ctx.ui.input("Enter custom verbs (comma-separated)", current);
	if (input === undefined) return;

	const verbs = input
		.split(",")
		.map((v) => v.trim())
		.filter((v) => v.length > 0);
	currentConfig.widget.message.customVerbs = verbs;
	saveConfig();
	applyConfig(ctx);
	ctx.ui.notify(`Custom verbs set to: ${verbs.join(", ") || "(empty)"}`, "info");
}

// ── Simultaneous preset selector (widget + footer + status on one screen) ─

/** Generate preview text for a message preset. */
function getMessagePreview(preset: string): string {
	const tempConfig = {
		...currentConfig.widget.message,
		preset: preset as PolishConfig["widget"]["message"]["preset"],
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

/** Get a layout preview for a footer preset. */
function getFooterPreview(preset: string): string {
	const previews: Record<string, string> = {
		default: "(pi default)",
		rich: "model · git · ctx% · time",
		minimal: "model · git · ctx%",
	};
	return previews[preset] ?? "?";
}

/** Get a preview for a status preset (the summary that would be published). */
function getStatusPreview(preset: string): string {
	return preset === "on" ? buildStatusSummary() : "(off)";
}

async function interactiveSimultaneousPreset(ctx: ExtensionCommandContext): Promise<void> {
	// Snapshot current config for rollback on Esc
	const snapshot: PolishConfig = structuredClone(currentConfig);

	const items: SettingItem[] = [
		{
			id: "indicator",
			label: "Indicator Preset",
			description: getIndicatorPreview(currentConfig.widget.indicator.preset),
			currentValue: currentConfig.widget.indicator.preset,
			values: [...INDICATOR_PRESETS],
		},
		{
			id: "message",
			label: "Message Preset",
			description: getMessagePreview(currentConfig.widget.message.preset),
			currentValue: currentConfig.widget.message.preset,
			values: [...MESSAGE_PRESETS],
		},
		{
			id: "footer",
			label: "Footer Preset",
			description: getFooterPreview(currentConfig.footer.preset),
			currentValue: currentConfig.footer.preset,
			values: [...FOOTER_PRESETS],
		},
		{
			id: "status",
			label: "Status Preset",
			description: getStatusPreview(currentConfig.status.preset),
			currentValue: currentConfig.status.preset,
			values: [...STATUS_PRESETS],
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
					currentConfig.widget.indicator.preset =
						newValue as PolishConfig["widget"]["indicator"]["preset"];
					items.find((i) => i.id === "indicator")!.description =
						getIndicatorPreview(newValue);
				} else if (id === "message") {
					currentConfig.widget.message.preset =
						newValue as PolishConfig["widget"]["message"]["preset"];
					items.find((i) => i.id === "message")!.description =
						getMessagePreview(newValue);
				} else if (id === "footer") {
					currentConfig.footer.preset = newValue as PolishConfig["footer"]["preset"];
					items.find((i) => i.id === "footer")!.description = getFooterPreview(newValue);
				} else if (id === "status") {
					currentConfig.status.preset = newValue as PolishConfig["status"]["preset"];
					// Status summary depends on other presets, so refresh it too.
					items.find((i) => i.id === "status")!.description = getStatusPreview(newValue);
				}
				// Live preview (not persisted)
				applyConfig(ctx);
			},
			() => done(false), // Esc = discard
		);
		container.addChild(settingsList);

		container.addChild(new Text(theme.fg("dim", "Ctrl+S save • esc cancel"), 1, 0));
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
		currentConfig.widget.message.preset = snapshot.widget.message.preset;
		currentConfig.widget.indicator.preset = snapshot.widget.indicator.preset;
		currentConfig.widget.message.customVerbs = snapshot.widget.message.customVerbs;
		currentConfig.footer.preset = snapshot.footer.preset;
		currentConfig.status.preset = snapshot.status.preset;
		applyConfig(ctx);
	}
}

// ── Show / reset ──────────────────────────────────────────────────────────

export function showConfig(ctx: ExtensionCommandContext): void {
	const lines = [
		`Message preset: ${currentConfig.widget.message.preset}`,
		`Custom verbs: ${currentConfig.widget.message.customVerbs?.join(", ") || "(none)"}`,
		`Indicator preset: ${currentConfig.widget.indicator.preset}`,
		`Footer preset: ${currentConfig.footer.preset}`,
		`Status preset: ${currentConfig.status.preset}`,
	];
	ctx.ui.notify(lines.join("\n"), "info");
}

export async function resetConfig(ctx: ExtensionCommandContext): Promise<void> {
	const ok = await ctx.ui.confirm("Reset Config", "Reset all settings to defaults?");
	if (!ok) return;

	resetConfigState();
	saveConfig();
	applyConfig(ctx);
	ctx.ui.notify("Config reset to defaults", "info");
}
