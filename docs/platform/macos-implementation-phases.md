# macOS 桌面端实现分期

Status: Proposed
Owner: platform
Last verified: 2026-08-05
Layer: raw-source
Module: Developments
Feature: PlatformRuntime
Doc Type: implementation-plan
Canonical: true
Related:
  - tauri.md
  - tauri-setup.md
  - ../architecture/README.md
  - ../architecture/ipc-and-preload.md
  - ../build/README.md
  - ../developments/release-management.md

## 单点真相范围

这份文档统一说明：

- Mira 当前桌面代码距离 macOS 可用版本还有哪些真实缺口
- macOS 首版为什么应先走 Electron，而不是直接追求 Tauri 完整对齐
- 共享构建输入、原生依赖、终端运行时、浏览器 Native Messaging、TTS、签名公证应该如何分期
- 每一期的交付边界、验收门槛与明确不做项

这不是“在现有配置里补一个 `mac` target”的任务。当前仓库虽然已经出现 DMG、ICNS、POSIX shell、Darwin 生命周期等基础，但共享桌面构建输入和生产运行时仍以 Windows x64 为单点真相。若不先拆平台合同，macOS 构建即使生成 `.app` 或 `.dmg`，也会在 backend、SQLite、Terminal Runtime、Piper 或 Native Messaging 任一环节失效。

## 结论

### 推荐路线

1. **首个可运行版本采用 Electron。**
2. **先完成共享 runtime 平台化，再推进 Tauri macOS。**
3. **首发目标锁定 Apple Silicon / arm64、Developer ID 直发 DMG，不以 Mac App Store 为首期目标。**
4. **浏览器 Native Messaging 与本地 Piper 不阻塞第一版内部可用包，但必须以显式“暂不可用/降级”呈现，不能静默失败。**
5. **Windows 现有合同保持不变；平台化通过 manifest、resolver 和按平台产物实现，不以大规模重写桌面壳层为代价。**

### 为什么 Electron 优先

当前 Electron 主进程已经具备几个对 macOS 有利的条件：

- 使用 `process.resourcesPath` 解析生产资源，天然符合 `.app/Contents/Resources` 布局
- 已处理 Darwin 的窗口关闭生命周期
- backend 在没有独立 Node runtime 时，可以通过 `ELECTRON_RUN_AS_NODE=1` 使用 Electron 自身执行 `server.cjs`
- `electron-builder.yml` 已存在 `mac.target: dmg` 与 ICNS 图标入口

Tauri 当前额外存在以下阻塞：

- 手动从当前可执行文件目录拼接 `resources`，不符合 macOS `.app` 的标准资源目录
- backend 生产启动写死 `node.exe` 和 `where.exe`
- Native Messaging 写死 `.exe`、Windows 注册表与 `reg.exe`
- Tauri 打包脚本显式拒绝非 Windows 平台

因此，Electron 更适合作为验证共享 runtime 平台化成果的第一条 macOS 产品链；Tauri 应在共享输入稳定后复用同一套能力合同，而不是先在 Rust 壳层里复制一套临时方案。

## 当前代码事实

| 子系统 | 当前实现 | 对 macOS 的影响 |
| --- | --- | --- |
| 根命令 | `dev:*:win`、`package:*:win`、`release:*:win` | 缺少平台中立入口和 macOS 命令 |
| Electron Builder | 已声明 DMG 与 ICNS | 只能说明有目标配置，不能证明运行时资源可用 |
| Electron 主进程 | Darwin 生命周期、`process.resourcesPath`、Electron-as-Node fallback 已存在 | 适合作为首版壳层；Native Messaging 仍是 Windows-only |
| Tauri 配置 | `targets: all`，资源列表完整 | 配置层看似跨平台，实际资源内容仍是 Windows 产物 |
| Tauri 主进程 | 数据、日志、Workspace 目录使用 Tauri path API | 基础目录逻辑可复用；资源根、Node、Native Messaging 需改造 |
| Shared artifacts | 强制构建 `.exe` Native Host、Windows Terminal Runtime、Windows Piper | 是当前最大总阻塞，不应绕过 |
| Backend bundle | `sharp-win32-x64`、`sqlite-vec-windows-x64`、`node-pty/win32-x64` 写死 | macOS 包即使启动，也无法加载关键 native module |
| Terminal Runtime | PowerShell 下载与解压，Node/MinGit/uv/rg 均为 Windows x64 | 需按 `platform-arch` 建锁文件和 manifest |
| Terminal Harness | 已有 POSIX shell profile、POSIX process group、UTF-8 | 业务执行层已具备较好跨平台基础 |
| Piper | 只准备 `piper_windows_amd64.zip` 与 `piper.exe` | 首期需 feature gate；后续补 macOS arm64 runtime |
| Browser Native Messaging | `.exe` launcher + Windows Registry | macOS 需独立 launcher 与 Chrome manifest 安装路径 |
| Release Factory | 验证、payload、native runtime 均围绕 `windows-x64` | 需新增 macOS 独立证据链，不能直接复用 Windows validation 根目录 |

