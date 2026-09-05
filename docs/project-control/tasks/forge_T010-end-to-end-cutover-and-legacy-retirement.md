---
status: current
priority: P0
owner: forge / integration
last_verified: 2026-09-05
layer: project-control
module: Forge
feature: CutoverAcceptance
doc_type: task-card
canonical: true
related:
  - docs/project-control/tasks/forge_T009-desktop-cuixing-product-surface.md
task_state: TODO
---

# forge_T010 End-to-End Cutover and Legacy Retirement

## Target

完成淬行在 Mira 内的真实产品闭环验收，并切断对独立 `mira-forge` 工程、端口、依赖和前端构建的运行时依赖。

这是迁移收口卡，不负责补做前面漏掉的大功能。

## Must Read

- `AGENTS.md`
- `docs/forge/FORGE_CURRENT_CONTRACT.md`
- forge_T001-T009 及其 Evidence
- Mira packaging / runtime docs
- 源 Forge T018 当前验收要求

## Allowed Changes

- Forge 迁移后模块的验收修正（仅真实 integration defect）
- Forge / Mira 集成 smoke tests
- packaging / runtime config 中仅 Forge 必需改动
- `docs/forge/**`
- `docs/CURRENT_PRODUCT_TRUTH.md`
- `docs/ENGINEERING_MEMORY.md`
- 本任务卡 / 总台账状态与证据

## Forbidden Changes

- 为通过 smoke 引入 hardcoded 本地路径
- 临时 mock / silent fallback 进入生产主链
- 自动 Reviewer / parallel Builder / worktree scheduler
- 自动 Push / Merge / Deploy
- 把未观察到的真实产品链写成 PASS
- 因迁移失败重新恢复独立 Forge server 作为兜底

## Required Product Smoke

至少一条真实链：

```text
Register / select real project
  -> Main Thread reads real task source
  -> resolve exact Task Card
  -> explicit Dispatch
  -> real Builder starts
  -> Runtime Summary / Inspector shows authoritative state
  -> Builder terminal
  -> runtime task becomes reviewing
  -> related Main Thread receives one builder_result
  -> next Main Thread turn uses the result
```

同时验证：

- cancel / interrupted 可观察；
- refresh / Mira Server restart 后 durable state 可重建；
- no second Forge HTTP server；
- no Forge standalone dependency install；
- packaged Desktop 能找到并使用同一 Forge runtime。

## Legacy Retirement

迁移验收通过后：

- `uichat-mira` 成为 Forge 唯一 active source of truth；
- 独立 `mira-forge` 不再参与 build / release / runtime / active development；
- 旧仓如需保留，只能作为 historical / archived reference，并明确指向 Mira 新位置；
- 是否物理删除旧 GitHub repository 不由施工线程擅自执行。

## Acceptance Criteria

1. 上述真实 Builder product-loop 有可检查 evidence。
2. `pnpm check` 通过。
3. 涉及 packaging/runtime 的目标平台 package build 通过。
4. 未出现第二 lockfile / workspace / Forge package。
5. 未出现 `:47831` 运行时依赖。
6. T018 对应真实链路能力在 Mira 中重新验收，不继承旧仓未完成结论。
7. current truth / engineering memory 已更新到淬行合并后的真实状态。

## Validation

- focused Forge tests
- server + desktop typecheck
- `pnpm check`
- packaging build（按当前目标平台）
- real product-loop smoke
- `git diff --check`

## Unknown / Human Decision

旧 `mira-forge` GitHub repository 最终选择 Archive 还是 Delete 属于 owner 仓库治理动作；本卡只要求其退出 active product source-of-truth。
