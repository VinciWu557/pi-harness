---
name: custom-ui
description: 编写 pi 自定义 TUI 组件与界面装饰的完整工作流：从确认需求、选择模式，到编写组件代码并集成到扩展。
disable-model-invocation: true
---

# 编写 pi 自定义 UI

pi 的 TUI 界面可通过扩展（extensions）自定义：从简单的状态栏、widget，到完整的自定义组件、覆盖层和自定义编辑器。

所有具体 API（组件接口、内置组件、定位参数、主题颜色）以 pi 文档 `docs/tui.md` 为准。每个步骤会指明应读取的章节。

## 步骤

### 1. 确认需求与 UI 类型

向用户提问，确定自定义目标和部署位置。

**UI 类型**（六选一）：

- **简单装饰**：状态栏文字（`setStatus`）、编辑器上下 widget（`setWidget`）、自定义 footer（`setFooter`）、工作指示器（`setWorkingIndicator`）。不涉及键盘交互。
- **对话框**：确认弹窗（`confirm`）、单选列表（`select`）、文本输入（`input`）、通知（`notify`）。有交互但不需手写 component。
- **选择/设置组件**：从列表中选择（`SelectList`）或切换多个开关（`SettingsList`）。使用内置组件，组合即可。
- **自定义全屏组件**：手写 TUI component，自己管理 render / handleInput / invalidate。适合复杂交互。
- **覆盖层**：在现有界面上方弹出组件（对话框、侧边栏等），使用 `overlay: true` + 定位参数。
- **自定义编辑器**：替换主输入框，实现模态编辑（如 vim 模式）。需继承 `CustomEditor`。

**部署位置**：

- 项目级：`.pi/extensions/<name>.ts`，仅当前项目可用
- 全局：`~/.pi/agent/extensions/<name>.ts`，所有项目可用

**完成标准**：UI 类型 + 具体交互需求 + 扩展文件路径均已明确。

---

### 2. 读取参考文档

根据步骤 1 确定的类型，读取 `docs/tui.md` 中的对应章节：

| UI 类型 | 应读章节 |
|---------|---------|
| 简单装饰 | Pattern 4/4b/5/6（Status、Working Indicator、Widgets、Custom Footer） |
| 对话框 | Custom UI: Dialogs（`docs/extensions.md`） |
| 选择/设置组件 | Pattern 1 + Pattern 3（SelectList、SettingsList） |
| 自定义全屏组件 | Creating Custom Components + Pattern 1 + Key Rules |
| 覆盖层 | Overlays + Overlay Focus + Overlay Lifecycle |
| 自定义编辑器 | Pattern 7（Custom Editor） |

所有类型都需确认以下关键规则（`docs/tui.md` Key Rules 章节）：

- **Theme 从 callback 获取**，不能直接 import。用 `ctx.ui.custom((tui, theme, keybindings, done) => ...)` 中的 `theme` 参数。
- **状态变更后调用 `tui.requestRender()`**，触发重绘。
- **自定义组件必须返回** `{ render, invalidate, handleInput }` 三个方法。
- **每行不超过 `render(width)` 的 `width` 参数**，用 `truncateToWidth` 截断。

**完成标准**：已读完对应章节，关键规则已确认。

---

### 3. 编写组件代码

参照 `docs/tui.md` 中的 Common Patterns，根据步骤 1 的类型实现。

**所有类型的共同注意事项**：

- 扩展入口：`export default function (pi: ExtensionAPI) { ... }`
- 代码写在 `session_start` 事件处理器中（或 `registerCommand` 的 handler 中）
- `ctx.ui.custom()` 的回调工厂函数在终端可用时才会执行，使用 `ctx.mode === "tui"` 做守卫

**按类型分述**：

#### 简单装饰

参照 `docs/tui.md` Pattern 4/4b/5/6。关键点：

- `setStatus(key, text)` 在 footer 显示文字，`setStatus(key, undefined)` 清除
- `setWidget(key, lines, { placement })` 在编辑器上/下方显示内容，支持返回 `{ render, invalidate }` 对象的函数形式
- `setFooter(factory)` 完全替换 footer，factory 接收 `(tui, theme, footerData)`
- `setWorkingIndicator({ frames, intervalMs })` 自定义工作中动画，不传参恢复默认

#### 对话框

参照 `docs/extensions.md` Custom UI: Dialogs 章节。关键点：

