---
status: current
priority: P1
owner: agent-runtime
last_verified: 2026-07-06
layer: project-control
module: ProjectControl
feature: AgentLoopV17BlackboxTestPlan
doc_type: task-card
canonical: true
related:
  - docs/project-control/agent-nodes-workboard.md
  - docs/project-control/tasks/agent_node_T026-user-visible-execution-trace.md
  - docs/project-control/tasks/agent_node_T028-blackbox-autonomous-source-review.md
  - docs/chat/agent-loop-v1.7-construction-plan.md
task_state: DONE
---

# agent_node_T027 blackbox test plan v1.7

## Target

本任务只做一件事：

先把 `v1.7` 的 3 个黑盒场景方案写清楚，不直接落测试代码。

只保留以下 3 个用户可见场景：

- 自主源码审查
- 终端失败后继续推进
- 小范围修复闭环

## Group And Dependency

- Group: `C`
- Sequence: `C2`
- Depends on:
  - `agent_node_T019`
  - `agent_node_T020`
  - `agent_node_T021`
- Parallel rule:
  - A1-A3 稳定后可并行开始
  - 不得提前写最终黑盒测试实现

## Involved Files

- `docs/chat/agent-loop-v1.7-construction-plan.md`
- `docs/project-control/tasks/agent_node_T027-blackbox-test-plan-v17.md`
- `docs/project-control/tasks/agent_node_T028-blackbox-autonomous-source-review.md`
- `server/src/agent/` 下待新增黑盒测试文件位置说明

## Scope

Allowed:

- `docs/project-control/tasks/agent_node_T027-blackbox-test-plan-v17.md`
- `docs/project-control/agent-nodes-workboard.md`
- 在本卡内说明 `T028` 后续建议测试文件位置与 helper 边界

Forbidden:

- `server/src/agent/` 下任何运行时代码
- `server/src/agent/` 下任何正式黑盒测试实现
- `tool-node.ts`、`resume.ts`、`graph/routes.ts`、`planner/node.ts` 的行为改动
- 把 `T027` 扩成“所有 Agent 都要黑盒覆盖”的大池
- 提前实现 `T028`

## Minimal Change Points

- 为 3 个场景写：
  - 输入
  - 期望用户可见行为
  - 中间关键断言
  - 禁止行为
  - 结束条件
- 为 `T028` 预留统一测试入口建议，不直接写测试代码

## Planned Test Entry

`T027` 只定义方案，不落代码。

`T028` 落地时建议优先新增 1 个 trio 级黑盒入口，而不是把 3 个场景拆散到大量独立文件：

```text
server/src/agent/__tests__/agentgraph-v17-blackbox-trio.test.ts
```

允许补最小 test helper，但 helper 只服务这 3 个场景：

```text
server/src/agent/__tests__/helpers/
  blackbox-v17-fixtures.ts
  blackbox-v17-assertions.ts
```

不建议在 `T028`：

- 直接复用大量 node-level 内部 helper，导致黑盒退化成白盒拼装
- 为方便测试临时改运行时 contract
- 把其它非本卡场景顺手塞进同一文件

## Scenario Matrix

### Scenario 1：自主源码审查

| Item | Plan |
| --- | --- |
| 用户输入 | `帮我评估这个项目 Agent 闭环哪里还不完整` |
| 前置条件 | 线程已绑定 workspace；可暴露 `read_locate` / `read_open`，如存在 terminal search 也可被模型选择 |
| 期望用户可见行为 | 用户不给路径，系统仍会自己定位 Agent 相关代码或文档；执行轨迹能看到“查找 -> 读取 -> 再查找/再读取 -> 汇总结论” |
| 中间关键断言 | 至少发生 `2` 次以上自主推进动作，且动作属于 `locate/read` 或 `terminal search/read`；第一次目标不准时，后续能继续定位，不会直接结束；最终回答明确说明看过哪些模块、文件或职责边界 |
| 禁止行为 | 没有读取证据就直接泛泛而谈；只做 1 次失败 locate 就结束；把内部字段名或调试 JSON 当最终用户回答；要求用户先告诉具体路径才继续 |
| 结束条件 | 输出基于已读证据的缺口判断与建议；若证据仍不足，也要明确说缺的是哪类证据、卡在哪一步 |

建议断言重点：

- `agentGraph.run(...)` 是唯一执行入口
- 最终状态不是“第一次路径不准即失败”
- execution trace 中能看到至少一次“失败后继续定位”或“定位后继续读取”
- 最终回答包含已查看对象，而不是空泛评价

mock / fixture 策略：

