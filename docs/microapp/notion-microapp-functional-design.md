# Notion 微应用功能设计

Status: Proposal  
Owner: microapp / integrations / knowledge-base / agent-runtime  
Last verified: 2026-07-17  
Layer: design  
Module: MicroAPP  
Feature: Notion  
Doc Type: planned-design  
Canonical: true  
Related:
  - README.md
  - ../integrations/third-party-integration-architecture.md
  - ../integrations/third-party-integration-consumption-model.md
  - ../architecture/ipc-and-preload.md
  - ../knowledge-base/README.md

## 文档范围

本文是 UIChat Mira Notion 微应用的功能设计和边界说明，定义 V1 的连接、接入点、权限、Agent 能力投影、审计和知识库同步语义。

本文不是施工任务卡，也不代表完整的 Notion 能力已经完成。当前已完成 Notion 连接配置的后端持久化、Token 校验和能力状态读取；接入点、Agent Tool、Policy、Evidence 和知识库导入仍需后续施工。

当前实现优先级：

1. 连接配置和连接状态；
2. 当前授权形成的可用能力展示；
3. 为洞见、AgentMCP 等未来能力消费方预留接入点模型和页面位置。

接入点当前先实现后端资源绑定、验证和能力执行接口；前端完整 CRUD 和 Agent Tool 投影后续接入。

## 产品定义

### 定位

连接一个 Notion Workspace，通过多个受控接入点，为 Mira 提供：

- 页面搜索与读取；
- 数据库 / Data Source 查询；
- 内容写回；
- 手动同步到现有知识库。

核心闭环：

```text
连接 Workspace
  -> 添加接入点
  -> 限定资源和动作
  -> Mira 消费受控能力
  -> 结果进入 Evidence 和审计记录
```

### V1 范围

- 一个启用中的 Notion Workspace 连接；
- Internal Integration Token 授权；
- 多个页面范围、数据库或归档目标接入点；
- 接入点级允许动作和验证状态；
- 连接测试、资源验证和最近活动摘要；
- Agent 只消费受控 Notion 工具；
- 用户手动选择页面同步到现有知识库。

### V1 非目标

- 不复刻 Notion 编辑器；
- 不修改数据库 Schema；
- 不做多 Workspace UI；
- 不做 OAuth 公共应用安装流程；
- 不做 Webhook 自动同步或双向持续同步；
- 不把 Notion 原生 API / MCP 工具全集暴露给 Planner；
- 不新建 Agent Runtime，不改变既有 Agent 主链。

## 核心模型

### Connection

Connection 是 Workspace 级授权实例。页面 V1 只展示一个连接，但数据结构保留 `connectionId`，以便未来扩展多 Workspace。

```ts
interface NotionConnection {
  id: string;
  name: string;
  workspaceId: string | null;
  workspaceName: string | null;
  authMode: "internal_token";
  credentialRef: string;
  enabled: boolean;
  status: "unconfigured" | "validating" | "connected" | "error" | "disabled";
  lastValidatedAt: string | null;
  lastErrorCode: string | null;
  lastErrorMessage: string | null;
}
```

约束：

- Token 只能保存在 backend 凭据存储中；
- renderer 不读取完整 Token，只展示脱敏值；
- 更换 Token 后必须重新验证连接和接入点；
- 替换失败时保留旧的有效凭据；
- 关闭连接后停止调用，但保留配置。

### AccessPoint

接入点是一个有名称、有资源范围、有允许动作的 Notion 资源入口。

```ts
interface NotionAccessPoint {
  id: string;
  connectionId: string;
  name: string;
  type: "page_scope" | "database" | "publish_target";
  resourceId: string;
  resourceUrl?: string;
  resourceTitle: string;
  enabled: boolean;
  includeChildren?: boolean;
  allowedActions: NotionAction[];
  verificationStatus: "pending" | "verified" | "error";
  lastVerifiedAt: string | null;
  lastErrorMessage: string | null;
}
```

类型和动作边界：

| 类型 | 用途 | 允许动作示例 |
| --- | --- | --- |
| `page_scope` | 页面搜索、正文读取、知识库同步 | `search`、`read`、`sync_to_knowledge_base` |
| `database` | 结构化记录查询和属性更新 | `query`、`read`、`create_record`、`update_record` |
| `publish_target` | 承接聊天、评审、报告和内容成果 | `read`、`create_page`、`append_content`、`update_record` |

