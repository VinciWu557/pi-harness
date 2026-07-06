import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";

export default function (pi: ExtensionAPI) {
	pi.on("session_start", (_event, ctx) => {
		// 块状渐层 + 随机摸鱼文案
		const blocks = ["░", "▒", "▓", "█", "▓"];
		const phrases = [
			"发呆中",
			"摸鱼中",
			"假装深度思考中",
			"忽悠中",
		];

		// 每个 block 随机配一个 phrase，打乱顺序，制造"随机"感
		const pairs = blocks.flatMap((b) =>
			phrases.map((p) => ({ block: b, phrase: p })),
		);
		// Fisher-Yates 洗牌
		for (let i = pairs.length - 1; i > 0; i--) {
			const j = Math.floor(Math.random() * (i + 1));
			[pairs[i], pairs[j]] = [pairs[j]!, pairs[i]!];
		}

		ctx.ui.setWorkingIndicator({
			frames: pairs.map(
				({ block, phrase }) =>
					ctx.ui.theme.fg("accent", block + " " + phrase),
			),
			intervalMs: 120,
		});
	});
}
