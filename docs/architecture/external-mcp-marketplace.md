# 外部 MCP Marketplace 接入

Layer: raw-source
Module: tooling-runtime
Doc Type: design

Status: Planned
Owner: runtime
Last verified: 2026-06-25

## 单点真相范围

这页只回答一件事：

UIChat Mira 将来要怎样消费第三方 MCP server。

它覆盖：

- 外部 MCP server 的发现与安装记录
- transport 的归属与连接方式
- 权限、密钥、免责声明与审计边界
- MCP protocol capability 怎样投影进现有 harness runtime
- 后续怎样再接到 chat runtime

它不讨论“本项目怎样把自己的文档暴露给别的 AI 客户端”。那部分属于知识库侧 MCP，见：

- `knowledge-system/FULL_MCP_AND_INDEX_ARCHITECTURE.md`

相关概念：

- [[CONCEPT_MCP]]
- [[CONCEPT_RUNTIME]]
- [[AREA_MAP_RUNTIME]]

## 适合什么时候读

你在下面这些场景里应该先读这页：

- 想把 MCP marketplace server 接进本项目
- 想明确第三方 MCP server 的运行边界应该落在 renderer 还是 backend
- 想知道 Tool、MCP、marketplace、external server、builtin MCP 这些产品概念怎么区分
- 准备给 Settings -> MCP 扩市场、安装、连接、调试能力

## 当前事实

当前项目已经有内部 MCP / harness 基座，位于 `server/src/mcp`，并且已经具备：

- 内置 tool / resource 注册
- `GET /mcp/tools`
- `GET /mcp/resources`
- `POST /mcp/invocations`
- `POST /mcp/invocations/stream`
- invocation 事件缓冲
- 内置 `read`、`edit`、`web_search`、`terminal` 等能力
- renderer 里的 Settings -> Tools workbench

当前缺的不是 invocation 基础设施，而是“第三方 MCP server 生命周期管理”。

## 当前怎么用

当前阶段，这里的 MCP 不是聊天自动调工具系统，而是一个 external MCP server 接入工作台。

它的实际使用主线是：

1. 打开 `Settings -> MCP`
2. 在 `市场` 里浏览第三方 MCP server
3. 选择支持 `streamable-http` 的 server，执行安装
4. backend 保存 external MCP server record
5. 切到 `已安装`
6. 对目标 server 执行 `连接`
7. 对目标 server 执行 `Discover`
8. backend 把远端 MCP protocol tools 投影为本地 harness capability
9. 通过现有 `/mcp/invocations` 或 `/mcp/invocations/stream` 做手动调用

换句话说，当前 MCP 走的是：

`市场 -> 安装 -> 连接 -> Discover -> 投影 -> 手动调用`

而不是：

`市场 -> 安装 -> 聊天自动使用`

### 当前已经打通

- marketplace 浏览
- external MCP server 安装记录
- disclaimer 校验
- `streamable-http` transport
- `connect`
- `Discover`
- projected capability 注册
- 手动 invocation
- 前端展示已安装 server、连接状态、Discover 结果与 projected capability id

### 当前还没打通

- chat 自动调用 MCP capability
- 复杂 approval 流程
- `stdio` transport
- 完整 secret 管理面板
- 非核心内置 MCP package 管理闭环

## 产品概念边界

产品形态上，`Tool` 和 `MCP` 是两个概念。

- `Tool` 是项目内部核心能力。哪怕底层 schema、事件、harness 实现借用了 MCP 标准，它在产品上仍然是 Tool。
- `MCP` 是非核心能力接入域，包含外部 marketplace MCP server，以及后续 app 自带但非核心的内置 MCP 包。
- MCP 协议里的 tool/resource 只是协议 capability，不自动等于产品里的 `Tool`。

因此 UI 上也要分开：

- Settings -> Tools：内部核心 Tool 工作台
- Settings -> MCP：MCP 市场、第三方 MCP server、未来非核心内置 MCP 包

## 核心定位

外部 MCP server 必须由 backend harness 托管，不能放到 renderer 直接跑。

原因很简单：

- renderer 不能直接持有 Node API
- 外部 server 可能涉及进程拉起、网络访问、密钥与审批状态
- 所有 capability 执行都应该复用现有 invocation 生命周期
- harness 应该继续做统一的进度、产物、失败与完成状态观察者

renderer 可以做：

- 浏览 marketplace
- 安装、启用、禁用、测试 external server
- 查看发现到的 MCP protocol tool / resource
- 编辑配置与密钥

