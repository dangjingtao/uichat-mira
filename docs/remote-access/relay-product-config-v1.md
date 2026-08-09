# Mira Relay Product Config V1

Status: Current
Related: `relay-transport-v1.md`

## 用户入口

Remote Relay 的产品入口统一位于：

```text
设置 -> 远程连接
```

界面保持最小：

```text
Mira Relay                         [开关]
○ 默认服务
○ 自定义地址
  [ https://relay.example.com ]

Tailscale                          [开关]

已配对设备
```

只有选择“自定义地址”时显示输入框。

## 用户可见配置

用户只配置：

- 是否启用 Mira Relay。
- 使用默认服务还是自定义 Relay 地址。
- 自定义地址本身。

用户不配置也不应看到：

- Cloudflare Worker / Durable Object。
- Relay ID。
- Host token。
- Client token。
- WSS path。

## 默认服务

默认 Relay endpoint 由 Mira 构建 / 部署配置提供。

当前配置入口：

```text
UI_CHAT_REMOTE_RELAY_DEFAULT_URL
```

也可由 `runtime.config.cjs` 的 `remoteRelay.defaultUrl` 提供。

仓库不硬编码一个尚未真实部署的官方域名。若当前构建没有默认 endpoint，则“默认服务”不能被成功启用，用户仍可使用自定义 Relay 地址。

## 自定义 Relay 地址

V1 接受根级 HTTPS base URL，例如：

```text
https://relay.tomz.io
https://example-account.workers.dev
```

不接受：

- HTTP。
- URL 内嵌用户名 / 密码。
- query / fragment。
- 路径前缀。

Desktop 内部把 HTTPS base URL 转换为 WSS，并追加 Mira Relay protocol path。

## Identity

首次读取 Relay 配置时 Desktop 自动生成：

```text
relayId
hostToken
clientToken
```

Relay ID 与 token 不由用户填写。

Host / Client token 加密存储在 Desktop SQLite；UI API 只返回产品配置，不返回 token。

## 配对兼容

现有 Mobile V1 pairing URI 继续保留：

```text
host
challenge
code
version=1
```

当 Relay 已启用且 endpoint 可用时，Desktop 只追加：

```text
relay=<https relay endpoint>
relayId=<relay id>
```

当前 Mobile V1 parser 只读取既有四个字段，因此会忽略新增参数，不破坏当前 Tailscale 配对。

Relay-only pairing、Client Relay credential 下发和 Mobile RelayTransport 属于后续 Mobile 接入任务，不在本配置任务中伪装为已完成。
