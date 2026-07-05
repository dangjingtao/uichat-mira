# Harness 1期实施 Checklist

Status: Current
Owner: runtime
Last verified: 2026-07-05
Layer: wiki
Module: Harness
Feature: Phase1Implementation
Doc Type: checklist

## 目标

这一期目标不是做“完整沙箱平台”，而是完成一套**桌面轻量级、可审计、可治理的 Harness + Sandbox v0.5**。

本期边界：

- `Harness` 继续作为执行与治理中枢
- `Sandbox` 独立成模块，但只做轻量 v0.5
- 工具暴露策略收口为 Harness 内部策略子域
- 外部 MCP 保留专门治理

## 完成定义

当下面这些条件同时满足时，可认为 1 期完成：

- 命令执行不再直接散落在 tool runtime 内
- `SandboxExecutor` 已成为统一受控执行入口
- workspace 边界检查为真实路径检查，而不是字符串判断
- 进程树能被超时 / 取消统一回收
- invocation / trace / artifact / error 可稳定回传
- 外部 MCP 继续与内置 tool 分开治理
- 基础 GC / retention 策略落地

## A. Harness 收口

- [x] 明确 `Harness` 与 `Sandbox` 的模块边界
- [x] 把“工具暴露策略”从 `chat / agent / route` 的散落逻辑收口为 Harness 内部策略子域
- [x] 为工具暴露策略补单测
- [x] 明确内置 tool 与外部 MCP projected tool 的可见面边界
- [x] 增加 `resolveHarnessToolCandidatesForTurn(...)` 候选工具暴露 API
- [x] 明确 `CapabilityMatch / ToolExposure / Invocation` 三层命名契约
- [x] 明确 `preferredToolId` 只是 hint，不是执行选择
- [x] 明确 Harness 对 Agent 只上抛工具候选与工具元信息，不再上抛可执行 capability 状态
- [x] 删除外层 route 级越界 `web_search` 预取
- [ ] 补一份 Harness runtime 真实模块图

## B. Sandbox 模块 v0.5

- [x] 新建独立 `Sandbox` 模块目录与入口
- [x] 定义 `SandboxExecutor` 统一接口
- [x] `SandboxExecutor` 支持 `command / args / cwd / env / timeout / outputLimit`
- [x] 所有 CLI 执行改走 `SandboxExecutor`
- [x] 明确 `SandboxExecutor` 不承担审批，不替代 Harness

### B1. Workspace 边界

- [x] 所有 `cwd` 先做绝对路径解析
- [ ] 所有文件参数先做绝对路径解析
- [x] 使用真实路径判断是否位于 workspace root 内
- [x] 拒绝 `..`、软链接逃逸、绝对 cwd 输入
- [x] 补齐 workspace 越界单测

### B2. 命令策略

- [x] 把命令白名单升级为“命令 + 参数策略”
- [x] 禁止明显危险入口，例如 `node -e`、`python -c`
- [x] 禁止明显全局副作用入口，例如 `git config --global`
- [ ] 对联网类命令单独标记风险
- [ ] 为命令策略补 fixture 用例

### B3. 进程治理

- [ ] 所有执行都记录 pid / invocationId
- [x] 超时时统一结束进程树
- [x] 取消时统一结束进程树
- [x] 失败时清理短生命周期进程句柄
- [x] Windows 下使用 best-effort kill tree，并在 result 中标记 limitation

### B4. 输出与资源限制

- [x] 为 stdout / stderr 增加总量上限
- [x] `stdout` / `stderr` 编码结果显式回传
- [x] 二进制输出不再直接按文本回传
- [x] workspace 内文件/目录支持显式 artifact 注册
- [x] 为执行增加 timeout
- [ ] 为并发执行增加上限
- [ ] 明确默认不允许长驻后台进程逃逸
- [x] 输出超限时返回标准化错误
- [x] 新增绕过 LLM / Planner 的 direct bench，并输出结构化 JSON

### B5. 环境变量治理

- [x] 默认不透传完整 `process.env`
- [x] 定义最小 env 白名单
- [ ] 把 secret 类 env 与普通 env 分开
- [x] 为 env 过滤补单测
- [x] persistent PTY 创建路径复用 env 白名单

## C. 风控与审批

- [x] 明确 `sideEffect` 只是初筛，不是最终边界
- [x] 保持“沙箱优先、审批兜底”
- [ ] 越出 root / sandbox 时进入审批
- [ ] 为 `terminal_session`、`edit_file`、外部 MCP 明确审批语义
- [x] 文档中明确 v0.5 不是完整安全沙箱

## D. 外部 MCP 专门治理

- [x] 保持 external MCP 与 internal tool 分开展示
- [x] 保持 external MCP 与 internal tool 分开审计
- [x] `stdio` projected capability 默认按高风险处理
- [x] 未知副作用 projected capability 默认按需审批处理
- [x] server 级 trace / disclaimer / transport 信息可查询

## E. 生命周期与 Retention

- [x] invocation 结束后清理短生命周期资源
- [x] invocation 结束后保留 trace / artifact / error / approval 记录
- [x] 为 `invocationMap` 增加 retention 策略
- [x] 为 `traceMap` 增加 retention 策略
- [x] 为 `agentRunStore` 增加 retention 策略
- [x] 为 retention 增加 sweeper 或定期回收机制

## F. 测试

- [x] 成功执行路径测试
- [x] workspace 越界拒绝测试
- [x] timeout 测试
- [x] cancel 测试
- [x] 输出超限测试
- [x] env 过滤测试
- [x] 进程树清理测试
- [x] 外部 MCP 风险分层测试
- [x] retention / cleanup 测试
- [x] Sandbox direct bench 正负向样例与 `not_implemented` 标记

## G. 文档与验收

- [x] 更新 Harness 真相文档
- [x] 新增 Sandbox 模块说明页
- [x] 写清楚 v0.5 与未来强沙箱版的边界
- [x] 写清楚外部 MCP 的专门治理规则
- [x] 列出 1 期未做项，避免误判为“完整沙箱”

## 当前判断

以当前项目体量和目标来看，这一版 1 期范围是可落地的，前提是：

- 不在 1 期追求完整跨平台强隔离
- 不把外部 MCP 与内置 tool 强行统一成一个执行面
- 不把 `SandboxExecutor v0.5` 误称为最终沙箱