renderer 不该做：

- 直接连接 MCP transport
- 自己保存第三方 server secret 真值
- 绕过 harness 直接执行 MCP capability

## 信任边界

### `tool`

项目内置、处于本项目信任边界内的内部核心 Tool。

例如：

- `read_open`
- `web_search`
- `terminal_session`

### `builtin-mcp`

后续由 app 自带、但不属于内部核心 Tool 的非核心内置 MCP 包。

它归 Settings -> MCP 管理，不归 Settings -> Tools 管理。

### `external-mcp`

用户安装或连接的第三方 MCP server，以及它暴露出来的 tool / resource。

### `marketplace`

发现元数据来源，不等于信任边界本身。

也就是说：

- marketplace 只能告诉我们“这里有个 server”
- 它不能直接等同于“这个 server 可以安全执行”

## 范围

### 本页覆盖范围

- 浏览 marketplace MCP server 元数据
- 持久化已安装 / 已配置的 external server 记录
- 通过批准的 transport 连接 external server
- 发现 MCP protocol tools / resources
- 把 MCP protocol capability 投影进当前 harness registry
- 通过现有 invocation API 与 SSE 事件模型执行 MCP capability
- 在 backend 内部保存 secret
- 对高风险操作展示风险信息并接入审批

### 第一阶段明确不做

- 普通 chat 流程里的自动 tool calling
- OAuth 账号绑定流程
- 从不受信任包元数据静默自动安装
- transport 之间的静默兼容 fallback
- 未经用户明确确认就执行任意 marketplace code

## 外部来源

第一优先的 marketplace 来源建议是官方 MCP registry：

```text
https://registry.modelcontextprotocol.io/v0/servers
```

但要明确：

- registry 提供的是发现元数据
- 不是执行策略真相
- 不是安全白名单

已安装 server 记录至少要保存这些可审计字段：

- registry source URL
- server id 或 package name
- server version
- transport type
- install command 或 remote URL
- declared capabilities
- last fetched time

## Transport 模型

外部 transport 必须显式建模，不做模糊字符串兜底。

推荐枚举：

```ts
type ExternalMcpTransportKind = "stdio" | "streamable-http";
```

### `stdio`

由 backend 启动并持有子进程。

要求：

- 显式 `command`、`args`、`env`
- 首次启动前必须有用户确认
- 打包态要单独评估兼容性
- 要有 timeout 与进程清理
- 必要时把 stdout / stderr 送进 invocation 事件流

### `streamable-http`

由 backend 连接远端 MCP endpoint。

要求：

- 显式 endpoint URL
- 可选 auth header 或 token reference
- 按 MCP transport 指南处理 headers / origin
- 清晰标注 network-access 风险
- 不允许 renderer 直接连

## 数据模型

推荐的 backend record：

```ts
type ExternalMcpServerRecord = {
  id: string;
  source: "registry" | "manual";
  registryUrl?: string;
  packageName?: string;
  displayName: string;
  description?: string;
  version?: string;
  transport: ExternalMcpTransportConfig;
  status: "configured" | "connected" | "disabled" | "failed";
  enabled: boolean;
  createdAt: string;
  updatedAt: string;
  lastConnectedAt?: string;
  lastError?: string;
};

type ExternalMcpTransportConfig =
  | {
      kind: "stdio";
      command: string;
      args: string[];
      envSecretRefs?: Record<string, string>;
    }
  | {
      kind: "streamable-http";
      url: string;
      authSecretRef?: string;
    };
```

推荐的已发现 tool record：

```ts
type ExternalMcpDiscoveredCapability = {
  id: string;
  serverId: string;
  externalName: string;
  projectedCapabilityId: string;
  title: string;
  description?: string;
  inputSchema: Record<string, unknown>;
  outputSchema?: Record<string, unknown>;
  risk: McpCapabilityMetadata;
  lastDiscoveredAt: string;
};
```

## MCP Capability 投影规则

MCP capability id 不能和内部核心 Tool id 冲突。

内置 capability 继续保留稳定 id，例如：

- `read_open`
- `read_locate`
- `web_search`
- `terminal_session`

第三方 MCP protocol capability 统一使用投影命名。

推荐格式：

```text
mcp:<server-id>:<capability-kind>:<capability-name>
```

规则：

