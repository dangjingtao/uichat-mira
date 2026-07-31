# Chat / Agent 统一记忆系统 V1

Status: Active
Owner: chat / agent / memory
Last verified: 2026-08-01
Layer: architecture
Doc Type: canonical

## 1. 目标

Mira 建立一个独立的长期记忆模块，第一阶段只服务普通 Chat 与 Agent。

Chat 与 Agent 必须共享：

- 同一份用户长期记忆；
- 同一套提取、校验、写入和删除合同；
- 同一个 request-only 注入入口；
- 同一个对话轮次提交策略。

Memory 不属于 Role、RAG、Skill 或微应用。Role 只作为领域模块组织方式的参考；RAG、角色专属记忆和知识库暂不进入 V1。

V1 中 RAG 明确不读、不写这套用户长期记忆。知识库线程开启 Agent 时仍按 Agent 路径处理；普通 RAG 路径保持原样。

## 2. 当前代码基础

现有代码已经具备：

1. `thread-request-context-memory.resolver.ts`：长期记忆 request-only 注入槽；
2. `thread-request-context.node.ts`：Chat 与 Agent 共用的请求上下文链；
3. 默认对话流：普通 Chat 与 Agent 共用 assistant 消息持久化函数；
4. `llmSharedNode`：可通过 Mira 的 task 模型执行结构化整理；
5. `UI_CHAT_DATABASE_DIR`：Electron 与 Tauri 已统一传入的用户数据目录。

V1 在这些合同上补齐中间层，不修改 Planner、Agent Graph 或 Harness 合同。

## 3. 核心原则

### 3.1 文件是真相源

长期记忆以 Markdown 文件保存。SQLite / sqlite-vec 以后只能作为可删除、可重建的检索索引，不拥有记忆真相。

### 3.2 模型只提出修改

模型不能直接写文件。模型只返回结构化 `MemoryPatchProposal`；TypeScript Policy 校验后才能落盘。

### 3.3 证据优先

每条自动记忆必须绑定来源消息：

- `threadId`
- `userMessageId`
- `assistantMessageId`

模型推测、心理画像、临时情绪和未经用户确认的信息不得进入长期记忆。Assistant 文本只用于理解上下文，不是用户事实的权威来源。

### 3.4 失败不影响聊天

提取、解析、文件写入或后续索引失败时：

- 已完成的回复保持成功；
- Agent Graph 状态不受影响；
- 只记录可观察错误；
- 下一轮可以继续正常对话。

### 3.5 少记优先于错记

V1 只保存：

- 用户明确表达的稳定偏好；
- 用户明确确认的长期事实；
- 用户明确纠正的旧信息；
- 后续会反复使用的项目决定与约束。

V1 不保存：

- 模型推断出的性格或心理状态；
- 一次性任务和短期待办；
- 助手自行提出但用户未确认的结论；
- 来自工具输出或外部内容的用户身份事实。

## 4. 文件布局

根目录：

```text
<UI_CHAT_DATABASE_DIR>/memory/
└── users/
    └── <userId>/
        ├── MEMORY.md
        └── .meta/
            ├── journal.jsonl
            ├── tombstones.jsonl
            └── processed-turns.jsonl
```

- `MEMORY.md`：长期记忆真相源；
- `journal.jsonl`：已执行 Patch 的审计记录；
- `tombstones.jsonl`：删除记录及原来源，阻止同一旧证据令记忆复活；
- `processed-turns.jsonl`：已整理轮次的持久化幂等账本。

V1 先使用单一 `MEMORY.md`。达到真实容量或检索压力后，才引入 `USER.md`、topic 文件和索引；不提前建设目录体系。

## 5. 托管区块

自动记忆使用机器可识别、人工可阅读的 Markdown 区块：

```markdown
<!-- mira:memory
{"id":"mem_xxx","kind":"preference","sources":[{"threadId":"...","userMessageId":"...","assistantMessageId":"..."}],"createdAt":"...","updatedAt":"..."}
-->
用户偏好先看明确结论，再阅读展开理由。
<!-- /mira:memory -->
```

