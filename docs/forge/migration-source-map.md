# Forge Migration Source Map

Status: Current  
Owner: forge / architecture  
Last verified: 2026-09-05  
Source: `dangjingtao/mira-forge@6557b9ff552c4be3d3d1be2da0b24bb6d1344ed0`  
Target: `dangjingtao/uichat-mira` `dev`

## Baseline Note

T001 派卡时总台账记录的目标观察点是 `uichat-mira dev@27be0eb`。

T001 实际施工前重新读取当前 `dev`，HEAD 已为 `684ea0d9e68fca9e5f4fcd9d302d3396a4c6131e`，并且已经存在 `desktop/src/features/forge/**` UI 壳。

因此：

- Forge **源基线继续固定**为 `6557b9f`；
- Mira `dev` 是移动目标分支；
- 当前 UI 壳作为 target fact 记录，不作为 T009 完成证据；
- 后续施工不得回退到旧 target SHA，也不得用移动中的 `mira-forge dev` 替代固定源 SHA。

## Migration Rules

迁移不是整仓复制。

每个源文件只能得到三类结论之一：

- **PORT**：保留行为合同，迁入 Mira 对应 domain；
- **REFERENCE**：只作为合同/测试/交互证据，不直接复制；
- **DO NOT MIGRATE**：旧独立产品外壳在 Mira 中终止。

## Root / Build Shell

| Source | Decision | Target / Reason |
| --- | --- | --- |
| `package.json` | DO NOT MIGRATE | 不建立 Forge 独立 package；需要的依赖由 Mira Server/Desktop 各自现有 package 管理 |
| `package-lock.json` | DO NOT MIGRATE | 不迁移第二 lockfile |
| `pnpm-lock.yaml` | DO NOT MIGRATE | 不迁移第二 lockfile；Mira lockfile 不手工编辑 |
| `pnpm-workspace.yaml` | DO NOT MIGRATE | 使用 Mira 现有 pnpm workspace |
| `vite.config.ts` | DO NOT MIGRATE | 不保留 Forge 独立 Vite 应用 |
| `index.html` | DO NOT MIGRATE | 使用 Mira Desktop renderer 入口 |
| `tsconfig.json` | REFERENCE | TypeScript 语义按 Mira Server/Desktop 当前配置重新落地，不建立独立 tsconfig 根工程 |
| root `README.md` / `AGENTS.md` | REFERENCE | 当前合同提炼到 `docs/forge/**`；Mira 全局规则仍由目标仓 `AGENTS.md` 管理 |

## Server Core

| Source | Decision | Mira Target |
| --- | --- | --- |
| `server/domain.mjs`, `domain.test.mjs` | PORT | `server/src/forge/domain/**` + focused tests |
| `server/dispatch-domain.mjs` | PORT | `server/src/forge/dispatch/**` |
| `server/dispatch-manager.mjs` | PORT | `server/src/forge/dispatch/**` / runtime supervision |
| `server/dispatch-manager.test.mjs`, `dispatch-serial.test.mjs`, `builder-dispatch.test.mjs` | PORT TEST SEMANTICS | `server/src/forge/dispatch/**/*.test.ts` |
| `server/builder-contract.mjs` | PORT | `server/src/forge/adapters/builder/**` or shared Forge contract |
| `server/opencode-adapter.mjs`, `piagent-adapter.mjs`, `codex-builder-adapter.mjs` | PORT | `server/src/forge/adapters/builder/**` |
| matching Builder adapter tests | PORT TEST SEMANTICS | target adapter `*.test.ts` |
| `server/readiness.mjs`, `readiness.test.mjs` | PORT | `server/src/forge/dispatch/**` / readiness tests |
| `server/project-task-actions.mjs`, test | PORT | `server/src/forge/project/**` / `task-source/**` |
| `server/repo-task-source.mjs`, test | PORT | `server/src/forge/task-source/**` |
| `server/main-thread-domain.mjs`, test | PORT | `server/src/forge/main-thread/**` |
| `server/main-thread-manager.mjs`, test | PORT | `server/src/forge/main-thread/**` |
| `server/main-thread-adapters.mjs`, test | PORT | `server/src/forge/adapters/main-thread/**` |
| `server/codex-desktop-adapter.mjs`, test | PORT | `server/src/forge/adapters/main-thread/**` |
| `server/t018-main-thread-result-context.test.mjs` | PORT TEST SEMANTICS | Main Thread / Builder Result Handoff regression tests |
| `server/store.mjs`, `store.test.mjs` | PORT BEHAVIOR, NOT PATH | `server/src/forge/runtime/**`; preserve atomic/serialized mutation semantics, but persistence path/lifecycle must be Mira-owned |
| `server/acceptance.mjs`, `acceptance.test.mjs` | REFERENCE / PORT TEST SEMANTICS | Forge integration acceptance tests; do not preserve old standalone server assumptions |
| `server/index.mjs` | DO NOT MIGRATE AS BOOTSTRAP | route/domain behavior is re-expressed under `server/src/forge/routes/**` and registered from Mira `server/src/index.ts`; no second HTTP server |

## Legacy Web / Renderer

