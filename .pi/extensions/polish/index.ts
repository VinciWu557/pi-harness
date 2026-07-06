import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import config from "./polish.json" with { type: "json" };
import { createMessage, type MessageConfig } from "./messages.js";
import { createIndicator, type IndicatorConfig } from "./indicators.js";

export default function (pi: ExtensionAPI) {
	pi.on("session_start", (_event, ctx) => {
		// Apply working message preset
		const message = createMessage(config.message as MessageConfig);
		if (message !== undefined) {
			ctx.ui.setWorkingMessage(message);
		}

		// Apply working indicator preset
		const indicator = createIndicator(config.indicator as IndicatorConfig, ctx.ui.theme);
		if (indicator !== undefined) {
			ctx.ui.setWorkingIndicator(indicator);
		}
	});
}