## 目标能力分层

macOS 不应以“所有 Windows 功能同日齐平”为唯一开工条件。建议按以下能力层交付：

### Core

- 应用启动、退出与单实例行为
- Chat / Provider / Agent 主链
- SQLite 数据库与迁移
- Workspace 选择、读写、附件
- POSIX Terminal Session
- Web Search 与不依赖 Native Messaging 的浏览器能力
- 更新前的基础日志与诊断信息

### Extended

- 浏览器扩展下载与 Native Messaging Host 安装
- Piper 本地 TTS
- 本地模型 runtime
- Office/PDF/外部 CLI 能力
- 签名、公证、可公开分发

第一版内部可用包必须完整覆盖 Core；Extended 可按后续阶段逐项开放，但 UI 和 capability snapshot 必须准确描述实际可用性。

## 分期计划

## Phase 0：目标冻结与平台合同

### 目标

先把“macOS 首版是什么”写进合同，避免实现过程中不断把 Universal、App Store、Tauri、Native Messaging、Piper 同时拉进首期。

### 决策

- 首发架构：`darwin-arm64`
- 首发壳层：Electron
- 分发：Developer ID 直发 DMG
- 首期不做：Mac App Store sandbox、Universal 2、Intel x64、自动更新
- Core 必须可用；Native Messaging 与 Piper 可在首个内部包降级
- `desktopRuntime.platform` 在 Node/Electron 合同继续使用 `darwin`；Tauri 侧应将 Rust 的 `macos` 映射为 `darwin`，避免前端出现第三套平台值

### 产物

- 平台/架构命名规范：`windows-x64`、`darwin-arm64`
- capability matrix
- artifact manifest schema
- 首版 DoD

### Gate

任何构建脚本不得仅凭“在 macOS runner 上能执行”就宣称支持；必须能说明每一项原生资源来自哪个 `platform-arch` manifest。

## Phase 1：macOS 开发态 Bring-up

### 目标

先证明源码开发态可以在 Apple Silicon Mac 上稳定运行，不做生产打包承诺。

### 代码范围

- `package.json`
  - 增加 `dev:electron:mac`
  - 增加 `dev:tauri:mac` 仅用于壳层探测，不作为首版交付承诺
  - 逐步增加无平台后缀的内部命令，平台后缀保留为兼容别名
- `electron/dev-launcher.cjs`
- `scripts/run-tauri-dev.cjs`
- `scripts/tauri-dev-launcher.cjs`
- `server/src/harness/environment.ts`
- Terminal Session smoke tests

### 实现要求

- 开发态不得要求生成 Windows Native Host `.exe`
- 浏览器扩展页面构建和 Native Host 构建拆开
- backend、desktop dev server 能复用现有端口探测与进程回收逻辑
- 默认 Workspace 使用 `~/Documents/UIChat Mira/Default Workspace`
- Terminal shell 使用用户 `$SHELL`，缺失时回退 `/bin/zsh` 或 `/bin/bash`
- 补 `darwin` 下路径大小写、空格、中文目录 smoke

### 验收

- `pnpm dev:electron:mac` 可启动
- Chat、数据库、Workspace、普通附件、POSIX Terminal 可用
- 退出应用后无遗留 backend/dev server 进程
- Windows 原有开发命令不回归

## Phase 2：共享构建输入平台化

### 目标

把 `.artifacts/` 从“Windows 构建缓存”变成带平台合同的桌面 payload 输入。这一期是 Electron 与 Tauri 两条 macOS 链的共同前置条件。

### 推荐目录

```text
.artifacts/
  payload/
    windows-x64/
      manifest.json
      desktop/
      server/
      node-runtime/
      terminal-runtime/
      browser-extension/
      micro-apps/
    darwin-arm64/
      manifest.json
      desktop/
      server/
      node-runtime/
      terminal-runtime/
      browser-extension/
      micro-apps/
```

不要求一次性迁移所有历史路径。可以先由 resolver 兼容旧 `windows-x64` 目录，再逐步收口。

### 代码范围

