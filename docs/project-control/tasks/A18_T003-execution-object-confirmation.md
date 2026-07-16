---
task_state: READY_FOR_REVIEW
owner: project-owner
repository: dangjingtao/uichat-mira
baseline_branch: dev
---

# A18_T003 — 收紧执行对象确认边界

- 状态：READY_FOR_REVIEW
- 仓库：`dangjingtao/uichat-mira`
- 基线分支：`dev`
- 类型：P0/P1 技术债 / 禁止硬编码
- 前置任务：`A18_T001`
- 合并顺序：第 3 张
- 本卡完成前不得重新接回 coverage / completion transition

## 背景

当前 `server/src/agent/task-intent.ts` 使用关键词和正则：

- 分类 list / locate / read / mutate / verify / search / terminal。
- 从用户原话匹配 path-like 字符串。
- 从删除、修改、创建、移动等语句后提取 named target。
- 写入 `requiredTargets`。

粗粒度动作分类可以保留；但自然语言字符串不能直接成为执行对象。一旦 coverage 重新消费 `requiredTargets`，正则猜出的对象可能进入执行链。

## 目标

1. 本地规则可以做粗粒度任务意图分类。
2. 本地规则不得确认具体执行对象。
3. 用户文本里的 path-like / named target 只能是 candidate。
4. 只有可靠来源确认的对象才能进入 `CurrentTaskFrame.confirmedObjects` 或工具参数。
5. 本卡不重新连接 coverage。
6. 不新增实体解析器、规划器或状态机。

## 定义

### Candidate

从用户文本或模糊描述得到的潜在对象，不是可执行真相。

### Confirmed Object

至少来自一种可靠来源：

- 用户明确提供且语义无歧义的结构化参数。
- `read_locate / read_list / codebase_explore` 等工具返回并由 Planner 选择。
- 当前对话中已明确确认。
- approval 绑定的精确 frozen pendingToolCall。
- task model 基于可见 evidence 选定，之后仍走 Normalize/schema/boundary/Policy。

## 施工范围

优先检查：

- `server/src/agent/task-intent.ts`
- `CurrentTaskFrame` confirmed object 写入/读取位置
- coverage reducer / transition 潜在消费点
- Planner observation context
- task-intent、coverage、Planner 相关测试

允许：

- 保留粗粒度 action classification。
- 将 `requiredTargets` 改为非执行 candidate，或移除危险提取。
- 增加最小来源标记。
- 增加 guard，确保 candidate 不得进入执行参数。

不得：

- 把路径正则换成更复杂正则后继续确认对象。
- 扩张文件名词典、动词名单或 toolId 路由表。
- 用 normalize 把自然语言候选洗成安全执行路径。
- 在 ToolNode/Policy 重新解析用户原话。
- 重新连接 coverage reducer。
- 修改 AgentGraph 拓扑。

## 实施要求

1. 明确拆分动作分类与对象确认。
2. `PATH_TARGET_PATTERN`、mutation named-target extraction 不得继续产出执行级 target。
3. 若保留 candidate：
   - 字段名体现未确认。
   - Normalize、Policy、ToolNode 不读取。
   - 不直接计入任务已覆盖。
4. `CurrentTaskFrame.confirmedObjects` 只能由 Planner 基于结构化上下文/evidence 更新。
5. Planner 工具参数仍必须走 Normalize、schema、boundary、Policy。
6. 用户明确写相对路径时，也不得通过本地正则绕过 Planner。
7. 不强制所有路径都 ask_user；真实歧义且无法 locate 时由 Planner 决定。

## 必须覆盖的测试

1. “删除配置文件”不会把“配置文件”变成 `targetPath`。
2. “修改 README.md”可产生 candidate/意图，但不直接进入 pendingToolCall。
3. “读取 /etc/passwd”不会被本地解析改写成 workspace target。
4. “在 server/src 下找 planner”不会整段解析成路径。
5. locate 多候选时，只有 Planner 选定对象成为 confirmed。
6. confirmed object 执行仍经过 Normalize/Policy。
7. selectedToolIds、capabilityIntent、requiredTargets 都不能触发执行。
8. coverage 在本卡后仍未接回。
9. action classification 基础能力不要求删除。

## 验收标准

- 不存在 raw user text → regex → executable target 的直接链路。
- candidate 与 confirmed object 语义清晰。
- 不新增路径词典、文件名特判、toolId 特判。
- coverage 未接回。
- Planner 仍是唯一决策者。
- 相关测试与 typecheck 通过。

## 施工红线

1. 不新增 AgentGraph 节点、旁路、循环或 `nextAction` 类型。
2. 不改变主链：`Planner → Normalize → Policy → ToolNode → Evidence → Planner`。
3. 不按具体 `toolId`、MCP 名称、微应用类型或 Python provider 写 AgentGraph 特判。
4. 不使用关键词、正则或字符串猜测，把自然语言直接转换为可执行的 `path / targetPath / destinationPath / command / code`。
5. 不绕过 `pendingToolCall`、Policy、ToolNode、Evidence。
6. 不为通过单个测试硬编码返回值、文件名、工具名、系统路径或分支。
7. 能力差异在 Tool Adapter、Harness、Sandbox、Evidence 合同内收敛，不塞进 Graph。
8. 如统一合同不足，停止施工并提交“合同缺口说明”，不得自行扩大架构。
9. 不顺手重构无关模块，不升级依赖，不改大前端。
10. 测试必须保护合同，不得继续保护已确认的错误行为。

## 本次实现证据

- `server/src/agent/task-intent.ts` 保留粗粒度动作分类，新增 `candidateTargets`；`requiredTargets` 只从带来源的 confirmed object 产生，不读取 raw user text。
- `server/src/agent/__tests__/task-intent.test.ts` 覆盖 mutation、相对路径、absolute path 和多目标候选不确认。
- `server/src/agent/__tests__/coverage-state.test.ts` 覆盖候选不进入 coverage target，确认 coverage 未重新接入。
- 定向测试：task-intent、coverage、tool-call-normalize 共 73/73 通过；coverage 原有多目标读取、locate 后 read、mutation 失败与完成状态回归均保留并通过。
- 执行边界测试：Planner/selectedToolIds/Policy/ToolNode/Harness 相关测试 92/92 通过；覆盖 Planner 选定 confirmed object、Normalize/Schema/Boundary/Policy 链路及非 Planner 字段不触发执行。
- 类型检查：`pnpm check`，6 个 workspace typecheck 通过。
- 当前 task-frame 全量测试中 1 个 prepare-context 测试因环境未设置 `DATABASE_URL` 失败，未经过本次修改逻辑；其余相关测试通过。
- Black-box smoke：未运行；本卡不改变 AgentGraph 主链或用户入口，保留为后续独立 smoke 风险。任务等待复审，不预写 `DONE`。

## 交付要求

完成后必须提供：

- 改动文件清单。
- 行为变化说明。
- 新增或修改测试清单。
- 实际测试命令与结果。
- 是否影响现有黑盒、审批、Evidence、Trace。
- 已知限制。
- 一个独立提交；不得夹带全仓格式化、依赖升级或无关清理。
