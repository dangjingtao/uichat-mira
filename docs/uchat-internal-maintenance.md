# UChat 内部维护约束

Status: Current
Owner: chat
Last verified: 2026-06-25
Layer: raw-source
Module: chat
Doc Type: current-contract

## 单点真相范围

这篇文档用于约束 `uchat` 的后续维护边界，避免 UI、协议和业务逻辑重新混写回同一层。

相关文档：

- [[uchat]]
- [[architecture/provider-proxy-api]]
- [[maps/AREA_MAP_CHAT]]

## 目录边界

### `desktop/src/shared/uchat/core`

这一层只允许放：

- canonical 类型定义
- store
- runtime orchestration
- 与具体 UI、协议、接口无关的抽象

这一层禁止放：

- JSX
- `className`
- Tailwind 样式
- React 组件库依赖
- 当前项目 REST / SSE 协议细节
- 当前页面业务规则

### `desktop/src/shared/uchat/ui`

这一层只允许放：

- `uchat` 的纯展示组件
- React 绑定
- 与 canonical message / thread / composer 直接对应的 UI 组件
- 通用的 RAG 展示组件

## 维护规则

- 业务规则优先留在 integration 层
- 协议适配优先留在项目接线层
- core 不直接认识当前页面树和具体后端路由

## 相关文档

- `uchat.md`
- `chat-system-practices.md`