- 保留外部 MCP capability schema
- 每次 invocation 都挂上 `serverId`
- 未知副作用默认按“需要审批”处理
- 远端 MCP capability 默认视为 `networkAccess: true`
- `stdio` MCP capability 默认视为 `sideEffect: process`
- 不做静默降级到内部核心 Tool 的 fallback
- renderer 页面直接展示 projected id，方便排查、审批和 trace 对齐

## API 面

第一轮建议路由：

```text
GET    /mcp/marketplace/servers
POST   /mcp/external/servers
GET    /mcp/external/servers
GET    /mcp/external/servers/:id
PATCH  /mcp/external/servers/:id
POST   /mcp/external/servers/:id/connect
POST   /mcp/external/servers/:id/disconnect
POST   /mcp/external/servers/:id/discover
DELETE /mcp/external/servers/:id
```

注意：

- 这些都是 backend route
- 不包含开发态专用 `/api` 前缀

## Secret 处理

renderer local storage 不能作为 external MCP secret 的主存储。

`.env` 也不适合作为用户驱动的 marketplace server 主存储，因为它不适合：

- UI 安装 / 删除
- token 轮换
- 每个 server 各自的 credential
- 打包桌面端的持久状态

MVP 决策建议：

- external server record 放 SQLite
- secret material 放 SQLite 加密字段
- API 返回只给脱敏元数据，例如 `hasSecret`
- invocation 时只在 backend 执行上下文里解析 secret
- 删除 server 时同步删 secret 记录

建议表：

```text
external_mcp_servers
external_mcp_server_secrets
```

如果以后迁移到 Windows Credential Manager 或其他 OS keychain，也应该保留稳定的 `secretRef`，避免 transport / config 模型再次重构。

## 配置表单策略

不能把 external MCP server 的配置问题简化成“给一个 token 输入框”。

现实里一个 server 可能同时需要：

- endpoint URL
- auth token / API key / custom headers
- workspace / tenant / org / project
- region / mode / provider
- server 自己额外要求的业务字段

而且这些字段不一定都能从 marketplace、MCP 包或 server 自描述里自动拿全。

### 市面上成熟产品的共性

当前主流产品基本都收敛到同一个判断：

- 不假设可以从 MCP 包里自动提取完整安装表单
- 先接入 server 定义，再逐步补配置
- secret 和非 secret 字段分开
- 允许工作区级、用户级、环境变量级配置叠加
- 给高级用户保留 headers / env / raw config 兜底入口

也就是说，成熟产品做的是：

`server definition + known config + secret inputs + advanced config + validation loop`

而不是：

`自动生成一次性完美表单`

### 本项目应该怎样落

这里推荐把 external MCP 配置理解成多来源合成的“已知配置草案”。

来源通常有四层：

1. 项目内置 preset / adapter
2. marketplace 元数据
3. server 自身可发现的声明
4. 用户手工补充

因此 backend 不应该承诺“返回完整 schema”，只能承诺：

- 返回当前已知的配置字段
- 标注这些字段来自哪里
- 标注这份 schema 是否可能不完整
- 允许用户继续补充高级配置

推荐模型：

```ts
type ExternalMcpConfigField = {
  key: string;
  label: string;
  type: "text" | "password" | "url" | "select" | "boolean" | "number" | "json";
  required: boolean;
  secret?: boolean;
  placeholder?: string;
  description?: string;
  defaultValue?: unknown;
  options?: Array<{ label: string; value: string }>;
};

type ExternalMcpConfigSchemaResolution = {
  fields: ExternalMcpConfigField[];
  completeness: "known-partial" | "known-good" | "unknown";
  sources: Array<"preset" | "marketplace" | "server-self-describe" | "manual">;
  notes?: string[];
};
```

### 渐进式配置，而不是一次填完

更现实的交互主线应该是：

1. 用户安装 server
2. 系统展示“当前已知字段”
3. 用户填写
4. backend 尝试 `connect`
5. 如果失败：
   - 展示错误
   - 保留现有配置
   - 允许继续补字段
   - 必要时进入高级配置

这意味着配置系统必须支持：

- schema 不完整
- connect 后再修
- secret 与普通字段分开保存
- raw headers / raw JSON 作为高级兜底

### MVP 建议

第一轮不必一步做到全能动态表单，但方向要对。

建议先支持三层：

1. 基础配置
   - endpoint
   - transport
   - display name
   - timeout

2. 已知字段表单
   - text
   - password
   - boolean
   - select
   - json

3. 高级配置
   - custom headers
   - extra env / secret refs
   - raw config JSON

这样可以覆盖大多数 `streamable-http` server，同时不假装我们能自动知道全部业务字段。

