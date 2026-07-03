---
status: current
priority: P1
owner: runtime
last_verified: 2026-07-02
layer: project-control
module: ProjectControl
feature: CoreToolsReadLocateKeywordPreview
doc_type: task-card
canonical: true
related:
  - docs/tooling-runtime/core-tool-rectification-ledger.md
  - docs/tooling-runtime/core-tool-matrix-review.md
  - docs/tooling-runtime/read-skill-design.md
  - docs/tooling-runtime/tools-protocol.md
task_state: READY_FOR_REVIEW
---

# core_tools_T008 Read Locate Keyword Preview

## Target

让 `read_locate` 支持内容定位 / 关键词定位，但仍只返回候选和短 preview。

问题本体：

- `read_locate` 是 Read 组的定位入口，不是最终阅读结果
- 如果只有路径/名称定位，真实工作区检索能力不够
- 如果返回大量正文，又会反过来侵蚀 `read_open` / `read_extract` 的职责

## Allowed Changes

- `read_locate` 的 keyword / content locate 相关实现
- preview 长度与返回结构约束
- 与 `read_locate` 内容定位直接相关的测试
- 与该任务直接相关的当前文档更新

## Forbidden Changes

- 把 grep 暴露成新的第七个 Read 工具
- 顺手把 `read_locate` 扩成全文阅读工具
- 顺手修改 `read_open` / `read_extract` 的主语义边界

## Acceptance Criteria

1. `read_locate` 支持 keyword locate
2. 返回结果只包含候选和短 preview
3. 不返回大量正文
4. 台账回填：
   - 对应 `core-tool-rectification-ledger.md` P1 / Read / `read_locate` 条目

## Verification

- `pnpm --filter @ui-chat-mira/server typecheck`
- `pnpm --filter @ui-chat-mira/server test -- src/mcp/tools/read-locate.tool.test.ts`

## Notes

- 这张卡不新增独立 `read_grep`
- 底层是否用 `rg` / 索引 / 其它 provider，由 Harness 环境与当前实现决定

## Evidence

- 代码：
  - `server/src/mcp/read/locate.ts`
  - `server/src/mcp/tools/read-locate.tool.test.ts`
- 结果：
  - `read_locate` 继续支持 path/name locate 与 content keyword locate
  - content 命中只返回短 preview，不再返回长段正文
- 验证：
  - `pnpm --filter @ui-chat-mira/server typecheck`
    - 结果：通过
  - `pnpm --filter @ui-chat-mira/server test -- src/mcp/tools/read-locate.tool.test.ts src/agent/intent/task-capability-selector.test.ts`
    - 结果：通过，`10 passed`