一个 Connection 可以有多个 AccessPoint；一个 AccessPoint 不能突破自身声明的资源范围和动作范围。

### 接入点配置步骤

接入点配置前，必须先完成 Workspace 连接配置。一个 Workspace 连接可以配置多个页面、数据库和归档目标接入点，不需要为每个资源创建新的 Workspace 连接。

#### 1. 在 Notion 中授权资源

Notion Integration 默认不能访问整个 Workspace。每个需要接入的页面或数据库都必须单独共享给当前 Integration：

```text
打开目标页面或数据库
  -> 右上角 ···
  -> Add connections / 添加连接
  -> 选择 UIChat Mira
  -> 确认授权
```

数据库如果使用的是 Linked view，应授权原始数据库，而不是只授权视图所在页面。没有完成这一步时，Mira 会收到 Notion 的 `Could not find ...` 错误；这通常表示资源未共享给 Integration，也可能表示填写的 ID 不是目标资源的 ID。

#### 2. 在 Mira 中打开添加接入点

进入：

```text
设置 -> 微应用 -> Notion -> 添加接入点
```

填写接入点名称，选择资源类型，并填写目标资源 ID 或 URL。页面支持直接粘贴 Notion 页面或数据库 URL，前端会在提交前提取资源 ID；也可以直接填写带连字符的 UUID 或 32 位无连字符 ID。

资源类型必须与实际资源匹配：

| 页面选择 | 应填写的资源 | 典型用途 |
| --- | --- | --- |
| 页面范围 | Notion 页面 ID 或页面 URL | 搜索、读取页面和子页面、同步知识库 |
| 数据库 | Notion 数据库 ID 或数据库 URL | 查询数据库记录、创建记录 |
| 归档目标 | 用于接收内容的页面 ID 或页面 URL | 创建页面、追加内容 |

#### 3. 选择允许动作并验证

只选择该接入点实际需要的动作，然后点击“验证并添加”。Mira 会使用当前 Workspace Token 请求 Notion，验证资源是否存在、是否已共享给 Integration，并保存资源标题和接入点状态。

建议按最小权限配置：

```text
项目文档：页面范围 + 搜索、读取
项目任务库：数据库 + 查询、读取
产品决策记录：归档目标 + 读取、追加内容
博客草稿：数据库或页面范围 + 读取、创建页面、更新记录
```

验证成功后，接入点状态显示“正常”，对应能力才会显示为“可用”。写入和知识库同步即使已勾选，实际执行仍需经过 Mira Policy 审批。

#### 4. 验证失败时排查

按以下顺序检查：

1. Integration 名称是否为当前连接使用的 `UIChat Mira`。
2. 目标页面或数据库是否通过 `Add connections` 共享给该 Integration。
3. “类型”是否正确：数据库不能按页面范围添加，页面也不能按数据库添加。
4. 粘贴的 URL 是否指向目标资源；数据库 URL 中提取出的 ID 应与数据库实际 ID 一致。
5. Token 是否属于同一个 Workspace，连接状态是否仍为“已连接”。

重新共享或替换 Token 后，返回接入点列表点击重新验证；一个接入点验证失败不会影响同一 Workspace 下的其他接入点。

## 权限和风险

```ts
type NotionAction =
  | "search"
  | "read"
  | "query"
  | "create_page"
  | "append_content"
  | "create_record"
  | "update_record"
  | "sync_to_knowledge_base";
```

| 动作 | 风险 | 默认审批 | 说明 |
| --- | --- | --- | --- |
| `search` | low | auto | 只在绑定资源范围内搜索 |
| `read` | low | auto | 读取已授权页面或记录 |
| `query` | low | auto | 查询已绑定数据库 / Data Source |
| `create_page` | medium | manual | 创建外部页面 |
| `append_content` | medium | manual | 向外部页面追加内容 |
| `create_record` | medium | manual | 创建结构化记录 |
| `update_record` | medium | manual | 修改记录属性 |
| `sync_to_knowledge_base` | medium | manual | 写入本地知识资产 |

强制规则：

1. 接入点权限不等于执行批准。
2. 写入和同步必须进入 Mira Policy。
3. 执行路径保持 `Planner -> Normalize -> Policy -> ToolNode -> Evidence -> Planner`。
4. Tool 只能执行冻结后的 `pendingToolCall`。
5. Notion 原始响应先转换为 Evidence，不能直接进入 Planner prompt。
6. 审批摘要必须包含接入点、目标资源、动作、内容摘要和影响范围。

