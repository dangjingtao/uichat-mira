# Agent V1.5 T07：Read 公共工具面收敛

## 项目与阶段

- 仓库：https://github.com/dangjingtao/uichat-mira
- 制卡核验基线：`main@0e7e4ab36ee22dbfa2384c770f71f298ddbf35d8`
- 阶段：UIChat Mira Agent V1.5 稳定化
- 目标主线：`Planner → Normalize → Policy → ToolNode / Retrieve → Evidence → Planner`

## 全局冻结边界

1. Planner 是唯一语义决策中心；模型侧结构化输出仍然只有 `nextAction`。
2. Normalize 只做工具暴露成员校验、参数/路径规范化、Schema 校验，并冻结 `pendingToolCall`；不得换工具、改意图或改写 action。
3. Policy 只审批或拒绝冻结后的 `pendingToolCall`；不得改工具、参数或任务意图。
4. ToolNode 只执行冻结后的调用并产出真实结果；Retrieve 只产出真实检索结果。
5. Evidence 只忠实整理执行事实，不判断整项任务是否完成，不选择下一工具。
6. 工具/检索完成后必须经过 Evidence，再回 Planner。等待审批、terminal error、max-iteration 终态不得继续执行工具。
7. `capabilityIntent.selectedToolIds` 不得进入执行链；`selectedToolId` 仅允许作为 legacy/UI/trace 派生兼容字段。
8. 不新增语义节点、任务模型 selector、关键词 router、Planner action rewrite guard、静态计划机或兼容补丁层。
9. 不讨论 Agent V2、DAG、多智能体、并发工具、长期记忆、Harness 大改、MCP 市场或前端重做。
10. 只做本卡范围；禁止“顺手优化宇宙”。


## 任务目标

将 Planner 可见的 Read 工具收敛为两个互斥、易理解的公共合同：`read_discover` 与 `read_open`。现有 `read_list/read_locate/read_extract/read_slice/read` 保留为 Harness/runtime 内部能力，不再直接暴露给 Planner。

## 前置依赖

- T02 已合并。
- T03 已合并。

## 重点检查文件

- `server/src/harness/profiles/resolver.ts`
- `server/src/mcp/tools/read.tool.ts`
- `server/src/mcp/tools/read-open.tool.ts`
- `read-list/read-locate/read-extract/read-slice` 对应实现
- 工具 registry / exposure / schema / protocol 文档
- `server/src/harness/capability-profiles.test.ts`
- read tools 与 Normalize tests

## 最终 Planner 可见合同

### `read_discover`

用途：发现“有哪些对象”或“目标在哪里”，不读取正文。

必须使用结构化、机械分派的 discriminated union，示意：

```ts
{ mode: 'list', path: string, maxResults?: number }
| { mode: 'locate', query: string, root?: string, maxResults?: number }
```

- `mode=list` 机械分派到内部 list 能力；
- `mode=locate` 机械分派到内部 locate 能力；
- 不得根据自然语言关键词猜 mode；
- 返回候选对象、路径、类型、截断信息，不返回整份正文。

### `read_open`

用途：打开已知目标并读取内容；支持明确的可选定位范围。

必须使用结构化 selection，示意：

```ts
{
  path: string,
  selection?:
    | { kind: 'lines', start: number, end: number }
    | { kind: 'pages', start: number, end: number }
    | { kind: 'section', heading: string }
    | { kind: 'range', start: number, end: number }
}
```

具体支持项应与当前底层能力一致；不支持的 selection 必须 schema 拒绝或返回明确 unsupported，不得静默忽略。

## 内部工具边界

Planner 不可见：

- `read_list`
- `read_locate`
- `read_extract`
- `read_slice`
- compatibility `read`

这些内部工具可由 `read_discover/read_open` 根据结构化参数机械调用，但不得被 Planner、selector 或关键词 router 直接选择。

## 施工要求

1. 新增稳定 `read_discover` 工具 ID 与 schema。
2. 扩展 `read_open` 的结构化 selection，并保持 path 安全、workspace/root 限制。
3. `read` 兼容别名只能在内部兼容层存在，不进入 Planner exposure。
4. `read_slice` 不得作为普通用户意图首选或 Planner 可见工具。
5. public tool descriptions 必须互斥：discover 找对象，open 读已知对象。
6. 不得在 wrapper 中复制 local intent guard、文件名关键词评分或自动“locate 后 open”。
7. raw result 与 Evidence 事实必须保留来源工具/内部 operation 以便审计。
8. 不扩展 Edit、Search、Terminal 工具面。

## 明确不做

- 不把所有 read 内部能力删除。
- 不引入第三个 public read tool。
- 不修改 Planner 完成度判断；T08 负责。
- 不做通用代码图谱或 repo-map 集成。

## 验收标准

- [ ] Planner exposure 中 Read 类只有 `read_discover`、`read_open`。
- [ ] `read_list/read_locate/read_extract/read_slice/read` 不再对 Planner 可见。
- [ ] `read_discover` 仅按结构化 mode 机械分派，无自然语言 router。
- [ ] `read_open` 支持已声明的结构化 selection；非法/不支持范围明确失败。
- [ ] discover 不返回正文，open 不承担模糊目标发现。
- [ ] workspace/root、schema、artifact、trace 兼容保持正常。
- [ ] compatibility `read` 无法绕过 public contract 进入执行链。

## 最小测试范围

- capability/exposure：Planner 只看到两个 public read tools。
- schema：discover 两种 mode 互斥；open selection 合法与非法边界。
- dispatch：结构化 mode/selection 到内部实现的机械映射。
- 回归：compatibility `read`、`read_slice`、`read_locate` 不能由 Planner 直接执行。
- Graph 集成：discover 结果进 Evidence 后由 Planner 决定是否 open，不自动桥接。
- typecheck。

## 完工交付物

施工完成后必须提交可核验材料：

1. commit SHA 与 `base..head` diff 范围；
2. 实际改动文件清单；
3. 行为变化摘要，逐条对应本卡验收标准；
4. 新增/修改测试源码路径；
5. 实际执行的测试命令、原始结果与 typecheck 结果；
6. 明确说明是否影响既有 Agent 主线黑盒；
7. 所有测试源码与报告均须为 git tracked files，不接受只贴口头摘要。
---
status: current
priority: P1
owner: agent-runtime
last_verified: 2026-07-11
layer: project-control
module: AgentRuntime
feature: ReadSurface
doc_type: task-card
canonical: true
related:
  - docs/project-control/project-control-ledger.md
task_state: TODO
---
