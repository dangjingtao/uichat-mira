# uchat

`uchat` 是当前项目新的自有对话运行时方案，作为聊天状态和运行时框架的唯一主实现。

## 本轮整改跟踪

本轮 chat 主链路整改的执行原则与可勾选 checklist 统一维护在：

- `docs/chat-remediation-checklist.md`
- chat 发送协议、线程协议与后续待补协议统一维护在：`docs/provider-proxy-api.md`

执行要求：

- 修改前先检查代码是否已经实现，且实现是否符合当前产品规则
- 没实现，或实现存在行为缺陷时，再进入改动
- 每完成一项整改并通过对应测试后，再勾选 checklist
- 前端工程验收由项目 owner 手测，代码全部改好后由 Codex 列出手测清单并停下等待验收

## 目标

- UI 无关：核心不依赖 React 组件、Provider 栈、浏览器本地聊天存储。
- 协议无关：核心不直接认识当前项目的 REST 路由、SSE 事件名、附件元数据格式。
- 可扩展：后续可以替换线程存储、流式协议、附件上传方式，而不改核心状态机。
- 自己可控：只保留项目真正需要的能力，不再围绕第三方 runtime 适配。

## 目录

核心目录固定在：

```text
desktop/src/shared/uchat
```

当前公开文件：

```text
core/types.ts     # 领域模型与接口边界
core/store.ts     # vanilla zustand store
core/runtime.ts   # 线程/发送/上传/流式编排
ui/react.tsx      # React 绑定
index.ts          # 对外导出
```

内部维护约束见：

```text
docs/uchat-internal-maintenance.md
```

## 分层

### 1. uchat core

`desktop/src/shared/uchat/core`

这一层只负责：

- 线程、消息、附件、composer 的 canonical 模型
- 运行时状态
- 线程加载/选择
- 线程更新、刷新、归档、删除等命令
- 发送流程编排
- 上传流程编排
- 流式事件消费

这一层不负责：

- `/threads`、`/attachments`、`/proxy/chat/default`
- 当前后端 SSE 事件名
- 旧消息元数据中的历史兼容字段名
- React 组件渲染

### 2. app adapters

当前项目协议映射与项目级时机切面放在：

```text
desktop/src/features/chat/core
```

这一层负责：

- 将当前线程 REST 接口映射成 `ChatRepository`
- 将当前附件上传接口映射成 `ChatAttachmentDriver`
- 将当前 SSE 协议映射成 `ChatRunDriver`
- 将历史消息的旧持久化格式还原成 canonical parts
- 维护当前项目发送前后、刷新前后、事件处理复写等时机切面

如果后续后端协议变化，优先改这一层，不改 `shared/uchat/core`。

### 3. UI bindings

React 绑定仍然留在 feature 层，而不是塞回 core。

原因：

- 避免 core 重新耦合 React
- 未来可以接别的 UI
- 状态和组件演进可以分离

当前桌面应用的主聊天展示层进一步拆成两层：

```text
desktop/src/features/chat/components
  UChatThread.tsx
  UChatThreadListSidebar.tsx
  uchat/*
```

其中：

- `UChatThread.tsx` / `UChatThreadListSidebar.tsx` 是主容器入口
- `shared/uchat/ui/*` 是当前共享展示组件层与 RAG 可视化层
- `features/chat/core/*` 负责接口配置、数据转换、事件处理复写与时机切面
- 这些层都不应该反向污染 `shared/uchat/core`

## 当前产品规则

当前聊天线程与知识库的产品语义明确如下：

- `knowledgeBaseId` 是聊天线程是否走 RAG 的唯一真相源
- 线程存在 `knowledgeBaseId`：这条线程走 RAG
- 线程 `knowledgeBaseId = null`：这条线程走非 RAG

欢迎态与已持久化线程的行为边界：

- 欢迎态（尚未创建线程）允许选择、替换、解绑知识库
- 欢迎态的知识库操作只修改本地草稿，不创建线程、不发线程更新请求
- 首发发送时，当前草稿中的 `knowledgeBaseId` 会参与 `createThread`
- 已持久化线程允许绑定、换绑、解绑知识库
- 已持久化线程上的知识库操作属于线程配置变更，允许发 `PATCH /threads/:id`

