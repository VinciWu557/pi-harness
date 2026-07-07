/**
 * Widget abstraction for the polish extension.
 *
 * The "widget" is the content shown around the editor while the agent is
 * streaming a response. It has two components:
 *
 * - **message**: the text label (e.g. "Thinking..."), configured via
 *   `setWorkingMessage`.
 * - **indicator**: the animation frames, configured via `setWorkingIndicator`.
 *
 * Both are parts of the same on-screen region, so this module composes them
 * behind a single `applyWidget()` entry point.
 */

import type { ExtensionContext } from "@earendil-works/pi-coding-agent";

import { createIndicator, type IndicatorConfig, INDICATOR_PRESETS } from "./indicators.js";
import { createMessage, type MessageConfig, MESSAGE_PRESETS } from "./messages.js";

export type { IndicatorConfig } from "./indicators.js";
export type { MessageConfig } from "./messages.js";
export { INDICATOR_PRESETS, createIndicator } from "./indicators.js";
export { MESSAGE_PRESETS, createMessage } from "./messages.js";

/** Combined widget config: message + indicator. */
export interface WidgetConfig {
	message: MessageConfig;
	indicator: IndicatorConfig;
}

export const DEFAULT_WIDGET: WidgetConfig = {
	message: { preset: "default", customVerbs: [] },
	indicator: { preset: "default" },
};

/**
 * Apply the widget config to the current session.
 *
 * Sets both the working message and the working indicator. Either may be
 * `undefined` (for the "default" preset), which leaves pi's built-in value
 * untouched.
 */
export function applyWidget(config: WidgetConfig, ctx: ExtensionContext): void {
	const message = createMessage(config.message);
	ctx.ui.setWorkingMessage(message);

	const indicator = createIndicator(config.indicator, ctx.ui.theme);
	ctx.ui.setWorkingIndicator(indicator);
}
