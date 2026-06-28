# 缺陷台账（Defect Log）

Status: Current
Owner: bugfix
Last verified: 2026-06-26
Layer: raw-source
Module: Develoments
Feature: DefectTracking
Doc Type: implementation-notes
Canonical: true
Related:
  - README.md
  - ../knowledge-system/AI_READING_SCOPE.md

## 目的

记录当前已经确认的问题、影响范围、临时状态与下一步排查方向。

## 2026-06-27

### Chat Agent `terminal_session` 启动失败

- Layer: runtime / harness / terminal capability
- Status: Confirmed
- Severity: High for Agent local-tool scenarios

现象：

- 在普通聊天中启用 `Agent`
- 模型选择 `terminal_session` 后
- execution trace 显示 tool 节点失败
- 错误为：`spawn powershell.exe ENOENT`

已确认边界：

- 这不是 RAG 问题
- 这不是 Role / Summary 注入问题
- 这不是模型正文生成问题
- 这不是 `del 222.txt` 之类具体命令语法问题
- 这是 terminal capability 在启动 shell 进程时失败

当前判断：

- 终端 runtime 依赖 `powershell.exe`
- 当前运行环境里该可执行文件没有被正确解析
- 可能是 PATH 丢失、shell 路径硬编码不稳，或 capability runtime 没按当前平台做稳健解析

影响：

- Agent 已经能看到并选择内置 terminal 能力
- 但 terminal 类任务无法真正执行
- 用户会在 timeline 中直接看到 tool fail

已完成进展：

- Agent / chat tool-loop 主链已接通
- built-in tool surface 已对 Agent 放开
- external MCP 仍未暴露给 Agent
- 小上下文模型在 Agent 工具判定阶段的历史裁剪已加入

下一步：

- 检查 `terminal_session` runtime 的 shell 解析策略
- 明确 Windows 下是否允许：
  - 直接解析绝对 PowerShell 路径
  - 在 `powershell.exe` 不可用时切换到 `pwsh.exe`
  - 或通过统一 shell resolver 收口
- 修复后补 capability 级单测和 chat 侧回归验证
