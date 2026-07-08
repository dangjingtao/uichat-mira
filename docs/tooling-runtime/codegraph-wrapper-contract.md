---
status: current
owner: docs
last_verified: 2026-07-08
layer: wiki
module: Tool
feature: CodeGraphWrapperContract
doc_type: current-contract
canonical: true
related:
  - README.md
  - codebase-engine-abstraction.md
  - codegraph-managed-mcp-spike.md
  - tools-protocol.md
  - harness-runtime-design.md
  - ../project-control/tasks/code_T007-codegraph-wrapper-contract.md
  - ../project-control/project-control-ledger.md
---

# CodeGraph Wrapper Contract

## Purpose

这页定义 CodeGraph 在进入 UIChat Mira runtime 前必须满足的包装合同。

当前结论很明确：

- 第一阶段 Planner 只看到一个能力名：`codebase_explore`
- CodeGraph 原生命令 `query` / `explore` / `affected` 只能留在 wrapper 内部
- `codebase_explore` 是探索工具，不是 Evidence 工具，不直接生成答案
- 本页是 docs-only 合同，不代表已经接入 runtime

这页解决的不是“CodeGraph 能不能查到东西”，而是“查到以后怎样受控进入 Agent 主链，怎样避免把图谱噪声直接塞给 Planner 或 Evidence”。

## Scope

wrapper 必须先把问题限制在显式 scope 内，再决定如何调用 CodeGraph。

第一阶段只允许以下 scope 名：

- `agent-runtime`
- `harness-mcp`
- `desktop-ui`
- `microapps`
- `docs`
- `workspace-general`

### Scope Include Paths

| Scope | Include Paths |
| --- | --- |
| `agent-runtime` | `server/src/agent/**` |
| `harness-mcp` | `server/src/mcp/**`, `server/src/harness/**` |
| `desktop-ui` | `desktop/src/**`, `electron/**` |
| `microapps` | `server/src/microapps/**`, `server/src/routes/microapps/**`, `desktop/src/features/Settings/pages/MicroApps/**`, `docs/microapp/**` |
| `docs` | `docs/**`, `README.md`, `AGENTS.md` |
| `workspace-general` | 仓库根下当前任务相关源码与文档路径；默认可覆盖 `server/**`, `desktop/**`, `electron/**`, `packages/**`, `docs/**`, `scripts/**`, `runtime.config.cjs`, `README.md`，但仍受默认 exclude 约束 |

说明：

- `workspace-general` 不是“全仓无限制乱查”，而是给跨层问题保留一个受控的大范围入口。
- 如果问题已经能落在更具体的 scope，wrapper 应优先使用更窄的 scope。
- include path 是路径白名单，不是结果真实性保证。结果进入 Evidence 前仍必须核验原文。

## Default Exclude Paths

所有 scope 默认都要附带以下 exclude paths：

- `node_modules/**`
- `.git/**`
- `dist/**`
- `build/**`
- `coverage/**`
- `release/**`
- `.artifacts/**`
- `.test-artifact/**`

如果后续还有额外排除规则，也必须由 workspace policy 明确登记，不能靠 Planner 猜。

## Planner Exposure Rule

第一阶段 Planner 只允许规划：

- `codebase_explore`

第一阶段 Planner 不允许直接规划：

- `codegraph.query`
- `codegraph.explore`
- `codegraph.affected`
- 任何其他 CodeGraph 原生命令名

原因：

- Planner 需要能力级稳定面，不需要供应商命令级细节。
- 原生命令暴露给 Planner 后，scope、裁剪、降级、核验门槛就会失控。
- wrapper 负责把不同查询意图映射到 CodeGraph 内部命令，不把内部实现细节泄漏给上层。

## Wrapper Responsibility

`codebase_explore` wrapper 至少负责五件事：

1. 把 Planner 的自然语言探索意图映射到受控 scope。
2. 自动补齐 include / exclude path 约束。
3. 在内部选择 `query` / `explore` / `affected` 等原生命令。
4. 对返回结果做裁剪、去重、噪声抑制和限制说明。
5. 输出统一合同 `CodebaseExploreResult`，而不是把 CodeGraph 原始响应裸交给 Planner。

换句话说，CodeGraph 是底层引擎候选，`codebase_explore` 才是第一阶段对 Agent 暴露的正式能力。

## Query Path Scope Rule

wrapper 在执行 CodeGraph `query` 时，必须自动附加 path scope。

规则：

1. 如果 Planner 或上层显式给了合法 scope，wrapper 用该 scope 的 include paths 生成 path 过滤条件。
2. 如果上层没给 scope，但问题明显指向某一层，例如 `Planner`、`ToolNode`、`desktop settings page`，wrapper 必须先归类到最窄 scope，再发起查询。
3. 如果问题跨多个已知层，例如“桌面入口如何调用 microapp backend”，wrapper 可以组合多个 scope，但必须把组合结果记录在 `limitations` 或 summary 里。
4. 只有在无法稳定归类到具体层时，才允许退到 `workspace-general`。
5. 即使使用 `workspace-general`，也仍然必须带默认 exclude paths。

禁止行为：

- 不带 path scope 直接跑全仓 `query`
- 明知问题属于窄 scope，却直接用 `workspace-general`
- 让 Planner 自己拼 CodeGraph path 参数

## Broad Explore Noise Control

broad explore 必须做噪声压制，不能把一大批模糊候选裸交给 Planner。

