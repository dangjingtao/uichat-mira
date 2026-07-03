---
status: current
priority: P0
owner: runtime
last_verified: 2026-07-02
layer: project-control
module: ProjectControl
feature: CoreToolsEditBoundary
doc_type: task-card
canonical: true
related:
  - docs/tooling-runtime/core-tool-rectification-ledger.md
  - docs/tooling-runtime/core-tool-matrix-review.md
  - docs/tooling-runtime/tools-protocol.md
task_state: DONE
---

# core_tools_T001 Edit Workspace Boundary

## Target

让 `edit_file` 的路径处理严格限制在 workspace 内，禁止路径逃逸。

问题本体：

- `edit_file` 属于高风险本地写工具
- 如果路径边界不够严格，模型或调用方可能写到 workspace 之外
- 这张任务卡只处理 Edit 的路径边界，不扩大到其它工具治理

## Allowed Changes

- `edit_file` 路径解析与 workspace boundary 相关实现
- 与 `edit_file` 路径越界防护直接相关的测试
- 与该任务直接相关的当前文档更新

## Forbidden Changes

- 把本任务扩大成全量工具 boundary 重写
- 顺手修改 Edit action profile
- 顺手引入目录创建 / 删除 / 移动 / 重命名能力

## Acceptance Criteria

1. `edit_file` 的目标路径 resolve 后必须仍在 `workspaceRoot` 内
2. 绝对路径越界必须拒绝或进入明确审批，不允许静默写入
3. 路径逃逸（例如 `..`）必须拒绝或进入明确审批
4. 台账回填：
   - 对应 `core-tool-rectification-ledger.md` P0 / Edit

## Verification

- `pnpm --filter @ui-chat-mira/server typecheck`
  - 结果：当前分支失败
  - 失败位置：`server/src/microapps/legacy-sync.ts`、`server/src/microapps/runtime.ts`、`server/src/routes/integrations/index.ts`
  - 说明：这些 `microapps` 相关错误不属于 `T001` 直接修改范围，因此不作为本卡完成证据
- `pnpm --filter @ui-chat-mira/server test -- src/mcp/tools/edit-file.tool.test.ts src/mcp/workspace.test.ts`
  - 结果：通过，`2` 个测试文件、`17` 个测试通过

## Evidence

- Acceptance 1
  - [server/src/mcp/edit/runtime.ts](D:/workspace/rag-demo/server/src/mcp/edit/runtime.ts) 的 `edit_file` 写路径已从 `resolveWorkspacePath()` 收口到 `resolveWorkspaceWritePath()`
  - [server/src/mcp/workspace.ts](D:/workspace/rag-demo/server/src/mcp/workspace.ts) 新增写入专用边界校验：目标路径的最近已存在祖先会先做 `realpath` 校验，确保真实可达路径仍在 `workspaceRoot` 内

- Acceptance 2
  - [server/src/mcp/tools/edit-file.tool.test.ts](D:/workspace/rag-demo/server/src/mcp/tools/edit-file.tool.test.ts) 新增绝对路径越界拒绝用例
  - `edit_file` 对绝对路径输入不会静默写入 workspace 外，而是返回 `path must stay inside workspace root`

- Acceptance 3
  - [server/src/mcp/tools/edit-file.tool.test.ts](D:/workspace/rag-demo/server/src/mcp/tools/edit-file.tool.test.ts) 新增链接目录绕过拒绝用例，以及“workspace 内目标文件本身是 symlink 且指向外部文件”的拒绝用例
  - [server/src/mcp/workspace.test.ts](D:/workspace/rag-demo/server/src/mcp/workspace.test.ts) 新增 `resolveWorkspaceWritePath()` 针对绝对路径越界、链接目录逃逸、以及现有符号链接文件目标逃逸的断言
  - 这次实现覆盖了普通 `..` 逃逸、绝对路径越界、“workspace 内链接目录指向外部目录”的真实写入逃逸，以及“workspace 内文件路径本身是外链”的写入逃逸

- Acceptance 4
  - 本卡已回填到 [core-tool-rectification-ledger.md](D:/workspace/rag-demo/docs/tooling-runtime/core-tool-rectification-ledger.md) 的 `P0 / Edit`

## Changed Files

- `server/src/mcp/edit/runtime.ts`
- `server/src/mcp/workspace.ts`
- `server/src/mcp/tools/edit-file.tool.test.ts`
- `server/src/mcp/workspace.test.ts`
- `docs/project-control/tasks/core_tools_T001-edit-workspace-boundary.md`
- `docs/tooling-runtime/core-tool-rectification-ledger.md`

## Risks / Deferred

- 本次只收紧了 `edit_file` 的写路径边界，没有把同类真实路径校验扩到其它工具，符合本卡 `Forbidden Changes`
- `workspace.ts` 仍保留普通 `resolveWorkspacePath()` 给读取类和其他现有调用方使用；如果后续要做全量 workspace mutation/path hardening，需要另开任务

## Review Outcome

- 当前提交结论：评审通过
- 当前状态：`DONE`
- 评审结论：
  - `AC1` 已满足：`edit_file` 写入目标在 resolve 后会继续校验真实祖先路径仍位于 `workspaceRoot` 内
  - `AC2` 已满足：绝对路径越界被显式拒绝，不会静默写入
  - `AC3` 已满足：`..` 逃逸、链接目录/符号链接绕过，以及现有 symlink 文件目标写入都被拒绝
  - `AC4` 已满足：台账已对齐 `P0 / Edit`
  - 非阻断说明：当前分支的 `server typecheck` 被 `microapps` 相关现存错误打断，因此本卡的完成证据以定向测试为主，不再把 `typecheck 通过` 写作完成依据

## Notes

- 这张卡不讨论 `write_file` 的创建 / 覆盖语义
- 这张卡不讨论 `replace_block` 唯一匹配
