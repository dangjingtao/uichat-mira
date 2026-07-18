# 见行（MiraWebBrige）

> 当前 Native Messaging Host 的生产运行时说明
>
> - 用户不需要安装 Deno，也不需要安装 Node.js。
> - 安装包携带一个很小的 `MiraWebBridgeHost.exe` launcher，Chrome 直接启动这个 exe。
> - launcher 再启动 Mira 安装包自带的 `node.exe host.mjs`，生产用户不需要安装 Deno 或 Node.js。
> - Deno 不参与当前 Native Host 构建；构建机使用 GCC 编译 launcher。

This directory contains the Vanilla JS browser collector for the Evolving Knowledge micro-app. The extension performs basic page extraction and sends captures directly to UIChat Mira; it does not start a backend or run Python/Node services.

见行（MiraWebBrige）是一个纯 Vanilla JS Chrome 扩展：连接浏览器与 UIChat Mira，支持 Agent 浏览器操作，并保留用户主动剪藏和基础数据清洗能力。

扩展不启动后端、不运行 Python 或 Node 服务，也不负责数据库写入。浏览器操作由本地 Mira 应用协调，剪藏数据入库和 AI 整理由 UIChat Mira 负责。

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

从项目根目录启动 Electron 或 Tauri 开发环境时，根启动脚本会先准备 Native Host，再生成开发版扩展包。单独运行扩展目录的开发命令也会准备 Native Host：

```bash
pnpm --dir mira-clipper-ext dev
```

开发命令在 Native Host 已被 Chrome 占用时会复用现有 exe，不会阻塞整个开发环境启动；发布构建使用严格的 `npm run native:build`，仍会在 exe 被占用时直接报错，避免发布包带入旧 launcher。

### 加载 Chrome 扩展

Chrome → `chrome://extensions/` → 打开"开发者模式" → "加载已解压的扩展程序" → 选择本项目根目录 `mira-clipper-ext/`。

不要加载 `extension/` 子目录。它是扩展源文件目录，单独加载会生成另一个扩展 ID，Native Host 注册不会自动匹配。开发时只加载 `mira-clipper-ext/` 根目录。

### 连接方式

见行支持两种连接方式，由用户在 Mira 和扩展设置中选择：

- **Native Messaging**：主连接。扩展调用 `chrome.runtime.connectNative()`，Chrome 启动 Mira 安装的 `MiraWebBridgeHost.exe`，Host 再连接 Mira 的 WebSocket。
- **WebSocket**：开发调试连接。扩展直接连接 Mira 的本地 WebSocket，不作为生产主连接。

Native Messaging 的安装由 Mira 桌面端完成。桌面端会把 Host 和 manifest 写入用户目录，并注册 Chrome Native Messaging 注册表项。升级 Mira 后，如果 Host 版本或 manifest 发生变化，应在见行设置中执行“修复 Native”。未安装或版本不匹配时，扩展不会静默切换到另一种连接方式，而是显示明确错误。

### 连接生命周期

连接由见行扩展的 Service Worker 主动维护，不由 Mira 桌面端打开 `chrome-extension://` 页面唤醒。Mira 页面中的“连接”按钮只连接本地 WebBridge UI 通道，并显示扩展是否已经在线；它不会打开未知页面，也不能直接调用 Chrome 的扩展 API。

### 授权入口

见行扩展在首次安装、Chrome 启动或授权失效时会自动打开独立授权页；如果 Chrome 没有切到该页面，点击工具栏中的见行图标，再点击“打开独立授权页”。在页面中粘贴 Mira 生成的授权码后，授权页会从授权码解出 backend URL，换取访问令牌并保存到扩展存储，然后通知 Service Worker 连接。授权成功后回到 Mira 点击“连接”即可开始烟测。

- 扩展安装、Chrome 启动、授权码更新或连接方式变化时，Service Worker 自行建立连接。
- Native Messaging 由扩展调用 `chrome.runtime.connectNative()` 启动；Native Port 断开后，扩展使用指数退避重新连接。
- Native Host 连接后端失败或后端 WebSocket 断开时保持 Native Port，并对 backend 使用有界指数退避重连；Chrome Port 断开时 Host 才退出。
- 收到 `AUTH_REQUIRED` 后立即清理令牌并停止重连，用户在扩展授权入口重新授权。
- 用户主动剪藏仍只通过 Popup、快捷键或右键菜单触发，不属于 WebBridge 工具。

### Native Host 构建现状

开发机执行：

```bash
npm run native:build
```

该命令调用 `scripts/build-native-host.mjs`，使用 GCC 编译小型 launcher，生成：

```text
dist/native/MiraWebBridgeHost.exe
```

这一步要求构建机安装可用的 Windows C 编译器。它只影响构建机，不代表生产用户需要安装 Deno 或 Node.js。

当前 Native Host 的链路是：

```text
Chrome 扩展
  -> Native Messaging
  -> MiraWebBridgeHost.exe
  -> Mira 本地 WebSocket /webbridge
  -> UIChat Mira
```

Native Messaging 使用 stdin/stdout 传输带 4 字节长度前缀的 JSON；诊断信息只能写入 stderr，不能写入 stdout，否则会破坏 Chrome 的消息 framing。

### 生产发布边界

生产安装包应包含以下内容：

- Chrome 扩展资源
- `MiraWebBridgeHost.exe`
- Native Messaging manifest
- Mira 自带的运行时和安装/修复逻辑

生产用户不应被要求准备 Deno、Node.js、固定后端端口或手工注册表配置。后端地址和凭证由 Mira 的授权流程及运行时配置提供，Native Host 不硬编码端口。

注册时 Mira 将 manifest 写入用户目录，但 manifest 的 `path` 直接指向安装包内的 launcher；因此不需要让用户下载或复制 exe。升级 Mira 后重新点击“修复 Native”即可更新 manifest 指向新的安装包路径。

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