文件中非托管区块属于用户内容，Memory Kernel 不得覆盖。模型输出中包含托管区块保留标记时，Policy 必须拒绝该 Patch。

## 6. 核心合同

```ts
interface MemoryConsolidator {
  propose(input: ConsolidationInput): Promise<MemoryPatchProposal[]>;
}

interface MemoryRepository {
  list(userId: number): Promise<MemoryRecord[]>;
  apply(userId: number, patches: ValidatedMemoryPatch[]): Promise<ApplyResult>;
}

interface MemoryTurnLedger {
  has(userId: number, source: MemorySource): Promise<boolean>;
  mark(userId: number, source: MemorySource): Promise<void>;
}

interface MemoryContextBuilder {
  build(userId: number): Promise<MemoryContextSnapshot>;
}
```

V1 Patch 操作：

- `create`
- `replace`
- `delete`

`delete` 必须写入 tombstone。Tombstone 只阻止同一旧来源重复晋升；用户在后续新消息中明确重新确认时，允许重新建立同内容记忆。

## 7. 生命周期

### 7.1 读取

```text
收到普通 Chat / Agent 请求
→ 同步读取当前用户 MEMORY.md
→ 构建有大小上限的 memoryContext
→ 交给现有 resolveMemoryContext
→ Chat 与 Agent 各自继续原有执行链
```

普通 RAG 路径不执行这一步。同步读取在文件超过 256 KiB 时安全降级为空；V1 达到该规模前应先引入索引和分文件策略。

### 7.2 写入

```text
assistant 消息已持久化
→ 判断是否是可提交轮次
→ processed-turns 幂等检查
→ MemoryConsolidator 读取本轮与现有记忆
→ 生成 Patch Proposal
→ MemoryPolicy 校验
→ MemoryRepository 原子落盘（如有 Patch）
→ 记录 processed turn
```

提交规则：

- 普通 Chat 的完成回复：提交；
- Agent：只有 `status=completed` 时提交；
- Agent 的 `running`、`waiting_approval`、`waiting_user`、`failed`、`blocked`、`cancelled` 中间或终止状态：不提交；
- RAG：不提交。

即使某轮没有产生任何 Patch，也必须记录为 processed，避免 Agent 恢复或消息重复持久化时再次调用 task 模型。

## 8. 并发、原子性与幂等

同一用户的轮次整理和文件修改必须串行执行；不同用户可以并行。

文件修改步骤：

1. 读取当前文件；
2. 解析托管区块；
3. 校验目标 ID、重复内容和 tombstone；
4. 写临时文件；
5. `rename` 原子替换；
6. 追加 journal；
7. 记录 processed turn。

整理失败时不记录 processed turn，使后续可以重试；已经完成的聊天回复不回滚。

## 9. 上下文预算

V1 规则：

- 最多注入 40 条有效记忆；
- 总字符数不超过 6000；
- 按最近更新时间倒序；
- 不注入 metadata 和来源 ID；
- 记忆为空时不生成 memory execution node。

## 10. V1 验收

必须覆盖：

1. 普通 Chat 明确偏好可在下一轮被注入；
2. Agent 与 Chat 读取同一份记忆；
3. Agent 仅在 completed 后沉淀记忆；
4. Agent 审批和恢复过程不会重复整理；
5. task 模型不可用时，回复仍正常完成；
6. 非法 JSON、低置信度或非法 Patch 不写文件；
7. 托管区块保留标记不能由模型写入正文；
8. 同一用户并发写入不破坏 Markdown；
9. 人工文本不会被自动修改；
10. replace 能替换旧记忆而不是重复追加；
11. delete 写 tombstone，同一旧证据不能复活，新明确来源可以重新确认；
12. 同一消息轮次持久化幂等；
13. RAG 不进入 V1 读取或写入链。

## 11. 后续阶段（非 V1）

- 用户查看、编辑、删除记忆的桌面管理页；
- 来源消息回看与分支失效；
- `USER.md`、topic 文件与每日记忆；
- FTS / embedding 混合检索；
- 记忆质量评测与真实对话回放；
- Role 专属记忆与 RAG 记忆接入。
