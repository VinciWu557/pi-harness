/**
 * Argument completions for the `/polish` command.
 *
 * Provides subcommand completion and preset value completion (for both the
 * direct subcommands like `footer <preset>` and the `set key=value` form).
 * Imported only by `index.ts`.
 */

import { INDICATOR_PRESETS, MESSAGE_PRESETS } from "./widget/index.js";
import { FOOTER_PRESETS, STATUS_PRESETS } from "./footer/index.js";

export function getArgumentCompletions(prefix: string) {
	const subcommands = [
		{ value: "message", label: "message", description: "Set message preset" },
		{ value: "indicator", label: "indicator", description: "Set indicator preset" },
		{ value: "footer", label: "footer", description: "Set footer preset" },
		{ value: "status", label: "status", description: "Set status preset" },
		{ value: "set", label: "set", description: "Set all presets at once (key=value)" },
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

	// After subcommand name (space typed): presets for message/indicator/footer/status
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

	if (sub === "footer" && parts.length <= 2) {
		return FOOTER_PRESETS.filter((p) => p.startsWith(typedPreset)).map((p) => ({
			value: p,
			label: p,
		}));
	}

	if (sub === "status" && parts.length <= 2) {
		return STATUS_PRESETS.filter((p) => p.startsWith(typedPreset)).map((p) => ({
			value: p,
			label: p,
		}));
	}

	// set subcommand key=value completions
	if (sub === "set" && parts.length <= 7) {
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

		const presetMap: Record<string, readonly string[]> = {
			message: MESSAGE_PRESETS,
			indicator: INDICATOR_PRESETS,
			footer: FOOTER_PRESETS,
			status: STATUS_PRESETS,
		};
		const presets = presetMap[key];
		if (presets) {
			return presets
				.filter((p) => p.startsWith(partialValue))
				.map((p) => ({
					value: p,
					label: p,
				}));
		}
	}

	// Suggest remaining keys
	const availableKeys = [
		{ key: "message=", label: "message=", description: "Message preset" },
		{ key: "indicator=", label: "indicator=", description: "Indicator preset" },
		{ key: "footer=", label: "footer=", description: "Footer preset" },
		{ key: "status=", label: "status=", description: "Status preset" },
		{ key: "verbs=", label: "verbs=", description: "Custom verbs" },
	].filter((k) => {
		const keyName = k.key.slice(0, -1);
		return !usedKeys.has(keyName);
	});

	return availableKeys
		.filter((k) => k.key.startsWith(typedArg))
		.map((k) => ({ value: k.key, label: k.label, description: k.description }));
}
