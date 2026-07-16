---
status: current
priority: P1
owner: microapp / runtime
last_verified: 2026-07-14
layer: project-control
module: MCP
feature: MicroAppMailQuery
doc_type: task-card
canonical: true
related:
  - docs/microapp/news-and-mail-mcp-design.md
  - docs/tooling-runtime/tools-protocol.md
  - docs/project-control/project-control-ledger.md
task_state: DONE
---

# microapp_info_mcp_002 Mail Query

## Target

为邮件中心实现一个丰富的本地查询与显式同步领域能力，供后续 `mail_query` MCP tool 调用。

单一查询能力需要覆盖：邮件摘要搜索、结构化过滤、message ID 详情读取，以及 `sync: none | if-stale | force` 的显式 IMAP 拉取。

本卡不负责 MCP registry / Harness exposure，不实现普通写信、回复发送或 OpenAI tunnel。

## Allowed Changes

- `server/src/microapps/mail-center/index.ts`
- `server/src/db/repositories/mail-accounts.repository.ts`
- `server/src/db/repositories/mail-folders.repository.ts`
- `server/src/db/repositories/mail-messages.repository.ts`
- 邮件检索 adapter 和索引所需的新文件，限于 `server/src/services/retrieval/**` 或 `server/src/db/repositories/`
- 本卡直接相关的 server tests
- 本任务卡自身

## Forbidden Changes

- `server/src/mcp/core/**`
- `server/src/harness/**`
- `server/src/mcp/tools/web-search.tool.ts`
- `server/src/mcp/tools/mail-query.tool.ts` 的注册和 exposure 逻辑
- `desktop/**`
- `electron/**`
- `tauri/**`
- SMTP 普通发信、回复、转发、草稿远程提交
- 远程已读、星标、归档、删除、移动文件夹等写操作
- 账号配置 MCP、密码读取和 OpenAI tunnel / 倾城时光

## Input Contract

领域层应支持以下查询语义：

```ts
type MailQueryInput = {
  userId: number;
  accountId?: string;
  messageIds?: string[];
  query?: string;
  from?: string;
  to?: string;
  subject?: string;
  since?: string;
  until?: string;
  unreadOnly?: boolean;
  flaggedOnly?: boolean;
  hasAttachments?: boolean;
  includeBody?: boolean;
  sync?: "none" | "if-stale" | "force";
  limit?: number;
  cursor?: string;
};
```

`userId` 由上层可信 context 提供，不能由模型直接生成或覆盖。默认 `sync` 为 `none`，默认不返回正文。

## Acceptance Criteria

1. 支持关键词、发件人、收件人、主题、时间范围、未读、星标和附件过滤。
2. 支持通过 `messageIds` 读取邮件详情，并可以选择是否包含纯文本正文。
3. 支持本地缓存查询和分页 cursor，不使用应用层全量加载后再过滤。
4. `sync: none` 只查询本地缓存。
5. `sync: if-stale` 和 `sync: force` 的网络访问、同步数量和本地写入状态可被调用方识别。
6. 同步继续使用只读 IMAP 访问，不修改远程邮件状态。
7. 邮件账号和消息查询始终按当前用户隔离。
8. 邮箱密码、认证配置和底层连接细节不进入输出、artifact 或错误信息。
9. HTML 邮件默认不作为模型正文输出，优先提供纯文本和安全附件摘要。
10. 定向测试覆盖账号隔离、查询组合、详情读取、同步失败、同步数量限制和 secret 不回流。
11. 不修改 forbidden area。

## Verification

- `pnpm --filter @ui-chat-mira/server exec vitest run <本卡新增或直接影响的 server tests>`
  - workdir: `D:/workspace/rag-demo`
  - purpose: 验证 mail query service、repository 和同步合同
- `pnpm check`
  - workdir: `D:/workspace/rag-demo`
  - purpose: 验证 server / workspace 类型检查
- `rg -n "smtpPassword|imapPassword|smtpHost|imapHost|Authorization" server/src/microapps/mail-center server/src/services/retrieval`
  - workdir: `D:/workspace/rag-demo`
  - purpose: 检查邮件领域结果没有回传 secret 或认证细节
- `git diff --name-only`
  - workdir: `D:/workspace/rag-demo`
  - purpose: 检查改动只落在本卡允许范围

## Evidence Requirements

- 列出查询、详情和同步相关的实际代码位置。
- 记录 `sync` 三种模式的行为和测试结果。
- 记录用户隔离和 secret redaction 的测试证据。
- 明确列出未实现的发信、回复、附件下载和远程文件夹操作。

## Isolation Rules

- 本卡拥有 MailCenter 的查询与同步领域语义。
- MCP 治理卡只能调用本卡提供的领域服务，不得在 tool 层重写账号归属和密码处理逻辑。
- 本卡不得借机修改邮件 UI 或增加远程邮件写操作。

## Unfinished / Risks

- 当前实现只同步最近一批邮件；增量 UID、历史分页和多文件夹同步不在本卡默认范围内。
- 邮件 embedding 索引必须按用户 / 账号过滤，不能先全库召回再在应用层过滤。
- `force` 同步的审批策略由 `microapp_info_mcp_003` 统一处理。
