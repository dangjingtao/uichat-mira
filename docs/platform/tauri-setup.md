# Tauri 安装、构建与排障

Status: Current
Owner: platform
Last verified: 2026-06-26
Layer: raw-source
Module: Develoments
Feature: PlatformRuntime
Doc Type: how-to

## 单点真相范围

这页文档统一说明：

- Tauri 开发前需要准备什么
- 当前项目如何启动 Tauri 开发流程
- 打包前后常见问题怎么排查

相关文档：

- [[platform/tauri]]
- [[developments/release-management]]
- [[AREA_MAP_PLATFORM]]

## 适合什么时候读

这些场景建议先读这页：

- 第一次在本机跑 Tauri
- Tauri 构建失败
- 想确认 Tauri 依赖是否装齐
- 想排查 Rust / Cargo / Tauri CLI 相关问题

## 准备步骤

### 1. 安装 Rust

Windows：

- 从 `https://rustup.rs/` 安装
- 或使用 `winget install Rustlang.Rustup`

macOS / Linux：

```bash
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
source $HOME/.cargo/env
```

### 2. 安装 Tauri CLI

```bash
pnpm add -Dw @tauri-apps/cli@latest
```

### 3. 安装工作区依赖

```bash
pnpm install
```

## 当前开发命令

从仓库根目录启动：

```bash
pnpm dev:tauri:win
```

当前项目的 Tauri 开发链不是只起一个前端页面，而是要和现有桌面开发流程、共享构建输入一起看。

## 当前打包命令

```bash
pnpm package:tauri:win
```

## 常见排查项

### Rust / Cargo 不可用

先确认：

```bash
rustc --version
cargo --version
```

### Tauri CLI 不可用

先确认：

```bash
pnpm tauri --version
```

### 构建输入不完整

如果 Tauri 起不来，不要只盯 Rust 侧。还要一起检查：

- 前端生产构建是否存在
- backend bundle 是否已准备
- `.artifacts/` 下共享输入是否齐全

### 版本不一致

打包前如果怀疑版本没同步，先看：

- `package.json`
- `tauri/tauri.conf.json`
- `tauri/Cargo.toml`

必要时执行：

```bash
pnpm version:sync
```

## 相关文档

- `tauri.md`
- `../architecture/README.md`
- `../developments/release-management.md`
