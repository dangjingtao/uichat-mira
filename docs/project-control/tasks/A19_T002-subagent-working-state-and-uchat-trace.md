# A19_T002 — subAgent 常驻工作状态与 UChat Trace

- 状态：IMPLEMENTED — VERIFICATION PENDING
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
- Trace 只追加，不修改或删除旧事件。
- 审批 checkpoint 保存 `runId`、`nextSeq`、最后 Working State 和 Trace 历史。
- 精确审批恢复后沿用同一 run，不重新从第一步开始。
- 顶部普通 Trace 默认只显示标题，不展开 summary 噪声。
- 正文上方 Working State 在 running、waiting、completed、failed、blocked 状态都可恢复和展示。
- 历史消息从持久化 data part 重建，而不是依赖瞬时组件 state。
- Trace 发布失败不能成为 subAgent 的第二控制平面。

### 非目标

- 不展示原始 chain-of-thought、隐藏推理、私有 scratchpad 或秘密。
- 不把 Working State 伪装成逐 token 内心独白。
- 不重写 UChat 消息协议或另建旁路 WebSocket。
- 不把所有内部日志都常驻在消息正文。
- 不修改 Main Agent C contract。
- 不让 Trace 事件反向控制 subAgent。

## Working State 合同

```ts
type SubAgentWorkingState = {
  runId: string
  skillId: string
  phase:
    | "planning"
    | "working"
    | "waiting_approval"
    | "waiting_input"
    | "blocked"
    | "completed"
    | "failed"
  currentJudgement?: string
  currentAction: string
  nextAction?: string
  blockingReason?: string
  updatedAt: number
}
```

这是面向用户的安全工作摘要，不是模型原始隐藏思维。

## Trace Event 合同

```ts
type SubAgentTraceEvent = {
  runId: string
  seq: number
  eventId: string
  skillId: string
  type: SubAgentTraceEventType
  title: string
  timestamp: number
  details?: Record<string, unknown>
}
```

关键规则：

- `seq` 由 Runtime 生成，不由模型生成；
- 同一 `runId` 内单调递增；
- 多个 run 保持消息中的追加顺序，不把不同 run 的相同 seq 混排；
- 返工应发布显式事件，不能重写旧步骤编号；
- 普通 Trace 行只展示 `title`，详情默认折叠。

## UChat 展示合同

### 顶部 Trace Bar

显示：

- 最新 Trace 标题；
- 状态图标；
- 现有步骤计数；
- running 时 spinner。

普通 subAgent Trace 不在折叠列表中重复展示 summary。

### 正文上方常驻区

显示：

- 当前判断；
- 正在处理；
- 下一步；
- 阻塞原因。

新状态覆盖旧快照的展示，但旧快照和 Trace 仍保存在消息 data parts 中。任务结束后保留最终状态，不自动消失。

## 简单 Smoke

### Smoke A：运行中

启动一个 PDF 或 GitHub Skill。

检查：

- 顶部标题随事件推进；
- 正文上方状态持续存在；
- 工具调用期间不会闪退；
- 普通 Trace 展开后只显示标题。

### Smoke B：审批暂停与恢复

触发需要审批的写操作。

检查：

- Working State 切换到 `waiting_approval`；
- 刷新页面后状态仍在；
- 审批通过后同一个 `runId` 恢复；
- `seq` 延续递增；
- 旧副作用不重复执行。

### Smoke C：完成后刷新

完成一个 Skill 任务并刷新会话。

检查：

- 最终 Working State 仍显示；
- spinner 消失；
- 顶部显示最后 Trace 标题；
- Trace 历史顺序不变。

### Smoke D：Stateful Flow

进行一轮备孕评估。

检查：

- Flow 作为单 subAgent 控制器发布 `waiting_input`；
- 常驻区显示当前缺口和下一步；
- 下一轮继续使用稳定 Flow session run id；
- 完成后显示 `completed` 并进入冻结交付。

## 必须覆盖的测试

- Working State parser 选择最新状态。
- state snapshots 不混入历史 Trace 行。
- 同一 run 按 seq 排序，不同 run 不混排。
- 普通 subAgent Trace 行标题可见、summary 不显示。
- completed Working State 仍常驻。
- append-only start 事件不会留下永久 spinner。
- checkpoint 恢复 runId / nextSeq / Working State。
- Trace emit 失败不改变执行结果。
- UChat 旧消息兼容：没有 subAgent state 时继续使用旧 inner status fallback。

## 验收标准

- subAgent 自己发布可读工作状态。
- 顶部 Trace 与常驻 Working State 职责分离。
- SSE、持久化、刷新、审批恢复完整贯通。
- 不暴露隐藏 chain-of-thought。
- 不引入第二控制平面。
- 单测、typecheck 与人工 UChat smoke 实际通过后才可把本卡改为 DONE。

## 施工红线

1. 不只改 `UChatExecutionTrace.tsx` 就宣称完成。
2. 不从 Main Planner thought 推导 subAgent 状态。
3. 不把模型生成的步骤编号当事件顺序。
4. 不让 Trace 发布失败中断业务执行。
5. 不破坏旧 RAG / Main Agent Trace 展示。
6. 不泄露 prompt、token、凭据、原始隐藏推理或未脱敏参数。

## 实现记录

已落地：

- Runtime-owned append-only ledger：`runId + seq + events + Working State`。
- `subagent_report_state` 安全状态发布工具。
- 工具开始/完成/失败、审批、恢复、输入缺口和终态事件。
- checkpoint 保存并恢复 ledger 与 Skill 版本绑定。
- 事件复用现有 execution-node → SSE → message data part → persistence 链路。
- UChat parser 将 state snapshot 与历史 Trace 分离。
- 顶部优先显示最新 subAgent Trace 标题。
- 正文上方常驻显示判断、动作、下一步和阻塞。
- completed / failed / blocked 状态不再自动消失。
- Planner-derived inner status 仅作为旧消息 fallback。
- Stateful Flow 发布同一套 Working State / Trace 语义。
- 增加 UChat parser/展示回归测试。

尚未在当前执行环境运行：

- desktop Vitest
- server checkpoint / approval 回归测试
- desktop / server typecheck
- `pnpm check`
- 真实 UChat 刷新、断线和审批恢复 smoke

在上述验证完成前，本卡保持 `IMPLEMENTED — VERIFICATION PENDING`。