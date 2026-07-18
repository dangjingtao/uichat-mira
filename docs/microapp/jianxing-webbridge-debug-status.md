# 见行 WebBridge 调试状态

Status: Current debugging record
Owner: browser-extension / runtime
Last verified: 2026-07-18
Layer: raw-source
Module: JianXing / MiraWebBrige
Doc Type: debugging-status
Canonical: true

## 这页记录什么

这页记录见行（MiraWebBrige）当前在本地调试环境中的真实状态，供继续排查和评审使用。

这不是最终设计，也不是“已完成”说明。文档把已经观察到的事实、当前仍然不稳定的行为、未完成的能力和后续验证条件分开记录。

## 结论摘要

当前不能把浏览器连接称为完成：

- WebSocket 曾经完成过真实握手，但连接稳定性仍未达到验收标准。
- Native Messaging 的 Host framing、backend 鉴权失败路径和 launcher stdio 转发已经有可重复的本地 smoke 验证，但真实 Chrome `connectNative()` 用户流程仍未完成验收。
- 应用页面自身可以连接 `/webbridge`，但这不等于扩展已经连接。
- 扩展授权成功只代表授权码换取 token 成功，不代表扩展已经完成 WebSocket 或 Native Messaging 握手。
- 当前本地开发加载应使用 `mira-clipper-ext/` 根目录；`extension/` 子目录也有一份 manifest，但它会产生不同的扩展 ID，不能直接视为同一个运行实例。

## 连接拓扑

### WebSocket

```text
见行扩展 Service Worker
  └─ WebSocket /webbridge
       └─ Mira Fastify backend
            └─ 应用页面 WebBridgeClient
```

扩展和应用页面是两个独立的 WebSocket 客户端。扩展先发送 `hello`，后端返回 `hello_ack`；应用页面也需要独立发送自己的 `hello`。应用页面显示 `connected`，只能说明应用页面这一侧的 socket 已建立，仍需查看 `extensionConnected` 才能确认扩展在线。

### Native Messaging

```text
见行扩展 Service Worker
  └─ chrome.runtime.connectNative()
       └─ MiraWebBridgeHost.exe
            └─ host.mjs
                 └─ WebSocket /webbridge
                      └─ Mira Fastify backend
```

Native Messaging 的 stdio 消息使用 Chrome 规定的 framing：4 字节消息长度，后接 UTF-8 JSON。Native Host 到 backend 的通信仍然使用 `/webbridge` WebSocket。

Host 的当前状态边界：

- backend 暂时不可用时，Host 保持 Native Port，并使用有界指数退避重连 backend。
- backend 返回 `AUTH_REQUIRED` 时，Host 转发原始错误和一次 `auth_required` 状态，停止 backend 重连；扩展负责清理 token 并打开授权页。
- backend URL 无效时，Host 返回 framing 完整的错误状态，不进入重连循环。
- Chrome stdin 结束时，Host 才结束进程；Host 不通过 stdout 输出诊断日志。

## 当前配置来源

- backend host / port 的运行时来源是 `runtime.config.cjs`。
- 扩展不应在代码中固定 backend 端口。
- 授权码包含后端端口；扩展通过授权码解出 backend URL，再请求 `/oauth/token`。
- token 保存在扩展的 `chrome.storage.local`。
- backend URL 和连接方式保存在扩展的 `chrome.storage.sync`。
- 当前协议版本是 `1`。

## 已验证事实

### 应用端

- 本地 backend health 可访问。
- 应用页面可以连接 backend 的 `/webbridge`。
- 应用页面在扩展未上线时显示“等待扩展”，这是当前预期的可见状态。

### 扩展目录

当前仓库存在两种可被 Chrome 识别的加载目录：

| 加载目录 | Service Worker 路径 | 当前观察到的扩展 ID | 当前用途 |
| --- | --- | --- | --- |
| `mira-clipper-ext/` | `extension/background.js` | `gmgdbphkmkdedfabchklghghdcpjepoc` | 当前本地开发加载目录 |
| `mira-clipper-ext/extension/` | `background.js` | `nmokeaddhccicikbkemfpgkodojchhdb` | 备用目录形态，必须单独管理 ID 和 Native 注册 |

这两个目录不是同一个 Chrome 扩展实例。Chrome 会根据 manifest 和目录内容分别加载它们。

### WebSocket

- 已在隔离 Chrome 配置中加载仓库根目录扩展。
- 使用本地有效登录 token 和授权后的 backend URL 写入扩展存储后，曾观察到扩展 Service Worker 的 WebSocket 状态为 `ready: true`。
- 该结果证明 WebSocket 协议链路在特定运行条件下可以完成握手。
- 该结果不证明连接可以长期保持，也不证明真实用户当前环境不会进入“等待扩展”。

### Native Messaging

- 直接运行 `host.mjs` 并发送合法 Native Messaging hello 后，曾收到 backend 返回的 `hello_ack`。
- 通过 `MiraWebBridgeHost.exe` 启动时，曾出现没有收到 Native 返回帧的情况。
- 这两条观察结果仅用于缩小后续验证范围，不能单独作为 Native 根因结论。
- 当前 Native 仍未完成真实 Chrome 用户流程验收。

### 自动化检查

最近一次扩展侧检查结果：

