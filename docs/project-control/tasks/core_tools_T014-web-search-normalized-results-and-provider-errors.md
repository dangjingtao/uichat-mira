---
status: current
priority: P2
owner: runtime
last_verified: 2026-07-06
layer: project-control
module: ProjectControl
feature: CoreToolsWebSearchNormalizedResultsAndProviderErrors
doc_type: task-card
canonical: true
related:
  - docs/tooling-runtime/core-tool-rectification-ledger.md
  - docs/tooling-runtime/core-tool-matrix-review.md
  - docs/tooling-runtime/tools-protocol.md
task_state: DONE
---

# core_tools_T014 Web Search Normalized Results And Provider Errors

## Target

让 `web_search` 对上层只暴露统一搜索结果结构，并在 provider 失败时返回结构化错误。

## Allowed Changes

- `web_search` 结果标准化与 provider 错误归一化相关实现
- 与 Tavily / SearXNG 结果统一结构直接相关的测试
- 与该任务直接相关的当前文档更新

## Forbidden Changes

- 把本任务扩大成 provider 输入面治理重做
- 顺手新增 provider 专属工具
- 顺手改搜索配置持久化设计

## Acceptance Criteria

1. 上层只消费统一搜索结果结构
2. Tavily 结果标准化
3. SearXNG 结果标准化
4. provider 失败结构化返回
5. 台账回填：
   - 对应 `core-tool-rectification-ledger.md` P2 / Web Search 条目

## Verification

- `pnpm --filter @ui-chat-mira/server typecheck`
- `pnpm --filter @ui-chat-mira/server test -- src/mcp/tools/web-search*.test.ts`
- `pnpm check`

## Notes

- 这张卡不处理 artifact 脱敏；那是 P3 独立任务

## Evidence

- 代码：
  - `server/src/mcp/tools/web-search.tool.ts`
  - `server/src/mcp/tools/web-search.tool.test.ts`
- 结果：
  - `web_search` 成功结果统一收口为同一搜索结果结构
  - `SearXNG` 成功结果不再向上层暴露 `baseUrl`
  - provider 失败会归一为结构化错误明细，并在全 provider 失败时挂到统一错误对象的 `errors`
- 验收对应：
  - AC1 上层统一结果结构：
    - `server/src/mcp/tools/web-search.tool.ts` 的 `outputSchema` 只暴露 `query / provider / capabilityId / results`
    - 成功返回统一走 `NormalizedWebSearchResult`
  - AC2 Tavily 结果标准化：
    - `server/src/mcp/tools/web-search.tool.test.ts` 覆盖 Tavily 返回 `title / link / snippet`
  - AC3 SearXNG 结果标准化：
    - `server/src/mcp/tools/web-search.tool.test.ts` 覆盖 SearXNG 返回 `title / link / snippet`
    - 上层结果与 provider 专属 `baseUrl` 解耦
  - AC4 provider 失败结构化返回：
    - `server/src/mcp/tools/web-search.tool.test.ts` 覆盖 Tavily `502`、SearXNG upstream engine unavailable，以及多 provider 全失败时统一挂载 `errors`
  - AC5 台账回填：
    - `docs/tooling-runtime/core-tool-rectification-ledger.md` 的 P2 / Web Search 条目已更新为当前验证结果
- 验证：
  - `pnpm --filter @ui-chat-mira/server test -- src/mcp/tools/web-search.tool.test.ts`
    - 结果：通过，`14 passed`
  - `pnpm --filter @ui-chat-mira/server typecheck`
    - 结果：通过
  - `pnpm check`
    - 结果：通过

## Review Outcome

- 评审结论：通过
- 当前状态：`DONE`
