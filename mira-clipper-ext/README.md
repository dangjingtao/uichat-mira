# Mira Clipper

This directory contains the Vanilla JS browser collector for the Evolving Knowledge micro-app. The extension performs basic page extraction and sends captures directly to UIChat Mira; it does not start a backend or run Python/Node services.

Mira Clipper 是一个纯 Vanilla JS Chrome 扩展：浏览器内采集并做基础数据清洗，然后直接发送到 UIChat Mira 的“洞见”微应用。

扩展不启动后端、不运行 Python 或 Node 服务，也不负责数据库写入。数据入库和 AI 整理由 UIChat Mira 负责。

## 目录结构

```
.
├── DESIGN.md                   # 历史系统设计参考
├── EXTENSION_DESIGN.md         # 扩展设计
└── extension/                  # Chrome 扩展（Vanilla JS，零构建）
│   ├── manifest.json
│   ├── background.js
│   ├── content/
│   │   └── content.js
│   ├── popup/
│   │   ├── popup.html
│   │   ├── popup.css
│   │   └── popup.js
│   ├── options/
│   │   ├── options.html
│   │   ├── options.css
│   │   └── options.js
│   └── icons/
│       └── README.md
```

## 快速开始

### 加载 Chrome 扩展

Chrome → `chrome://extensions/` → 打开"开发者模式" → "加载已解压的扩展程序" → 选择本项目根目录 `mira-clipper-ext/`。

开发调试也可以选择 `extension/` 子目录；两个目录都包含有效的 Manifest，功能保持一致。

### 运行测试

```bash
npm test
npm run check
```

## 核心原则

- **浏览器内基础清洗，洞见后端统一入库**
- 扩展零构建，只有 Vanilla JS
- 扩展不启动服务，不包含后端运行时
- 只向配置的本地 UIChat Mira 地址发送数据

## 文档索引

- [系统设计](DESIGN.md) — 架构、数据模型、Text2SQL 场景
- [扩展设计](EXTENSION_DESIGN.md) — manifest、popup UI、通信协议
