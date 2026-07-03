# Sandbox 模块说明

Status: Current
Owner: runtime
Last verified: 2026-06-28
Layer: wiki
Module: Sandbox
Feature: ModuleDefinition
Doc Type: current-contract

## 单点真相范围

这页定义当前项目里 `Sandbox` 模块在 1 期的真实职责与边界。

它回答：

- `Sandbox` 是什么
- `Sandbox` 当前做到了什么
- `Sandbox` 当前明确不做什么
- 它和 `Harness`、external MCP、persistent PTY 的关系是什么

## 当前定位

当前 `Sandbox` 不是完整强隔离平台。

更准确地说，它是：

- 一个独立模块
- 被 `Harness` 调用的受控执行层
- 当前主要承接命令执行的轻量 v0.5 路线

它不直接等同于：

- Docker / VM / AppContainer 级强隔离
- 统一承接所有执行型 capability 的最终运行时
- external MCP 的真实执行平面

## 当前已实现

当前 1 期已经实现：

- `SandboxExecutor` 独立入口
- workspace 真实路径边界检查
- 最小 env 白名单
- stdout / stderr 总量限制
- timeout
- abort / 进程树终止
- 最小命令 + 参数策略

相关实现：

- [executor.ts](/D:/workspace/rag-demo/server/src/sandbox/executor.ts)
- [policy.ts](/D:/workspace/rag-demo/server/src/sandbox/policy.ts)
- [executor.test.ts](/D:/workspace/rag-demo/server/src/sandbox/executor.test.ts)

## 当前接入范围

当前 1 期已经接入：

- `terminal_session` 的 ephemeral child-process 路径

当前 1 期没有接入：

- `terminal_session` 的 persistent PTY 路径
- external MCP 的真实执行
- `edit_file`

## 与 Harness 的关系

### Harness 负责

- tool registry
- invocation lifecycle
- approval
- trace / artifact / audit
- 风险与治理边界

### Sandbox 负责

- 命令执行
- 执行前边界检查
- 进程级资源控制
- 输出与超时限制

### 不该混的边界

- `Sandbox` 不持有审批最终状态
- `Sandbox` 不直接决定 tool exposure
- `Sandbox` 不替代 `Harness` 的 invocation 状态机

## 与 external MCP 的关系

当前决议是：

- external MCP 继续保留专门治理
- 1 期不把 external MCP 的真实执行统一并入 `SandboxExecutor`
- 但 external MCP 的风险、transport、审计边界仍由 Harness 统一定义

原因：

- external MCP 不只是命令执行问题
- 它还包含 server 生命周期、transport、secret、免责声明和投影治理

## 与 persistent PTY 的关系

当前决议是：

- ephemeral child-process 路径进入 `SandboxExecutor`
- persistent PTY 路径 1 期继续保留现状

原因：

- 先收口最容易失控的非持久进程执行面
- 避免在 1 期同时重写交互式 PTY 语义和沙箱边界

## 1期不是最终沙箱

当前 `SandboxExecutor v0.5` 的正确表述是：

- 受控执行器
- 轻量沙箱前置层
- 桌面级可治理执行面

它不是：

- 严格意义上的安全沙箱
- 三端统一强隔离运行时

## 后续方向

后续可能继续补：

- persistent PTY 是否并入 Sandbox
- external MCP 与 Sandbox 的衔接
- 并发限制
- 联网命令专门风险标记
- 更强的跨平台执行后端抽象