- `scripts/prepare-desktop-artifacts.js`
- `scripts/prepare-tauri-assets.js`
- `server/build.js`
- `scripts/prepare-terminal-runtime.mjs`
- `scripts/terminal-runtime.lock.json` 及新的平台锁文件
- `scripts/terminal-runtime-staging.js`
- `scripts/prepare-piper-runtime.mjs`
- release payload manifest / validation 脚本

### Backend native modules

`server/build.js` 必须按目标平台选择原生依赖，不能继续固定复制：

- `@img/sharp-win32-x64`
- `sqlite-vec-windows-x64`
- `node-pty/prebuilds/win32-x64`

macOS arm64 payload 至少需要验证：

- `better-sqlite3` 可加载
- `sharp` arm64 binding 可加载
- `sqlite-vec` 对应 Darwin arm64 扩展可加载；若上游无可分发包，必须明确 fallback 或暂时关闭向量扩展，而不是保留 Windows DLL
- `node-pty` Darwin arm64 binding 可加载

构建必须在目标 OS 上完成或验证；不把 Windows 产出的 native modules 跨平台复制到 macOS 包。

### Terminal Runtime

为 `darwin-arm64` 单独维护 lock 和 checksum，包含：

- Node + npm/npx
- Git（优先系统 Git/Xcode Command Line Tools 探测，是否随包分发需单独决策）
- uv
- ripgrep

下载与解压逻辑使用 Node HTTPS/fetch、`tar`/`unzip` 或纯 Node 实现，不依赖 PowerShell。manifest 中记录：

- platform
- architecture
- runtime path
- source URL
- SHA-256
- staged size
- executable mode

### Piper

Phase 2 不强制立即提供 Piper macOS 包，但必须做到：

- runtime preparer 根据平台选择资源，而不是默认 `piper.exe`
- 未提供 Darwin runtime 时生成显式 capability `unavailable`
- 共享 payload 不因 Piper 缺失整体失败

### 验收

- Windows payload 内容与行为不变
- `darwin-arm64` payload 不含 `.exe`、`.dll`、Windows Registry 脚本和 MinGit
- payload manifest 可在打包前完整校验
- server bundle 在目标 Mac 上完成 native module load smoke

## Phase 3：Electron macOS 可安装 MVP

### 目标

生成可在干净 Apple Silicon Mac 上安装和运行的未公证内部 DMG，完整覆盖 Core 能力。

### 代码范围

- `electron/main.cjs`
- `electron-builder.yml`
- `scripts/build-dist.js`
- 新增或平台化 Electron package script
- macOS smoke workflow

### Backend 启动策略

首版优先复用 Electron-as-Node：

1. 若 payload 中存在 `node-runtime/node`，使用独立 Node
2. 否则使用 `process.execPath` 并注入 `ELECTRON_RUN_AS_NODE=1`
3. 两种路径都必须通过 backend health 和 native module load smoke

这能降低首版 sidecar 签名数量，但不是永久取消独立 Node runtime。Terminal Runtime 仍可按 Phase 2 的平台 manifest 提供 Node/npm/npx 给 Agent 使用。

### 打包要求

- `mac.target` 明确为 DMG，首期 `arch: arm64`
- 使用 ICNS 图标
- 所有 extra resources 从 `darwin-arm64` payload resolver 获取
- 不把 Windows Native Host、Piper 或 Terminal Runtime 混入包内
- backend 启动失败时显示可诊断错误，不直接白屏
- 日志落到应用数据目录

### 验收

在未安装 Node、pnpm、Rust、GitHub CLI 的干净 Apple Silicon Mac 上：

- DMG 可挂载，应用可拖入 Applications
- 应用可启动并创建数据目录
- backend health 通过
- 数据库创建、重启后数据保留
- 默认 Workspace 可读写
- Terminal Session 能运行 POSIX 命令并正确终止进程树
- Chat / Provider / Agent 基础链可用
- Native Messaging 与 Piper 若尚未实现，UI 明确标记为暂不可用

## Phase 4：macOS 原生能力补齐

### 目标

补齐不属于 Core、但会影响 Mira 完整桌面体验的 macOS 原生能力。

### 4.1 Browser Native Messaging

需要独立实现 macOS launcher，不能复用 `MiraWebBridgeHost.exe`。

建议：

- 输出无扩展名可执行文件，例如 `MiraWebBridgeHost`
- launcher 定位同目录 `host.mjs`
- manifest `path` 使用绝对路径
- 用户级 Chrome manifest 写入：
  - `~/Library/Application Support/Google/Chrome/NativeMessagingHosts/`
