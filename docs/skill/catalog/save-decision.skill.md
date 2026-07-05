# Skill Card: Save Decision

Status: Planned
Owner: docs / chat / runtime
Last verified: 2026-07-06
Layer: raw-source
Module: SKILL
Feature: SaveDecisionSkill
Doc Type: design
Canonical: true
Related:
  - ../README.md
  - ../skill-memory-poc.md
  - ../schema/skill-card.schema.md

## Skill Card

```yaml
id: save-decision
title: 保存决策
status: planned
scope: thread-level-memory-poc
triggerMode: suggested-with-confirmation
inputs:
  - 当前线程内已经明确达成的判断或取舍
  - 该判断必须能影响后续同线程工作方向
  - 决策文本必须能被压缩成可复述的一句话或短段
outputs:
  - 一份待确认的决策条目草案
  - 草案应包含决策结论和适用上下文
  - 若讨论仍在摇摆，应该返回“不建议写入”的判断
writes:
  - 确认后把决策条目写入 thread-level memory 可见对象
  - 第一批 POC 中决策条目不单独建表，先并入线程记忆
  - 写回结果必须允许用户后续修订或清空
requiresUserConfirmation: true
agentHarnessImpact:
  - 不修改 Agent 主链
  - 不新增 Harness runtime
  - 不要求直接调用 Harness tool
  - 不修改 MCP 协议或注册关系
trigger examples:
  - “这件事定了，当前阶段先做 skill，不先接飞书和 Notion，把这个决策记下来。”
  - “把刚才确认的路线保存一下，后面都按这个方向继续。”
  - “这一条已经拍板了，你可以作为线程决策记住。”
non-trigger examples:
  - “我再想想。”
  - “先列一下优缺点。”
  - “你更推荐哪个方案？”
acceptance criteria:
  - 只有在决策已经明确时才生成草案
  - 方案讨论期、摇摆期不能进入写回候选
  - 确认前不能静默写入线程记忆
  - 确认后写回结果对用户可见、可编辑、可清空
  - 不要求调用 Harness tool
  - 不影响 Agent 主链
```

## 这张卡片解决什么

它解决的是：

- 线程里已经拍板的事情如何被持续遵守
- 后续讨论如何减少反复横跳
- 用户和助手如何共享“这件事已经定了”的状态

它不解决：

- 多项目统一决策中心
- 企业审批流
- 自动从所有聊天里抽取战略结论

## 触发边界

只有当决策已经明确，或者用户明确要求“把这条定论记下来”，才适合触发。

常见合格决策包括：

- 当前阶段的产品路线
- 某项工作先做还是后做
- 某个功能边界已经确认

不合格情况包括：

- 还在比选
- 只是模型建议
- 用户表达了犹豫
- 没有明确结论，只是方向倾向

## 写回对象要求

第一批 POC 中，决策先并入 thread-level memory 可见对象。

原因不是说决策不重要，而是当前阶段先验证：

- 决策条目值不值得长期保留
- 决策条目是否真的能帮助续接
- 后面是否值得单独拆表

## 确认要求

这张卡必须坚持：

```text
识别到明确决策
-> 生成待确认决策草案
-> 让用户确认
-> 再写回线程级 memory
```

不允许：

- 助手把“建议”当成“已拍板”
- 用户还没确认时就写入
- 讨论未收敛时提前沉淀决策

## 当前结论

`save-decision` 的价值在于减少后续线程里对同一判断的反复争论，但它也最容易把“讨论中的倾向”误写成“已经确定的结论”，所以必须把确认门槛写死。