## 页面信息架构

路由：

```text
/settings/micro-apps/notion
```

页面使用单个可滚动详情页，不做多层 Tab：

```text
Header
Connection Overview
Main Grid
  ├─ Access Points
  ├─ Connection Configuration
  └─ Right Aside
       ├─ Available Capabilities
       ├─ Policy Notice
       └─ Recent Activity
```

### 页面交互要求

- Header 提供返回、状态、测试连接和保存操作；
- Connection Overview 展示 Workspace、授权范围、接入点数量和最近校验时间；
- Access Points 当前只展示预留位置和模型示例；后续阶段再支持搜索、类型过滤、添加、编辑、停用、重新验证和删除；
- 添加 / 编辑接入点使用 Modal，保存前必须验证资源可访问；
- Connection Configuration 只显示脱敏 Token，替换凭据需要单独操作；
- Available Capabilities 只展示当前授权和接入点形成的受控能力；
- Recent Activity 只展示可审计摘要，不展示完整 Token、正文或原始 API 响应。

页面必须复用 `MicroAppPageLayout`、`Button`、`Card`、`Alert`、`Badge`、`TextInput`、`Select`、`Switch`、`Modal`、`Result`、`Skeleton`、`Message` 等共享组件，并使用语义 token。不得在业务页新增大圆角、强渐变或卡片套卡片。

## 功能流程

### 首次连接

```text
进入 Notion
  -> 输入 Internal Integration Token
  -> 测试连接
  -> backend 获取 Workspace 信息
  -> 返回连接能力和授权资源概况
  -> 保存 credentialRef
  -> 显示已连接状态
```

需要区分 Token 无效、Token 撤销、协议错误、网络错误、限流和无资源权限。

### 添加接入点

```text
填写名称和资源链接
  -> backend 解析 resourceId
  -> 使用当前 Connection 验证访问
  -> 获取资源标题和类型
  -> 校验动作兼容性
  -> 保存并启用 AccessPoint
```

资源未验证成功时可以保留草稿，但不能启用或提供给 Agent。

### Agent 搜索与读取

```text
用户问题
  -> Planner 选择 notion_search / notion_read
  -> Normalize 冻结接入点和参数
  -> Policy 自动批准只读调用
  -> ToolNode 调用 Notion Provider
  -> Evidence 生成摘要和来源
  -> Planner 基于 Evidence 回答
```

### 写回 Notion

```text
用户要求保存或更新
  -> Planner 生成写入动作
  -> Normalize 冻结目标和内容
  -> Policy 展示审批摘要
  -> 用户批准
  -> ToolNode 执行
  -> Evidence 保存结果和资源引用
```

### 同步到知识库

V1 只支持手动、单页或明确页面范围同步，不启用 Webhook、不做删除同步、不自动覆盖现有内容。同步必须产生标准化导入对象，沿用现有 Knowledge Base 导入链路并保留 Notion source metadata。

## Agent 工具投影

Planner 只看到以下受控工具：

```ts
notion_search({ accessPointId, query, limit? })
notion_read({ accessPointId, resourceId })
notion_query_database({ accessPointId, filter?, sorts?, limit? })
notion_create_page({ accessPointId, title, content, properties? })
notion_append_page({ accessPointId, resourceId, content })
notion_update_record({ accessPointId, resourceId, properties })
notion_import_to_knowledge_base({ accessPointId, resourceIds, knowledgeBaseId })
```

统一结果结构：

```ts
interface NotionToolSummary {
  action: NotionAction;
  accessPointId: string;
  status: "completed" | "failed" | "blocked";
  resourceCount: number;
  keyFindings: string[];
  citations: Array<{ resourceId: string; title: string; url?: string }>;
  answerReadiness: { canAnswer: boolean; reason: string; missingInfo?: string[] };
  rawRef?: string;
}
```

原始响应只用于 debug / audit，不进入 Planner prompt。

## Backend 边界

建议独立模块承担以下职责，具体目录按现有 server 结构落地：

```text
server/src/microapps/notion/
  connection-service.ts
  access-point-service.ts
  notion-client.ts
  resource-resolver.ts
  tool-adapter.ts
  evidence-mapper.ts
  errors.ts
  types.ts
```

