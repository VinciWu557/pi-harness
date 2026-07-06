---
name: custom-theme
description: 编写 pi 自定义主题的完整工作流：从选调色板、设计 vars，到分配 51 个 color token，生成 JSON 主题文件。
disable-model-invocation: true
---

# 编写 pi 自定义主题

pi 主题是 JSON 文件，放在 `~/.pi/agent/themes/<name>.json`，通过 `/settings` 或 `settings.json` 中 `"theme"` 字段激活，编辑后 hot reload 即时生效。

所有具体规范（颜色值格式、51 个 token 列表、JSON 结构、`$schema` URL）以 pi 文档为准。先读取 pi 系统文档中的 `docs/themes.md`，再开始以下步骤。

## 步骤

### 1. 确认终端与偏好

向用户提问，收集以下信息：

- 终端是暗色（dark）还是亮色（light）？
- 是否有偏好的基础调色板？备选：Nord、Gruvbox、Tokyo Night、Catppuccin、Solarized、Dracula、Monokai，或自定义。

**完成标准**：终端底色 + 调色板方向均已明确，可以进入选色阶段。

---

### 2. 设计 vars 调色板

根据步骤 1 的信息，确定主题名和 vars 颜色变量。

**2a. 确定主题名**

- 不能包含 `/`
- 简洁有辨识度（如 `nord-darker`、`gruvbox-warm`）

**2b. 定义 vars**

参照 pi 内置主题作为起点：

- 读取 pi 源码中的 `dist/modes/interactive/theme/dark.json` 或 `light.json`，观察 vars 的典型结构和色域覆盖
- 根据步骤 1 选择的调色板，将对应颜色值填入 vars
- 确保覆盖 6 大分组的需求：核心 UI、背景与内容、Markdown、Tool Diffs、语法高亮、Thinking 级别边框

**注意事项**：

- hex 颜色推荐用 6 位小写格式（`#rrggbb`）
- `text` 变量用于默认文字色，暗终端常用浅灰，亮终端常用深灰
- 背景类变量（`*Bg`）应与文字色形成足够对比度
- `selectedBg` 是选中行背景，在终端底色之上应产生可见区分
- `toolSuccessBg`、`toolErrorBg`、`toolPendingBg` 分别是工具执行成功/失败/进行中的框背景，三者应有视觉区分

**完成标准**：主题名 + 覆盖所有分组的 vars 结构已确定。

---

### 3. 分配 51 个 color tokens

对照 `docs/themes.md` 中的 Color Tokens 表格，将 vars 中的颜色逐一映射到 `colors` 的 51 个 token。

**分配原则**：

- **一律使用 vars 引用**（`"accent"`），不直接写 hex —— 这样修改 vars 一处即可联动全局
- 语法高亮组（`syntax*`）可适当用 hex 直写，因为它们通常有独立的配色传统（VS Code Dark+、One Dark 等）
- `text` 通常设为 `""`（终端默认色），让终端自身决定文字颜色
- `dim` 比 `muted` 更暗，`muted` 比 `text` 更暗 —— 形成三层文字层级
- thinking 级别边框从 `thinkingOff`（最不明显）到 `thinkingXhigh`（最显眼）递进
- `borderMuted` 应非常低调（暗终端用深灰，亮终端用浅灰）

**完成标准**：`docs/themes.md` 中列出的所有 token 全部赋值，且整体形成合理色彩体系 —— accent 用于强调元素，语义色（success/error/warning）表意明确，thinking 递进有视觉层次。

---

### 4. 写入 JSON 文件

组装完整的主题 JSON。结构参照 `docs/themes.md` 中 Theme Format 章节的模板，写入 `~/.pi/agent/themes/<name>.json`。

- `$schema` 字段参照 pi 文档中的 URL，让编辑器能自动补全 + 校验，**始终保留此行**
- `export` 是可选的，控制 `/export` HTML 导出的背景色。参照 `docs/themes.md` 中 HTML Export 章节
- 写入后提示用户：文件已创建，路径是 `~/.pi/agent/themes/<name>.json`

**完成标准**：文件已写入磁盘，JSON 语法有效，所有必需 token 不缺项。

---

### 5. 选择并测试

提示用户激活主题：

- 方式一：在 pi 中运行 `/settings`，在 theme 字段输入主题名
- 方式二：直接编辑 `~/.pi/agent/settings.json`，添加 `"theme": "<name>"`
- **hot reload**：编辑主题文件后 pi 自动重新加载，无需重启，可以边改边看效果

建议测试要点：

- 检查不同消息类型（用户消息、工具执行框）的背景色是否协调
- 检查 Markdown 渲染（标题、代码块、引用、链接）在终端下是否可读
- 检查语法高亮的代码块是否清晰可辨
- 检查 thinking 级别切换时边框颜色递进是否自然

**完成标准**：用户确认主题已激活并能在终端中看到效果。
