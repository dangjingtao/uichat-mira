# Agent Phase 1 Global Review

本文档用于沉淀一期智能体代码评审的全局结论。

- 原始逐段评审记录保留在 [agent-phase-1-code-review.md](D:/workspace/rag-demo/docs/chat/agent-phase-1-code-review.md)。
- 本文档不重复逐函数细节，而是给出总评、问题分层和整改优先级。

## Overall Assessment

当前 Agent Graph 的方向是对的，主链路已经成形：

```txt
prepareContext
-> plan
-> capabilityIntent
-> policy
-> tool / retrieve
-> routeStep
-> generate
-> evaluate
-> output
```

问题不在 LangGraph 这类流程图本身，而在底层约束还没有收口。

更准确地说：

```txt
不是流程图本身要推翻，
而是 capability/tool 分层、审批粒度、执行契约这些底层约束需要重构。
```

当前系统已经具备 Agent Runtime 骨架，但还不是一个安全、稳定、可扩展的完全体。

一句话总评：

```txt
编排方向是对的，但领域模型分层和安全边界还没有收口。
```

## Problem Groups

### 1. 安全边界

当前最高风险点不是“有没有工具”，而是“高风险动作由谁来承接、谁来兜底”。

最典型的问题是 `terminal_session`：

```txt
用户自然语言
-> Agent 提取 target
-> Agent 拼 shell command
-> policy 工具级审批
-> Harness 不解析 command
-> runtime 执行 command
```

这说明当前系统把过多安全责任前置到了 Agent 层。Agent 可以理解意图，但不应该承担最终危险命令构造和边界兜底。

这里要把两个问题明确拆开：

- `terminal_session` 是危险执行载体问题
- `tool-level approval` 是授权模型问题

它们有关联，但不是一个问题。

### 2. Capability / Tool 领域模型

当前底层 registry 是 `tool-first`，意图层又临时抽象出 capability profile，但 state、trace、审批、执行并没有把两层概念真正分开。

典型表现：

- `selectedCapabilityId` 实际经常承载 `toolId`
- `pendingToolCall.capabilityId` 实际经常承载 `toolId`
- `lastToolExecution.capabilityId` 实际经常承载 `toolId`
- `listCapabilityDefinitions()` 本质仍然返回 tool definition

这不是命名小问题，而是领域模型没有分层完成。

### 3. 意图识别与规则短路

当前意图识别整体方向并不差，它已经是：

```txt
embedding
+ rule hint
+ rerank
+ task model 二次裁决
```

问题在于规则短路仍然偏强，尤其 `isWorkspaceIntentQuery` 这类逻辑已经不只是 hint，而是强路由 gate。

这一层可以继续保留规则增强，但不适合让规则直接替代能力选择，更不适合把粗粒度字符串命中当成最终路由依据。

### 4. 工具回看与证据链

当前系统有“工具成功后再回看一次”的机制，但它还不是严格意义上的 observation-aware review。

现在更像：

```txt
工具成功
-> 给一次重新判断机会
-> 再拿原 query 做 capability intent
```

而不是：

```txt
工具成功
-> 消费本轮 observation / tool result
-> 判断是否需要继续调用工具或直接回答
```

同时，生成层主要消费 `lastToolExecution`，没有把完整 `observations` 变成正式 evidence payload。

这会削弱多工具链路，也会让“真实结果”和“最终回答”之间的绑定变弱。

### 5. 终态、Trace、可观测性

当前 `failed / blocked / waiting_approval / completed` 基本能工作，但终态原因表达不完整。

最明显的问题是：

- `blockedReason` 只存在于 graph state
- `AgentGraphOutput` 不保留 `blockedReason`
- assistant metadata 也不保留 `blockedReason`

所以 UI 能知道“卡住了”，但不一定知道“为什么卡住了”。

另外，`capabilityId / toolId` 语义污染也继续传到了 trace 和 output 层。

## Priority

### P0

#### P0-1：Agent 自动拼 terminal command 风险

问题本体：

Agent 不该把自然语言直接翻译成 shell command，尤其不该用 `terminal_session` 承载删除、移动、修改等文件操作。

整改方向：

把删除/移动/写入拆成 managed workspace tool，用结构化参数和 workspace boundary 校验。

这里的 `managed workspace tool` 指不接受任意 shell command，而是接受结构化操作参数的受控工具，例如：