- `npm run check`：通过。
- 扩展和 Native Host 契约测试：38 项通过。
- Popup / content script E2E：7/7 通过。
- 使用本地 backend 的无效 token smoke：收到 `AUTH_REQUIRED` response 和一次 `auth_required` 状态，未观察到重复鉴权通知。
- 使用临时编译 launcher 的 framing smoke：`MiraWebBridgeHost.exe -> host.mjs` 能转发错误状态帧。
- 这些测试覆盖脚本语法、manifest、Popup、content script 和部分协议契约。
- 这些测试不等价于真实 Chrome 中的长期 WebSocket 稳定性，也不等价于 Native Messaging 安装、注册、启动和升级验收。

## 当前问题

### WebSocket 稳定性未达标

现象：

- 扩展有时可以完成握手，有时在应用页面显示“等待扩展”。
- 页面刷新、授权变化、切换连接方式、Service Worker 重新加载后，连接状态需要继续观察。
- 应用页面 socket 已连接时，扩展 socket 仍可能没有上线。

待满足的稳定性标准：

- 授权成功后一次完成连接，不依赖用户重复点击。
- 同一用户只保留一个有效扩展连接。
- WebSocket 断开后能重连，但不能产生连接风暴或重复 backend client。
- Service Worker 被 Chrome 暂停和恢复后能重新建立连接。
- 页面刷新、标签页切换和应用页面刷新不影响扩展主连接。
- token 过期时明确进入授权状态，不持续重连失效 token。
- 应用页面能持续收到 `extension_connected` / `extension_disconnected` 状态。

### Native Messaging 仍未完成真实验收

当前尚未完成以下闭环：

- Chrome 扩展调用 `connectNative()` 的真实用户流程。
- Chrome 启动安装目录中的 Native Host，并完成真实 `hello_ack` 验收。
- Native Host 正确继承 Chrome 的 stdin/stdout/stderr，并在真实 Chrome 流程下完成验证。
- Native Port 断开后 Host 退出且不会遗留旧进程的真实 Chrome 验收。
- Mira 升级后 Native manifest、launcher、host script 和扩展 ID 仍然匹配。
- 开发解压扩展、dev CRX、prod CRX 的 Native 注册边界清晰且可重复验证。

## 参考信息，不是已确认原因

下面的信息来自当前代码、真实运行观察和 Chrome 官方文档，只作为下一轮验证的参考，不在本页把它们写成已经确认的根因：

1. Chrome 官方 Native Messaging 文档要求 Windows Native Host 使用标准输入输出传输二进制 framing，并特别提醒文本模式可能破坏消息格式。
2. 当前 launcher 使用 C `CreateProcess` 启动 `host.mjs`，需要继续验证子进程标准句柄的继承方式。
3. 当前 Native manifest 的 `allowed_origins` 是固定扩展 ID；解压目录和不同签名 CRX 的扩展 ID 需要继续统一验证。
4. Chrome MV3 Service Worker 存在暂停和恢复生命周期，连接状态机需要在真实 Chrome 长时间运行中验证。
5. Native Host 由 `connectNative()` 启动并由 Port 生命周期管理，Host 退出、断开和重复启动需要增加进程级观测。

官方参考：[Chrome 原生消息传递](https://developer.chrome.com/docs/extensions/develop/concepts/native-messaging)。

## 推荐验证顺序

按下面顺序验证，避免把两套传输机制的结果混在一起：

1. 只加载 `D:\uichat-mira\mira-clipper-ext` 根目录扩展。
2. 只选择 WebSocket，完成授权后记录扩展 Popup、Service Worker 和 Mira 页面三处状态。
3. 保持同一个授权 token，验证应用页面刷新、扩展重新加载、Chrome 放置一段时间后的重连行为。
4. 清理旧 Native Host 进程后，再单独选择 Native Messaging。
5. 查看 Chrome 扩展错误、Native Host 进程树、Native manifest 的 `allowed_origins` 和 backend WebSocket client 数量。
6. 最后分别验证 dev CRX、prod CRX 和解压扩展，不把其中一种 ID 的结果套用到另一种。

## Native 完成验收条件

Native 只有同时满足以下条件，才能标记为完成：

- Chrome `connectNative()` 能稳定收到 Native Host 返回的 `hello_ack`。
- backend 能看到一条对应扩展 client，且没有重复 client 持续增长。
- 切换 Native / WebSocket 后旧通道会关闭，新的通道只建立一次。
- Native Host 断开时进程可以退出，不遗留旧 launcher 或 Node 子进程。
- 授权过期后进入可见授权状态，重新授权后能恢复连接。
- Mira 升级后点击“修复 Native”即可更新 Host 注册，不需要用户手工编辑注册表。
- 解压开发目录和发布 CRX 的 ID / Native 注册规则已经写入构建和安装检查。

## 相关代码

- `mira-clipper-ext/manifest.json`
- `mira-clipper-ext/extension/manifest.json`
- `mira-clipper-ext/extension/background.js`
- `mira-clipper-ext/extension/auth/authorize.js`
- `mira-clipper-ext/native-host/host.mjs`
- `mira-clipper-ext/native-host/launcher.c`
- `server/src/routes/webbridge.ts`
- `desktop/src/shared/api/webbridge.ts`
- `electron/main.cjs`
- `tauri/src/main.rs`
