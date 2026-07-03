# UChat 治理现状评估

Status: Current
Owner: chat
Last verified: 2026-07-02
Layer: raw-source
Module: Chat
Feature: UChatGovernance
Doc Type: assessment
Canonical: false
Related:
  - README.md
  - ../../uchat.md
  - ../../uchat-internal-maintenance.md

## 评估范围

本轮只看前端：

- `desktop/src/shared/uchat/core`
- `desktop/src/shared/uchat/ui`
- `desktop/src/features/chat`

不对后端路线作结论。

## 本轮代码观察

几个直接信号：

- `desktop/src/shared/uchat/ui/UChatThreadView.tsx`：1541 行
- `desktop/src/features/chat/components/UChatThread.tsx`：674 行
- `desktop/src/features/chat/core/protocol.ts`：713 行
- `desktop/src/shared/uchat/core/runtime.ts`：922 行

单靠行数不能判断对错，但结合当前职责分布，已经足够说明 `uChat` 进入了“需要治理，而不能再靠局部补丁维持整洁”的阶段。

## 当前优点

### 1. 主边界在概念上仍成立

当前文档和代码大体还保留了这条主边界：

- `shared/uchat/core`：canonical 类型、runtime、store
- `shared/uchat/ui`：展示组件
- `features/chat`：项目接线和业务装配

这说明当前不是彻底失控，而是边界开始承压。

### 2. `uChat` 已经形成真实平台层价值

它已经不只是一个聊天页组件，而是承接了：

- thread lifecycle
- composer lifecycle
- optimistic message flow
- run lifecycle
- execution trace UI

这代表它值得做专项治理，而不是随 feature 一起散改。

### 3. 侧边栏和线程视图已经开始有可插拔意识

像 `ChatSidebarEntry` 这样的抽象是正确方向，说明项目已经在尝试避免继续硬编码。

## 当前缺陷

### 1. integration 层职责正在持续变厚

典型表现：

- `features/chat/core/protocol.ts` 同时承担了 REST 适配、SSE 适配、canonical normalization、运行驱动实现
- `features/chat/components/UChatThread.tsx` 同时承担了角色、知识库、工作空间、摘要、Agent 开关、Modal 管理和线程交互
- `features/chat/components/UChatThreadListSidebar.tsx` 同时承担了 workspace 分组、workspace CRUD、sidebar tool modal、thread 列表接线

问题不在于“文件大”，而在于多个产品能力开始在同一装配层相互耦合。

### 2. `uChat core` 的 canonical 模型已经承受产品字段渗透

当前 canonical thread / capability 已经显式包含：

- `workspaceId`
- `agentEnabled`
- `sidebarEntries`

这类字段不一定现在就错，但说明 `uChat core` 正在被具体产品语义拉着走。

如果未来继续直接把：

- `knowledgeBaseId`
- `roleId`
- `contextSummary`
- 自定义智能体配置
- TTS / image generation 状态

都持续塞进 canonical 层，`uChat` 会逐渐失去“通用聊天 runtime”定位。

### 3. 线程元数据成为默认扩展槽，但缺少治理规则

当前大量线程上下文信息通过 `thread.metadata` 透传：

- `knowledgeBaseId`
- `roleId`
- `agentEnabled`
- `contextSummary`
- `contextSummaryUpdatedAt`

这在当前阶段有现实价值，但缺点也很明显：

- 领域语义分散
- 类型约束不强
- 容易让“临时扩展”变成长期依赖
- UI / runtime / protocol 都会开始各自解释 metadata

如果不治理，后面接附件策略、文生图、TTS、自定义智能体时会更乱。

### 4. `ui` 层已经不再只是纯展示

`UChatThreadView.tsx` 里虽然主要还是展示，但已经承担了大量交互编排和消息呈现决策：

- execution trace 展示
- agent 按钮状态逻辑
- composer action 展开
- 编辑消息逻辑的 UI 细节
- 多种 message part 呈现规则

这不代表它现在必须立刻拆，但意味着“只要再继续加两三个能力”，它会很快跨过可维护阈值。

### 5. 需求增长方向已经超出“普通聊天 UI”范畴

接下来你们明确要接：

- 自定义智能体
- RAG / Role / MCP 组合
- 附件
- 文生图
- TTS

这说明 `uChat` 后续要面对的不是单一文本聊天，而是一个多模态、多上下文、多执行面的对话工作台。

如果继续沿当前“每个 feature 在 chat integration 加一层逻辑”的路径走，复杂度会加速上升。

## 当前不清楚但危险的点

### 1. `uChat` 到底要不要继续保持“产品中立”

现在文档口径是：

- `uChat` 是 app-owned runtime
- 但仍强调 `core / ui / integration` 分层

问题是，随着 workspace、agent、role、RAG 一起上，`uChat` 还是不是一个相对中立的聊天 runtime，需要进一步明确。

如果答案是“要”，那很多能力就必须继续留在 integration。
如果答案是“不要”，那就要承认 `uChat` 正在演进成 Mira 专属 chat platform。

这个问题不先说清，后续所有边界判断都会摇摆。

### 2. thread metadata 的上限在哪里

当前 metadata 很好用，但它只是“好用”，还不是“清楚”。

要尽快明确：

- 哪些字段允许长期存在于 metadata
- 哪些字段必须升级为显式 typed field
- 哪些字段根本不该由 thread 持久化

### 3. capability、context、execution 三类东西还会继续混

未来的附件、文生图、TTS、自定义智能体，如果不提前分层，很容易混成一锅：

- capability：当前能做什么
- context：当前回复受什么隐藏状态影响
- execution：这一轮到底执行了什么

这三类东西必须持续区分，否则 UI 和 runtime 都会变形。

## 当前建议

### 1. 不立即大拆，但要停止无规则继续扩张

当前最合理的动作不是“先拆大文件”，而是：

- 每新增一项聊天能力，先判断落哪一层
- 先记清楚能力类型，再写实现

### 2. 建立一个稳定的“线程上下文 contract”

要尽快收口 `Role / KnowledgeBase / Summary / Agent / Workspace / Future Memory` 的边界：

- 哪些属于 request-only
- 哪些属于 thread persisted state
- 哪些只是 UI draft state

### 3. 建立“媒体能力 contract”

附件、文生图、TTS 不是同一类需求。

至少要提前区分：

- 输入附件
- 输出媒体
- 媒体生成任务
- 媒体回放 / 展示

否则以后都只会继续塞进 `ChatMessagePart` 和大组件判断分支里。

### 4. 建立“自定义智能体能力矩阵”

未来自定义智能体很可能是：

- RAG
- Role
- MCP
- 当前 Agent

的组合体。

所以不能把它当单一功能，而要当配置矩阵来设计。

## 第一轮治理结论

当前 `uChat` 最真实的问题不是“代码已经坏了”，而是：

- 功能面增长太快
- integration 层开始变成收容一切的地方
- canonical 模型和 metadata 都在被业务拉扯

所以后续治理目标应是：

- 保住主分层
- 限制领域概念继续下沉
- 先定义 contract，再接新能力

