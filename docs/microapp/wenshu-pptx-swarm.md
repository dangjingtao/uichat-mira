# 文枢 PPTX Swarm 映射

Status: Current
Owner: chat / runtime / microapp
Last verified: 2026-07-23
Layer: raw-source
Module: SKILL
Feature: PptxSwarm
Doc Type: current-contract
Canonical: true
Related:
  - ./wenshu-skill-runtime.md
  - ../skill/README.md

## 结论

用户整理的 PPT 包包含两层产品语义：

```text
pptx
  -> 普通 / 短 deck

pptx-swarm
  -> 20+ 页长 deck
  -> 多份 / 批量演示文稿
```

Mira 接入这层业务语义，但不照搬 Nested Agent / Subagent swarm 控制结构。

当前 Mira 不变量：

```text
Parent Agent Loop = 唯一控制循环
```

因此文枢映射为：

```text
Parent Agent
  -> pptx-swarm Skill 业务约束
  -> 先完成视觉方向 / outline / 所有 deck spec
  -> office_presentation
       validate all
       create all
       inspect all
  -> Evidence
  -> Parent Agent
```

## Routing

`server/src/skills/registry.ts` 当前规则：

- 普通 PPT / PPTX / 演示文稿：`pptx`
- 明确 20 页及以上：`pptx-swarm`
- 批量 / 多份 PPT：`pptx-swarm`
- 两者都只使用一个任务级能力：`office_presentation`

## Batch contract

`office_presentation` 支持：

```text
operation=create_batch
presentations=[
  {
    outputPath,
    spec
  }
]
```

硬规则：

1. 所有完整 spec 先存在。
2. 全部 spec 先完成 blocking validation。
3. 任意一个 deck 有 blocking error 时，不进入整批 final create。
4. 全部通过后再 create / inspect 全批次。
5. 不允许 presentation 1 已生成交付时 presentation 2 还没有完整 spec。

## Why not nested agent

`pptx-swarm` 的核心价值是：

- 长任务分段组织
- 全量规格先完成
- 批量统一校验
- 批量统一交付

这些业务不变量不要求第二套 Agent Loop。

把它直接实现成 Nested Agent 会破坏 Mira 当前 Skill 合同：

```text
Skill = 内部状态 + 多工具编排 + 业务语义封装
```

所以当前实现保留业务效果，不复制控制架构。
