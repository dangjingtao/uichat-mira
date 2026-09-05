---
status: current
priority: P0
owner: forge / server
last_verified: 2026-09-05
layer: project-control
module: Forge
feature: RuntimeLifecycle
doc_type: task-card
canonical: true
related:
  - docs/project-control/tasks/forge_T002-core-import-and-dependency-unification.md
task_state: TODO
---

# forge_T003 Forge Runtime Lifecycle and Persistence Ownership

## Target

让 Forge 成为 Mira Server 内部受管理 runtime，而不是 `127.0.0.1:47831` 上的第二个独立 control-plane 进程。

同时收口 Forge durable state 的所有权：保留旧 state schema 的行为语义和原子/串行 mutation 保障，但新运行态必须由 Mira 管理其存储生命周期。

## Must Read

- `AGENTS.md`
- `docs/architecture/README.md`
- `docs/forge/FORGE_CURRENT_CONTRACT.md`
- `server/src/index.ts`
- `server/src/db/index.ts`
- 源 Forge `server/store.mjs`、`server/index.mjs`、dispatch/main-thread reconcile 逻辑

## Allowed Changes

- `server/src/forge/**`
- `server/src/index.ts`（仅 Forge 初始化 / shutdown 接线）
- `server/src/config/**` 或现有配置入口（仅 Forge 必需项）
- 相关 server 测试
- 本任务卡状态 / 证据

## Forbidden Changes

- 新开 Forge HTTP server / 固定端口
- 新增 sidecar / child process 来承载 Forge Core
- 使用进程 cwd 作为未经验证的持久数据目录
- 把完整 Repository Task Card 正文复制进 Forge runtime state
- 在本卡强制重写成全新 SQLite schema，除非当前 Mira 已有明确可复用持久化合同且行为等价可证明
- 改 Desktop UI

## Required Behavior

- Mira Server 启动时创建唯一 Forge runtime。
- Mira Server 正常 shutdown 时显式关闭 Forge managers / provider-owned resources。
- 启动 reconcile 必须把丢失 supervision 的 active dispatch / main-thread turn 标成 interrupted/error，而不是假装继续运行。
- 新安装不再依赖独立 Forge server 或独立 dependency install。
- 若支持旧 `~/.mira-forge/state.json` 导入，只允许一次性、可观察、可失败的迁移；不得静默双写两个真相源。

## Acceptance Criteria

1. Forge Runtime 生命周期由 Mira Server 拥有。
2. 无 `:47831` 第二服务依赖。
3. durable state 在刷新 / server restart 后可恢复非活动事实。
4. active process supervision 丢失时能可靠 reconcile。
5. shutdown 不遗留 Forge 自己启动的 provider 子进程。
6. persistence 路径与所有权有文档和测试，不产生第二套业务真相。

## Validation

- runtime lifecycle / reconcile 定向测试
- persistence reopen 测试
- server typecheck
- `pnpm check`（若修改 server bootstrap）
- `git diff --check`

## Unknown / Human Decision

如果 Mira 当前不存在稳定、用户可写的 backend data-root 抽象，停止在路径决策点并报告；不得自行把 `process.cwd()` 当长期用户数据目录。