```ts
{
  operation: "delete",
  targetPath: "...",
  recursive: true,
  dryRun: false,
}
```

#### P0-2：审批粒度过粗

问题本体：

当前审批批准的是 `toolId`，不是某次具体 `invocation`。

对 `sideEffect !== "none"`、`requiresApproval = true`、外部 MCP 写操作、消息发送、文件修改、终端执行等高风险工具，审批必须从 `tool-level` 升级为 `invocation-level`。

整改方向：

`approval` 绑定 `toolId + args/inputHash`，`resume` 时复用或校验同一份调用参数。

#### P0-3：执行契约没有强冻结

问题本体：

`policyNode` 虽然会冻结 `pendingToolCall`，但 `toolNode` 在缺少 `pendingToolCall` 时仍可能重新 `build args`。这会破坏“策略层决定调用，执行层只负责执行”的契约。

整改方向：

执行层只接受已冻结的调用对象；没有 `pendingToolCall` 时不应重新推导危险参数，而应中断并报错。

### P1

#### P1-high：策略分支没有显式处理 deny

问题本体：

`AgentPolicyDecision` 类型里有 `deny`，但当前 `policyNode` 仍使用“不是 `require_approval` 就执行”的写法。这个写法在类型契约上是危险的。

这不是当前已知必现风险，因为本地代码里 `evaluateAgentToolPolicy` 还没有实际返回 `deny`；但它属于本轮安全整改中应一并收掉的隐患。

整改方向：

显式分支处理 `allow / require_approval / deny`，不能依赖宽松条件判断。

#### P1-1：Capability / Tool 分层重构

问题本体：

意图层是 capability-first，执行层是 tool-first，但 state contract 仍混用 `capabilityId`，导致审批、trace、恢复执行和防重复逻辑都被污染。

整改方向：

明确拆分：

- `selectedCapabilityId`
- `selectedToolId`
- `pendingToolCall.toolId`
- `lastToolExecution.toolId`

只有意图识别和能力解释层以 capability 为主，执行态统一以 tool 为主。

#### P1-2：Harness 输入契约与 schema 校验

问题本体：

当前 Harness 更像“对象形状检查 + 工具执行转发”，还不是严格的参数契约层。

整改方向：

对高风险工具增加正式 schema 校验，并把 workspace-bound 的 boundary key 显式建模，而不是只靠局部约定。

#### P1-3：意图识别中的规则短路降级

问题本体：

`computeRuleScore` 适合做召回增强，不适合做强决策；`isWorkspaceIntentQuery` 这类逻辑当前过强。

整改方向：

把 workspace rule 从 hard shortcut 降级为 scoring hint 或高置信辅助信号，让 task model 在能力选择层保持最终意图裁决权；安全放行仍由 policy / approval / runtime 校验负责。

#### P1-4：工具结果证据链补全

问题本体：

系统现在支持累积 `observations`，但生成层主要只看最后一次工具结果，前序 evidence 容易丢。

整改方向：

把 `observations / toolExecutions` 变成正式 evidence payload，并让生成层稳定消费，而不是只依赖 `lastToolExecution`。

### P2

#### P2-1：回看逻辑升级

把当前“成功后再看一眼”的机械回看，升级成基于 observation 的下一步判断。

#### P2-2：工具路径与 RAG 路径组合

让 Agent 从“有工具就不 RAG、没工具才 RAG”的分流结构，逐步走向更自然的组合式规划。

#### P2-3：终态与可观测性增强

补齐：

- `blockedReason`
- 更明确的 terminal reason
- 更干净的 `capabilityId / toolId / invocationId` trace 语义

#### P2-4：evaluate 节点语义升级

要么把 `evaluateNode` 收敛成名副其实的 final answer guard，要么补上 evidence-grounding 检查，避免名字过大、能力过小。

## Final Position

建议用下面这段话作为后续一期整改的统一口径：

```txt
当前 Agent Graph 的方向是对的，主链路已经完整；
但它还处在“流程骨架可用、底层约束未收口”的阶段。

下一步不应该继续先加更多工具和节点，
而应该先收紧三件事：

第一，Capability 和 Tool 分层；
第二，审批从 tool-level 改成 invocation-level；
第三，高风险动作从 command 模型改成 managed operation 模型。

在完成安全边界和领域模型收口前，不建议继续扩大高风险工具的自动执行范围。
```
