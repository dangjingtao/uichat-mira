---
status: historical
owner: runtime
last_verified: 2026-07-30
layer: wiki
module: Sandbox
feature: ModuleDefinition
doc_type: historical
canonical: false
related:
  - ../tooling-runtime/README.md
  - ../tooling-runtime/terminal-capability-checklist.md
  - ./README.md
---

# Sandbox 模块说明（历史）

> 这页描述的是早期轻量 Sandbox v0.5 路线，已经不能作为当前执行运行时合同。

## 归档原因

旧文档把 `Sandbox` 写成独立的受控执行层，并保留了已经失效的本地绝对路径与阶段性实现判断。

当前工程讨论已经转向：

- 终端能力如何在 Host Runtime 中获得更自由、可回收的执行空间；
- Harness 如何负责审批、工作区、审计和能力暴露；
- Sandbox 如何降低审批摩擦，而不是用大量正则把能力削弱；
- 强隔离、WSL、小型系统、Windows Job Objects / AppContainer 等方案如何按真实效果评估。

这些方向仍在演进，尚未形成一份可替代所有执行环境讨论的完整 current-contract。

## 仍然有效的历史背景

早期路线曾强调：

- workspace 边界；
- env 控制；
- stdout / stderr 截断；
- timeout 与 abort；
- Windows 进程树终止；
- artifact 登记；
- terminal capability 的可用性暴露。

这些问题仍然重要，但具体实现和归属必须回到当前 Tool / Harness / Terminal 文档核验。

## 当前阅读入口

- [[../tooling-runtime/README]]
- [[../tooling-runtime/terminal-capability-checklist]]
- [[README]]

在新的执行运行时合同形成前，不应继续引用本页中的旧模块边界、旧路径或“当前已实现”清单。