聊天界面里的“解绑知识库”语义：

- 这不是删除知识库资源
- 这只是让当前线程不再绑定某个知识库
- 知识库资源本身的删除仍然只能在知识库管理域完成

## 核心接口

### ChatRepository

负责线程列表、线程详情、创建、更新、删除。

### ChatRuntime

当前 `uchat` 运行时已经直接提供应用层常用命令：

- `loadThreads()`
- `selectThread()`
- `ensureThread()`
- `refreshThread()`
- `updateThread()`
- `archiveThread()`
- `deleteThread()`
- `setComposerText()`
- `setComposerAttachments()`
- `send()`

这意味着 UI 层应优先调用 runtime，而不是自己直接请求项目 API。

同时，runtime state 还会暴露 `capabilities`，用于告诉 UI：

- 当前仓储是否支持重命名 / 归档 / 删除
- 当前运行时是否支持附件上传

这样 UI 层不需要直接探测 repository 实现细节。

### ChatRunDriver

负责执行一次 assistant run，并把底层流式协议转换成统一事件：

- `message:part`
- `message:replace`
- `message:metadata`
- `message:error`
- `message:finish`
- `run:error`
- `run:finish`

### ChatAttachmentDriver

负责上传文件，并返回 canonical message part：

- `image`
- `file`

## canonical message parts

`uchat` 内部统一使用以下 part 模型：

- `text`
- `image`
- `file`
- `data`

其中：

- `image` / `file` 用于真正可回放的消息内容
- `data` 用于像 RAG trace 这类结构化附加信息

这套结构是运行时内部协议，不等于当前后端协议。

## 为什么能解决“刷新后图片丢失”

之前的问题本质上不是“组件不会显示图”，而是：

- 流式阶段有临时 attachment/runtime 状态
- 刷新后只能依赖线程详情接口
- 线程详情接口过去没有稳定返回 canonical image/file parts

`uchat` 的要求是：

- 历史消息必须能还原成 canonical parts
- 实时消息和持久化消息必须走同一套 message shape

这样 UI 层只认一种消息结构，刷新前后不会分叉。

## 当前状态

已完成：

- `uchat` core 初版
- `uchat` React UI bindings 初版
- 当前项目线程/附件/流式协议 adapter 初版
- 后端线程详情新增 `parts` 返回，用于历史消息回放图片/文件
- runtime `capabilities` 已下沉到 core，UI 不再直接依赖 repository 能力探测
- `/chat` 主路由已直接挂到 workspace，不再依赖临时空 route element
- `UChatThread` 主路径已切到 `shared/uchat/ui/*` 展示层，不再直接依赖 legacy `components/Thread/*`
- 旧的 `ChatPage` 兼容入口已移除，当前聊天主入口只保留 `BaseLayout -> ChatWorkspace -> uchat`
- legacy `Thread` 视图和 `CurrentThreadProvider` 链已从桌面主实现中移除
- 旧线程 adapter、history adapter、attachment adapter 与 transport bridge 生产入口已移除
- desktop 侧旧运行时依赖、兼容 transport 测试与持久化兼容层已移除，`uchat` 成为唯一聊天运行时主实现
- 协议层已收口文本与附件数据保真：用户文本首尾空白不再被协议层擅自改写，图片 / 文件附件 data 与 data URL 也不再被裁剪
- chat 主链路已收口到 `knowledgeBaseId` 作为唯一 RAG 真相源，旧 `ragEnabled` 语义与文案已清理
- 阶段 7 的后端路由与 thread 服务测试已补充并通过
- 阶段 8 已完成文档与交接整理，当前仅保留项目 owner 人工验收
- 当前仍在收口的主线问题包括发送失败后残留幽灵消息

## 人工验收清单

以下功能已完成代码收口，但仍需要项目 owner 用桌面端实际验收：

