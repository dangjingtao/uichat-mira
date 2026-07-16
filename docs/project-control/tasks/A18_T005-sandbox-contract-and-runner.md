# A18_T005 — Sandbox 能力合同与 Runner 收口

- 状态：READY
- 仓库：`dangjingtao/uichat-mira`
- 基线分支：`dev`
- 类型：Sandbox 基础能力 / 安全合同
- 前置任务：`A18_T001`、`A18_T002`、`A18_T003`
- 合并顺序：第 5 张
- 本卡完成前不开放 Python model-visible tool

## 背景

仓库已有：

- `server/src/harness/sandbox/contract.ts`
- `server/src/harness/sandbox/index.ts`
- `server/src/sandbox/executor.ts`
- `command` profile 的 L1 workspace runner
- timeout、output limit、env allowlist、cwd workspace lock、artifact 基础能力

需要收口真实安全边界、profile 状态、审批、路径与 Evidence 合同。

## 目标

形成 Terminal 与后续 Python 共用的最小 Sandbox Runtime 合同。不改 AgentGraph，不实现容器平台。

固定链路：

`Planner → Normalize → Policy → ToolNode → Harness/Sandbox → Evidence → Planner`

## 施工范围

优先检查：

- `server/src/harness/sandbox/contract.ts`
- `server/src/harness/sandbox/index.ts`
- `server/src/sandbox/executor.ts`
- terminal_session definition / adapter / executor
- MCP sandbox capability metadata
- workspace boundary、Policy、artifact、trace 测试
- `docs/harness/sandbox-module.md`

不得：

- 新增 Graph 节点。
- 引入 Docker、WASM、isolated-vm、AppContainer 大改。
- 实现 `networked_command`。
- 开放任意系统命令免审批。
- 把外部 MCP path 当宿主 workspace path。
- 把 Sandbox 做成万能集成容器。
- 在本卡实现 Python tool。

## 合同要求

### Profile 状态

必须可查询且真实：

- `command`：当前 L1 runner，已实现。
- `read_only`：未实现则 blocked。
- `workspace_write`：未实现则 blocked。
- `networked_command`：blocked。
- 声明 profile 不等于已实现。

### 安全能力声明

已保证至少包括：

- cwd 绑定 workspace。
- cwd escape / traversal 阻止。
- env allowlist。
- timeout。
- output limit。
- structured result。
- artifact workspace boundary。

未验证不得宣称：

- 完整网络隔离。
- 完整文件系统隔离。
- 可靠阻止所有子进程。
- Windows 完整 kill tree。
- hostile-code 强隔离。

### 请求合同

`SandboxRunRequest` 只能由 Harness 构造。

模型不能直接选择：

- shell/Python executable absolute path。
- 任意宿主 env。
- sandbox implementation。
- 隐藏安全开关。

cwd 沿用 directory 合同，不复用普通 path 的 sentinel 改写。

### 结果合同

稳定返回：

- status
- exitCode
- stdout/stderr
- encoding
- duration
- truncated
- binaryDetected
- violations
- artifacts

blocked / timed_out / failed / completed 明确区分。

结果通过 Tool Adapter 转 `McpToolEvidence`，Graph 不解析。

### 审批

- command/cwd/env/timeout/artifact request 变化即形成新 pendingToolCall 与 inputHash。
- 审批不可跨 inputHash 复用。
- Sandbox 不放宽 Policy。
- 本卡不重写风险模型。

### 路径语义

- `workspaceBound: true` 的本地工具按声明 argKeys/argTypes 做 boundary。
- 未声明 workspaceBound 的外部 MCP 不做宿主路径猜测。
- 外部 MCP 需要宿主 workspace 时必须显式声明 capability。
- 禁止按参数名 `path/filePath/cwd` 全局猜测。

## 必须覆盖的测试

1. command 正常执行并返回完整 result。
2. cwd 空值默认 workspace root；合法相对 cwd 可用。
3. POSIX absolute、Windows absolute、traversal cwd 拒绝。
4. env allowlist 生效。
5. timeout、truncation、binary/unreadable 可区分。
6. artifact workspace 内可注册，越界拒绝。
7. 未实现 profiles 明确 blocked。
8. inputHash 变化后旧审批不可复用。
9. terminal result 通过通用 Evidence 进入 Planner/Generate。
10. 外部 MCP remote path 不被宿主 normalizer 改写。
11. capability 未声明 workspaceBound 时不按参数名猜路径。
12. Graph 主链测试不变。

## 验收标准

- Sandbox 真实能力与限制可查询、可测、可文档化。
- command runner 使用统一合同。
- 未实现 profile 明确 blocked。
- 路径、审批、结果、Evidence 边界清楚。
- 不增加 Graph 复杂度。
- 不出现 toolId/MCP/参数名猜测硬编码。
- 单测、集成测试、direct bench、typecheck 通过。

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
