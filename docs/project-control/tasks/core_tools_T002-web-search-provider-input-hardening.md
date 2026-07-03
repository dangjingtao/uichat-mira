---
status: current
priority: P0
owner: runtime
last_verified: 2026-07-02
layer: project-control
module: ProjectControl
feature: CoreToolsWebSearchHardening
doc_type: task-card
canonical: true
related:
  - docs/tooling-runtime/core-tool-rectification-ledger.md
  - docs/tooling-runtime/core-tool-matrix-review.md
  - docs/tooling-runtime/tools-protocol.md
  - docs/tooling-runtime/harness-runtime-design.md
task_state: DONE
---

# core_tools_T002 Web Search Provider Input Hardening

## Target

禁止模型通过 `web_search` 直接生成 provider 配置参数。

问题本体：

- 当前 `web_search` 真实 runtime tool 统一语义是对的
- 但如果 `apiKey` / `baseUrl` 继续直接出现在模型输入面里，会引入配置污染和 SSRF 风险
- 这张卡只处理 provider 输入面治理，不扩大到 search result ranking 或 provider 扩展

## Allowed Changes

- `web_search` LLM-facing 输入 schema
- provider 配置来源约束
- 与 `apiKey` / `baseUrl` 输入治理直接相关的测试
- 与该任务直接相关的当前文档更新

## Forbidden Changes

- 把 `web_search` 拆成多个 provider 工具
- 顺手改 Web Search 的结果排序策略
- 顺手改 Search artifact 展示层

## Acceptance Criteria

1. LLM-facing `web_search` 输入面不再直接暴露 `apiKey`
2. LLM-facing `web_search` 输入面不再直接暴露 `baseUrl`
3. provider 配置只来自 trusted runtime config / `web_search_settings` / 环境变量
4. 台账回填：
   - 对应 `core-tool-rectification-ledger.md` P0 / Web Search

## Verification

- `pnpm check`
  - 结果：当前分支失败
  - 失败位置：`packages/docs-site` typecheck 进程崩溃
  - 说明：失败点不属于 `T002` 直接改动范围，因此不作为本卡完成证据
- `pnpm --filter @ui-chat-mira/server test -- src/mcp/tools/web-search.tool.test.ts`
  - 结果：通过，`13` 个测试通过
- `pnpm --filter @ui-chat-mira/desktop test -- src/features/Settings/pages/Tools/utils.test.ts src/features/Settings/pages/Tools/__tests__/useToolsWorkbench.test.tsx`
  - 结果：通过，`2` 个测试文件、`16` 个测试通过
- `pnpm package:electron:win`
  - 结果：失败，失败点来自仓库当前已有打包链路问题，不是本任务改动直接引入
  - 观测到的问题：
    - `server` 全量测试阶段存在缺失依赖 `xlsx`
    - `server/src/mcp/harness/sandbox.test.ts` 引用缺失的 `./sandbox.js`
    - 另有多条既有测试断言失败，导致 electron package 过程中断

## Notes

- 这张卡不处理 `maxResults` 限幅
- 这张卡不处理 provider 失败结构化返回

## Review Outcome

- 当前提交结论：评审通过
- 当前状态：`DONE`
- 评审结论：
  - `AC1` 已满足：LLM-facing `web_search` schema 不再暴露 `apiKey`
  - `AC2` 已满足：LLM-facing `web_search` schema 不再暴露 `baseUrl`
  - `AC3` 已满足：provider 配置只从 trusted runtime config / `web_search_settings` / 环境变量读取
  - `AC4` 已满足：台账已对齐 `P0 / Web Search`
  - 非阻断说明：`pnpm check` 当前被 `packages/docs-site` typecheck 崩溃打断，因此本卡完成证据以定向测试为主
