---
status: current
owner: project-owner
last_verified: 2026-07-18
layer: wiki
module: Project
feature: EngineeringMemory
doc_type: current-snapshot
canonical: true
related:
  - harness/agentgraph-harness-protocol.md
  - harness/README.md
  - development/agent-observability.md
  - tooling-runtime/tools-protocol.md
  - project-control/project-control-ledger.md
---

# UIChat Mira 工程记忆

> 这页记录当前工程共同记忆：已经成立的主线、不可破坏的合同、当前阶段边界和仍需观察的问题。
>
> 它不是任务台账，也不复制每个模块的全部实现细节。发生冲突时，以链接到的 current-contract、代码和真实验证证据为准。

## 1. 当前阶段

UIChat Mira 当前处于 **Agent V1.5 稳定化阶段**。

优先级是：

- 主线稳定
- 真实前端可用
- 回归预防
- 工具执行可信
- Evidence 驱动回答
- 执行过程与状态可见

当前不主动扩展为：

- Agent V2
- DAG scheduler
- 多 Agent 编排
- 并发工具执行
- 长期记忆系统
- 大规模 Harness 重写
- 大型前端重设计

## 2. 产品与工程定位

UIChat Mira 是本地优先、桌面优先的个人 AI 工作台。

长期方向包括：

- 多 Provider，而不是 OpenAI-only
- Chat、RAG、Agent、MCP、微应用共存
- Harness 作为工具控制平面
- Agent 负责多步决策与任务完成
- 用户始终保留审批、停止、观察与最终合并控制

项目原则：

> 解决真实问题优先于让测试形式上变绿；测试是验证功能的手段，不是工程目标本身。

## 3. Agent Runtime 当前真相

`AgentGraph` 当前代表稳定运行时门面，不等于 LangGraph 本身。

应用默认运行时是 `pi_loop`：

```text
AgentRun
  -> AgentGraph 稳定门面
  -> Pi Loop（应用默认）
  -> Planner
  -> Normalize
  -> Policy
  -> Tool / Retrieve
  -> Evidence
  -> Planner
  -> Generate
  -> Finalize
  -> AgentRun
```

LangGraph 仍保留为：

- 显式兼容运行时
- 测试对照
- 回归比较

它不是应用默认主链。

完整合同见：

- [AgentGraph 与 Harness 当前协议](harness/agentgraph-harness-protocol.md)

## 4. Agent 主线不变量

必须保护：

1. Planner 只输出 `nextAction`。
2. Normalize 只校验并冻结 `nextAction.use_tool`，生成 frozen `pendingToolCall`。
3. Policy 只审批 frozen `pendingToolCall`。
4. Tool 只执行与 Policy 决策一致的 frozen `pendingToolCall`。
5. Tool / Retrieve 不直接写累计 Evidence。
6. Evidence 是累计证据的单一写入者。
7. Tool / Retrieve 完成后必须先进入 Evidence，再回 Planner。
8. `capabilityIntent.selectedToolIds` 不得进入执行链。
9. `selectedToolId` 只保留 UI、trace、diagnostics 与兼容语义。
10. Approval waiting、terminal error、recovery exhausted 状态不得继续执行工具。
11. Generate 必须基于已经进入 Evidence 的真实结果回答。

核心闭环：

```text
Planner
  -> Normalize
  -> Policy
  -> Tool
  -> Evidence
  -> Planner
```

检索闭环：

```text
Planner
  -> Retrieve
  -> Evidence
  -> Planner
```

## 5. Planner 与任务完成

Planner 是 task model 驱动的下一步决策器，不是静态计划表推进器。

它要区分：

- 当前证据是否可以解释某个局部问题
- 当前用户任务是否已经完成

`currentTaskFrame` 用于维护：

- 用户目标
- 已覆盖目标
- 未完成目标
- 当前下一步

Evidence answerable 不等于 task completable。

Pi Loop 没有全局 iteration cap。`maxIterations = 0` 只保留兼容与诊断语义。

仍然存在局部预算：

- schema replan
- recoverable tool failure

## 6. Approval 与恢复

审批授权绑定 exact invocation：

- `toolId`
- `toolCallId`
- `inputHash`

命令、参数、cwd、env、timeout 变化后，必须重新判断。

审批等待时保存 runtime checkpoint，包括：

- `currentTaskFrame`
- observations
- Evidence
- retrieved chunks
- last tool execution
- iteration count
- frozen `pendingToolCall`

Approve 路由快速返回 `running`，后续执行异步恢复；恢复后继续消费原 frozen 调用，不重新根据自然语言猜参数。

## 7. Harness 当前定位

Harness 是：

> Agent 的工具控制平面，不是 Agent 的大脑。

Harness 负责：

- capability / tool registry
- tool exposure
- schema 与 metadata
- risk / approval boundary
- workspace boundary
- invocation
- external MCP projection
- trace / audit
- 结果到 `llmContent` 的统一投影

Harness 不负责：

- 多步任务下一步决策
- 工具参数生成
- 任务完成判断
- 最终自然语言回答

