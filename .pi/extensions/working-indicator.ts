import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";

export default function (pi: ExtensionAPI) {
	pi.on("session_start", (_event, ctx) => {
		const width = 8;
		const tail = ["▓", "▒", "░"];

		// 高亮块从左到右移动，留下 ░▒▓█ 渐变尾迹
		const forward = Array.from({ length: width }, (_, pos) => {
			let line = "";
			for (let i = 0; i < width; i++) {
				const dist = Math.abs(i - pos);
				if (dist === 0) line += "█";
				else if (dist <= tail.length) line += tail[dist - 1]!;
				else line += "░";
			}
			return line;
		});

		// 从右到左返回，去掉首尾避免在两端重复停留
		const backward = forward.slice(1, -1).reverse();
		const waves = [...forward, ...backward];
		const phrases = [
			"发呆中",
			"摸鱼中",
			"假装深度思考中",
			"忽悠中",
		];

		// 随机挑一句文案，所有帧共用
		const phrase = phrases[Math.floor(Math.random() * phrases.length)]!;
		ctx.ui.setWorkingIndicator({
			frames: waves.map(
				(wave) =>
					ctx.ui.theme.fg("accent", wave + " " + phrase),
			),
			intervalMs: 120,
		});
	});
}