## Marketplace Source 策略

marketplace 来源不应和 UI 语言强绑定。

正确关系是：

- 语言影响文案
- source 决定元数据来源
- 二者可以影响默认值，但不是同一个设置

推荐模型：

- 默认 source：官方 MCP registry
- 国内友好 source：镜像、自托管 curated registry、静态 JSON
- MVP 可先支持 runtime / env override，例如 `MCP_REGISTRY_URL`
- 后续再补 UI source selector

未来可补：

```text
GET /mcp/marketplace/sources
PUT /mcp/marketplace/source
GET /mcp/marketplace/servers?source=official
```

## 权限与免责声明

外部 MCP capability 默认应走显式风险审查。

审批输入至少包括：

- server identity
- transport kind
- tool name
- declared schema
- side effect metadata
- network / process / local-write 标记
- 涉及的 workspace 或 root scope

默认策略建议：

- 只读元数据浏览不需要审批
- 第一次连接 external server 需要审批
- 启动 `stdio` server 需要审批
- 本地写、进程、网络类 tool 在执行前需要审批
- 风险元数据不明时默认需要审批

### MVP 免责声明模型

MVP 不一定马上做完整 per-tool approval，但至少要有 third-party server 安装 / 启用免责声明。

建议：

- 内部核心 Tool 不走 MCP 安装免责声明
- app 自带但非核心的内置 MCP 包归 Settings -> MCP 管理，按 MCP 产品策略决定是否需要额外提示
- user-installed / user-connected third-party server 必须接受一次免责声明
- invocation-time approval 先预留策略接口
- disclaimer acceptance 必须可持久化、可审计

可持久化结构：

```ts
type ExternalMcpDisclaimerAcceptance = {
  serverId: string;
  acceptedAt: string;
  acceptedVersion?: string;
  disclaimerTextHash: string;
};
```

如果免责声明文本或 server version 发生重要变化，可以要求重新确认。

## 与 Chat Runtime 的关系

第一阶段不要改普通 chat 主链。

后续真要接入 chat tool calling，流程应该是：

1. provider 提出 tool call
2. backend 把目标 id 映射到内部核心 Tool 或已投影 MCP capability
3. harness 检查审批与执行策略
4. 如果需要审批，run 进入 approval-wait
5. 已批准的 invocation 发出 trace 与 artifact
6. tool result 通过 provider proxy adapter 回写到模型上下文
7. 最终 assistant 输出以 `uchat` 的 canonical message parts 持久化

也就是说，真正动 chat 之前，还要同步设计这些页面：

- `provider-proxy-api.md`
- `uchat.md`
- `harness-runtime-design.md`

## UI 放置建议

第一阶段放在 `Settings -> MCP`，不要挂在 `Settings -> Tools` 下面。

建议视图：

- `Marketplace`
- 已安装 / 已连接 MCP server
- 未来非核心内置 MCP 包
- connection status
- discovered MCP protocol tools / resources
- manual invocation test panel
- per-server secret / config editor
- risk / disclaimer display

页面边界：

- `Settings -> Tools`
  - 按五大内置域分组：`read`、`edit`、`web_search`、`terminal`、`browser_action`
  - 只承载内部核心 Tool 工作台
- `Settings -> MCP`
  - 关注 MCP server 浏览、风险审查、安装前评估
  - 后续承载已连接 MCP server、非核心内置 MCP 包、discovered capability 与 projected id

这样可以保持产品概念清楚，即使底层都复用同一套 harness / invocation 基座。

## 打包注意事项

Electron 打包态通过内置 Node runtime 跑 backend。

要在打包态支持 `stdio` external server，至少要验证：

- backend 能正常拉起子进程
- command lookup 不依赖开发机 PATH
- app 退出时能清理 server 进程
- 不会隐式依赖 `resources/server/node_modules` 之外的原生模块

如果这些条件不满足，就应该：

- 暂时禁用 `stdio` marketplace server
- 或明确标成 dev-only

## 分阶段计划

## Delivery Checklist

### 已完成

- [x] 确认产品边界：`Tool` 和 `MCP` 分离，`Settings -> MCP` 作为独立产品域
- [x] 完成 MCP 市场浏览 MVP：独立页面、市场拉取、基础文档与文案
- [x] 完成 Phase 1 后端：external MCP server record、`streamable-http` connect/discover、capability projection、手动 invocation

我已完成的自动化测试：

