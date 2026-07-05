# Skill Card: Save Preference

Status: Planned
Owner: docs / chat / runtime
Last verified: 2026-07-06
Layer: raw-source
Module: SKILL
Feature: SavePreferenceSkill
Doc Type: design
Canonical: true
Related:
  - ../README.md
  - ../skill-memory-poc.md
  - ../schema/skill-card.schema.md

## Skill Card

```yaml
id: save-preference
title: 保存偏好
status: planned
scope: thread-level-memory-poc
triggerMode: suggested-with-confirmation
inputs:
  - 当前线程内用户明确表达的稳定偏好
  - 偏好必须和当前助手协作方式相关
  - 偏好必须能被压缩成清晰短句
outputs:
  - 一份待确认的偏好条目草案
  - 草案应说明偏好内容和适用范围
  - 若表达不稳定或只是临时语气，应返回“不建议写入”的判断
writes:
  - 确认后把偏好条目写入 thread-level memory 可见对象
  - 第一批 POC 中偏好条目不单独建表，先并入线程记忆
  - 写回结果必须允许用户逐条修改或整体清空
requiresUserConfirmation: true
agentHarnessImpact:
  - 不修改 Agent 主链
  - 不新增 Harness runtime
  - 不要求直接调用 Harness tool
  - 不修改 MCP 协议或注册关系
trigger examples:
  - “以后你先给结论，再补细节，这个偏好帮我记住。”
  - “少讲代码，多从 AI 产品角度说，这个以后都按这个来。”
  - “回答尽量短一点，这条你可以记下来。”
non-trigger examples:
  - “这次先简单说。”
  - “你现在别展开太多。”
  - “给我三个方案看看。”
acceptance criteria:
  - 只针对稳定协作偏好生成草案
  - 临时要求和一次性语气不进入写回候选
  - 确认前不能静默写入线程记忆
  - 确认后写回结果对用户可见、可编辑、可清空
  - 不要求调用 Harness tool
  - 不影响 Agent 主链
```

## 这张卡片解决什么

它解决的是：

- 用户已经反复表达的协作偏好如何被稳定延续
- 偏好如何被压缩成可复用条目
- 偏好如何在下一轮继续影响回答风格

它不解决：

- 用户身份画像
- 跨工作区的全局人格建模
- 与外部平台同步偏好

## 触发边界

这张卡可以由助手建议触发，但不能自动写入。

适合进入草案候选的偏好一般有两个特征：

1. 不是一次性命令
2. 具有后续复用价值

例如：

- 先给结论
- 回答简洁
- 多谈产品边界，少谈代码实现

下面这些不适合触发：

- 当前轮次的临时格式要求
- 和任务内容无关的情绪话
- 助手自己推断出来但用户没有明确表达的倾向

## 写回对象要求

第一批 POC 中，偏好不单独建对象表，先作为 thread-level memory 中可见的条目写回。

重要的是产品边界，而不是现在就把数据结构做复杂：

- 用户要能看到记录了什么
- 用户要能改写那句偏好
- 用户要能删除那句偏好

## 确认要求

助手最多只能这样做：

```text
识别到可能的稳定偏好
-> 提出“是否要记住这条偏好”
-> 展示待写入草案
-> 等用户确认
-> 再写回线程级 memory
```

不允许：

- 因为多次出现就自动落记忆
- 助手用“我帮你记住了”跳过确认
- 在用户没表态时直接写入

## 当前结论

`save-preference` 适合做成“建议触发但必须确认”的 skill，因为它最容易误伤边界，只有把确认权留给用户，thread-level memory POC 才不会变成黑盒记忆。
