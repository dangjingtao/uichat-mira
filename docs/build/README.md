# Build

Status: Current
Owner: build
Last verified: 2026-06-28
Layer: raw-source
Module: Build
Feature: Packaging
Doc Type: current-contract
Canonical: true
Related:
  - ../../README.md
  - local-model-packaging.md
  - ../developments/release-management.md
  - ../platform/tauri.md
  - ../../scripts/build-dist.js
  - ../../scripts/prepare-desktop-artifacts.js
  - ../../scripts/build-tauri-dist.js
  - ../../scripts/prepare-tauri-assets.js

## 单点真相范围

这页是 Build 模块当前的主入口。

它统一说明：

- Electron / Tauri release 打包命令
- `.artifacts/` 中间产物如何生成
- 测试报告如何进入 release 包
- release 输出目录和保留策略
- 本地模型包和 WASM runtime 资源入包规则
- 当前平台兼容边界
- 后续改造方向

以后涉及构建、打包、release 产物、测试报告入包、平台构建兼容性的设计和结论，优先记录在 `docs/build/` 下。

## 当前命令

Electron Windows release：

```bash
pnpm package:electron:win
```

Tauri Windows release：

```bash
pnpm package:tauri:win
```

清理临时构建产物：

```bash
pnpm clean:artifacts
```

同步版本号：

```bash
pnpm version:sync
```

## 本地模型资源

本地 embedding / rerank 模型包、`onnxruntime-web` WASM runtime、Electron / Tauri resources 复制、首启解压和 checksum 校验规则，见：

- `local-model-packaging.md`

## Release 构建原则

Release 构建必须强制执行测试并携带本次构建对应的测试结果摘要。

这条规则的含义：

- release 包里的测试结果不能依赖旧的 `coverage/` 目录。
- client 和 server 测试结果摘要都应来自本次 release 构建。
- 构建脚本应在摘要缺失时失败，而不是静默跳过。
- 开发态可以复用或跳过报告生成，release 态不允许跳过。

当前实现还没有完全达到这条规则：

- `scripts/prepare-desktop-artifacts.js` 调用 `scripts/generate-test-report.js`，强制生成 client/server coverage。
- `scripts/generate-test-report.js` 会生成 client/server `test-results-summary.json`。
- `scripts/generate-test-report.js` 会校验 client/server 的 `coverage-summary.json`、`test-results.json`、`test-results-summary.json`。

如果测试失败、报告缺失或 summary 生成失败，release artifacts 准备阶段会失败，后续不会继续打包。

## Electron Release 流程

入口脚本：

```text
scripts/build-dist.js
```

当前流程：

1. 读取根目录 `package.json` 的 `version`。
2. 生成 release 输出目录名：

   ```text
   release/v<version>_<YYYYMMDD>_<HHMMSS>/electron/
   ```

3. 清理旧的 `.artifacts/electron-app`。
4. 执行 `pnpm version:sync`，同步 workspace 和 Tauri 版本字段。
5. 执行 `pnpm internal:prepare:desktop-artifacts`。
6. 按目标平台解析 electron-builder flag。
7. 进入 `.artifacts/electron-app`，执行 `electron-builder --win` 或 `electron-builder --mac`。
8. 打包成功后清理 `.artifacts/`。
9. 按 `RELEASE_KEEP_COUNT` 清理旧 release 目录。

当前 Electron package 脚本只接受：

```text
win
windows
mac
macos
```

未知平台会直接失败，不再静默回退到 Windows 包。

Electron staged app 位于：

```text
.artifacts/electron-app/
```

主要内容：

```text
.artifacts/electron-app/
  main.cjs
  preload.cjs
  package.json
  electron-builder.yml
  runtime.config.cjs
  desktop/dist/
  backend/
  icons/
  node-runtime/
```

最终 Electron 包中：

```text
resources/app.asar
resources/server
resources/node-runtime
resources/runtime.config.cjs
```

后端由 Electron main process 启动：

```text
resources/node-runtime/node.exe resources/server/server.cjs
```

## Shared Desktop Artifacts 流程

入口脚本：

```text
scripts/prepare-desktop-artifacts.js
```

当前流程：

1. 生成应用元信息：

   ```text
   server/app-meta.json
   .artifacts/server-bundle/app-meta.json
   ```

2. 强制生成 client/server 测试覆盖率报告和测试结果摘要。
3. 构建 renderer：

   ```bash
   pnpm internal:build:desktop
   ```

4. 构建 backend bundle：

   ```bash
   pnpm internal:build:server
   ```

5. 构建 docs site：

   ```bash
   pnpm docs:build
   ```

6. 把前端测试结果摘要复制进 backend bundle：

   ```text
   .artifacts/server-bundle/client-coverage/test-results-summary.json
   ```

7. 把服务端测试结果摘要复制进 backend bundle：

   ```text
   .artifacts/server-bundle/server-coverage/test-results-summary.json
   ```

8. 复制 docs site：

   ```text
   .artifacts/server-bundle/docs-site/
   ```

9. 复制 renderer dist、icons、runtime config、当前 Node runtime。
10. 组装 `.artifacts/electron-app`。

## Backend Bundle 流程

入口脚本：

```text
server/build.js
```

输出目录：

```text
.artifacts/server-bundle/
```

当前内容：

```text
.artifacts/server-bundle/
  server.cjs
  app-meta.json
  package.json
  tools/
  static/
  node_modules/
  client-coverage/test-results-summary.json
  server-coverage/test-results-summary.json
  docs-site/
```

