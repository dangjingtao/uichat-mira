# UChat 运行时

Status: Current
Owner: chat
Last verified: 2026-07-22
Layer: raw-source
Module: Chat
Feature: UChat
Doc Type: current-contract
Canonical: true
Related:
  - uchat-internal-maintenance.md
  - chat/uchat-application-state-lifecycle-design.md
  - chat/chat-system-practices.md
  - provider/README.md

`uchat` 是当前项目新的自有对话运行时方案，作为聊天状态和运行时框架的唯一主实现。

## 单点真相范围

这篇文档是以下内容的单点真相页：

- `uchat` 运行时的职责边界
- chat 主实现的分层口径
- 当前线程与知识库绑定的产品语义

相关概念：

- [[CONCEPT_UCHAT]]
- [[CONCEPT_RUNTIME]]
- [[CONCEPT_KNOWLEDGE_BASE]]
- [[AREA_MAP_CHAT]]

## 运行时口径

当前 chat 运行时规则统一维护在：

- `docs/uchat-internal-maintenance.md`
- `docs/provider/README.md`

历史整改记录只作为背景材料阅读，不再作为当前主契约。

## 目标

- UI 无关：核心不依赖 React 组件、Provider 栈、浏览器本地聊天存储
- 协议无关：核心不直接认识当前项目的 REST 路由、SSE 事件名、附件元数据格式
- 可扩展：后续可以替换线程存储、流式协议、附件上传方式，而不改核心状态机
- 自己可控：只保留项目真正需要的能力，不再围绕第三方 runtime 适配

## 当前边界

当前 `uchat` 应被理解为三层：

- core：状态、类型、runtime orchestration
- ui：与 canonical message / thread / composer 对应的展示组件
- integration：与当前项目业务协议和页面装配发生连接的适配层

不要再把 UI、协议和业务规则重新揉回同一层。

## 应用级状态生命周期

- `shared/uchat` 从公共入口导出 `UChatApplicationStateProvider`；
- UChat 宿主按应用提供的 `sessionKey` 持有唯一 runtime，同一会话内普通路由切换不得重建；
- 应用集成层注入 runtime 工厂和清理行为，UChat 不依赖认证、路由、知识库、角色或桌面 API；
- 首页、聊天和设置位于共同的已登录聊天状态边界下；
- 聊天视图可以在设置页卸载，但 runtime、线程状态、composer 和运行中任务继续存在；
- runtime 同一时间只运行一个任务，`activeRunThreadId` 记录该任务所属线程；切换线程不会重置后台任务状态；
- 后台有其他线程运行时，当前线程 composer 允许编辑并按线程保留草稿，但发送继续禁用，且当前线程不显示停止按钮；
- 登出或用户身份变化时创建新会话状态，并停止旧 runtime 的当前发送；
- 应用壳层和设置页面不得订阅完整线程或消息数组。

详细实施记录和测试证据见 `chat/uchat-application-state-lifecycle-design.md`。

## Sidebar 扩展口径

聊天侧边栏历史线程区域上方的功能入口，现已纳入 `uchat` 可扩展能力范围。

- `core` 只定义通用入口描述：`ChatSidebarEntry`
- `ui` 只负责渲染入口，不绑定具体业务行为
- `integration` 负责提供入口列表，并处理点击后的真实动作，例如弹出搜索、切换工作空间、后续接更多 chat 工具入口

这意味着：

- 不要在 `UChatSidebarView` 里继续硬编码某个具体功能按钮
- 新入口应优先通过 `sidebarEntries` 注入
- 如果未来要新增“收藏线程”“多会话筛选”“Agent 工具台”等入口，优先沿用这条 contract，而不是再开一套 sidebar 私有实现

## 消息媒体插槽

- `shared/uchat` 从公共入口导出 `UChatThreadSlots` 和 `UChatMessageExtensionProps`
- `UChatThreadView` 只提供消息正文 `content` 和消息操作 `actions` 两个通用挂载位置
- 图片生成、图片预览地址加载、失败重试、TTS 请求和音频播放由应用集成层的 `DesktopChatMessageExtensions` 承担
- `shared/uchat` 不直接调用 `getChatMediaPreviewUrl`，也不认识 UIChat Mira 的图片生成和 TTS 开关
- 未注入 `MessageExtensions` 时，只是不渲染应用媒体扩展；基础消息、线程和 composer 行为不受影响
- Agent 是 UChat 内建能力；模式按钮通过 `ComposerTools` 所在的 composer 工具位置渲染，不通过媒体插槽接入