- 夹具来源：
  - 使用 `T028` 专属测试 workspace fixture，放入一组最小但真实可读的 Agent 相关文件样本
  - 样本应覆盖 `AgentGraph / Planner / Tool / Policy / Evidence` 这些可被 locate/read 命中的对象
  - 可以复用现有 blackbox 风格的“虚拟消息、基础 run 输入、工具暴露列表”构造方式，但不要直接复用 node 级私有 state fixture
- 需要 mock 的边界：
  - mock 模型规划输出，让它先走一次不准确定位，再走正确 locate/read，最后输出总结
  - mock Harness 工具执行结果中的 locate/read 可见返回内容，保证测试稳定，不依赖真实仓库文件漂移
  - 如使用 terminal search，terminal 的命令输出也应作为 Harness 边界 mock，而不是跑真实终端
- 必须真实走主链的对象：
  - `agentGraph.run(...)` 主入口
  - tool exposure -> planner -> normalize -> policy -> tool -> observation / evidence -> planner / generate 这条运行链
  - `onExecutionNode` 收集到的用户可见推进轨迹
- 可复用的 helper：
  - 现有 blackbox 测试里的基础 run builder、消息 builder、工具定义 builder、tool exposure builder
  - trio 级测试可新增“源码审查 fixture 装配 helper”，但它只能负责组装输入，不负责替代主链执行
  - 不复用直接断言内部节点状态的 helper

### Scenario 2：终端失败后继续推进

| Item | Plan |
| --- | --- |
| 用户输入 | `帮我跑一下 Agent 相关测试` |
| 前置条件 | `terminal_session` 需要审批；workspace 内存在可读 `package.json` 或等价脚本定义文件；第一次命令故意返回失败或命令不存在 |
| 期望用户可见行为 | 系统先请求审批运行测试命令；第一次命令失败后，不直接结束，而是回到 Planner 继续读脚本定义或改命令；如果新命令仍属高风险，会重新请求审批；最后给出测试结果或明确卡点 |
| 中间关键断言 | 第一次终端失败后，至少产生 `1` 个新的有效动作；新的动作要么是读取 `package.json`，要么是生成更合适的测试命令；新命令和原命令不同，且会重新走审批；最终回答要解释失败原因和后续处理结果 |
| 禁止行为 | 第一次命令失败后直接把 run 判死；复用旧审批直接跑新命令；伪造“测试通过”；只回显终端报错，不继续推进 |
| 结束条件 | 要么拿到真实测试结论，要么明确说明为什么无法继续，以及已经验证过哪些替代路径 |

建议断言重点：

- 首次终端失败被当作可恢复失败返回 Planner，而不是全局直接终止
- 第二步出现新的有效动作
- 新高风险命令形成新的审批对象，不复用旧 approval
- 最终回答同时包含失败原因、后续动作和最终结论/卡点

mock / fixture 策略：

- 夹具来源：
  - 使用 `package.json` 或等价脚本文件的最小 workspace fixture，确保存在可读脚本定义
  - fixture 中准备一个“第一次命令会失败、读取脚本后可改成第二个命令”的稳定样本
  - 不需要真实安装依赖或真实跑仓库测试
- 需要 mock 的边界：
  - mock 第一次终端调用返回失败结果
  - mock 后续 `read_open package.json` 或等价文件读取结果
  - mock 第二次终端调用返回可分析的测试输出或新的明确失败
  - 审批对象与审批恢复可作为 Harness / approval 边界的受控返回，不依赖真实审批 UI
- 必须真实走主链的对象：
  - `agentGraph.run(...)` 主入口
  - 第一次终端失败后回到 Planner 再产生新动作的主链推进
  - 第二个高风险命令重新进入审批，而不是沿用旧调用
  - 最终回答对“失败 -> 继续推进 -> 结论/卡点”的串联说明
- 可复用的 helper：
  - 现有 blackbox 测试里的 terminal tool definition helper、approval result helper、execution trace 收集 helper
  - 可新增“终端失败后继续推进”的场景装配 helper，用来组织两次命令和一次文件读取的样本顺序
  - 不复用字段级失败分类断言 helper，避免测试退化成内部合同测试

### Scenario 3：小范围修复闭环

| Item | Plan |
| --- | --- |
| 用户输入 | `修一下工具失败后直接终止的问题，做最小改动，并告诉我改了什么` |
| 前置条件 | workspace 内准备一处可最小修复的问题与对应测试/验证命令；写入和终端验证都需要审批 |
| 期望用户可见行为 | 系统先定位相关代码，再读取必要文件，提出最小改动方案，请求写入审批，执行修改，再请求验证审批；验证失败时继续做一次小修或明确卡点；最终总结改了什么、为什么这么改、验证结果如何 |
| 中间关键断言 | 必须出现 `read -> edit proposal -> approval -> write -> approval -> test` 主链；写入前有明确修改提议；所有写入和终端动作都经过审批；验证失败时不能静默结束，必须继续修一次或明确阻塞原因 |
| 禁止行为 | 只给口头建议不落地；未审批直接写文件或跑命令；大范围重构替代最小修复；验证失败后假装成功 |
| 结束条件 | 成功时给出修改摘要和验证结果；失败时给出已完成的修改、失败证据、阻塞点和未完成项 |

