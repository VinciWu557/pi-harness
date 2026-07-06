import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { Type } from "typebox";

export default function (pi: ExtensionAPI) {
	// ============================================================
	// 1. 会话启动通知
	// ============================================================
	pi.on("session_start", async (_event, ctx) => {
		ctx.ui.notify("pi-hello 已加载", "info");
	});

	// ============================================================
	// 2. 事件拦截：危险命令安全检查
	// ============================================================
	pi.on("tool_call", async (event, ctx) => {
		if (event.toolName !== "bash") return;

		const cmd = event.input.command as string | undefined;
		if (!cmd) return;

		// 拦截危险操作
		const dangerous = [
			{ pattern: /\brm\s+-rf\b/, msg: "rm -rf 被拦截" },
			{ pattern: /\bsudo\b/, msg: "sudo 命令被拦截" },
			{ pattern: />\s*\/etc\//, msg: "禁止写入 /etc/ 目录" },
		];

		for (const { pattern, msg } of dangerous) {
			if (pattern.test(cmd)) {
				const ok = await ctx.ui.confirm(
					"⚠️ 安全检查",
					`${msg}\n\n命令: ${cmd}\n\n是否允许执行？`,
				);
				if (!ok) return { block: true, reason: msg };
				break;
			}
		}
	});

	// ============================================================
	// 3. 注册自定义工具
	// ============================================================
	pi.registerTool({
		name: "greet",
		label: "打招呼",
		description: "向指定的人打招呼，支持多种语言",
		parameters: Type.Object({
			name: Type.String({ description: "要打招呼的人名" }),
			language: Type.Optional(Type.String({ description: "语言: zh, en, ja (默认 zh)" })),
		}),
		async execute(_toolCallId, params) {
			const greetings: Record<string, string> = {
				zh: `你好，${params.name}！👋`,
				en: `Hello, ${params.name}! 👋`,
				ja: `こんにちは、${params.name}！👋`,
			};
			const lang = params.language ?? "zh";
			const msg = greetings[lang] ?? greetings.zh;

			return {
				content: [{ type: "text", text: msg }],
				details: { name: params.name, language: lang },
			};
		},
	});

	// ============================================================
	// 4. 注册自定义命令
	// ============================================================
	pi.registerCommand("hello", {
		description: "打个招呼",
		handler: async (args, ctx) => {
			const name = args?.trim() || "世界";
			ctx.ui.notify(`你好，${name}！`, "info");
		},
	});

	pi.registerCommand("harness-status", {
		description: "查看 pi-hello 状态",
		handler: async (_args, ctx) => {
			ctx.ui.notify("pi-hello v0.1.0 运行中", "info");
			ctx.ui.setStatus("harness", "✅ pi-hello 已激活");
		},
	});
}