| Source | Decision | Mira Target |
| --- | --- | --- |
| `src/App.tsx` | REFERENCE / PORT PRODUCT SEMANTICS | `desktop/src/features/forge/**`; do not copy old app shell |
| `src/MainThreadPanel.tsx` | REFERENCE / PORT INTERACTION | Mira Forge Main Thread surface |
| `src/FirstRunCheck.tsx` | REFERENCE | only retain machine-check behavior if still required by integrated product; not a separate app surface |
| `src/ShortcutFeedback.tsx` | REFERENCE | keyboard affordance may be reimplemented through Mira shared UI |
| `src/main-thread-focus.ts` | PORT IF STILL NEEDED | Forge Desktop local interaction helper |
| `src/main.tsx` | DO NOT MIGRATE | Mira renderer already owns bootstrap |
| `src/workbench/**` | REFERENCE / PORT PRODUCT SEMANTICS | `desktop/src/features/forge/**`; runtime summary/inspector/event log/task context reimplemented against typed Mira API |
| `src/workbench/live-runtime-model.js` + `.d.ts` | PORT BEHAVIOR | typed projection/model under Forge Desktop feature/API contract |
| `src/styles/**` | DO NOT COPY AS DESIGN SYSTEM | interaction/state semantics may be referenced; visual implementation must use Mira tokens/shared UI |
| old Web/Vite shell | DO NOT MIGRATE | no iframe, no second frontend project |

当前 target `dev` 已有 `desktop/src/features/forge/**`。后续 T009 应在这一目标目录上按 OpenDesign + Mira UI contract 收口，而不是把旧 `src/**` 整体覆盖进去。

## Source Documentation

| Source | Decision | Target |
| --- | --- | --- |
| `docs/architecture.md` | REFERENCE | `docs/forge/FORGE_CURRENT_CONTRACT.md` + Mira architecture docs |
| `docs/task-source-contract.md` | PORT CONTRACT | 保留 repository truth / runtime truth、路径边界、identity、显式写入等规范到 Forge current docs / implementation tests |
| `docs/tui-interaction.md` | REFERENCE | keyboard-first / focus behavior输入，不保留独立 TUI app |
| `docs/frontend-style-contract.md` | HISTORICAL UI REFERENCE | Mira Desktop design system 优先 |
| `docs/user-guide.zh-CN.md` | REFERENCE | 产品语义来源；后续在 Mira 文档体系重写 |
| `docs/v1-status.md` | HISTORICAL SNAPSHOT | 不作为当前状态真相 |
| `docs/v2-plan.md` | HISTORICAL / NON-NORMATIVE | 不作为迁移施工真相 |
| `docs/workbench/00-work-ledger.md` | SOURCE STATUS EVIDENCE | T015-T018 当前状态来源之一 |
| `docs/workbench/01-second-wave.md`, `02-third-wave.md` | HISTORICAL EXECUTION EVIDENCE | 仅用于理解已验证路径 |
| `docs/workbench/tasks/T001-T018*.md` | REFERENCE | 当前迁移重点读取 T015-T018；早期卡用于行为来源追踪，不直接复制成 Mira 项目卡 |

## Scripts / Smoke / Test Support

| Source | Decision | Target |
| --- | --- | --- |
| `scripts/dev.mjs` | DO NOT MIGRATE | 使用 Mira 根工程 dev startup |
| `scripts/fake-opencode.mjs` | PORT TEST SUPPORT IF NEEDED | Forge test-support，不能进入生产 fallback |
| `scripts/builder-adapter-smoke.mjs` | REFERENCE / PORT TEST | integrated Forge provider diagnostic |
| `scripts/dispatch-smoke.mjs` | PORT TEST SEMANTICS | Forge dispatch integration test |
| `scripts/readiness-smoke.mjs` | PORT TEST SEMANTICS | Forge readiness integration test |
| `scripts/smoke.mjs` | REFERENCE / REBUILD | T010 integrated product-loop smoke，不保留 standalone control-plane assumptions |
| `scripts/frontend-style-contract.test.mjs` | DO NOT PORT AS OLD STYLE CONTRACT | T009 使用 Mira shared UI / design guidelines 验证 |
| `scripts/live-runtime-model.test.mjs` | PORT TEST SEMANTICS | Forge Desktop runtime projection regression |

## Test Migration Rule

源仓所有 `server/*.test.mjs` 的**行为语义**必须被覆盖，但测试框架和文件布局不要求原样复制。

迁移测试至少继续保护：

- state transition guards；
- Repository Task Truth / Runtime Truth 分离；
- Task Source unique identity / realpath boundary；
- dispatch readiness；
- global serial Builder safety；
- provider adapter normalization；
- cancellation / failure / restart interruption；
- exact provider thread resume；
- SHA-bound review invalidation；
- Builder success -> `reviewing` only；
- builder_result identity + idempotency；
- next Main Thread turn consumes bounded new result context once；
- no duplicate handoff on polling/refresh；
- no auto dispatch / push / merge / deploy。

## Task-by-Task Destination

| Mira Task | Main Migration Slice |
| --- | --- |
| T001 | current contract + source map |
| T002 | domain/core import + dependency unification |
| T003 | runtime lifecycle + persistence ownership |
| T004 | project registry + repository Task Source |
| T005 | Main Thread + provider adapters |
| T006 | Builder dispatch + process supervision |
| T007 | Review guards + Builder Result Handoff |
| T008 | Mira Server routes + Desktop typed API |
| T009 | OpenDesign-driven Mira Desktop product surface |
| T010 | integrated product-loop smoke + standalone Forge retirement |

## Explicitly Not Migrated

迁移完成后不得继续依赖：

```text
mira-forge/package.json
mira-forge/package-lock.json
mira-forge/pnpm-lock.yaml
mira-forge/pnpm-workspace.yaml
mira-forge/vite.config.ts
mira-forge/index.html
mira-forge/src/main.tsx
mira-forge/scripts/dev.mjs
mira-forge/server/index.mjs as a standalone server
127.0.0.1:47831 as a second product control plane
~/.mira-forge/state.json as an independently-owned live truth source
```

如果后续任务需要其中任一项继续作为运行时必需条件，应停止并报告，这意味着迁移边界已经被破坏。