设计记录和后续筹划见 `chat/uchat-ui-slot-design.md`。

## Composer 工具插槽

- `shared/uchat` 的 `UChatThreadSlots` 提供可选的 `ComposerTools` 挂载位置
- UChat 内建的 Agent 模式按钮在该位置渲染，宿主仍可通过 `ComposerTools` 追加其他通用工具
- Agent 审批不属于 composer 工具，继续显示在对应消息内

## Agent 界面能力

- Agent 是 UChat 内建业务，由 UChat 提供稳定的模式、提交和消息状态表达
- `UChatAgentModeControl` 通过 composer 工具插槽渲染模式开关，工作空间可用性和切换意图由宿主通过 UChat 合同传入
- 宿主可通过 `UChatThreadView` 的 `composerSuggestion` 在输入框上方插入应用自有的候选面板；该节点不携带业务语义。本项目仅在 Agent 启用时用它展示 `$` Skill 候选列表
- 宿主可通过 `renderComposerEditor` 仅替换文本编辑区域；本项目在 Agent 启用时使用 mention 编辑器展示已选 Skill，附件与 composer 操作区仍由 UChat 管理
- Agent 输入框使用 `@` 选择现有 MCP workbench 工具包；候选项来自工具定义的 `workbench` 元数据，发送时通过 `requestedToolGroupIds` 传入 Agent
- `@` 工具包是 Planner 的显式工具偏好：后端把工具包名称、说明、成员工具和本轮实际暴露工具写入结构化上下文，同时用于增强工具意图 query；它不筛选或扩大 `exposedTools`，不强制调用，不绕过权限与审批
- Agent execution trace 使用独立的工具包上下文节点显示偏好是否可用；未知或当前未暴露的工具包必须显示不可用，不得伪装成已经调用
- `UChatAgentUIController` 是 UChat 界面层统一的 Agent 状态与操作合同，包含模式、运行态、两类可用性以及切换、提交、审批和拒绝意图
- `UChatThreadView` 只接收一个可选的 `agent` 控制对象，不再分别接收多个 Agent 状态和回调属性
- 输入组件只渲染通用 `composerTools` 节点，不包含 Agent 状态判断或切换实现
- `resolveUChatAgentSubmission` 在 composer 外部选择普通发送或 Agent 发送；composer 只接收通用提交属性
- `UChatAgentMessageStatus` 在对应消息内处理审批、拒绝、阻塞、失败和操作错误
- execution trace 仍由 `UChatMessageTrace` 和 `UChatExecutionTrace` 表达，不与 Agent 审批重复
- 本次没有调整 runtime、canonical message、协议、审批接口或后端

## Execution trace

- RAG、Agent 和 Tool 的执行步骤统一使用 canonical message 的 `execution-node`
- `UChatMessageTrace` 在 UChat 内部完成步骤派生、去重和失败展示选择
- `UChatExecutionTrace` 在 UChat 内部渲染统一轨迹，不作为应用业务插槽
- `rag-node` 是历史消息的兼容输入，不代表当前 trace 只属于 RAG
- 检索来源和 Agent 审批仍是各自独立的数据与交互，不得重复实现执行步骤解析

## 流式文本显示

- canonical message 继续即时保存协议传入的完整文本，runtime 和 store 不承担视觉节奏控制
- UChat 助手正文通过共享 UI 的 `StreamingTextRenderer` 生成按帧追赶的可见前缀，再交给 `MarkdownText`
- 中文按 Unicode 字素边界推进，避免截断 emoji 和组合字符；首批显示短前缀，传输结束后继续完成显示队列
- Streamdown 保留流式 Markdown 状态，但 UChat 不启用逐词入场动画
- 助手消息从本地乐观结果切换为持久化结果时使用稳定的展示 key，避免真实消息 ID 变化导致渲染队列和 Markdown 实例重建；业务操作仍使用 canonical message ID
- 该显示层不处理附件、媒体、execution trace、工具事件或 Agent 状态

## 适合什么时候读

这些场景建议先读这页：

- 改聊天主链路
- 改线程与消息状态模型
- 改知识库绑定语义
- 评审某段 chat 改动是否越过了分层边界

## 相关文档

- `uchat-internal-maintenance.md`
- `chat/chat-system-practices.md`
- `provider/README.md`