- [x] marketplace response normalization
- [x] invalid registry payload handling
- [x] external server 创建、connect、discover、projection、manual invocation 路由链路
- [x] disclaimer 未接受时拒绝安装 external MCP server

需要你手测的项目：

- [ ] 打开 `Settings -> MCP`，确认市场页入口、文案和 Tool/MCP 产品边界符合预期
- [ ] 确认当前 MCP 页面没有再混进 `Settings -> Tools`

当前已完成项的验收标准：

- [x] 产品形态上 `Tool` 与 `MCP` 明确分离，页面入口与文档表述一致
- [x] 后端可以接入一个 `streamable-http` external MCP server，并完成 connect/discover/invocation 最小闭环
- [x] third-party external MCP server 在安装前必须接受一次免责声明

### 进行中

- [ ] 完成 Phase 1 前端：`Settings -> MCP` 接 external server API，展示已安装/已连接 server、discover 结果与 projected capability id

我会补的自动化测试：

- [ ] external server 列表渲染
- [ ] connect/discover 动作状态
- [ ] projected capability id 展示
- [ ] 错误态、空态、刷新态

需要你手测的项目：

- [ ] 从 MCP 页面能看到已安装 server、连接状态、discover 结果
- [ ] projected capability id 的呈现方式符合你的产品预期
- [ ] 状态流和按钮命名符合你的使用习惯

验收标准：

- [ ] `Settings -> MCP` 不只浏览 marketplace，还能展示真实 external MCP server 生命周期状态
- [ ] 用户能清楚区分 marketplace server、installed server、discovered capability、projected capability id
- [ ] 页面刷新后已安装/已发现状态仍能正确恢复

### 待做

- [ ] 完成 Phase 1 前端交互：从 marketplace 发起安装，安装时弹一次第三方免责确认
- [ ] 完成 Phase 1 测试补齐：前端 external server 状态流、connect/discover 动作、错误态与空态
- [ ] 完成 Phase 2 后端：secret 存储、脱敏返回、server config 更新接口
- [ ] 完成 Phase 2 后端：approval record 与高风险 capability denial
- [ ] 完成 Phase 2 前端：secret/config 编辑、风险展示、approval 状态展示
- [ ] 完成 Phase 2 测试补齐：secret 不回流、approval denial、生效边界
- [ ] 完成 Phase 3 设计收口：provider/chat runtime 与 MCP capability 调用协议对齐
- [ ] 完成 Phase 3 实现：chat tool calling、approval-wait、`uchat` trace 持久化
- [ ] 完成后续扩展：非核心内置 MCP 包管理、marketplace source 切换、`stdio` transport

后续每项都需要补三类内容：

- [ ] 我负责的自动化测试
- [ ] 需要你手测的项目
- [ ] 明确的验收标准

### Phase 1：Marketplace + 手动 Invocation

交付：

- marketplace metadata fetch
- manual external server records
- 先支持一种 transport，优先 `streamable-http`
- MCP capability 投影进 harness registry
- 通过 `/mcp/invocations/stream` 手动调试
- registry parsing、projection、invocation routing 的测试
- external server 安装 / 启用免责声明

完成条件：

一个已配置的 external MCP server 能在 Settings -> MCP 里展示 projected MCP capability，并能通过 backend SSE invocation flow 手动调用。

### Phase 2：Secret 与 Approval 加固

交付：

- backend-owned secret storage
- 脱敏 server config response
- approval records
- UI 风险展示
- invocation denial tests

完成条件：

敏感 MCP capability 在没有审批状态时不能运行，且 secret 不会回流到 renderer response。

### Phase 3：Chat Tool Calling

交付：

- provider capability definition projection
- backend chat tool-call loop
- approval-wait 事件语义
- `uchat` canonical invocation trace parts
- assistant message 上的 durable invocation reference

完成条件：

一次 chat run 可以调用已批准的 MCP capability，持久化 invocation trace，并在刷新后回放。

## 测试要求

每个实现阶段都必须同改同测。

最低 backend 测试：

- marketplace response normalization
- invalid registry payload handling
- external server config validation
- MCP capability id projection 与 collision handling
- connect / discover failure reporting
- external MCP capability invocation lifecycle events
- high-risk MCP capability approval denial

最低 renderer 测试：

- external server list rendering
- 脱敏 secret 展示
- connect / discover 动作状态
- MCP 页面能展示 projected MCP capability id

手动验证：

```bash
pnpm check
pnpm package:electron:win
```

涉及打包影响时，还要按 `runtime.config.cjs` 里的 host / port 检查打包后 backend health。
