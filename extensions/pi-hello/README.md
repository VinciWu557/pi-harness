# @vinciwu557/pi-hello

[![npm](https://img.shields.io/badge/npm-@vinciwu557/pi--hello-blue)](https://www.npmjs.com/package/@vinciwu557/pi-hello) [![License: MIT](https://img.shields.io/badge/license-MIT-green.svg)](./LICENSE)

示例 Pi 扩展，演示 tool + command + 事件拦截的基础结构。

## 功能

- **会话启动通知** — 加载时显示提示信息
- **危险命令拦截** — 拦截 `rm -rf`、`sudo`、写入 `/etc/` 等危险操作，需用户确认
- **greet 工具** — 向指定的人打招呼，支持中/英/日多语言
- **hello 命令** — `/hello [name]` 打个招呼
- **harness-status 命令** — `/harness-status` 查看扩展运行状态

## 安装

```bash
pi install npm:@vinciwu557/pi-hello
```

## 试用

```bash
pi -e npm:@vinciwu557/pi-hello
```

## 包结构

```
pi-hello/
├── src/
│   └── hello.ts       # 扩展入口
├── test/
│   └── hello.test.ts  # 测试
├── package.json
├── tsconfig.json
├── README.md
└── LICENSE
```

## Keywords

pi-package, pi-extension, pi, hello, example

## License

[MIT](./LICENSE)
