---
status: current
priority: P0
owner: forge / server
last_verified: 2026-09-05
layer: project-control
module: Forge
feature: ProjectTaskSource
doc_type: task-card
canonical: true
related:
  - docs/project-control/tasks/forge_T003-runtime-lifecycle-and-persistence-ownership.md
task_state: DOING
---

# forge_T004 Project Registry and Repository Task Source

## Target

迁移并接通 Forge Project Registry 与 Repository-native Task Source，使淬行能够绑定真实本地仓库、读取 Ledger / Task Card，并在显式动作下创建或更新 Task Card。

## Must Read

- `AGENTS.md`
- `docs/forge/FORGE_CURRENT_CONTRACT.md`
- 源 Forge `docs/task-source-contract.md`
- 源 Forge `server/repo-task-source.mjs`
- 源 Forge `server/project-task-actions.mjs`
- Mira 当前 project-control task card / ledger 规范

## Allowed Changes

- `server/src/forge/project/**`
- `server/src/forge/task-source/**`
- `server/src/forge/**` 中直接相关共享 types / tests
- `docs/forge/**`（仅 Task Source current contract）
- 本任务卡状态 / 证据

## Forbidden Changes

- 建立第二套 Task Card 数据库
- 把任务正文复制进 Forge runtime persistence
- 自动修复 Ledger / Card drift
- 从任意 prose 猜依赖、状态或 Task ID
- 允许 taskLedger / taskDir 逃逸 registered project root
- 改 Mira 项目台账格式来迁就 Forge

## Required Behavior

保留并验证：

- Ledger 至少 `ID | Task | Status`
- Task ID 唯一
- 每个任务恰好匹配一张 Task Card
- realpath / workspace boundary
- 中文旧卡 `状态：` 等已接受兼容读取
- read side-effect free
- create/update 显式写入
- ledger/card 写入失败时不留下半成功状态
- drift 只 warning，不静默“修好”

## Construction Evidence

- Base: `dev@1741d5711867eada53bcb93f9b7a5db03904cc13`.
- 新增 `server/src/forge/task-source/**`：repository-native Markdown ledger/card inspect / resolve / explicit create / explicit update。
- 新增 `server/src/forge/project/**`：真实本地 root 注册、integration branch / task source 显式配置、project-level inspect / resolve / create / update / runtime batch binding。
- 没有引入旧 Forge `docs/workbench/**` 默认路径。目标项目未配置 task source 时明确失败；不把历史默认静默变成 Mira 新合同。
- 没有扩展 parser 去猜 Mira 自身 `project-control` frontmatter 语义，也没有修改 Mira 项目总台账格式。
- inspect 会验证 Ledger `ID | Task | Status`、全局 Task ID 唯一、每个 ledger task 恰好一张 card、heading identity、Status / 中文 `状态：` 兼容、realpath 边界。
- drift 仅形成 warning，不在读取时回写。
- create/update 仅在显式调用时写 repository；writer 保留原 Forge 的 card/ledger 双写回滚语义，并增加失败注入测试证明 ledger 写失败后 card 不留半成功状态。
- Runtime 仅保存 Project / Batch / Task identity 与执行状态；定向测试用正文 marker 验证 Task Card body 不进入 Forge runtime persistence。
- 未新增 route、Desktop、Main Thread provider、Builder provider、Reviewer、自动 dispatch / push / merge / deploy。

## Acceptance Criteria

1. 可注册真实本地项目并配置 integration branch / task source。
2. 可 inspect、resolve、create、update repository task。
3. 错 root、缺卡、重复卡、路径逃逸都明确失败。
4. Forge runtime 只保存 task reference / execution binding。
5. 项目自己的 Task Card 仍是需求 / 产品状态真相。

## Validation

- 临时仓库 Task Source fixture
- wrong-root / duplicate / escape / localized-card tests
- server typecheck
- `git diff --check`

## Unknown / Human Decision

None.
