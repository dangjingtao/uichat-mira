# A19_T001 — 所有现有 Skill 统一接入 subAgent Runtime

- 状态：READY
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

### 非目标

- 不新增 Agent Graph 拓扑。
- 不重开 Planner、Normalize、Policy、ToolNode、Evidence、Generate 或 C contract。
- 不引入多 subAgent 编排、swarm、manager/worker 或嵌套 Agent。
- 不为每个 Skill 手工复制一套 runner。
- 不因接入 subAgent 自动扩大 ToolExposure。
- 不顺手重做 Skill 商店、安装 UI 或 UChat 展示。

## 通用执行合同

建议收口为通用类型，具体命名可按现有代码风格调整：

```ts
type SubAgentExecutionProfile = {
  skillId: string
  engine: "pi-agent-core"
  allowedHarnessToolIds: string[]
  runtimeBindings: SubAgentRuntimeBinding[]
  workspaceBound: boolean
}
```

约束：

1. profile 来源必须是通用 Registry / Resolver，不再以 `WENSHU_*` 专用映射作为唯一入口。
2. 同一轮只选择一个 primary Skill，并启动其唯一 subAgent。
3. Skill 私有 Runtime 只对对应 subAgent 可见。
4. Harness 工具仍以真实注册、授权和 Policy 结果为准。
5. 缺少能力时返回标准 requirement，不伪造成功。
6. `pi-agent-core` 不出现在用户可见文案中。

## Skill 包最低质量基线

现有 Skill 可以修订，但只补齐执行所必需的规范，不进行无关重写。每个 Skill 至少应具备：

- 稳定 `id`、`version`、名称、描述与适用范围；
- 清楚的使用时机与不适用范围；
- 可执行的工作方法 / 计划，而不是泛泛角色提示；
- 工具、Runtime、权限和审批边界；
- Evidence、Artifact 与 Completion Criteria；
- 缺资料、缺能力、失败和恢复规则；
- 渐进式资源披露，避免一次注入全部参考资料；
- Skill 与 Tool 分离，不通过说明书暗中注册能力。

如某个 Skill 已满足要求，不得为了统一文风而改写其专业内容。

## 施工范围

优先检查或修改：

- Skill Scanner / Loader / Registry
- SkillContext 与 primary Skill 选择
- subAgent profile resolver
- 当前 forked Skill agent runner 的通用命名与入口
- 文枢专用 profile 的迁移兼容
- GitHub、MiraDocs、备孕及其他现有 Skill 的接线
- 服务端单测、集成测试和最小 smoke

## 简单烟测用例

### Smoke 1：当前 Skill 全量解析

1. 启动服务端并扫描当前 Skill 包。
2. 读取实际发现的 Skill 列表。
3. 对每个 Skill 调用通用 profile resolver。
4. 断言每个 Skill 恰好得到一个 profile，`engine=pi-agent-core`。
5. 断言不存在同一 Skill 多 profile 或无 profile。

### Smoke 2：文枢能力不回退

1. 分别触发 DOCX、PDF、XLSX、PPTX 的最小只读或安全诊断任务。
2. 断言每次只创建一个 subAgent run。
3. 断言只暴露对应 Skill 的 Runtime 与允许的 Harness 工具。
4. 断言返回 Evidence；可生成 Artifact 的任务同时返回 Artifact。

### Smoke 3：GitHub Skill 统一接线

1. 使用已授权仓库发起只读项目概览任务。
2. 断言命中 `github-collaboration` 后创建一个 subAgent。
3. 断言仍只使用现有四个 GitHub 领域工具。
4. 断言不扩大 ToolExposure，不产生远程写入。

## 验收标准

- 当前可发现的全部 Skill 均进入同一 subAgent Runtime。
- 一个 Skill 恰好对应一个 subAgent profile；一次任务只实例化一个 subAgent。
- 不存在 subAgent 套娃或按 Skill 随意配置数量。
- 文枢、GitHub 等现有能力与审批边界不回退。
- Skill 包必要修订符合最低质量基线，且无无关内容重写。
- Main Agent C contract 与主循环职责保持不变。
- 单测、集成测试、smoke、server typecheck 通过。

## 施工红线

1. 不把 Tool 当 Skill，也不把 Skill 当 ToolExposure 开关。
2. 不为某个具体 Skill 在 Main Agent / Graph 中增加特判。
3. 不允许 subAgent 创建下一级 Agent。
4. 不绕过 Harness、Policy、审批、Evidence 或 workspace 边界。
5. 不修改 GitHub Skill 的远程写入前读、审批后写、执行后回读合同。
6. 不以“统一”为理由重写已经合格的 Skill 专业内容。
7. 如通用合同不足，先提交合同缺口，不私自扩张架构。

## 交付要求

完成后提供：

- 实际接入的 Skill 清单；
- 旧专用入口与新通用入口的迁移说明；
- 修改过的 Skill 包及修改原因；
- 测试命令与结果；
- 已知限制；
- 一个聚焦提交，不夹带无关重构或依赖升级。
