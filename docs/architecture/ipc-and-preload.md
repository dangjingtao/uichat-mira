# IPC 与 Preload 指南

Status: Current
Owner: runtime
Last verified: 2026-06-25
Layer: raw-source
Module: Develoments
Feature: NativeBridge
Doc Type: current-contract
Canonical: true
Related:
  - README.md
  - ../platform/tauri.md

## 单点真相范围

这页文档统一说明：

- renderer 与 native capability 的边界
- preload 当前暴露的最小契约
- 什么情况下该用 IPC，什么情况下该直接走 backend HTTP

相关概念：

- [[CONCEPT_RUNTIME]]
- [[CONCEPT_PLATFORM]]
- [[AREA_MAP_RUNTIME]]

## 基本原则

renderer 代码是不受信任的。native 能力和 runtime 配置应通过 preload 暴露，而不是直接在 renderer 开 Node API。

当前项目使用 HTTP 访问 backend API。IPC 只保留给桌面 / native 能力，以及少量 runtime 信息暴露。

renderer 应通过单一适配层读取 host / runtime 细节，而不是在业务代码里直接分支判断 `window.desktopApi`、Tauri 全局变量或 `file:` URL。

## 当前 preload 契约

当前 Electron preload 暴露的核心 runtime 信息包括：

- `platform`
- `isPackaged`
- `backendUrl`

这类信息用于让 renderer 判断当前运行上下文，但不应把更多业务逻辑堆回 preload。

## 什么时候该走 HTTP

这些场景优先走 backend HTTP：

- 业务 API
- 健康检查
- 模型配置
- 线程、消息、知识库、评测等产品能力

一句话说：只要本质上是 backend route，就不该包装成 IPC。

## 什么时候该走 IPC / preload

这些场景才适合走 IPC 或 preload：

- 原生窗口能力
- 本地文件 / shell / 桌面集成
- runtime 环境信息暴露
- 不适合直接暴露给 renderer 的 native capability

## 当前禁止事项

- renderer 直接访问 Node API
- 在业务组件里散落读取 `window.desktopApi`
- 用 IPC 包一层普通 HTTP 路由
- 把 host / port 常量写死在前端代码里

## 相关文档

- `README.md`
- `api-response-spec.md`
- `model-config-api.md`
