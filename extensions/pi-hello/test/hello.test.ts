import { expect, test } from "vitest";
import assert from "node:assert/strict";
import { createMockContext, createMockPi } from "../../../test/support";
import hello from "../src/hello";

test("registers greet tool, hello command, and harness-status command", () => {
	const mock = createMockPi();
	hello(mock.pi);

	// Tool registration
	expect(mock.tools).toHaveLength(1);
	expect(mock.tools[0].name).toBe("greet");
	expect(mock.tools[0].label).toBe("打招呼");

	// Command registration
	expect(mock.commands.size).toBe(2);
	expect(mock.commands.get("hello")?.description).toBe("打个招呼");
	expect(mock.commands.get("harness-status")?.description).toBe("查看 pi-hello 状态");
});

test("hello command notifies with the given name", async () => {
	const mock = createMockPi();
	hello(mock.pi);

	const command = mock.commands.get("hello");
	assert.ok(command);

	const { ctx, notifications } = createMockContext();
	await command.handler("  Vinci  ", ctx);

	expect(notifications).toHaveLength(1);
	expect(notifications[0].message).toBe("你好，Vinci！");
	expect(notifications[0].level).toBe("info");
});

test("hello command defaults to 世界 when no name given", async () => {
	const mock = createMockPi();
	hello(mock.pi);

	const command = mock.commands.get("hello");
	assert.ok(command);

	const { ctx, notifications } = createMockContext();
	await command.handler("", ctx);

	expect(notifications).toHaveLength(1);
	expect(notifications[0].message).toBe("你好，世界！");
});

test("harness-status command sets status and notifies", async () => {
	const mock = createMockPi();
	hello(mock.pi);

	const command = mock.commands.get("harness-status");
	assert.ok(command);

	const { ctx, notifications, statuses } = createMockContext();
	await command.handler("", ctx);

	expect(notifications).toHaveLength(1);
	expect(notifications[0].message).toBe("pi-hello v0.1.0 运行中");
	expect(statuses.get("harness")).toBe("✅ pi-hello 已激活");
});

test("greet tool returns greeting in the specified language", async () => {
	const mock = createMockPi();
	hello(mock.pi);

	const tool = mock.tools[0];
	assert.ok(tool.execute);

	const result = await tool.execute("call-id", { name: "World", language: "en" });
	expect(result.content).toEqual([{ type: "text", text: "Hello, World! 👋" }]);
	expect(result.details).toEqual({ name: "World", language: "en" });
});

test("greet tool defaults to Chinese when no language specified", async () => {
	const mock = createMockPi();
	hello(mock.pi);

	const tool = mock.tools[0];
	assert.ok(tool.execute);

	const result = await tool.execute("call-id", { name: "世界" });
	expect(result.content).toEqual([{ type: "text", text: "你好，世界！👋" }]);
	expect(result.details).toEqual({ name: "世界", language: "zh" });
});

test("greet tool supports Japanese", async () => {
	const mock = createMockPi();
	hello(mock.pi);

	const tool = mock.tools[0];
	assert.ok(tool.execute);

	const result = await tool.execute("call-id", { name: "Taro", language: "ja" });
	expect(result.content).toEqual([{ type: "text", text: "こんにちは、Taro！👋" }]);
});

test("greet tool falls back to Chinese for unknown language", async () => {
	const mock = createMockPi();
	hello(mock.pi);

	const tool = mock.tools[0];
	assert.ok(tool.execute);

	const result = await tool.execute("call-id", { name: "Test", language: "fr" });
	expect(result.content).toEqual([{ type: "text", text: "你好，Test！👋" }]);
	expect(result.details).toEqual({ name: "Test", language: "fr" });
});