真实执行入口只有 frozen `pendingToolCall`。

## 8. Generate 与 Evidence

Harness 成功结果会投影为模型可消费的 `llmContent`。

Generate 当前：

- 只消费 completed executions
- 优先使用真实 `llmContent`
- 有总字符预算 `48_000`
- 明确标记 truncated
- 超预算只截断上下文，不终止工具进程
- 要求回答只依据已展示事实

因此不能再传播“Generate 只看摘要”或“无边界拼接全部工具结果”的旧说法。

## 9. CodeGraph 当前受控合同

CodeGraph 的产品入口保持单一：

- Planner 只看见 `codebase_explore`
- 原生 `query / explore / affected` 留在 wrapper 内部
- CodeGraph 返回的是候选，不是最终 Evidence
- 候选默认要求原文验证
- 进入 Evidence 前必须经过 `read_file_slice` 或等价原文读取

降级链：

```text
CodeGraph
  -> scoped search_text
  -> workspace_inventory
  -> read_file_slice
```

需要保护：

- CodeGraph 失败不能直接回答“没有”
- broad explore 结果不能裸传 Planner
- telemetry 默认关闭
- 索引不能默认污染用户仓库
- capability id 不能穿透为真实 invocation tool id

CodeGraph 是代码理解加速器，不是第二个 Planner。

## 10. Terminal Runtime 当前真相

`terminal_session` 是稳定能力合同，不拆成 Python、Node、Git、PowerShell 等多个工具。

当前默认 Runtime：

- `host_spawn`
- 完整 Shell
- Python / Node / Git / package manager
- pipeline 与 shell-native syntax
- persistent PTY
- `attachSessionId`
- watcher / dev server / REPL / 长进程
- Windows Job Object
- Job Object 不可用时 `taskkill /t /f`
- POSIX process group

工作目录原则：

- 默认 `cwd = workspace`
- workspace 是施工现场，不是监狱
- 越界优先记录与审批
- 不靠路径拦截破坏 Runtime 能力

旧 command sandbox 已退出 `terminal_session` 主执行链。

`sandbox_runtime` 只保留为未来可选 Provider，用于环境隔离、快照、回滚和依赖隔离；当前未实现，也不会偷偷退回旧 sandbox executor。

## 11. 前端执行轨迹与可见 OS

前端显示的“内心 OS”来自 Planner JSON 中公开的 `reason` 字段。

它不是：

- 隐藏 chain of thought
- 原始完整模型输出
- 未脱敏 prompt

产品行为合同：

- Planner 决策期间展示公开 reason
- 回答组织完成后，OS 区域消失
- 执行链按真实语义顺序展示
- 重复语义节点必须依靠 `attemptKey` 保留每次执行
- approval / resume 使用 `toolCallId` 对齐
- 页面最终状态应服从 AgentRun 的 running / waiting / completed / failed 状态，不能被历史审批节点反向覆盖

完整排查方法见：

- [Agent Observability](development/agent-observability.md)

## 12. 失败合同

Recoverable failure：

- Tool execution 记录 failed
- 失败事实进入 Evidence
- 回 Planner 尝试恢复
- 恢复耗尽后 Generate guarded answer
- Graph status 为 completed
- Chat finish reason 为 stop

Terminal failure：

- Graph status 为 failed
- finish reason 为 error
- Generate 不执行

工具自身拒绝输入，例如 URL scheme 不支持，属于工具层能力边界；是否恢复由 Evidence 和 Planner 决定，不应被误判成审批仍在等待。

## 13. 当前工程控制原则

Codex 可以并行施工。

评审可以按任务拆开。

但必须保持：

- merge control 集中
- task scope 独立
- 不顺手优化宇宙
- 不让单个施工线程改写主线合同
- 不用旧任务卡覆盖 current-contract
- 不用 AI 线程记忆替代仓库真相

阅读优先级：

```text
current-contract
  > current overview / runbook
  > implementation plan / task card
  > historical design
```

## 14. 当前仍需观察

以下不是架构重做理由，只是继续稳定化时要盯住：

- 前端最终 lifecycle 状态是否还会被历史 approval trace 污染
- Planner reason 流式展示是否在长 JSON / 大上下文下被截断
- HTML 等高噪声输入是否导致工具反复切换
- recoverable tool failure 是否总能回 Planner，而不是过早 terminal stop
- Windows 实机 PTY / Job Object / 长进程 smoke
- CodeGraph 真实 provider 的原文验证与 fallback 质量
- 文档站 generated index 是否随最新 docs 重新生成

## 15. 当前单点真相入口

先读：

1. [AgentGraph 与 Harness 当前协议](harness/agentgraph-harness-protocol.md)
2. [Harness 模块](harness/README.md)
3. [Agent Observability](development/agent-observability.md)
4. [Tools Protocol](tooling-runtime/tools-protocol.md)
5. [Project Control Ledger](project-control/project-control-ledger.md)

历史设计、旧 Workboard 和旧任务卡只能解释演进，不能覆盖以上当前合同。
