# pi-harness Monorepo 改造计划

## Context

当前 `pi-harness` 仓库是一个单包结构，所有扩展、技能打包在一起，用户必须一次性安装全部内容。随着插件、功能、提示词增多，用户需要按需安装。

参考 [narumiruna/pi-extensions](https://github.com/narumiruna/pi-extensions) 的 monorepo 模式，将仓库改造为 npm workspaces 多包结构，让用户可以通过 `pi install npm:@vinciwu557/pi-hello` 按需安装单个 package。

### 当前状态

- 单 `package.json`，包含 `extensions/hello/`、`skills/demo-skill/`
- 无构建系统、无测试、无 linting、无 CI/CD
- GitHub: VinciWu557/pi-harness

### 用户决策

- **npm scope**: `@vinciwu557`
- **skills/prompts/themes**: 各自作为独立 npm 包发布
- **工程功能**: ESLint + Prettier + TS 类型检查、Vitest 测试框架、CI/CD、边界检查脚本
- **hello/demo-skill**: 保留为示例包

## Approach

将 pi-harness 改造为 npm workspaces monorepo，参照 pi-extensions 的成熟模式：

### 目标目录结构

```
pi-harness/
├── package.json                    # 根 workspace 管理器（private, 不发布）
├── package-lock.json
├── eslint.config.mjs               # ESLint flat config（格式化 + lint）
├── .prettierrc                     # Prettier 格式化配置
├── .prettierignore                 # Prettier 忽略文件
├── vitest.config.ts                # Vitest 测试配置
├── tsconfig.json                   # 根 TypeScript 配置
├── .gitignore
├── .pre-commit-config.yaml         # pre-commit hooks（可选）
├── README.md                       # 更新的 README
├── LICENSE                         # MIT
├── AGENTS.md                       # 仓库开发指南
├── scripts/
│   ├── check-extension-boundaries.mjs  # 包边界检查
│   └── bump-shared-version.mjs     # 统一版本号 bump
├── test/
│   └── support.ts                  # 共享测试 mock 工具
├── .github/
│   └── workflows/
│       ├── ci.yml                  # CI: lint + typecheck + test
│       ├── bump-version.yml        # 版本号 bump + tag
│       ├── publish.yml             # npm 发布
│       └── release.yml             # GitHub Release
├── extensions/
│   └── pi-hello/                   # @vinciwu557/pi-hello
│       ├── package.json
│       ├── tsconfig.json
│       ├── README.md
│       ├── LICENSE
│       ├── src/
│       │   └── hello.ts
│       └── test/
│           └── hello.test.ts
├── skills/
│   └── skill-demo/                 # @vinciwu557/skill-demo
│       ├── package.json
│       ├── SKILL.md
│       ├── README.md
│       └── LICENSE
├── prompts/                        # 未来扩展（暂为空）
└── themes/                         # 未来扩展（暂为空）
```

### 包命名约定

| 资源类型  | 包名格式               | 示例                        |
| --------- | ---------------------- | --------------------------- |
| Extension | `@vinciwu557/pi-*`     | `@vinciwu557/pi-hello`      |
| Skill     | `@vinciwu557/skill-*`  | `@vinciwu557/skill-demo`    |
| Prompt    | `@vinciwu557/prompt-*` | `@vinciwu557/prompt-coding` |
| Theme     | `@vinciwu557/theme-*`  | `@vinciwu557/theme-dark`    |

## Files to modify

### 新建文件

| 文件                                     | 说明                                             |
| ---------------------------------------- | ------------------------------------------------ |
| `eslint.config.mjs`                      | ESLint flat config：TypeScript + 推荐规则        |
| `.prettierrc`                            | Prettier 配置：tab 缩进、100 列、双引号、分号    |
| `.prettierignore`                        | Prettier 忽略文件                                |
| `vitest.config.ts`                       | Vitest 测试配置：扫描 `extensions/*/test/`       |
| `tsconfig.json`                          | 根 TS 配置：ES2022、NodeNext、strict、noEmit     |
| `scripts/check-extension-boundaries.mjs` | 边界检查：包之间无交叉依赖                       |
| `scripts/bump-shared-version.mjs`        | 统一版本号管理                                   |
| `test/support.ts`                        | 共享测试 mock（createMockPi, createMockContext） |
| `AGENTS.md`                              | 仓库开发指南                                     |
| `LICENSE`                                | MIT 许可证                                       |
| `.github/workflows/ci.yml`               | CI 工作流                                        |
| `.github/workflows/bump-version.yml`     | 版本 bump 工作流                                 |
| `.github/workflows/publish.yml`          | npm 发布工作流                                   |
| `.github/workflows/release.yml`          | GitHub Release 工作流                            |
| `extensions/pi-hello/package.json`       | hello 扩展包配置                                 |
| `extensions/pi-hello/tsconfig.json`      | hello 扩展 TS 配置                               |
| `extensions/pi-hello/README.md`          | hello 扩展文档                                   |
| `extensions/pi-hello/LICENSE`            | MIT                                              |
| `extensions/pi-hello/test/hello.test.ts` | hello 扩展测试                                   |
| `skills/skill-demo/package.json`         | demo 技能包配置                                  |
| `skills/skill-demo/README.md`            | demo 技能文档                                    |
| `skills/skill-demo/LICENSE`              | MIT                                              |

### 修改文件

| 文件                                                             | 改动                                                                  |
| ---------------------------------------------------------------- | --------------------------------------------------------------------- |
| `package.json`                                                   | 改为 workspace 管理器，private: true，添加 scripts 和 devDependencies |
| `extensions/hello/index.ts` → `extensions/pi-hello/src/hello.ts` | 移动并重命名                                                          |
| `skills/demo-skill/SKILL.md` → `skills/skill-demo/SKILL.md`      | 移动                                                                  |
| `README.md`                                                      | 更新为 monorepo 文档                                                  |
| `.gitignore`                                                     | 扩充为完整的 gitignore                                                |

### 删除文件

| 文件                         | 原因                                    |
| ---------------------------- | --------------------------------------- |
| `extensions/hello/index.ts`  | 移至 `extensions/pi-hello/src/hello.ts` |
| `skills/demo-skill/SKILL.md` | 移至 `skills/skill-demo/SKILL.md`       |

## Reuse

参考仓库的可复用模式（路径均在 `/tmp/pi-github-repos/narumiruna/pi-extensions/`）：

| 复用内容                                 | 来源路径                                 | 改动                                                |
| ---------------------------------------- | ---------------------------------------- | --------------------------------------------------- |
| `tsconfig.json`                          | `tsconfig.json`                          | 直接复用                                            |
| `scripts/check-extension-boundaries.mjs` | `scripts/check-extension-boundaries.mjs` | scope 改为 `@vinciwu557/`，扫描 extensions + skills |
| `scripts/bump-shared-version.mjs`        | `scripts/bump-shared-version.mjs`        | 支持 `extensions/*` 和 `skills/*` 两个 workspace    |
| `test/support.ts`                        | `test/support.ts`                        | 直接复用 mock 模式（与测试框架无关）                |
| `.github/workflows/ci.yml`               | 同路径                                   | 直接复用                                            |
| `.github/workflows/bump-version.yml`     | 同路径                                   | git add 路径增加 `skills/*/package.json`            |
| `.github/workflows/publish.yml`          | 同路径                                   | 扫描 extensions + skills 目录                       |
| `.github/workflows/release.yml`          | 同路径                                   | 直接复用                                            |
| 单个 extension `package.json` 模式       | `extensions/pi-btw/package.json`         | 改 scope 和版本                                     |
| 单个 extension `tsconfig.json`           | `extensions/pi-btw/tsconfig.json`        | 直接复用                                            |
| `AGENTS.md`                              | `AGENTS.md`                              | 改为 pi-harness 的指南                              |

**不复用 Biome 和自定义测试运行器**：

- Biome → 替换为 ESLint 9 flat config + Prettier（用户偏好）
- `scripts/run-tests.mjs` + `tsconfig.test.json` → 替换为 Vitest（原生支持 TS，无需预编译）
- 测试文件从 `import test from "node:test"` + `import assert from "node:assert/strict"` 改为 `import { test, expect } from "vitest"`

## Steps

### 第一阶段：根配置搭建

- [ ] **Step 1**: 创建 `eslint.config.mjs`（ESLint 9 flat config，typescript-eslint 推荐规则）
- [ ] **Step 2**: 创建 `.prettierrc`（tab 缩进、100 列、双引号、分号）和 `.prettierignore`
- [ ] **Step 3**: 创建 `vitest.config.ts`（扫描 `extensions/*/test/`，使用 workspace 模式）
- [ ] **Step 4**: 创建 `tsconfig.json`（ES2022、NodeNext、strict、noEmit）
- [ ] **Step 5**: 改造根 `package.json` 为 workspace 管理器
    - `private: true`
    - `workspaces: ["extensions/*", "skills/*"]`（prompts/themes 暂不加入，待有内容后再加）
    - scripts: `format`, `lint`, `check:boundaries`, `typecheck`, `test`, `check`
    - devDependencies: `eslint`, `@eslint/js`, `typescript-eslint`, `prettier`, `vitest`, `@earendil-works/pi-coding-agent`, `@types/node`, `typebox`, `typescript`
- [ ] **Step 6**: 更新 `.gitignore`（扩充为完整版，**不含 `src/`** 避免误忽略扩展源码）
- [ ] **Step 7**: 创建 `scripts/check-extension-boundaries.mjs`（scope 改为 `@vinciwu557/`，扫描 extensions + skills）
- [ ] **Step 8**: 创建 `scripts/bump-shared-version.mjs`（支持多 workspace 目录）
- [ ] **Step 9**: 创建 `test/support.ts`（createMockPi, createMockContext 等 mock 工具，与测试框架无关）

### 第三阶段：扩展包改造

- [ ] **Step 10**: 将 `extensions/hello/index.ts` 移至 `extensions/pi-hello/src/hello.ts`
- [ ] **Step 11**: 创建 `extensions/pi-hello/package.json`（`@vinciwu557/pi-hello`，pi.extensions 指向 `./src/hello.ts`）
- [ ] **Step 12**: 创建 `extensions/pi-hello/tsconfig.json`
- [ ] **Step 13**: 创建 `extensions/pi-hello/README.md`
- [ ] **Step 14**: 创建 `extensions/pi-hello/LICENSE`
- [ ] **Step 15**: 创建 `extensions/pi-hello/test/hello.test.ts`（测试 greet 工具和 hello 命令）
- [ ] **Step 16**: 删除旧的 `extensions/hello/` 目录

### 第四阶段：技能包改造

- [ ] **Step 17**: 将 `skills/demo-skill/SKILL.md` 移至 `skills/skill-demo/SKILL.md`
- [ ] **Step 18**: 创建 `skills/skill-demo/package.json`（`@vinciwu557/skill-demo`，pi.skills 指向 `./SKILL.md`）
- [ ] **Step 19**: 创建 `skills/skill-demo/README.md`
- [ ] **Step 20**: 创建 `skills/skill-demo/LICENSE`
- [ ] **Step 21**: 删除旧的 `skills/demo-skill/` 目录

### 第五阶段：CI/CD 和文档

- [ ] **Step 22**: 创建 `.github/workflows/ci.yml`（push/PR 时运行 `npm run check`）
- [ ] **Step 23**: 创建 `.github/workflows/bump-version.yml`（手动触发，bump 版本 + tag）
- [ ] **Step 24**: 创建 `.github/workflows/publish.yml`（tag 触发，发布未发布的包到 npm）
- [ ] **Step 25**: 创建 `.github/workflows/release.yml`（tag 触发，创建 GitHub Release）
- [ ] **Step 26**: 更新 `README.md`（monorepo 文档，包列表表格，安装说明）
- [ ] **Step 27**: 创建 `LICENSE`（MIT）
- [ ] **Step 28**: 创建 `AGENTS.md`（仓库开发指南）
- [ ] **Step 29**: 创建 `.pre-commit-config.yaml`（可选：eslint + prettier + typecheck hooks）

### 第六阶段：验证

- [ ] **Step 30**: `npm install`（安装依赖，建立 workspace 链接）
- [ ] **Step 31**: `npm run check`（运行 ESLint + Prettier + 边界检查 + 类型检查 + 测试）
- [ ] **Step 32**: `npm run typecheck`（验证所有 workspace 包类型正确）
- [ ] **Step 33**: `npm test`（验证测试通过）
- [ ] **Step 34**: `npm --workspace @vinciwu557/pi-hello pack --dry-run`（验证包内容正确）
- [ ] **Step 35**: `npm --workspace @vinciwu557/skill-demo pack --dry-run`（验证技能包内容正确）
- [ ] **Step 36**: `pi -e ./extensions/pi-hello`（本地试用扩展）

## Verification

```bash
# 1. 安装依赖
npm install

# 2. 全量检查（ESLint + Prettier + 边界 + 类型 + 测试）
npm run check

# 3. 单独运行各检查
npm run lint               # ESLint 检查
npm run format             # Prettier 格式化
npm run check:boundaries   # 包边界
npm run typecheck          # TypeScript 类型检查
npm test                   # 运行 Vitest 测试

# 4. 验证包内容
npm --workspace @vinciwu557/pi-hello pack --dry-run
npm --workspace @vinciwu557/skill-demo pack --dry-run

# 5. 本地试用
pi -e ./extensions/pi-hello
pi -e ./skills/skill-demo

# 6. 模拟安装（发布后）
pi install npm:@vinciwu557/pi-hello
pi install npm:@vinciwu557/skill-demo
```

## 注意事项

1. **`.gitignore` 不含 `src/`**：参考仓库的 `.gitignore` 包含 `src/`，导致扩展源码被忽略需要 `git add -f`。我们不会包含此规则。
2. **npm scope 小写**：npm scope 必须小写，使用 `@vinciwu557`（即使用户名是 VinciWu557）。
3. **workspace 渐进式添加**：`prompts/` 和 `themes/` 目录暂不加入 workspace，待有实际内容后再添加到 `workspaces` 数组。
4. **版本统一管理**：所有包共享同一个版本号，通过 `scripts/bump-shared-version.mjs` 统一 bump。
5. **边界检查覆盖所有包类型**：边界检查脚本同时扫描 `extensions/` 和 `skills/`，确保包之间无交叉依赖。
6. **publish.yml 需适配多目录**：发布脚本需扫描 `extensions/` 和 `skills/` 两个目录下的包。
