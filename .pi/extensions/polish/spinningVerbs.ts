const VERBS = [
	"发呆中",
	"摸鱼中",
	"假装深度思考中",
	"忽悠中",
] as const;

/** 从动词库里随机挑一个 */
export function randomVerb(): string {
	return VERBS[Math.floor(Math.random() * VERBS.length)]!;
}
