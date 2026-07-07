/**
 * Message presets for the polish widget.
 *
 * Each preset produces a working message string shown during streaming.
 * The `createMessage` factory dispatches based on the config preset name.
 *
 * This is the text component of the streaming widget (shown above the editor
 * while the agent is responding). See `widget/index.ts` for the combined
 * widget abstraction.
 */

/** Configuration for the message preset. */
export interface MessageConfig {
	preset: "default" | "playful" | "professional" | "custom" | "minimal";
	customVerbs?: string[];
}

/** All valid message preset names, in menu/completion order. */
export const MESSAGE_PRESETS = ["default", "playful", "professional", "custom", "minimal"] as const;

// ── Built-in verb libraries ──────────────────────────────────────────────

const BUILTIN_PLAYFUL = [
	"发呆",
	"摸鱼",
	"假装深度思考",
	"忽悠",
	"红温",
	"烧脑",
	"胡言乱语",
] as const;

const BUILTIN_PROFESSIONAL = [
	"Working on it",
	"Thinking",
	"Processing",
	"Crunching numbers",
	"Brewing coffee",
	"Consulting the oracle",
] as const;

// ── Helpers ──────────────────────────────────────────────────────────────

function randomFrom(verbs: readonly string[]): string {
	return verbs[Math.floor(Math.random() * verbs.length)]!;
}

function formatMessage(verb: string): string {
	return `${verb}...`;
}

// ── Preset factories ─────────────────────────────────────────────────────

type MessageFactory = (config: MessageConfig) => string | undefined;

const factories: Record<MessageConfig["preset"], MessageFactory> = {
	default: () => undefined,

	playful: () => formatMessage(randomFrom(BUILTIN_PLAYFUL)),

	professional: () => formatMessage(randomFrom(BUILTIN_PROFESSIONAL)),

	custom: (config) => {
		const verbs = config.customVerbs;
		if (!verbs || verbs.length === 0) {
			return formatMessage("...");
		}
		return formatMessage(randomFrom(verbs));
	},

	minimal: () => "...",
};

/**
 * Create a working message based on the given config.
 *
 * Returns `undefined` for the "default" preset, which means "don't touch
 * pi's built-in working message".
 */
export function createMessage(config: MessageConfig): string | undefined {
	const factory = factories[config.preset];
	if (!factory) {
		return undefined;
	}
	return factory(config);
}