- Chromium、Chrome for Testing 等路径作为后续兼容项，不在首个实现里猜测式全写
- status / install / uninstall 通过平台 adapter 实现，不在 Electron 与 Tauri 各自复制业务判断

需要同时修改：

- `mira-clipper-ext/scripts/build-native-host.mjs`
- Electron IPC adapter
- Tauri command adapter（Phase 6 接入）
- Native Host smoke

### 4.2 TTS

建议能力顺序：

1. API provider TTS 保持可用
2. 新增 macOS 系统语音 provider，最小实现可先基于系统能力
3. 再评估 Piper Darwin arm64 的体积、许可、音质与签名成本

不要把现有 `windows_builtin` 在 macOS 上伪装成可用；provider catalog 应按平台报告真实状态。

### 4.3 本地模型与外部 CLI

- ONNX Runtime Web 静态资源通常可共享，但模型 pack 与 native helper 仍需逐项验证
- Office/PDF 能力不得默认系统已有 Python、LibreOffice、pdftotext
- 每个 CLI 通过 capability probe 暴露，不以 PATH 假设替代 manifest

### 验收

- Chrome Native Messaging 可安装、检测、修复、卸载
- 浏览器扩展与 Mira 之间能完成一次端到端握手
- TTS provider 状态与实际平台能力一致
- 无功能因缺失可执行文件而导致 backend 崩溃

## Phase 5：签名、公证与发布流水线

### 目标

把内部 DMG 变成可对外分发、通过 Gatekeeper 校验的正式 macOS 产物。

### Apple 分发要求

直发应用需要：

- Developer ID Application 证书
- Hardened Runtime
- 与实际能力匹配的 entitlements
- 对 `.app` 内所有嵌套可执行文件、动态库、`.node`、Native Host、sidecar、CLI runtime 完整签名
- 使用 Apple 当前公证流程提交 notarization
- 对最终 `.app` / DMG staple 并离线验证

不得只签最外层 `.app`。Mira 包含 Node native modules 和多个潜在 runtime，漏签任一嵌套 Mach-O 都可能使公证或 Gatekeeper 失败。

### Workflow

新增独立 macOS job，不把结果写入 `windows-x64` validation 根目录：

- runner：`macos-*`
- arch：arm64 构建环境需明确，不能默认 runner 架构
- install / typecheck / tests
- build `darwin-arm64` payload
- native module load smoke
- package Electron DMG
- codesign verify
- notarize
- staple
- `spctl --assess` 与 DMG 安装 smoke
- 上传 artifact 与 validation manifest

Secrets 至少包括：

- Apple signing identity / certificate material
- certificate password
- Apple notarization credentials（API key 或 Apple ID app-specific password 方案二选一）
- Team ID

### 验收

- `codesign --verify --deep --strict --verbose=2` 通过
- `spctl --assess --type execute` 通过
- notarization 状态成功
- staple 校验成功
- 在另一台未配置开发环境的 Apple Silicon Mac 上首次启动不触发“应用已损坏”或来源不可验证

## Phase 6：Tauri macOS 对齐

### 前置条件

只有 Phase 2 的共享 payload 与 Phase 5 的签名规则稳定后，才进入 Tauri 正式对齐。否则会把平台问题重复实现一遍。

### 代码范围

- `tauri/src/main.rs`
- `tauri/tauri.conf.json`
- `scripts/prepare-tauri-assets.js`
- `scripts/build-tauri-dist.js`
- Tauri capabilities / sidecar config

### 必改项

#### 资源目录

移除从 `current_exe()` 父目录手拼 `resources` 的逻辑，改用 Tauri 的 resource path resolver。macOS `.app` 中可执行文件位于 `Contents/MacOS`，资源位于 `Contents/Resources`，手拼相邻目录会落错位置。

#### 平台值

将 Rust `std::env::consts::OS == "macos"` 映射为前端合同使用的 `darwin`；Windows 继续映射为 `win32`。

#### Backend runtime

短期优先：

- 从 `darwin-arm64` payload 携带 `node-runtime/node`
- 通过 Tauri resource resolver 定位
- backend 进程生命周期继续由现有 `BackendProcess` 管理

后续若改成 Tauri sidecar，必须遵守 target triple 文件名规则，并把 sidecar 纳入签名、公证与 capability 权限配置。

#### Native Messaging

复用 Phase 4 的平台 adapter 与 macOS launcher，不在 Rust 代码里继续保留 Windows Registry 作为唯一实现。

### 验收