约束：

- renderer 不直接调用 Notion API；
- renderer 不保存 Token；
- backend 统一处理认证、限流、错误映射、审计和脱敏；
- Provider 原始字段不得泄漏到业务层；
- Knowledge Base 只消费标准导入对象。

建议接口保持无 `/api` 后端路由前缀，开发环境的 `/api` 只属于 Vite proxy：

```text
GET    /microapps/notion
PUT    /microapps/notion
POST   /microapps/notion/validate
POST   /microapps/notion/credentials
GET    /microapps/notion/access-points
POST   /microapps/notion/access-points
PUT    /microapps/notion/access-points/:id
DELETE /microapps/notion/access-points/:id
POST   /microapps/notion/access-points/:id/validate
GET    /microapps/notion/activities
```

写接口只能使用安全凭据输入或 `credentialRef`，不得返回完整 Token。

## 状态和审计

页面至少支持：未配置、正在验证、已连接无接入点、部分接入点异常、连接异常和限流状态。

单个接入点异常不能停止其他接入点；连接异常时 backend 阻断调用但保留配置；限流错误需要返回可恢复失败和 retry-after，不能高频自动重试。

活动记录建议结构：

```ts
interface NotionActivity {
  id: string;
  action: string;
  accessPointId?: string;
  resourceId?: string;
  status: "completed" | "failed" | "blocked";
  summary: string;
  occurredAt: string;
  traceId?: string;
}
```

禁止记录完整 Token、OAuth secret、完整页面正文、未脱敏隐私字段和 Planner 私有推理。

## 当前实现状态

截至 2026-07-17：

- 已实现 Notion 微应用入口和路由；
- 已实现页面 UI 和局部交互状态；
- 当前优先实现连接名称、Token 替换入口、启用开关、只读策略和能力展示；
- 已实现接入点后端持久化、资源验证、数据库查询、内容写回和知识库同步接口；
- 已实现 Notion backend 连接配置、加密凭据存储和 Workspace Token 验证；
- 已实现连接级可用能力状态读取；
- 前端已接入 AccessPoint 列表、添加验证、重新验证、删除和类型过滤；编辑能力与 Agent Tool 投影仍待补齐；
- 尚未实现 Notion Provider、Agent Tool、Policy、Evidence 和审计链路；
- 尚未实现知识库同步。

当前 UI 中的连接、接入点和活动数据属于演示状态，不能作为真实连接或真实权限的证明。

## V1 验收标准

### 连接和接入点

- [ ] renderer 不持有完整凭据；
- [ ] 可以测试连接并返回 Workspace 信息；
- [ ] 替换无效 Token 不覆盖旧有效凭据；
- [ ] 一个连接可以创建多个接入点（后续阶段）；
- [ ] 支持三种接入点类型和独立允许动作；
- [ ] 保存前验证资源可访问（后续阶段）；
- [ ] 可以搜索、过滤、编辑、停用、重新验证和删除接入点（后续阶段）；
- [ ] 单个接入点异常不影响其他接入点（后续阶段）。

### Agent 和安全

- [ ] Planner 只看到受控 Notion 工具；
- [ ] 只读调用按 Policy 自动执行；
- [ ] 写入和同步必须审批；
- [ ] Notion 结果先进入 Evidence；
- [ ] 原始响应不直接进入 Planner；
- [ ] 审计记录不包含 Token、secret、完整正文或私有推理。

### 知识库和 UI

- [ ] 可以手动选择页面同步到现有知识库；
- [ ] 导入记录保存 Notion source metadata；
- [ ] 同步失败不污染已有知识库内容；
- [ ] UI 复用共享组件和语义 token；
- [ ] 浅色、深色和主题预设保持可读；
- [ ] 键盘焦点、禁用态和可访问名称完整；
- [ ] 页面内容宽度与现有 MicroApp 页面保持一致。

## 推荐落地顺序

```text
1. Connection + secure credential
2. AccessPoint CRUD + resource validation
3. notion_search / notion_read / notion_query_database
4. Agent Tool + Evidence 接入
5. create / append / update 审批链
6. 手动同步 Knowledge Base
7. Activity Summary
```

OAuth、多 Workspace、Webhook、双向同步和完整 Notion 编辑体验不进入 V1。
