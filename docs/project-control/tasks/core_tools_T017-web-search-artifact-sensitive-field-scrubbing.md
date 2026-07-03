---
status: current
priority: P3
owner: runtime
last_verified: 2026-07-03
layer: project-control
module: ProjectControl
feature: CoreToolsWebSearchArtifactSensitiveFieldScrubbing
doc_type: task-card
canonical: true
related:
  - docs/tooling-runtime/core-tool-rectification-ledger.md
  - docs/tooling-runtime/core-tool-matrix-review.md
  - docs/tooling-runtime/tools-protocol.md
task_state: READY_FOR_REVIEW
---

# core_tools_T017 Web Search Artifact Sensitive Field Scrubbing

## Target

保留 `search-results` artifact，但清理其中敏感字段，避免 `apiKey`、header、环境变量等信息泄露。

## Allowed Changes

- `web_search` artifact 输出脱敏相关实现
- 与 artifact metadata 敏感字段校验直接相关的测试
- 与该任务直接相关的当前文档更新

## Forbidden Changes

- 把本任务扩大成 provider 配置系统重写
- 顺手修改搜索结果标准化主结构
- 顺手修改前端搜索配置持久化

## Acceptance Criteria

1. artifact 不包含 `apiKey`
2. artifact 不包含 header
3. artifact 不包含环境变量
4. 台账回填：
   - 对应 `core-tool-rectification-ledger.md` P3 / Web Search 条目

## Verification

- `pnpm --filter @ui-chat-mira/server typecheck`
- `pnpm --filter @ui-chat-mira/server test -- src/mcp/tools/web-search*.test.ts`

## Notes

- 这张卡不处理 provider 失败结构化返回；那是 P2 独立任务

## Evidence

- 代码：
  - `server/src/mcp/tools/web-search.tool.ts`
  - `server/src/mcp/tools/web-search.tool.test.ts`
- 结果：
  - `search-results` artifact metadata 只保留 `query / provider / capabilityId / resultCount`
  - artifact 中不再写入 `apiKey`、header、环境变量或 `baseUrl`
- 验证：
  - `pnpm --filter @ui-chat-mira/server test -- src/mcp/tools/web-search.tool.test.ts`
    - 结果：通过，`14 passed`
  - `pnpm --filter @ui-chat-mira/server typecheck`
    - 结果：当前分支失败
    - 说明：失败点位于 `server/src/mcp/harness/capability-profiles.ts`，是当前分支既有 `actionProfileId` / `actionProfileTitle` 字段类型未对齐，不属于 `T017` 允许改动范围