- `ctx.ui.confirm(title, message)` 返回 `boolean`
- `ctx.ui.select(title, items)` 返回选中项
- `ctx.ui.input(title, placeholder?)` 返回输入字符串
- `ctx.ui.notify(message, level)` 弹出通知，不阻塞
- 用 `ctx.hasUI` 守卫，非 TUI/RPC 模式下这些方法不可用

#### 选择/设置组件

参照 `docs/tui.md` Pattern 1（SelectList）和 Pattern 3（SettingsList）。关键点：

- `SelectList`：传入 `SelectItem[]`（含 `value`、`label`、可选 `description`），通过 `onSelect` / `onCancel` 回调处理结果
- `SettingsList`：传入 `SettingItem[]`（含 `id`、`label`、`currentValue`、`values`），通过回调处理值变更
- 用 `DynamicBorder` 做顶部/底部边框
- import 来源：`SelectList`、`SettingsList` 等 TUI 组件来自 `@earendil-works/pi-tui`；`DynamicBorder` 来自 `@earendil-works/pi-coding-agent`

#### 自定义全屏组件

参照 `docs/tui.md` Creating Custom Components 章节 + Pattern 1。关键点：

- 实现 `handleInput(data)`：用 `matchesKey(data, Key.xxx)` 检测按键，状态变更后调 `invalidate()` + `tui.requestRender()`
- 实现 `render(width)`：缓存渲染结果（`cachedWidth` + `cachedLines`），`invalidate()` 清缓存
- 实现 `invalidate()`：清缓存，让下次 `render()` 重新计算
- 如需 IME 支持（中文输入等），实现 `Focusable` 接口
- 容器组件包含 `Input`/`Editor` 子组件时，必须传播 `focused` 状态
- 用内置组件（`Container`、`Text`、`Box`、`Spacer`、`Markdown`）组合，不从头画

#### 覆盖层

参照 `docs/tui.md` Overlays 章节。关键点：

- `ctx.ui.custom(factory, { overlay: true })` 创建覆盖层
- `overlayOptions` 控制位置和大小：`anchor`（9 个方位）、`width`/`height`（支持百分比）、`margin`、`offsetX/Y`
- 覆盖层关闭后组件被 dispose，**不要复用实例**，每次重新创建
- 通过 `onHandle` 回调获取 handle，控制 `focus()` / `unfocus()` / `setHidden()`

#### 自定义编辑器

参照 `docs/tui.md` Pattern 7。关键点：

- 继承 `CustomEditor`（不是基类 `Editor`），获得 app 级快捷键（Esc 中断、Ctrl+D 退出等）
- `handleInput(data)` 中未处理的键调用 `super.handleInput(data)` 透传
- `setEditorComponent(factory)` 在 `session_start` 中调用，factory 接收 `(tui, theme, keybindings)`
- `setEditorComponent(undefined)` 恢复默认编辑器

**完成标准**：组件代码已写出，覆盖步骤 1 中的所有交互需求；theme 从 callback 获取、状态变更调用 requestRender、不超行宽。

---

### 4. 集成到扩展文件

将代码写入步骤 1 确定的扩展文件路径。

**文件结构**：

```typescript
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
// 按需导入 TUI 组件
import { Container, Text, SelectList } from "@earendil-works/pi-tui";
// 按需导入 agent 端工具
import { DynamicBorder, BorderedLoader } from "@earendil-works/pi-coding-agent";

export default function (pi: ExtensionAPI) {
  pi.on("session_start", (_event, ctx) => {
    // UI 初始化代码
  });

  // 或注册为命令：
  // pi.registerCommand("my-ui", { ... });
}
```

**注意事项**：

- `ctx.mode === "tui"` 守卫 TUI 专属代码，print/json 模式下跳过
- 复杂组件可拆分为独立 class，放在同一文件中或 `import` 引入
- 如需 npm 依赖，在扩展目录创建 `package.json` 并 `npm install`

**完成标准**：扩展文件已写入磁盘，TypeScript 语法正确，所有 import 齐全。

---

### 5. 测试验证

提示用户测试：

```bash
pi -e .pi/extensions/<name>.ts
```

**测试要点**：

- 交互行为：按键响应是否正确，选中/取消/确认流程是否完整
- 主题适配：切换主题后组件是否正确重绘（`invalidate` 是否正确实现）
- 边界情况：空数据、超长文本、窄终端宽度下的截断和布局
- 覆盖层：多次打开/关闭是否正常（每次新建实例，不复用）
- 自定义编辑器：Esc 是否能正常中断 agent，模式切换是否正常

**完成标准**：用户确认组件在终端中正常工作，无渲染异常或交互 bug。