最低规则：

1. broad explore 先按 scope 收窄，再按文件类型、符号密度、命中摘要质量排序。
2. 同一文件的相邻或重复命中要合并，避免把一个文件拆成十几个碎片刷屏。
3. 明显属于 generated、构建产物、缓存、vendor 的命中必须丢弃。
4. 没有 line range 的命中默认降级为低优先线索，不进入高置信候选前列。
5. 如果 broad explore 命中数远超裁剪上限，wrapper 应返回“结果已裁剪，需要 follow-up read / scoped search”，而不是假装列表完整。

## Result Trimming Limits

`codebase_explore` 的统一裁剪上限如下：

- `maxFiles: 8`
- `maxSnippets: 12`
- `maxSnippetLines: 24`
- `maxTotalLines: 160`
- `maxRawChars: 16000`

这些限制用于控制：

- Planner 上下文体积
- broad explore 噪声
- 原始引擎输出直接淹没后续读原文步骤

如果实际结果超限，wrapper 必须：

- 优先保留高相关、高置信、带 line range 的候选
- 明确标注结果已裁剪
- 给出下一步建议，例如 `read_file_slice`、`scoped search_text` 或更窄 scope 重查

## Unified Return Contract

wrapper 对外统一返回：

- `CodebaseExploreResult`

`CodebaseExploreResult` 至少包含：

| Field | Meaning |
| --- | --- |
| `scope` | 本次探索实际使用的 scope 或 scope 组合 |
| `query` | 归一化后的探索问题 |
| `engine` | 当前实际使用的引擎，例如 `codegraph` |
| `candidates` | 裁剪后的 `CodebaseCandidate[]` |
| `truncated` | 是否因为上限而裁剪 |
| `degraded` | 是否触发降级链 |
| `followUpHints` | 建议后续读原文或缩小范围的提示 |
| `limitations` | 本次结果的明确缺口、歧义、索引问题、路径覆盖边界 |

## CodebaseCandidate Contract

每个 `CodebaseCandidate` 必须至少包含：

- `path`
- `startLine`
- `endLine`
- `kind`
- `summary`
- `confidence`
- `source.engine`
- `source.command`
- `verification.required`
- `verification.status`
- `limitations`

建议语义如下：

| Field | Meaning |
| --- | --- |
| `path` | 候选命中的仓库相对路径 |
| `startLine` | 候选原文起始行 |
| `endLine` | 候选原文结束行 |
| `kind` | 命中类型，例如 `symbol-definition`、`reference`、`impact-edge`、`text-hit` |
| `summary` | wrapper 压缩后的最小必要摘要 |
| `confidence` | 归一化置信度 |
| `source.engine` | 当前候选来自哪个引擎，第一阶段通常是 `codegraph` |
| `source.command` | wrapper 内部实际使用的原生命令，例如 `query`、`explore`、`affected` |
| `verification.required` | 是否必须做原文核验 |
| `verification.status` | `pending`、`verified`、`rejected`、`unverifiable` 等状态；CodeGraph 初始返回统一从 `pending` 开始 |
| `limitations` | 候选级别的局限，例如索引旧、摘要含糊、范围过宽、缺少上下文 |

## Verification Gate

所有 CodeGraph candidate 默认都必须满足：

- `verification.required = true`
- `verification.status = pending`

这是默认值，不允许因为“看起来很像答案”就跳过。

进入 Evidence 前必须执行：

- `read_file_slice`
- 或等价的原文读取与行号核验能力

没有完成原文核验时：

- candidate 只能留在探索阶段
- 不能直接生成结论
- 不能作为“仓库里没有 / 已经实现 / 一定会影响”的最终判断依据

## Evidence Boundary

`codebase_explore` 的职责是给出“建议去哪里看”的候选上下文。

它明确不是：

- Evidence 工具
- answer 工具
- final answer 生成器

因此：

1. `codebase_explore` 不直接生成答案。
2. candidate 进入 Evidence 前必须做原文核验。
3. 核验失败、缺 line range、路径不可回读的候选，只能标记为 rejected 或 unverifiable。

## Failure Degradation Chain

wrapper 必须有统一失败降级链：

1. `CodeGraph`
2. scoped `search_text`
3. `workspace_inventory`
4. `read_file_slice`

解释：

- 先尝试结构化图谱结果。
- 图谱不可用、结果太噪或找不到稳定 line range 时，退到 scoped `search_text`。
- 如果连 scoped 文本搜索都不足以定位入口，再用 `workspace_inventory` 辅助确认目录和候选文件面。
- 最后用 `read_file_slice` 对候选原文做最小必要核验。

这里的降级意思是“继续探索”，不是“自动判定仓库没有”。

## Prohibitions

以下行为明确禁止：

1. CodeGraph 没查到就直接回答“没有”。
2. CodeGraph 结果无 line range 直接进入 Evidence。
3. broad explore 结果裸交给 Planner。
4. Planner 直接调用 CodeGraph 原生命令。

这些禁止项的共同原因是：它们会把底层引擎的不确定性伪装成上层结论，直接破坏 Evidence 边界。

## Docs-Only Boundary

本任务和本合同当前都属于 docs-only。

当前不做：

- runtime 接入
- Planner 改造
- ToolNode 改造
- Evidence 接线
- CodeGraph 安装、启动、进程托管代码

后续如果要把这份合同变成实现任务，必须另开 runtime 任务卡，并重新评估影响面。
