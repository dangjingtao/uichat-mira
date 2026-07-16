# A18_T001 — 恢复 Workspace Path 参数合同

- 状态：READY
- 仓库：`dangjingtao/uichat-mira`
- 基线分支：`dev`
- 类型：P0 技术债 / 安全语义回归
- 前置任务：无
- 合并顺序：第 1 张
- 可与 `A18_T002` 并行施工，但本卡先合并

## 背景

当前 `server/src/mcp/workspace-path-args.ts` 中，`normalizeWorkspaceRelativePathArg()` 会把所有以 `/` 开头的参数执行 `slice(1)`。

这会把 `/README.md`、`/etc/passwd` 等绝对路径静默改写为 workspace 内相对路径。它不一定越界，但会改变目标对象语义；下游 Policy 已无法知道 Planner 原本指定的是绝对对象。

当前 `server/src/agent/__tests__/tool-call-normalize.test.ts` 还有测试在保护这个错误行为。

## 目标

1. 只有 `/workspace` sentinel 可以转换为 workspace-relative path。
2. 其他 POSIX 绝对路径保持原始语义，交给下游 workspace boundary / Policy。
3. Windows drive absolute 与 UNC 保持不变。
4. 相对路径与 traversal 防护不回归。
5. `terminal_session.cwd` 的 directory 合同保持独立，不与普通 path 混修。

## 施工范围

优先检查并仅在需要时修改：

- `server/src/mcp/workspace-path-args.ts`
- `server/src/agent/__tests__/tool-call-normalize.test.ts`
- 与 workspace boundary / permissions 直接相关的现有测试
- 必要的任务或技术债记录

不得修改：

- AgentGraph 拓扑
- Planner prompt
- ToolNode 执行职责
- 已确认的 `normalizeWorkspaceRelativeDirectoryArg()` cwd 合同
- 外部 MCP 的远端路径语义

## 目标合同

| 输入 | 期望 |
|---|---|
| `/workspace` | `.` |
| `/workspace/` | `.` |
| `/workspace/docs/a.md` | `docs/a.md` |
| `docs/a.md` | 保持相对语义 |
| `./docs/a.md` | 可规范化为 `docs/a.md` |
| `../outside.txt` | 拒绝 |
| `/workspace/../outside.txt` | 拒绝 |
| `/README.md` | 保持 `/README.md` |
| `/docs/README.md` | 保持 `/docs/README.md` |
| `/etc/passwd` | 保持 `/etc/passwd` |
| `/bin/sh` | 保持 `/bin/sh` |
| `/usr/bin/env` | 保持 `/usr/bin/env` |
| `/C:/Windows/System32` | 保持原始绝对语义 |
| `D:\outside.txt` | 保持不变 |
| `\\server\share\x.txt` | 保持不变 |

Directory / cwd 继续维持：

- `.`、`server`、`server/src` 可接受。
- POSIX absolute、Windows absolute、parent traversal 必须拒绝。
- 不得把绝对 cwd 转成 `.`。

## 实施要求

1. 删除普通 `trimmed.startsWith("/") -> slice(1)` 的广义转换。
2. 只识别精确 `/workspace` sentinel 及其子路径。
3. Normalize 只做语义保持的规范化，不猜测用户“其实想表达 workspace 根路径”。
4. 绝对 path 是否允许访问，由既有 boundary / Policy / runtime 决定。
5. 当前错误测试必须反转为正确合同测试，不能删除后不补。
6. 禁止通过 `/etc/passwd` 等路径名单修复，规则必须对所有非 sentinel POSIX absolute 成立。

## 必须覆盖的测试

1. `/workspace`、`/workspace/...` 正确规范化。
2. 普通相对路径不回归。
3. plain traversal 与 sentinel traversal 拒绝。
4. `/README.md`、`/docs/README.md`、`/etc/passwd`、`/bin/sh`、`/usr/bin/env` 保持绝对语义。
5. `/C:/Windows/System32` 不剥离首个 `/`。
6. Windows drive absolute 与 UNC 保持不变。
7. `workspace_mutation.targetPath` 的非 sentinel absolute 不改写。
8. `terminal_session.cwd` 既有拒绝测试继续通过。
9. 下游 boundary 仍能阻止或正确审批 workspace 外 absolute。

## 验收标准

- 不再存在“任意 leading slash 转 workspace-relative”的逻辑。
- 错误测试已反转。
- 不新增系统路径名单或 toolId 特判。
- Normalize、Policy、ToolNode 职责未改变。
- AgentGraph 主链未变。
- 相关单测与 typecheck 通过。

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
