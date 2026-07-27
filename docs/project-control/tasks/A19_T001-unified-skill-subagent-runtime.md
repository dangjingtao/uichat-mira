# A19_T001 — 所有现有 Skill 统一接入 subAgent Runtime

- 状态：IMPLEMENTED — VERIFICATION PENDING
- 仓库：`dangjingtao/uichat-mira`
- 基线分支：`dev`
- 施工分支：`feature/subagent-skill-runtime-v1`
- 类型：Skill / Agent Runtime
- 前置任务：无
- 合并顺序：第 1 张

## 背景

当前文枢 Skill 通过专用 profile 接入 `pi-agent-core`，其他 Skill 仍可能停留在 Context 注入或专用接线。产品口径已经确定：

> 一个 Skill，对应一个 subAgent。

`pi-agent-core` 只保留为底层 engine 名；产品、架构、类型、Trace 和 UI 统一使用 `subAgent`。

## 目标

建立通用的 `SkillDefinition -> SubAgentExecutionProfile -> SubAgent Run` 执行合同，让当前 Skill Scanner / Registry 能发现的全部 Skill 都通过同一条 subAgent 委派链执行。

命中一个 Skill 时只实例化一个 subAgent；subAgent 不得继续孵化下一级 Agent。

## 第一版边界

### 必须实现

- 以 Skill Scanner / Registry 的实际发现结果为准，覆盖当前全部已安装 Skill。
- 每个 Skill 稳定映射到且只映射到一个 `SubAgentExecutionProfile`。
- Main Agent 负责识别、委派、接收结果和最终回复。
- subAgent 负责 Skill 内部计划、工具使用、观察、修复、Evidence 与 Artifact 交付。
- Harness、Policy、审批、Evidence 和 workspace 边界保持有效。
- GitHub Skill 已有专业内容允许复用；只做统一 Runtime 接线和必要规范补齐。
- 文枢现有能力不得回退。
- Stateful Skill 的 Flow/Reducer 作为该 Skill 唯一 subAgent 的确定性控制器，不得再叠一层自由 Planner。

### 非目标

- 不新增 Agent Graph 拓扑。
- 不重开 Planner、Normalize、Policy、ToolNode、Evidence、Generate 或 C contract。
- 不允许 subAgent 创建子 Agent。
- 不把 Office Runtime 重新暴露成全局 Harness 工具。
- 不取消现有精确审批、checkpoint 或 Evidence 约束。
- 不在本卡实现 Skill 市场、在线安装或多 Skill 编排。
- 不因统一接入而重写各 Skill 的专业正文。

## 统一执行合同

```ts
type SubAgentExecutionProfile = {
  skillId: string
  mode: "forked-agent"
  engine: "pi-agent-core"
  allowedHarnessToolIds: string[]
  runtimeBindings: RuntimeBinding[]
  workspaceBound: boolean
}
```

Profile 是需求声明，不是权限授予：

```text
实际可用 Harness 工具
= Skill 声明
∩ 当前 canonical ToolExposure
∩ Harness 已注册和健康能力
∩ Policy / approval
```

私有 Runtime 继续通过受管 adapter 绑定，不进入全局 ToolExposure。

## Stateful Skill 兼容合同

若 Skill 已注册确定性的 `SkillConversationFlowRuntime`：

- Flow / Reducer 持有状态、阶段、下一问和完成条件；
- 它就是该 Skill 唯一 subAgent 的执行控制器；
- 统一 subAgent 层只发布 Working State、Trace、Requirement、Evidence 与交付；
- 不额外启动第二个自由规划模型；
- Main Planner 不得覆盖 Flow 产生的 `ask_user` 或完成交付。

## 完成语义

subAgent 只允许返回：

- `completed`
- `insufficient_evidence`
- `needs_input`
- `failed`

带受管私有 Runtime 的 Skill 不能在没有 Runtime Evidence 或 Artifact 时宣称完成。纯说明书 Skill 可基于其说明书给出分析结论，但必须如实标明依据和缺口。

## 简单 Smoke

### Smoke A：已有 Office Skill

输入一个 DOCX / PDF / PPTX / XLSX 任务。

检查：

- 只启动一个 subAgent；
- 使用正确私有 Runtime；
- 写操作经过精确审批；
- 完成后 Main Planner 不重新施工；
- 现有文枢 smoke 不回退。

### Smoke B：GitHub Skill

输入：读取已授权仓库近期 PR 并给出风险。

检查：

- 命中 `github-collaboration`；
- 只启动一个 subAgent；
- GitHub 工具来自当前 ToolExposure，不由 SKILL.md 自行授予；
- 只读任务不触发写审批；
- 结论包含当前远程事实和缺口。

### Smoke C：Stateful Skill

进入备孕评估，回答一轮信息后继续。

检查：

- 只有一个 Skill 执行所有者；
- Flow/Reducer 决定下一问；
- 不再启动第二层自由 Planner；
- `ask_user` 在 prepareContext 后直接交付，不被 Main Planner 改写；
- 完成后按冻结交付合同直接 Generate。

## 必须覆盖的测试

- 任意 Scanner Skill 都能解析出唯一 profile。
- 用户或外部 Skill 不因重用 built-in id 获得私有 Runtime。
- Office Scanner manifest 仍保留 `read_open` / `read_extract` 和既有 Runtime。
- Skill 声明工具但当前 ToolExposure 未选择时，subAgent 返回 capability Requirement。
- 部分能力可用时允许继续可完成路径，例如 XLSX inspect / verify。
- Stateful Flow 的 interrupted/completed 映射到同一 subAgent 的 needs_input/completed。
- prepared `ask_user` 在 Pi loop 中直接 Generate，不进入 Main Planner。
- terminal / recoverable C contract 不变。

## 验收标准

- 当前所有可发现 Skill 均走统一 subAgent 委派合同。
- 一 Skill 一 subAgent，不套娃。
- 工具权限没有因 Skill 声明而扩大。
- Office、GitHub 与 Stateful Flow 的既有专业边界不回退。
- Main Agent C contract 保持不变。
- 单测、typecheck 与 smoke 实际通过后才可把本卡改为 DONE。

## 施工红线

1. 不新增 Main Agent Graph 节点或 Planner action 类型。
2. 不绕过 Harness、Policy、审批或 Evidence。
3. 不让 SKILL.md 成为权限来源。
4. 不把 Runtime Binding 当成多个 subAgent。
5. 不把 Stateful Flow 再包一层自由 Agent Loop。
6. 不为通过单个测试硬编码用户任务或返回值。
7. 不顺手重构无关模块、升级依赖或全仓格式化。

## 实现记录

已落地：

- Scanner / Registry 输出通用 `origin + execution` 声明。
- 通用 `resolveSubAgentExecutionProfile()` 覆盖所有 Skill。
- `runSubAgent()` 替代文枢专用 runner，旧入口只保留兼容导出。
- Harness 工具采用 Skill 声明与 canonical ToolExposure 的交集。
- Office 既有只读面、私有 Runtime、审批和 Evidence 合同被保留。
- GitHub Skill 只补执行元数据，专业正文未重写。
- Stateful Flow 接入为单 subAgent 的确定性控制器。
- Pi loop 在 prepareContext 后直接处理 subAgent `ask_user` / completed handoff。
- 增加通用 profile 与用户 Skill 权限隔离回归测试。

尚未在当前执行环境运行：

- Vitest
- server / desktop typecheck
- `pnpm check`
- 真实模型与私有 Runtime smoke

在上述验证完成前，本卡保持 `IMPLEMENTED — VERIFICATION PENDING`。