# Agent V1.5 全局审查整改提示词

## 基线

- 仓库：`dangjingtao/uichat-mira`
- 审查基线：`test@7b0760592dfc4b85acd4fcfca3c60fff3af37a91`
- 不新增第 9 张任务卡。
- 本整改作为 T08 开工前置清理；完成并复审通过后再进入 T08 正向增强。

## 只处理以下三个阻断

### 1. 删除残留 Shadow Decider 与死状态

删除未接入当前 Graph、但仍被导出的 `routeStepNode` 及其语义判断实现。

同步清理仅服务于该旧节点的状态与输入字段：

- `continueIteration`
- `postToolReviewPending`
- `reviewDecision`
- `reviewReason`

清理这些字段在 Graph state、`AgentNodeState`、`AgentGraphInput`、初始化状态、ToolNode patch、测试、trace、注释和导出中的残留。

不得把旧逻辑改名迁移到 Planner、Evidence、Generate、Read wrapper 或其他节点。

### 2. 收紧 Tool Exposure 单一真相源

运行时唯一可见工具真相必须是 `toolExposure`。

- `toolIntent` 只允许作为诊断、trace 或输出信息，不得参与 Planner、Normalize、Policy 或执行路由。
- 删除 Planner 从 `toolIntent.toolExposure` 重建可见工具的 fallback。
- Policy 不得从 `toolIntent.toolExposure` 读取定义。
- Policy 只审批冻结的 `pendingToolCall`；风险/审批元数据使用冻结调用中的 `toolMeta`。注册存在性检查不得替换 toolId、args、inputHash 或冻结元数据。
- 保持 T02 exposure 算法、fallback、外部 MCP 和安全边界不变。

### 3. 收紧 Evidence 后的事实读取关系

保留 `pendingEvidenceObservation`、`pendingToolExecution`、`pendingRetrievalEvidence` 作为进入 Evidence 的瞬时传输字段，但它们不得成为 Evidence 后 Planner 的平行事实源。

- Evidence 后，Planner 的工具/检索历史与 latest facts/gaps/error 统一从 `evidence` 构造。
- `buildExecutionObservationView` 不再以 `lastToolExecution` 作为与 `evidence.toolExecutions` 平行的 Planner 事实源。
- `getEvidencePayload` 不再以 `state.observations` 作为 accumulated evidence 的运行时 fallback。
- `lastToolExecution` 如因恢复、输出或兼容合同必须保留，应明确为派生/兼容字段，不得与 Evidence 同时向 Planner 表达同一事实。
- `pendingApproval` 仍由 Policy 独立持有；等待审批时不得伪造执行 Evidence。
- 不改变 recoverable / terminal C 合同。

## 必须保持

- `Planner → Normalize → Policy → ToolNode / Retrieve → Evidence → Planner`
- Planner 合法 `nextAction` 不被改写
- Normalize 只校验、规范化并冻结
- Policy 只审批冻结调用
- ToolNode / Retrieve 只产生真实结果
- Evidence 不判断任务完成度或下一步
- `read_discover` / `read_open` 公共面不变
- Generate grounded safety guard 不删除
- 不触碰 CodeGraph、前端或 T30～T33

## 最小验证

1. Graph 中不存在 `routeStepNode`，相关死字段从运行态类型和 patch 消失。
2. 构造互相冲突的 `toolExposure` 与 `toolIntent.toolExposure`，证明 Planner、Normalize、Policy 只服从 `toolExposure` / frozen `pendingToolCall`。
3. Tool 完成与可恢复失败经过 Evidence 后，Planner context 的工具事实来自 `evidence.toolExecutions`。
4. Retrieve 完成经过 Evidence 后，Planner context 来自 `evidence.retrievals`。
5. waiting approval 不进入 ToolNode；terminal failure 不进 Generate；recoverable exhausted 进入 guarded Generate。
6. T01、T05、T06、T07 相关最小合同测试通过。
7. `git diff --check` 通过；typecheck 仅允许记录既有 CodeGraph 基线，不得新增错误。

## 禁止扩大

- 不开始 T08 的 relevant history、goal coverage、prompt 正向增强施工。
- 不新增节点、selector、completion engine、DAG、兼容层或第 9 张任务卡。
