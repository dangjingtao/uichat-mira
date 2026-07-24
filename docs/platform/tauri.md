# Tauri 桌面应用

Status: Current
Owner: platform
Last verified: 2026-06-25
Layer: raw-source
Module: Develoments
Feature: PlatformRuntime
Doc Type: current-contract
Canonical: true
Related:
  - tauri-setup.md
  - ../architecture/README.md
  - ../developments/release-management.md

## 单点真相范围

这页文档统一说明：

- Tauri 作为 Electron 替代桌面壳层的定位
- Tauri 打包时复用的共享构建产物
- Tauri 专属的开发与打包流程

相关概念：

- [[CONCEPT_PLATFORM]]
- [[CONCEPT_RUNTIME]]
- [[AREA_MAP_PLATFORM]]

这篇文档说明当前项目如何用 Tauri 作为 Electron 之外的另一套桌面壳层来构建应用。

Tauri 和 Electron 预期共享根目录 `.artifacts/` 下同一批 staged build inputs，主要包括前端生产包、后端 bundle、图标、runtime config、Node/npm/npx runtime 和 Terminal Dev Runtime（MinGit、uv、ripgrep）。

Tauri 的 Rust 平台值 `windows` 在 runtime 注入边界映射为 `win32`，与
Electron 的 `process.platform` 合同一致。当前产品不支持 Unix 桌面平台或
Unix 格式的工作空间根目录。

Terminal Dev Runtime 的下载、checksum、manifest 与复制校验由共享脚本负责。Tauri 不维护另一套 downloader 或 PATH 逻辑；生产态只把 resources 根目录传给 Backend。详见 `../build/terminal-dev-runtime.md`。

## 当前定位

- Electron 仍是主要桌面壳层
- Tauri 是并行维护的替代壳层
- 两者应尽量共享前端与 backend 构建输入

## 适合什么时候读

- 改 Tauri 开发流程
- 改 Tauri 打包流程
- 评审 Electron / Tauri 共享边界

## 相关文档

- `tauri-setup.md`
- `../architecture/README.md`
- `../developments/release-management.md`
