---
status: current
owner: docs
last_verified: 2026-07-31
layer: schema
module: Docs
feature: ArchivePolicy
doc_type: current-contract
canonical: true
related:
  - ../README.md
  - provider/README.md
  - knowledge-base/README.md
  - evaluation/README.md
  - agent/README.md
  - tool/README.md
  - microapp/README.md
  - ../knowledge-system/DOCUMENTATION_STANDARDS.md
---

# 文档归档规则

归档的目的不是删除历史，而是阻止旧结论继续冒充当前事实。

## 当前归档索引

- [[archive/provider/README]]：Provider 旧总纲、旧混合 Proxy 文档与 Catalog 重构记录；
- [[archive/knowledge-base/README]]：Knowledge Base 单库 MVP、旧 API / Schema 与 Markdown Workspace 设计；
- [[archive/evaluation/README]]：Evaluation 六月薄总览、旧 Workbench 摘要和 moved 兼容页；
- [[archive/agent/README]]：Agent 历史路线、阶段清单与旧多 Agent / Pilot 口径；
- [[archive/tool/README]]：Tool / Harness 旧矩阵、整改台账与 CodeGraph 实现前方案；
- [[archive/microapp/README]]：MicroApp 旧总纲、实现前 POC、早期 Studio 设计与迁移前合同。

## 自动进入历史归档的情况

索引器会把以下内容归入“历史归档”：

- 路径位于 `archive/` 或任意子目录的 `archive/`；
- `Status` 为 Historical、Archived、Superseded、Deprecated、Retired、Completed、Closed 或 Obsolete；
- `Doc Type` 为 historical、retrospective 或 archive；
- 文件名明确包含 retrospective、legacy、deprecated、superseded 或 archive，且没有更强的当前状态声明。

## 什么时候只改状态

文档仍被大量链接、移动会造成断链时，可以保留原路径，但必须：

- 把 `Status` 改为 Historical 或 Superseded；
- 把 `Doc Type` 改为 historical；
- 在开头说明被哪份当前契约替代；
- 删除或修正会误导当前实现的绝对表述。

这属于站点级归档。

## 什么时候移动到 archive

满足以下条件时再物理移动：

- 已经没有活跃代码或 current-contract 依赖原路径；
- 链接可以一次性修复；
- 内容只剩背景价值；
- 原路径不再承担兼容入口。

移动后应同步修复相关链接。

当原路径仍被大量历史任务、评审和搜索结果引用时，可以：

1. 把原正文复制到模块归档；
2. 原路径替换为兼容退役页；
3. 兼容页只指向当前真相与历史索引。

## 不能归档的内容

- 当前运行时合同；
- 当前产品入口说明；
- 仍在真实执行的操作手册；
- 活跃缺陷、验收与恢复记录；
- 仍作为代码评审依据的稳定参考。

这些内容如果过期，应先补真相，而不是为了“目录干净”直接藏起来。

## 归档后的阅读规则

历史资料可以回答：

- 为什么曾经这样设计；
- 哪条路线失败过；
- 某个合同如何演化；
- 哪些约束来自过去的事故。

历史资料不能回答：

- 当前产品具备什么；
- 当前代码如何运行；
- 当前审批和恢复语义是什么；
- 当前 Provider 状态是否代表真实请求成功；
- 当前 Knowledge Base 是否已经 ready；
- 当前检索、Rerank 和 Agent 接入实际走哪条路径；
- 当前 Evaluation Package 是否保存真实语料；
- 当前 Run 是否支持重启恢复；
- 当前指标名称对应什么算法；
- 下一步施工应该遵守哪份合同。
