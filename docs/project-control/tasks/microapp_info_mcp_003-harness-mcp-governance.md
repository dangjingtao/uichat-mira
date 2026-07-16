---
status: current
priority: P1
owner: runtime
last_verified: 2026-07-14
layer: project-control
module: MCP
feature: MicroAppInfoMcpGovernance
doc_type: task-card
canonical: true
related:
  - docs/microapp/news-and-mail-mcp-design.md
  - docs/tooling-runtime/tools-protocol.md
  - docs/architecture/external-mcp-marketplace.md
  - docs/project-control/project-control-ledger.md
task_state: DONE
---

# microapp_info_mcp_003 Harness MCP Governance

## Target

把资讯和邮件能力接入当前 Harness / MCP runtime，并完成统一的 schema、capability profile、权限、trace、错误和黑盒验收。

本卡只负责能力暴露和运行时治理，不重新实现 NewsHub 或 MailCenter 的查询、索引和 IMAP 领域逻辑。

## Allowed Changes

- `server/src/mcp/tools/mail-query.tool.ts`
- `server/src/mcp/tools/mail-query.tool.test.ts`
- `server/src/harness/runtime.ts`
- `server/src/harness/profiles/**`
- `server/src/harness/exposure-core/**`，仅限本卡需要的 exposure 适配
- `server/src/harness/candidates-core/**`，仅限 capability profile / candidate contract 适配
- `server/src/mcp/core/**`，仅限新增所需 schema、error、trace 或 invocation 测试，不改已有通用协议语义
- `server/src/agent/intent/**`，仅限新增 `news_research` / `mail_reading` profile 文本和定向测试
- `server/src/mcp/routes.test.ts` 或新增 MCP / Harness 黑盒测试
- 本任务卡自身

## Forbidden Changes

- `server/src/microapps/news-hub/**`
- `server/src/microapps/mail-center/**`
- `server/src/db/repositories/news-items.repository.ts`
- `server/src/db/repositories/mail-*.ts`
- `server/src/services/internal-capabilities/**`
- `desktop/**`
- `electron/**`
- `tauri/**`
- OpenAI tunnel、Cloudflare Worker、倾城时光或外部资料投送
- 邮件账号配置、密码读取、普通发信和远程邮件写操作

## Capability Surface

资讯不新增独立 tool：

```text
news_research profile -> web_search -> local_news_hub strategy
```

邮件只新增一个 model-facing tool：

```text
mail_reading profile -> mail_query
```

`mail_query` 支持本地查询、message ID 详情和显式 `sync`，不拆分 `mail_search`、`mail_read`、`mail_summarize` 或 `mail_extract_tasks`。

## Acceptance Criteria

1. `mail_query` 显式声明 `source: "internal"`、domain、mode、inputSchema、outputSchema、tags 和风险元数据。
2. `mail_query` 只从可信 invocation context 获取 `userId`，模型不能传入用户身份。
3. `news_research` 和 `mail_reading` 能被 Harness capability profile 识别并正确映射到对应 tool / strategy。
4. 邮件默认只查询缓存；`sync: if-stale` 和 `sync: force` 的网络与本地写入行为不会被隐藏。
5. 同步、失败和结果都进入统一 invocation lifecycle 和 trace。
6. secret、认证信息、完整邮件 HTML 和不必要的原始 payload 不回流到 result、artifact 或 error。
7. 邮件账号不存在、账号不属于当前用户、同步失败、embedding 不可用和 rerank 降级都有明确错误或降级语义。
8. 不改变现有 external MCP projected tool 的命名、allowlist 和 exposure 行为。
9. 定向测试覆盖 tool schema、profile exposure、用户隔离、sync 风险、secret redaction、trace 和失败路径。
10. 不修改 forbidden area。

## Verification

- `pnpm --filter @ui-chat-mira/server exec vitest run <本卡新增或直接影响的 MCP / Harness tests>`
  - workdir: `D:/workspace/rag-demo`
  - purpose: 验证注册、暴露、调用、trace 和失败契约
- `pnpm check`
  - workdir: `D:/workspace/rag-demo`
  - purpose: 验证 runtime / server 类型检查
- `rg -n "mail_query|news_research|mail_reading|smtpPassword|imapPassword" server/src/mcp server/src/harness server/src/agent/intent`
  - workdir: `D:/workspace/rag-demo`
  - purpose: 检查工具命名、profile 和 secret 边界
- `git diff --name-only`
  - workdir: `D:/workspace/rag-demo`
  - purpose: 检查改动只落在本卡允许范围

## Evidence Requirements

- 记录 capability definition、profile 和 exposure 的代码位置。
- 记录 `mail_query` 的输入输出 schema 和实际调用结果。
- 记录至少一条成功调用、一条账号隔离失败和一条同步失败证据。
- 记录 trace 事件和 secret redaction 检查结果。
- 明确列出 OpenAI tunnel / 倾城时光未纳入本卡。

## Isolation Rules

- 本卡拥有 `mail_query` 的 MCP tool 注册和 Harness exposure 逻辑。
- 领域层查询、同步、embedding 和 rerank 实现只能通过 import 使用，不得在本卡重写。
- external MCP server 的生命周期和 projected capability 不在本卡扩展。

## Unfinished / Risks

- 当前项目的完整 approval persistence 仍有阶段性限制；本卡必须沿用现有 Harness approval contract，不能新增隐式放行。
- `sync: force` 涉及外部网络和本地持久化，最终是否每次等待用户审批必须以实际 runtime policy 和测试证据为准。
- 普通邮件发送、回复、转发和附件发送必须另行设计。

## Implementation Evidence

- 新增 `server/src/mcp/tools/mail-query.tool.ts`：注册 `mail_query` internal capability，模型输入不含 `userId`、SMTP/IMAP 密码或认证字段；执行时只使用可信 invocation context 的 `userId`，调用现有 `createMailCenterService().queryMail()`。
- `mail_query` 结果保留 `sync.requested`、`performed`、`status`、`syncedCount` 和安全错误；正文默认不返回，返回正文时限制长度；artifact 仅使用结构化邮件项目并标记敏感字段已排除。
- `mail_query` 为账号归属校验、结果规范化和同步状态写入统一 invocation trace，失败交由现有 invocation lifecycle 记录；未新增隐式审批或外部 MCP projected tool 行为。
- `server/src/harness/runtime.ts` 注册 `mail_query`；`server/src/harness/profiles/resolver.ts` 新增 `news_research -> web_search` 与 `mail_reading -> mail_query` 映射。
- 定向测试：`mail-query.tool.test.ts`、`capability-profiles.test.ts`、`exposure.test.ts`、`invocations.test.ts` 共 4 个文件、61 个测试通过。
- 审批修复：invocation context 传递本次完整输入 hash 的精确批准状态；`sync: force` 未批准时进入 `awaiting_approval`，仅精确批准可执行，修改 `sync` 或其他参数后旧批准不可复用；`sync: none` 与 `sync: if-stale` 沿用无审批策略。
- 修复后定向测试：同一 4 个文件共 63 个测试通过，包含真实 `executeInvocation` 审批路径。
- `pnpm check` 通过，desktop、packages/core、packages/docs-site、packages/deepagents-spike 和 server typecheck 均通过。
- 敏感字段扫描未发现密码、认证 header 或连接配置进入 MCP tool schema/result/artifact/error；OpenAI tunnel、Cloudflare Worker、倾城时光、发信和远程邮件写操作未纳入本卡。
