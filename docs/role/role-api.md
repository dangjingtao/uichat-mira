---
status: current
owner: role / backend
last_verified: 2026-08-01
layer: wiki
module: Role
feature: RoleAPI
doc_type: reference
canonical: true
related:
  - ../ROLE_CURRENT_TRUTH.md
  - README.md
  - page.md
  - runtime.md
---

# Role API

## 文档范围

Role API 管理当前用户自己的 Role 数据。它不管理 Thread 绑定、请求上下文顺序、Provider Connection 或媒体任务。

## 数据结构

```ts
type RoleStatus = "active" | "draft";

type RolePrompt = {
  description: string;
  worldview: string;
  persona: string;
  scenario: string;
  exampleDialogues: string;
  style: string;
  constraints: string;
};

type RoleLlmProfile = {
  temperature?: number;
  topP?: number;
  topK?: number;
  maxTokens?: number;
  frequencyPenalty?: number;
  presencePenalty?: number;
};

type Role = {
  id: string;
  name: string;
  summary: string;
  avatarId: string | null;
  status: RoleStatus;
  tags: string[];
  prompt: RolePrompt;
  llmProfile: RoleLlmProfile;
  createdAt: string;
  updatedAt: string;
};
```

## 路由

| 方法 | 路径 | 作用 |
| --- | --- | --- |
| GET | `/roles` | 列出当前用户 Role |
| GET | `/roles/:id` | 读取详情 |
| POST | `/roles` | 创建 |
| PATCH | `/roles/:id` | 增量更新 |
| DELETE | `/roles/:id` | 删除 |

所有路由要求登录。

## 列表参数

```ts
{
  status?: "active" | "draft";
  sortBy?: "createdAt" | "updatedAt" | "name";
  sortOrder?: "asc" | "desc";
}
```

默认排序字段是 `updatedAt`，默认方向是 desc。

## 创建

Body 全部可选：

```ts
{
  name?: string;
  summary?: string;
  avatarId?: string | null;
  status?: "active" | "draft";
  tags?: string[];
  prompt?: Partial<RolePrompt>;
  llmProfile?: Partial<RoleLlmProfile>;
}
```

Service 默认：

- name 空或缺失：`Untitled Role`；
- summary：空字符串；
- avatarId：null；
- status：draft；
- tags：空数组；
- Prompt：七个空字符串；
- LLM Profile：空对象。

桌面 Workbench 的 New 不使用完全空对象，而是立即提交一份预填 draft。

## 更新

PATCH 按字段 merge：

- 未传字段保持原值；
- prompt 按七个子字段 merge；
- llmProfile 按参数 merge；
- 不能通过传 null 清除单个 LLM Profile 参数，因为 schema 只接受 number；
- 桌面端清除参数时会省略该 key，但 Service merge 会保留旧值。

### 当前参数清除缺口

桌面 `normalizeLlmProfile` 会把空输入从 payload 中移除；Backend `updateRole` 又把 payload 与 existing profile 合并。

结果：

```text
用户清空某个已保存参数
→ PATCH 中缺少该 key
→ existing value 被保留
```

因此当前 LLM Profile Drawer 的“清空单项”不能可靠删除已保存参数；Reset 也只是恢复本地值。

这是 Medium 配置缺陷。本轮只记录，不修改 API。

## 字段规范化

### Tags

- API schema 最多 3 个；
- Service trim；
- 过滤空字符串；
- 只保留前三个；
- 当前不去重。

### Prompt

- 创建时缺失字段补空；
- 更新时 merge；
- 所有字段 trim；
- 没有长度上限。

### LLM Profile

- 只保留 number；
- 没有范围约束；
- 没有 provider capability 校验；
- topK / maxTokens 没有整数与正数约束。

## 权限

Role 查询按 userId 隔离。

更新和删除流程：

```text
findById(id, currentUserId)
→ not found 则拒绝
→ 再执行 update / delete
```

虽然 Repository update/delete 只按 id，但 Service 已先做用户归属校验。

## 删除语义

删除 Role row 后，Thread 外键使用 `ON DELETE SET NULL`：

```text
Delete Role
→ bound Thread.roleId = null
→ Thread / Messages remain
```

API 当前只返回：

```ts
{ deleted: true }
```

不会返回受影响 Thread 数量。

## Starter seed

Role 数据库初始化时：

1. 创建 roles 表；
2. 确保 `llm_profile_json` 列；
3. 检查整张表 COUNT；
4. 只有全表为空时，给当时所有 active users 写三个英文 starter roles。

它不是每用户首次登录初始化。

## 当前没有的 API

- Copy；
- Import / Export；
- Bulk update；
- Publish / Unpublish；
- Version / Snapshot；
- Compile / Preview request；
- Validate against Provider；
- 查询绑定 Thread；
- 删除前影响预览。

## 测试覆盖

现有 Role route test 覆盖：

- create；
- list；
- incremental update；
- llmProfile merge；
- delete。

当前没有专项覆盖：

- 删除后 Thread 保留；
- active / draft 与 Runtime 一致性；
- LLM Profile 单项清除；
- 参数范围；
- 新用户 starter seed。
