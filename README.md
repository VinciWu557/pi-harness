# 🧩 Pi Harness — 自定义 Pi 扩展集合

[![npm scope](https://img.shields.io/badge/npm-@vinciwu557-blue)](https://www.npmjs.com/org/vinciwu557) [![License: MIT](https://img.shields.io/badge/license-MIT-green.svg)](./LICENSE)

独立安装的 [Pi](https://pi.dev) Coding Agent 扩展、技能、提示词和主题包集合。每个包独立发布到 npm `@vinciwu557` scope，按需安装。

## 📦 包列表

### Extensions

| 包                                              | 功能                                              | 安装                                  |
| ----------------------------------------------- | ------------------------------------------------- | ------------------------------------- |
| [`@vinciwu557/pi-hello`](./extensions/pi-hello) | 👋 示例扩展：greet 工具、hello 命令、危险命令拦截 | `pi install npm:@vinciwu557/pi-hello` |

### Skills

| 包                                              | 功能                                  | 安装                                    |
| ----------------------------------------------- | ------------------------------------- | --------------------------------------- |
| [`@vinciwu557/skill-demo`](./skills/skill-demo) | 📝 示例技能：展示 pi skill 的基本结构 | `pi install npm:@vinciwu557/skill-demo` |

## 🚀 快速开始

从 npm 安装单个包：

```bash
pi install npm:@vinciwu557/pi-hello
```

试用而不永久安装：

```bash
pi -e npm:@vinciwu557/pi-hello
```

本地开发试用：

```bash
pi -e ./extensions/pi-hello
pi -e ./skills/skill-demo
```

多个扩展组合使用：

```bash
pi -e npm:@vinciwu557/pi-hello -e npm:@vinciwu557/skill-demo
```

## 📂 仓库结构

```
pi-harness/
├── extensions/          # TypeScript 扩展包（工具、命令、事件拦截）
│   └── pi-hello/        # @vinciwu557/pi-hello
├── skills/              # 技能包（/skill:name 调用）
│   └── skill-demo/      # @vinciwu557/skill-demo
├── prompts/             # 提示模板包（未来扩展）
├── themes/              # 自定义主题包（未来扩展）
├── scripts/             # 构建和发布脚本
├── test/                # 共享测试工具
├── .github/workflows/   # CI/CD 工作流
├── package.json         # 根 workspace 管理器
├── eslint.config.mjs    # ESLint 配置
├── .prettierrc          # Prettier 配置
├── vitest.config.ts     # Vitest 测试配置
├── tsconfig.json        # TypeScript 配置
└── AGENTS.md            # 开发指南
```

## 🛠️ 开发

```bash
# 安装依赖（建立 workspace 链接）
npm install

# 全量检查（ESLint + Prettier + 边界 + 类型 + 测试）
npm run check

# 单独运行
npm run lint               # ESLint
npm run format             # Prettier 格式化
npm run check:boundaries   # 包边界检查
npm run typecheck          # TypeScript 类型检查
npm test                   # Vitest 测试

# 预览包内容
npm --workspace @vinciwu557/pi-hello pack --dry-run
npm --workspace @vinciwu557/skill-demo pack --dry-run
```

### 添加新扩展

1. 在 `extensions/` 下创建 `pi-<name>/` 目录
2. 创建 `package.json`（参考 `extensions/pi-hello/package.json`）
3. 创建 `tsconfig.json`、`src/<name>.ts`、`test/<name>.test.ts`
4. 运行 `npm install` 建立 workspace 链接
5. 运行 `npm run check` 验证

### 添加新技能

1. 在 `skills/` 下创建 `skill-<name>/` 目录
2. 创建 `package.json`（参考 `skills/skill-demo/package.json`）
3. 创建 `SKILL.md`
4. 运行 `npm install` 建立 workspace 链接

## 📝 版本管理

所有包共享同一个版本号。使用 GitHub Actions 或本地脚本统一 bump：

```bash
# 本地 bump（不创建 tag）
node scripts/bump-shared-version.mjs patch

# 通过 GitHub Actions bump（创建 commit + tag）
# 在 GitHub 仓库页面手动触发 Bump version workflow
```

## 📄 License

[MIT](./LICENSE)
