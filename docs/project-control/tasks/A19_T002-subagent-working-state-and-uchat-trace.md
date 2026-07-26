# A19_T002 — subAgent 常驻工作状态与 UChat Trace

- 状态：READY
- 仓库：`dangjingtao/uichat-mira`
- 基线分支：`dev`
- 施工分支：`feature/subagent-skill-runtime-v1`
- 类型：subAgent Trace / UChat
- 前置任务：`A19_T001`
- 合并顺序：第 2 张

## 背景

当前前端存在执行 Trace 和临时 inner status，但其中部分内容由 Main Planner 或 active step 推导，且状态可能随流式事件一闪而过。

产品标准已经确定：

- 顶部 Trace 只负责流程感，普通事件主要显示标题，可快速刷新；
- 正文上方必须常驻显示 subAgent 当前判断、正在处理和下一步；
- subAgent 自己发布工作状态，前端不得从 Main Planner Trace 猜；
- Trace 历史只追加，不能出现“执行到第 5 步又退回第 3 步”的错乱；
- 审批暂停、恢复、刷新和历史消息重载后仍可恢复。

UChat 是复杂宿主框架，本任务不得按单一 React 组件补丁处理。

## 目标

建立 subAgent 原生、可持久化、可恢复的两层运行信息：

1. `Working State`：subAgent 当前对外工作摘要，常驻展示；
2. `Trace Event`：append-only 执行事件，顶部仅展示当前标题/进度，详情按需展开。

完整打通：

```text
subAgent Runtime
→ 服务端事件协议
→ SSE / 流式传输
→ 消息持久化与恢复
→ execution parser
→ UChat message lifecycle / slot
→ 顶部 Trace Bar + 常驻 Working State
```

## 第一版边界

### 必须实现

- Working State 由 subAgent Runtime 主动发布。
- Working State 至少包含：当前判断、正在处理、下一步、阻塞原因（可选）。
- 同一 run 的 Trace 使用稳定 `runId` 和单调递增 `seq`。
- Trace 只追加，不修改或重排已经发布的历史。
- 审批 checkpoint 保存并恢复 `runId`、下一序号和最后 Working State。
- 页面刷新、断线重连和历史消息加载后可恢复最后状态。
- 顶部 Trace 默认只显示当前阶段标题、状态和进度；普通事件不展示冗长摘要。
- 正文上方 Working State 常驻，不随普通 Trace 更新消失。
- 完成后保留最后一份可读状态快照；失败、阻塞和审批等待有明确状态。
- 旧消息没有新字段时继续使用兼容降级展示。

### 非目标

- 不展示或持久化模型原始隐藏推理文本。
- 不让前端控制 subAgent 下一步。
- 不实现完整项目管理式甘特图或可编辑 Plan。
- 不重做 UChat 消息系统、主题系统或全部 Trace UI。
- 不修改 Main Agent C contract。
- 不把每个 token、日志行或底层 HTTP 事件都塞进 Trace。

## 建议协议

具体字段名可按现有消息协议调整，但语义必须稳定：

```ts
type SubAgentWorkingState = {
  runId: string
  skillId: string
  phase: string
  currentJudgement?: string
  currentAction: string
  nextAction?: string
  blockingReason?: string
  updatedAt: number
}

type SubAgentTraceEvent = {
  runId: string
  seq: number
  eventId: string
  skillId: string
  type: string
  title: string
  timestamp: number
  details?: Record<string, unknown>
}
```

约束：

1. `seq` 由 Runtime 生成，模型不得指定。
2. Working State 是最新快照，可覆盖更新；Trace Event 是历史，只追加。
3. 返工必须发布显式 `revisit` / `plan.revised` 事件，不得复用旧步骤序号伪装倒退。
4. 普通 Trace 的用户可见主信息是 `title`；详情默认折叠。
5. 审批、失败、Evidence 缺口和返工可以突出显示详情。
6. Working State 是经过整理的工作摘要，不是原始 chain-of-thought。

## UChat 展示合同

### 顶部 Trace Bar

默认显示：

