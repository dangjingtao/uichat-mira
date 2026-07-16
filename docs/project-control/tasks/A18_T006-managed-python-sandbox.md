# A18_T006 — 受管 Python Sandbox

- 状态：READY
- 仓库：`dangjingtao/uichat-mira`
- 基线分支：`dev`
- 类型：Sandbox 执行能力
- 前置任务：`A18_T005`、`A18_T002`
- 合并顺序：第 6 张
- 第一版目标：可控、可审计、默认关闭；不是 Notebook 平台

## 背景

Agent 需要 Python 做数据分析、文件处理、代码验证和 artifact 生成。

不能把裸 `python` 命令交给模型，也不能让模型自行选择系统解释器、安装包、读取用户目录或继承宿主环境。

## 目标

实现 Harness 管理的 Python 执行能力。模型侧只看到统一工具，例如 `python_session`。Python 是 Sandbox Runtime 的一种受管执行器，不是 Graph 新分支。

## 第一版非目标

- 不做 Jupyter Notebook。
- 不做长驻 kernel。
- 不做任意 pip install。
- 不做网络访问。
- 不做 GPU/CUDA。
- 不做多 provider 编排。
- 不做远程容器集群。
- 不承诺未验证的 hostile-code 强隔离。
- 不提供 shell escape 万能终端。

## 施工范围

优先检查或新增：

- Sandbox runtime 配置与 capability reporting
- 受管 Python executor / adapter
- 模型可见 tool definition
- Harness 注册与 exposure
- Policy / approval metadata
- Tool result → `McpToolEvidence`
- artifact 回收
- Python runtime health check
- server tests 与最小文档

不得修改：

- Graph 拓扑
- Planner action 类型
- Normalize/Policy/ToolNode 主职责
- 大前端设置系统
- 微应用 runtime
- terminal_session 语义

## 模型可见合同

建议工具名 `python_session`，输入最小化：

```ts
type PythonSessionInput = {
  code: string
  cwd?: string
  timeoutMs?: number
  artifactRegistrations?: Array<{
    path: string
    kind?: "file" | "directory" | "log" | "report"
  }>
}
```

模型不得传入：

- `pythonExecutable`
- `venvPath`
- `pipArgs`
- 任意宿主 env
- 网络开关
- shell command
- 安全实现类型
- 用户主目录

解释器与环境由应用受管配置选择，不属于 tool args。

## Runtime 配置

1. 默认关闭：未配置或 health check 失败时不暴露。
2. 固定解释器：tool call 不得覆盖路径。
3. 健康检查：版本、可执行性、基础模块、工作目录能力。
4. 能力声明：可用状态、Python version、预装包/allowlist、隔离等级与限制。
5. 不把解释器 absolute path、宿主用户名、完整 env 暴露给模型或 Evidence。

## 执行合同

### Workspace

- cwd 必须 workspace-relative。
- 默认 workspace root。
- 输入输出只通过 workspace / 受管临时目录。
- artifact 必须经过 workspace boundary。

### 环境

- 最小 env allowlist。
- 不继承 token、API key、代理、数据库密码、用户 profile。
- 默认禁网；若 L1 无法验证网络隔离，必须标记限制，不得宣称强隔离。
- 默认禁止或限制 subprocess；无法可靠阻止时明确标记并保持高风险审批。

### 依赖

第一版禁止：

- `pip install`
- `python -m pip`
- conda / uv / poetry 安装
- 修改全局 site-packages

可选择标准库，或产品预装的固定包 allowlist。包清单来自 runtime 配置，不得在 Planner/Graph 硬编码。

### 资源

至少支持：

- timeout
- output limit
- artifact size/count limit
- 进程取消
- structured status

CPU/内存无法可靠限制时必须明确，不得伪装已实现。

## 执行方式

Harness：

1. 生成受管临时脚本。
2. 绑定 workspace cwd。
3. 用固定解释器执行。
4. 捕获 stdout/stderr/encoding/exitCode。
5. 验证并回收 artifacts。
6. 删除临时脚本或按 trace policy 保存。
7. 生成通用 `McpToolEvidence`。
8. 回到 Planner。

Graph 不检查 Python exitCode，也不解析 pandas/matplotlib 结果。

## Policy 建议

- `sideEffect: process`
- `requiresApproval: true`
- `workspaceBound: true`
- `sandboxRequired: true`
- `networkAccess: false`
- `longRunning: true`

每次 code、cwd、timeout、artifact request 变化都必须产生新 inputHash 与新审批。

## 必须覆盖的测试

1. Runtime 未配置时不暴露。
2. health check 失败时 unavailable。
3. 简单标准库代码执行并返回 stdout。
4. syntax error / 非零 exit 返回 failed evidence，不导致 Graph terminal failure。
5. timeout 返回 timed_out。
6. 超长输出截断。
7. cwd absolute/traversal 拒绝。
8. workspace artifact 可回收，越界拒绝。
9. tool args 不能覆盖解释器、env、网络、pip。
10. pip/conda/uv/poetry 安装不可达或明确阻止。
11. 敏感 env 不继承。
12. code 改变后旧审批不可复用。
13. Python 结果通过通用 Evidence 进入最终回答。
14. 不存在 `if toolId === "python_session"` 的 Graph 分支。
15. 重启后无长驻 kernel 状态。
16. Windows kill tree 限制被测试或文档明确。
17. 至少一个真实最小 smoke。

## 验收标准

- Python runtime 默认关闭，配置且健康后才暴露。
- 模型不能选择解释器、安装包、env 或网络。
- 执行受 workspace、审批、timeout、output、artifact 合同约束。
- 结果统一进入 Evidence。
- 不改 AgentGraph。
- 不按代码关键词、包名、文件名写 Graph 特判。
- 单测、集成测试、smoke、typecheck 通过。
- 文档明确已保证与未保证的隔离能力。

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