- `/chat` 首发发送只在首条消息时建线程，欢迎态不会提前入库
- 欢迎态与已持久化线程切换时，草稿与线程状态不会互相污染
- 线程知识库绑定、换绑、解绑只通过线程配置变更完成，不会误删知识库资源
- `default` provider 在绑定知识库的线程上会进入 RAG 分支，在未绑定知识库的线程上走普通持久化聊天
- RAG 回复的执行链路、参考来源与历史回放在刷新后仍然保持
- 普通聊天与 RAG 聊天发送后，线程标题和列表摘要会按服务端真实状态回刷
- RAG 在某阶段失败时，assistant 消息位仍然可见，并会显示阶段化失败提示，而不是在视觉上被吞掉
- 取消、失败和重新生成相关状态在桌面端仍需要继续人工观察

## 废弃规则

以下表达已经被产品规则否定，应视为“废弃，但当前代码可能尚未完全清理”：

  - 线程默认绑定知识库
  - “未绑定知识库但仍可通过独立开关走 RAG”
- 线程必须绑定默认知识库
- 从设置页或全局默认值隐式继承聊天知识库
- 欢迎态知识库操作直接创建线程或直接发线程更新请求

## 后端当前改造状态

截至 2026-06-21，chat 后端主路径已按以下规则推进：

- `/proxy/chat/default` 的 RAG 分流只看线程 `knowledgeBaseId`
- `threadService.createThread/updateThread` 只以 `knowledgeBaseId` 表达线程 RAG 绑定
- thread 接口不再暴露线程级独立 RAG 开关

本次未处理的影响面：

- RAG 评测链路仍可能存在旧的默认知识库假设
- 这些评测相关问题本轮不作为 chat 修复的一部分处理
- 后续修评测时，应同样以 `knowledgeBaseId` 作为唯一真相源重新自查

## 已确认待办专项

以下事项已确认需要改，但属于影响面较大的专项，不应混入当前零散修补：

1. 欢迎态草稿与已持久化线程彻底分离
2. 开发态动态端口治理

### 1. 欢迎态草稿与已持久化线程彻底分离

目标：

- “点击新对话”只进入欢迎态，不立即入库
- 首次发送消息才创建线程并落库
- 欢迎态草稿不允许污染任意已持久化线程
- 线程列表中的“最新空线程判断”应基于最新一条真实线程，而不是前端临时态误判

当前处理口径：

- 已通过局部修补保证欢迎态主路径可用
- 但这类问题仍应视为单独专项，后续要从 runtime / protocol / UI 派生状态三层一起做收口
- 本专项完成前，不应继续在业务层增加新的欢迎态兜底分支

### 2. 开发态动态端口治理

目标：

- 端口占用时，不再靠人工排查僵死 dev 进程
- 启动器负责探测端口是否可复用；不可复用时自动分配新端口
- 前端、Electron/Tauri 壳层、Vite proxy 与后端统一读取同一份已解析运行时地址

当前处理口径：

- 本轮只确认设计方向，不在 chat 修补中混改启动链路
- 服务端仍只消费环境变量，不在 `server/src/index.ts` 内自行递增端口
- 后续应由 dev launcher 产出统一 runtime resolved artifact，再由各端读取

## 约束

- 不依赖浏览器本地存储保存聊天记录
- 不要求多层 provider/adaptor 才能工作
- 不把当前项目协议写死进 core
- 不保留只是为了兼容旧运行时的历史结构
- 不从 `Settings -> Knowledge Base` 页面隐式继承当前聊天知识库。聊天所用知识库必须由用户在聊天流里显式决定，而不是由设置页切换副作用决定。
- 设置页知识库选择态与 chat runtime 必须解耦。设置页切换知识库只能影响设置页自身的数据展示与对应 API 请求，不能反向驱动 `uchat` runtime、线程创建默认值或聊天是否走 RAG。

## 后续演进

下一步建议保持这个边界：

1. `shared/uchat/core` 只演进领域模型和运行时抽象
2. `shared/uchat/ui` 只演进 UI 框架绑定
3. `features/chat/core` 处理项目专属协议
4. `features/chat/components` 只消费 runtime 状态，不关心后端细节
