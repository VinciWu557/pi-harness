# pi-harness

我的 pi 自定义插件集合。

## 安装

```bash
# 开发时（本地引用）
pi install ./path/to/pi-harness

# 从 GitHub 安装
pi install git:github.com/你的用户名/pi-harness
```

## 结构

```
pi-harness/
├── extensions/    # TypeScript 扩展（工具、命令、事件拦截）
├── skills/        # 可复用技能（/skill:name 调用）
├── prompts/       # 提示模板（/name 展开）
├── themes/        # 自定义主题
└── package.json
```

## 扩展列表

| 扩展 | 类型 | 说明 |
|------|------|------|
| `hello` | 示例 | 演示 tool + command + 事件拦截的基础结构 |

## 开发

```bash
# 测试单个扩展
pi -e ./extensions/hello/index.ts

# 安装本地包（之后每次启动自动加载）
pi install ./path/to/pi-harness

# 重新加载
/reload
```

## 技能列表

| 技能 | 说明 |
|------|------|
| `demo-skill` | 示例技能 |
