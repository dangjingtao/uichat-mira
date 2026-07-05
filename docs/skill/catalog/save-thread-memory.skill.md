# Skill Card: Save Thread Memory

Status: Planned
Owner: docs / chat / runtime
Last verified: 2026-07-06
Layer: raw-source
Module: SKILL
Feature: SaveThreadMemorySkill
Doc Type: design
Canonical: true
Related:
  - ../README.md
  - ../skill-memory-poc.md
  - ../schema/skill-card.schema.md

## Skill Card

```yaml
id: save-thread-memory
title: 保存线程记忆
status: planned
scope: thread-level-memory-poc
triggerMode: explicit
inputs:
  - 当前线程内用户明确要求“记住 / 保存 / 沉淀这轮讨论”
  - 当前线程内与目标主题直接相关的最近多轮对话
  - 已有 thread-level summary 或 memory 文本，若存在则作为合并参考
outputs:
  - 一份待确认的线程记忆草案
  - 草案应是面向后续续接的短文本，不是原始消息堆砌
  - 若发现内容不适合沉淀，应返回“不建议写入”的判断
writes:
  - 确认后更新 thread-level memory 可见对象
  - 允许覆盖、追加或改写现有线程记忆
  - 写回结果必须能被用户再次打开、编辑、清空
requiresUserConfirmation: true
agentHarnessImpact:
  - 不修改 Agent 主链
  - 不新增 Harness runtime
  - 不要求直接调用 Harness tool
  - 不修改 MCP 协议或注册关系
trigger examples:
  - “把我们刚才关于 SKILL 和记忆层的结论记下来。”
  - “这一轮讨论请沉成后续还能继续接上的线程记忆。”
  - “把这次聊出来的方向保存成这个线程的长期上下文。”
non-trigger examples:
  - “你总结一下刚才说了什么。”
  - “把这段话翻译成英文。”
  - “你觉得这个方向靠谱吗？”
acceptance criteria:
  - 只在用户明确要求保存线程记忆时触发
  - 产出的是待确认草案，而不是直接写入结果
  - 确认前不发生任何持久写回
  - 确认后写回的是线程级可见对象
  - 用户之后可以查看、编辑、清空该对象
  - 不要求改动 AgentGraph / Harness / MCP / ToolNode / Policy / Planner
```

## 这张卡片解决什么

它解决的是：

- 这轮讨论值不值得留下
- 留下后，下次如何快速续接
- 留下的是压缩后的线程记忆，而不是整段聊天记录

它不解决：

- 用户级长期人格建模
- 多线程共享知识图谱
- 平台级知识库归档

## 触发边界

只有在用户明确要求“保存这一轮讨论”为后续线程上下文时，才应该触发。

下面这些表达可以视为同义触发：

- 记住这次讨论
- 保存为线程记忆
- 沉成后续上下文
- 给这个线程留一段长期说明

如果用户只是想要：

- 一次性总结
- 解释
- 重写
- 翻译

都不应该转成这个 skill。

## 写回对象要求

第一批 POC 里，这张卡只允许写线程级 memory 可见对象。

写回对象必须满足：

1. 用户能看见全文
2. 用户能手动编辑
3. 用户能清空
4. 用户知道这次保存写进了哪里

## 确认要求

这张卡必须经过用户确认。

允许的流程只有：

```text
生成草案
-> 告诉用户准备写什么
-> 等用户确认
-> 再写回线程级 memory 对象
```

不允许：

- 先写后告知
- 静默追加
- 模型自行判断“这条很重要所以我先记下”

## 当前结论

`save-thread-memory` 是第一批最基础的记忆型 skill，因为它最贴近当前 thread summary 的产品形态，也最容易验证“可见、可改、可清空”的基本闭环。
