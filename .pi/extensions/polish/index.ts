import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { createWaveFrames } from "./wave.js";
import { randomVerb } from "./spinningVerbs.js";

export default function (pi: ExtensionAPI) {
	pi.on("session_start", (_event, ctx) => {
		const verb = randomVerb();
		ctx.ui.setWorkingMessage(verb + "...");

		const frames = createWaveFrames().map((wave) =>
			ctx.ui.theme.fg("accent", wave),
		);

		ctx.ui.setWorkingIndicator({
			frames,
			intervalMs: 120,
		});
	});
}
