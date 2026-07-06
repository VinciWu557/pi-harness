const WIDTH = 8;
const TAIL = ["▓", "▒", "░"];

/**
 * 生成波光动画帧：高亮块 █ 从左到右移动，留下 ░▒▓█ 渐变尾迹。
 * 返回的数组可直接用作 setWorkingIndicator 的 frames 参数。
 */
export function createWaveFrames(): string[] {
	const forward = Array.from({ length: WIDTH }, (_, pos) => {
		let line = "";
		for (let i = 0; i < WIDTH; i++) {
			const dist = Math.abs(i - pos);
			if (dist === 0) line += "█";
			else if (dist <= TAIL.length) line += TAIL[dist - 1]!;
			else line += "░";
		}
		return line;
	});

	// 从右到左折返，去掉首尾避免在两端重复停留
	const backward = forward.slice(1, -1).reverse();
	return [...forward, ...backward];
}