`server.cjs` 由 esbuild 打包。`better-sqlite3` 和 `sqlite-vec` 等 native 包不进入 bundle，而是复制到 `node_modules/`。

当前 native module 复制逻辑是 Windows-first：

- `better-sqlite3`
- `sqlite-vec`
- `sqlite-vec-windows-x64`
- `bindings`
- `file-uri-to-path`

如果未来支持 macOS / Linux release，需要把平台 native 包选择从硬编码改为按目标平台解析。

## 测试报告入包规则

开发页当前读取以下静态文件：

```text
/client-coverage/test-results-summary.json
/server-coverage/test-results-summary.json
```

Fastify 后端会在启动时检测并暴露这些目录：

```text
client-coverage -> GET /client-coverage/
server-coverage -> GET /server-coverage/
```

Release 包内这些文件位于：

```text
resources/server/client-coverage/test-results-summary.json
resources/server/server-coverage/test-results-summary.json
```

当前 release 规则：

1. 构建前清理 client/server coverage 目录。
2. 强制运行 client tests with coverage。
3. 强制运行 server tests with coverage。
4. 生成 client/server `test-results-summary.json`。
5. 校验以下文件都存在：

   ```text
   desktop/coverage/test-results.json
   desktop/coverage/test-results-summary.json
   server/coverage/test-results.json
   server/coverage/test-results-summary.json
   ```

6. 再复制测试结果摘要进入 `.artifacts/server-bundle/`。

实现入口：

```text
scripts/generate-test-report.js
```

当前脚本职责：

- 清理 `desktop/coverage` 和 `server/coverage`
- 运行 client coverage + json reporter
- 运行 server coverage + json reporter
- 从 `test-results.json` 生成 `test-results-summary.json`
- 校验报告完整性

## Tauri Release 流程

入口脚本：

```text
scripts/build-tauri-dist.js
```

当前流程：

0. 确认当前平台是 Windows。非 Windows 平台直接失败。
1. 读取根目录 `package.json` 的 `version`。
2. 生成 release 输出目录名：

   ```text
   release/v<version>_<YYYYMMDD>_<HHMMSS>/tauri/
   ```

3. 执行 `pnpm version:sync`。
4. 清理 Tauri 旧 bundle cache：

   ```text
   tauri/target/release/bundle/
   ```

5. 执行：

   ```bash
   cross-env CARGO_BUILD_JOBS=1 CARGO_INCREMENTAL=0 pnpm tauri build --config tauri/tauri.conf.json
   ```

6. 把 Tauri bundle 输出复制到 release 目录。
7. 清理 `.artifacts/`。
8. 按 `RELEASE_KEEP_COUNT` 清理旧 release 目录。

Tauri 在构建前通过 `beforeBuildCommand` 或相关准备链路复用：

```text
scripts/prepare-tauri-assets.js
```

该脚本会调用：

```bash
pnpm internal:prepare:desktop-artifacts
```

然后把共享 backend bundle 和 Node runtime 复制到：

```text
tauri/resources/server/
tauri/resources/node-runtime/
tauri/resources/runtime.config.cjs
```

Tauri 当前同样是 Windows-only release。生产态 Rust 代码当前查找：

```text
resources/node-runtime/node.exe
```

## Release 输出和保留策略

release 输出根目录：

```text
release/
```

Electron：

```text
release/v<version>_<YYYYMMDD>_<HHMMSS>/electron/
```

Tauri：

```text
release/v<version>_<YYYYMMDD>_<HHMMSS>/tauri/
```

默认只保留最近 `3` 个 release 目录。

覆盖保留数量：

```bash
RELEASE_KEEP_COUNT=5 pnpm package:electron:win
```

PowerShell：

```powershell
$env:RELEASE_KEEP_COUNT=5
pnpm package:electron:win
```

旧目录被 Windows 锁定时，清理应跳过该目录，不让 release 构建失败。

## 当前平台边界

当前 release 构建按 Windows 桌面环境维护。

已知 Windows-first 假设：

- Electron backend runtime 默认使用 `node.exe`。
- Tauri backend runtime 默认使用 `node.exe`。
- server bundle 固定复制 `sqlite-vec-windows-x64`。
- 根命令只暴露 `package:electron:win` 和 `package:tauri:win`。
- `build-dist.js` 当前只接受 `win/windows/mac/macos`，未知平台会失败。
- `build-tauri-dist.js` 当前只允许在 Windows 上执行。

在完成 macOS / Linux 适配前，非 Windows release 应被视为未支持，不要静默产出不完整包。

## 改造优先级

### P0：Release 测试报告链路

状态：已落地第一版。

当前入口：

```text
scripts/generate-test-report.js
```

后续可继续补充：

- 报告生成耗时统计
- 输出 `.artifacts/reports` 作为 Electron / Tauri 连续打包时的共享缓存
- 更清晰的失败摘要输出

### P1：Artifact 分层

目标：

- `reports`：测试报告生成与校验
- `stage`：准备 renderer/server/docs/runtime inputs
- `package`：Electron/Tauri 调用各自打包器
- `release-output`：时间戳目录、保留策略、清理

这样可以减少 Electron/Tauri 脚本里的重复逻辑。

### P2：平台显式化

目标：

- Windows 构建继续稳定
- 未支持的平台显式失败
- 未来支持 macOS / Linux 时再加入平台 native module 解析、Node runtime 命名和 Tauri resource 路径规则

## 相关文档

- `../developments/release-management.md`
- `../platform/tauri.md`
- `../platform/tauri-setup.md`