建议断言重点：

- 最终不是“只读不改”或“只提建议”
- 审批链完整可见，且写入审批与验证审批分离
- 验证失败后至少有一次继续推进或明确停线说明
- 最终回答必须有 diff 级结果描述和验证结论

mock / fixture 策略：

- 夹具来源：
  - 使用最小修复 workspace fixture：包含 1 个待修文件、1 个对应验证命令说明、1 份可读问题线索
  - fixture 要足够小，能支持“读取 -> 提议修改 -> 写入 -> 验证”的闭环，但不应扩大成真实多文件重构样本
  - 如需 patch 文本或写入前后内容，可在 fixture 中准备稳定的期望文件版本样本
- 需要 mock 的边界：
  - mock 模型给出的最小改动提议与后续验证决策
  - mock 写入工具与验证命令的 Harness 执行结果
  - 若设计包含“第一次验证失败再修一次”，两轮验证结果都应作为可控边界 mock
  - 不直接调用真实文件写入或真实终端测试命令
- 必须真实走主链的对象：
  - `agentGraph.run(...)` 主入口
  - 从读取证据到形成修改提议，再到审批、写入、验证、总结的完整推进链
  - 用户可见 execution trace 中的审批等待、恢复执行和终局说明
  - 最终回答里的修改摘要与验证结果说明
- 可复用的 helper：
  - 现有 blackbox 测试里的基础 run/input builder、审批对象装配 helper、trace 收集 helper
  - trio 级测试可新增“最小修复闭环 fixture helper”，负责准备待修文件与预期写入结果
  - 不复用任何直接拼装内部 edit state 或直接跳过审批的 helper

## Cross-Scenario Assertion Rules

3 个场景统一要求断言下面这些“黑盒可见事实”，避免退化成内部字段快照：

- 用户可见 execution trace 是否体现推进、失败、恢复、审批和终局
- 最终回答是否基于实际执行证据，而不是模板话术
- 高风险动作是否重新审批
- 失败后是否真的产生了新的有效动作
- 终局是否明确区分“成功完成”“明确阻塞”“证据不足”

可以读取和断言的黑盒面：

- `agentGraph.run(...)` 返回的 `status / answer / errorMessage / pendingApproval`
- `onExecutionNode` 收集到的用户可读 trace `summary / details`
- Harness 调用次数与审批对象数量
- 是否出现新的工具调用或新的命令参数

不应依赖的白盒面：

- 直接断言某个 node 私有局部变量
- 直接 mock 并检查 PlannerObservationContext 内部拼装细节
- 直接耦合 `T019-T024` 某个中间字段名
- 把完整内部 state snapshot 当唯一验收依据

## Acceptance Criteria

- 三个场景都形成可执行的黑盒测试方案
- 每个场景都具备：
  - 用户输入
  - 前置条件
  - 期望用户可见行为
  - 中间关键断言
  - 禁止行为
  - 结束条件
- 已说明 `T028` 建议测试入口和 helper 边界
- 不扩成大而散的黑盒池
- 不把所有测试都变成黑盒

## Test Type

黑盒方案设计

## Verification

- 文档审查
- 黑盒断言结构审查
- 检查 3 个场景是否都能直接映射到 `T028` 测试用例名和断言结构
- 检查是否存在越权内容：
  - 提前写测试实现
  - 提前改运行时 contract
  - 把额外场景混入 trio 计划

## Evidence

- 已补 3 个场景的可执行方案矩阵
- 已补 `T028` 建议测试入口与 helper 边界
- 本卡未新增测试代码，符合 `T027` 边界

## Submission Note

当前结果已通过本卡审查，可将 `T027` 状态回填为 `DONE`：

- 任务卡已补齐 3 个可直接映射到 `T028` 的黑盒场景方案
- 每个场景都包含输入、前置条件、可见行为、关键断言、禁止行为、结束条件、mock / fixture 策略
- 当前卡片仍只停留在方案设计边界，没有提前实现黑盒测试代码

## Risk Points

- 现在直接写测试代码会被 A4-A6 主链改动冲掉
- 场景边界不收死，后续会膨胀成无法维护的验收集
- 如果 `T028` 过度依赖内部中间字段，这 3 个场景会退化成伪黑盒
