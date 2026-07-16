# A18_T004 — MicroAPP Definition 版本化迁移

- 状态：READY
- 仓库：`dangjingtao/uichat-mira`
- 基线分支：`dev`
- 类型：P1 技术债 / 数据兼容
- 前置任务：无
- 合并顺序：第 4 张
- 可独立并行，但必须独立 PR

## 背景

当前 `micro_app_definitions` 通过 `CREATE TABLE IF NOT EXISTS`、`seedDefaults()`、`reconcileSeededDefinitions()` 初始化。

reconcile 主要在字段为空时回填 description、access points、binding schema、runtime key，没有 definition schema version。旧记录可能结构合法但语义过期，导致旧安装与新安装行为不同，甚至微应用静默消失。

## 目标

增加最小、确定、可测试的 definition 版本迁移机制。不是重写全局数据库 migration framework。

## 施工范围

优先检查：

- micro app 数据表 / Drizzle schema
- `server/src/db/repositories/micro-apps.repository.ts`
- `defaultDefinitionSeeds`
- 初始化、legacy migration、seed、reconcile 顺序
- repository / service / API 测试
- 必要的技术债记录

不得：

- 重写整个数据库迁移系统。
- 修改所有微应用 runtime。
- 大改前端或注册中心。
- 在多处散落 `if (type === "...")`。
- 无条件覆盖用户可配置值。

## 最小合同

### Schema

增加持久化版本字段，例如：

```ts
definitionSchemaVersion: number
```

旧数据可安全读取。

### Seed

每个默认 definition 声明当前 schema version。

### 初始化顺序

1. 确保表和列存在。
2. 迁移 legacy table。
3. 插入缺失 seed。
4. 按版本迁移已有 seeded definition。
5. 产生可测试、可审计的迁移结果。

### 字段所有权

- 系统字段：可由迁移更新，如 runtime key、官方 access point、系统 binding schema 结构。
- 用户字段：名称、enabled、用户填写的绑定值，不得被 seed 无条件覆盖。
- 混合字段：必须定义 merge 规则，不能整体替换。

### 幂等性

- 重复初始化不破坏数据。
- 当前版本不重复迁移。
- 未知 type 不删除、不强套 seed。
- 迁移失败不静默吞掉。

## 实施要求

1. 使用版本驱动迁移，不再只依赖“字段为空”。
2. 迁移逻辑集中、可读、可测。
3. 禁止为每个 type 在多处散落硬编码。
4. 不引入过度抽象。
5. 保留 enabled、用户名称等用户值。
6. 新安装与旧安装升级后的 definition 语义一致。
7. 不把 runtime、Agent、Sandbox 施工混入本卡。

## 必须覆盖的测试

1. 新数据库默认 definitions 带当前 version。
2. 旧表缺 version 列时安全补列并迁移。
3. version 低、字段非空但语义过期时能升级。
4. 用户字段不被覆盖。
5. 当前 version 幂等。
6. 未知 type 保持原样。
7. 非法 JSON / 迁移中断有明确策略。
8. 迁移后 list/getByType 正常。
9. access point/runtime key/binding schema 升级后不隐藏卡片。

## 验收标准

- 存在持久化 definition version。
- 已知 seed 通过版本确定性迁移。
- 用户数据不被无条件覆盖。
- 初始化幂等。
- 不出现 type 特判森林。
- 不改 AgentGraph。
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

## 交付要求

完成后必须提供：

- 改动文件清单。
- 行为变化说明。
- 新增或修改测试清单。
- 实际测试命令与结果。
- 是否影响现有黑盒、审批、Evidence、Trace。
- 已知限制。
- 一个独立提交；不得夹带全仓格式化、依赖升级或无关清理。