- 当前阶段标题；
- running / waiting / completed / failed 状态；
- 已完成 / 总步骤（仅在可信时显示）；
- 展开入口。

普通 Trace 事件只展示标题，不在顶部堆叠长摘要。

### 正文上方常驻区

固定显示 subAgent 当前：

- 当前判断；
- 正在处理；
- 下一步；
- 等待审批、等待用户输入或阻塞原因。

新 Working State 到达时更新当前卡片，但不得因为随后到达普通 Trace、tool result 或 answer token 而消失。

### 详细 Trace

- 默认折叠；
- 按 `seq` 排序；
- 普通事件只显示标题；
- 审批、失败、返工和 Evidence 缺口允许展开详情；
- 旧消息无 `runId/seq` 时使用原顺序兼容展示。

## 施工范围

动手前必须读通并记录现有链路：

- subAgent runner 与 checkpoint
- Agent / node execution event
- SSE / stream payload
- message persistence / reload
- execution parser 与类型
- UChat message rendering / slots / lifecycle
- approval pause / resume
- 现有 Trace、RAG Trace、Agent status 测试

可能修改：

- subAgent event emitter
- checkpoint 类型与恢复
- 服务端流式协议与持久化字段
- desktop parser / state reducer
- UChat Trace 和 Working State 展示
- 服务端与桌面端测试

不得只修改 `UChatExecutionTrace.tsx` 后宣称完成。

## 简单烟测用例

### Smoke 1：常驻状态不闪退

1. 触发一个至少包含 3 个工具步骤的 Skill 任务。
2. subAgent 发布 Working State A。
3. 连续发布多个普通 Trace 和 tool result。
4. 断言正文上方仍显示 A，直到 Working State B 到达才更新。
5. 断言顶部只快速显示当前 Trace 标题和状态。

### Smoke 2：审批暂停与恢复

1. 触发一个需要审批的 Skill 写操作。
2. 记录暂停前 `runId`、最后 `seq` 和 Working State。
3. 批准后恢复。
4. 断言使用同一 `runId`，新事件 `seq` 大于暂停前序号。
5. 断言 Working State 从“等待审批”更新为“继续执行”，不从头重演。

### Smoke 3：刷新恢复

1. 在 subAgent 运行中或等待审批时刷新页面 / 重载会话。
2. 从持久化消息恢复。
3. 断言顶部 Trace、最后 Working State 和审批状态一致。
4. 断言没有重复事件、序号倒退或常驻区消失。

### Smoke 4：显式返工

1. 让验证步骤发现结果缺口并返回前序工作修复。
2. 断言 Trace 新增 `revisit` / `plan.revised` 标题。
3. 断言 `seq` 继续增长，不显示为“第 5 步退回第 3 步”。

## 验收标准

- subAgent 能实时发布自己的 Working State 和 Trace。
- Working State 在 UChat 正文上方常驻并可恢复。
- 顶部 Trace 以标题、状态、进度为主，普通信息不喧宾夺主。
- 同一 run 的事件严格 append-only，`seq` 单调递增。
- 审批恢复延续同一 run，不重复执行已批准前的副作用。
- 页面刷新、历史加载和旧消息兼容通过。
- 不依赖从 Main Planner thought 推测 subAgent 状态。
- server、desktop 单测、集成测试、smoke、typecheck 通过。

## 施工红线

1. 不把 UChat 当简单 React 组件直接改。
2. 不在前端用文本匹配、时间猜测或数组下标伪造 run/step 身份。
3. 不把原始隐藏推理当产品协议。
4. 不允许 Trace 事件覆盖、删除或重排历史。
5. 不让 Trace 回调影响 subAgent 控制流。
6. 不破坏 RAG、普通 Agent、审批和旧消息展示。
7. 不重开 Main Agent、Planner、Agent Graph 或 C contract。

## 交付要求

完成后提供：

- 端到端数据链图或说明；
- 新事件与持久化字段清单；
- UChat 展示变化说明；
- 审批恢复与刷新恢复测试结果；
- 兼容策略和已知限制；
- 一个聚焦提交，不夹带 UChat 无关重构。