- Tauri 与 Electron 使用同一份 `darwin-arm64` payload manifest
- Core capability smoke 与 Electron 一致
- Native Messaging、Terminal、数据库、Workspace 的结果合同一致
- 两个壳层不维护两套下载器、原生依赖选择器或 runtime PATH 规则

## Phase 7：架构扩展与产品化

在 arm64 正式版稳定后再评估：

- Intel x64
- Universal 2
- 自动更新 feed
- 崩溃报告
- Mac App Store sandbox
- 钥匙串存储敏感配置
- Dock/Menu Bar 原生体验
- Electron 与 Tauri 的长期主次收敛

Universal 2 不是把两个 `.app` 简单拼接。所有 native module、sidecar、Piper、Node runtime 与 Native Host 都必须具备双架构或分别构建后合并，因此不应进入首版范围。

## 推荐 PR 序列

为了避免一个超大 PR 同时改动 runtime、壳层和发布，建议按以下顺序推进：

1. `feat/macos-dev-bootstrap`
   - 开发态命令、平台探测、feature gate、基础 smoke
2. `refactor/platform-artifact-contract`
   - payload resolver、manifest、目录与兼容层
3. `build/darwin-arm64-runtime`
   - server native modules、Terminal Runtime、目标平台验证
4. `feat/electron-macos-package`
   - Electron DMG、backend 启动、安装 smoke
5. `feat/macos-native-messaging`
   - launcher、manifest、安装/检测/卸载
6. `build/macos-sign-notarize`
   - 签名、公证、CI 与发布证据
7. `feat/tauri-macos-parity`
   - resource resolver、Node runtime、能力对齐

每个 PR 都必须保持 Windows release contract 可验证，不把“后续再修 Windows”作为平台化代价。

## 首个实现 PR 的建议边界

首个 PR 只做开发态 Bring-up 与 capability truth，不碰签名和正式发布：

- 新增 macOS dev 命令
- 拆开 extension package 与 Native Host build
- 对 Windows-only Piper / Native Messaging 返回明确 unavailable
- 验证 backend、数据库、Workspace、POSIX Terminal
- 增加 Darwin 测试与 smoke
- 记录仍被 Phase 2 阻塞的 production package 项

这样能最快拿到真实 Mac 运行反馈，又不会用临时路径污染正式打包合同。

## 风险与控制

### 原生依赖架构漂移

风险：开发机可以运行，但打包后 `.node` 来自错误平台或错误架构。

控制：manifest 记录 `platform/arch`；打包前对每个 native module执行 load smoke；禁止从另一 OS 复制 `node_modules` 产物。

### 签名对象遗漏

风险：最外层签名成功，但嵌套 runtime 导致公证失败。

控制：构建后枚举 Mach-O 与 `.node`，生成签名清单；签名和验证都基于清单执行。

### Tauri / Electron 双实现漂移

风险：两个壳层各自维护 runtime path、Native Messaging 和 backend 启动规则。

控制：共享 payload manifest、platform resolver 与 capability contract；壳层只负责生命周期和原生桥接。

### 首期范围膨胀

风险：Universal、App Store、Tauri、Piper、Native Messaging 同时阻塞首版。

控制：Phase 0 冻结 arm64 + Electron + direct DMG；Extended 能力按明确 gate 后移。

## Definition of Done

macOS 首个正式版本完成时，必须同时满足：

- Apple Silicon 干净机器可安装、启动、退出和再次启动
- Chat / Provider / Agent 主链通过
- SQLite、迁移、向量能力状态准确
- Workspace 读写与 POSIX Terminal 通过
- backend 无宿主 Node 依赖
- payload 不含 Windows-only 二进制
- 所有 native modules 与嵌套可执行文件签名完整
- notarization、staple、Gatekeeper 验证通过
- capability UI 不宣称未实现能力可用
- Windows 构建、验证与发布流程无回归
- Electron 与后续 Tauri 共用同一套 `darwin-arm64` runtime 合同

## 外部实现依据

- Apple notarization：`https://developer.apple.com/documentation/security/notarizing-macos-software-before-distribution`
- Chrome Native Messaging：`https://developer.chrome.com/docs/extensions/develop/concepts/native-messaging`
- electron-builder notarization：`https://www.electron.build/docs/notarization/`
- Tauri resources：`https://v2.tauri.app/develop/resources/`
- Tauri sidecar：`https://v2.tauri.app/zh-cn/develop/sidecar/`
- Tauri macOS signing：`https://v2.tauri.app/zh-cn/distribute/sign/macos/`
