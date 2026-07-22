# Skill Package / Runtime Pack 合同

Status: Current
Owner: chat / runtime / desktop
Last verified: 2026-07-23
Layer: raw-source
Module: SKILL
Feature: SkillPackageDistribution
Doc Type: current-contract
Canonical: true
Related:
  - ./README.md
  - ./skill-runtime-design.md
  - ../microapp/wenshu-skill-runtime.md

## Purpose

本合同定义 **Skill 展示/分发包** 与 **可选 Runtime Pack** 的边界。

它不改变正式 Skill Runtime 的核心定义：

> `Skill = 内部状态 + 多工具编排 + 业务语义封装`。

## 四层必须分开

```text
Skill Package
  SKILL.md / references / scripts metadata
  ↓ 描述方法、领域规则、依赖

Runtime Pack
  可选下载的第三方执行依赖
  ↓ 让 Domain Runtime 具备本地执行条件

Domain Runtime / Tool implementation
  确定性 PDF / XLSX / PPTX / DOCX 执行
  ↓

Formal Skill Runtime
  SkillDefinition + SkillInstance + state/stage + reducer + tool constraints
```

### Skill Package

Skill Package 是产品展示与分发单位，可以包含：

- `SKILL.md`
- reference / template
- scripts 或 runtime source metadata
- version
- runtime dependency declaration
- source / license metadata

**Skill Package 本身不是运行中的 SkillInstance。**

只有 `SKILL.md + 一个 Tool`，不能宣称已经实现正式 Skill Runtime。

### Runtime Pack

Runtime Pack 是可选安装的本地执行依赖集合。

安装 Runtime Pack：

- 可以使某些 Domain Runtime 从 unavailable 变成 available；
- 不创建 SkillInstance；
- 不注入 Planner 语义；
- 不新增 `use_skill` action；
- 不自动注册或扩大 Harness `toolExposure`；
- 不拥有 approval / sandbox / trace 权力。

## 安装模型

V1 使用按需安装：

```text
用户打开 Skill 详情
  ↓
点击「去使用」
  ↓
检查 runtimePack
  ├─ 已安装 -> 进入对应 MicroAPP
  └─ 未安装 -> 下载/安装 -> 校验 -> 标记 installed -> 进入 MicroAPP
```

安装状态至少区分：

```text
not-installed
installing
installed
broken / repair-needed
```

安装失败不得把半成品目录标记为 installed。

## 文件与 Python 边界

文枢 `wenshu-office` Runtime Pack：

- 复用 Mira **系统开发小套件 Python** 作为解释器；
- 不打包第二套 Python；
- 不把第三方依赖安装进用户全局 Python；
- 依赖安装到 Mira 自己管理的 runtime-pack 目录；
- Python 子进程通过受管 `PYTHONPATH` 使用该目录；
- 安装应使用 staging 目录，校验成功后再替换正式版本目录。

默认目录概念：

```text
<Mira runtime-packs>/
  wenshu-office/
    <version>/
      manifest.json
      site-packages/
```

具体根目录允许由 `MIRA_RUNTIME_PACKS_DIR` 覆盖。

## WenShu V1 Package

当前三个可选安装展示包：

```text
xlsx -> runtimePack: wenshu-office
pdf  -> runtimePack: wenshu-office
pptx -> runtimePack: wenshu-office
```

三个 Skill Package 共享一个 Runtime Pack，避免 Python / Pillow / lxml 等公共依赖重复下载。

DOCX 基础能力目前主要由现有 Node / Office Runtime 提供，不要求为了三个 Python Skill 强制重复安装 Python Pack。

## 与 MicroAPP 的关系

```text
Skills 页面
  -> 展示 Skill Package / 安装状态
  -> 去使用触发 Runtime Pack 安装
  -> 安装成功进入文枢 MicroAPP

文枢 MicroAPP
  -> Domain Runtime / debug / verification surface
```

MicroAPP 不自动等于 Skill。

## Agent / Harness 接入门槛

当前 PDF / XLSX / PPTX Skill Package **暂不自动接入 Agent / Harness**。

只有正式 Skill Runtime 至少具备以下合同后，才允许接入：

1. versioned `SkillDefinition`；
2. active `SkillInstance`；
3. state / stage；
4. accepted Evidence 驱动的 reducer；
5. stage-specific tool constraints；
6. completion criteria evaluation；
7. version binding / lifecycle truth。

接入时仍必须满足：

```text
Harness eligible tools
  ∩ Skill 当前 allowedToolIds
  ∩ Policy / environment
  -> state.toolExposure
```

Skill **只能收窄**已有可用工具，不得因为 Skill 被选中而主动把 Tool push 进 `toolExposure`。

## 当前实现锚点

- `server/src/skills/registry.ts`
- `server/src/microapps/office-suite/capability-pack.ts`
- `server/src/microapps/office-suite/runtime-pack-paths.ts`
- `server/src/routes/microapps/office-suite/capability-pack.ts`
- `server/tools/wenshu/requirements.txt`
- `desktop/src/features/Settings/pages/Skills/`

## Hard Rules

1. 安装 Skill Package / Runtime Pack 不等于激活正式 Skill Runtime。
2. Runtime Pack 不得扩大 Harness 权限或工具面。
3. 第三方 Python 依赖不污染用户全局 Python。
4. 安装失败不留下 installed 真值。
5. Domain Runtime 可先通过 MicroAPP 使用与验证，Agent 接入可以后置。
6. 正式 Skill Runtime 仍以 `README.md` 与 `skill-runtime-design.md` 为上位真相源。
