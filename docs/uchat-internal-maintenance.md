# uchat Internal Maintenance

本文档用于约束 `uchat` 的后续维护边界，避免 UI、协议和业务逻辑再次混写回同一层。

## 目录边界

### `desktop/src/shared/uchat/core`

这一层只允许放：

- canonical 类型定义
- store
- runtime orchestration
- 与具体 UI、协议、接口无关的抽象

这一层禁止放：

- JSX
- `className`
- Tailwind 样式
- React 组件库依赖
- 当前项目 REST / SSE 协议细节
- 当前页面业务规则

### `desktop/src/shared/uchat/ui`

这一层只允许放：

- `uchat` 的纯展示组件
- React 绑定
- 与 canonical message/thread/composer 直接对应的 UI 组件
- 通用的 RAG 展示组件

这一层可以包含：

- JSX
- Tailwind / 样式实现
- 视觉布局
- 与 `uchat core` 直接对接的 props 类型

这一层禁止放：

- 当前项目后端接口调用
- 当前项目线程协议转换
- 知识库启停等业务写操作实现
- 页面级数据装配逻辑

### `desktop/src/features/chat/core`

这一层只允许放：

- 当前桌面项目协议适配
- repository / run driver / attachment driver
- runtime provider 装配
- 当前项目接口配置
- 发送前后、刷新前后、流式处理中等时机切面
- 当前项目业务规则 hook

这一层禁止放：

- 大段视觉 JSX
- 样式实现
- 页面布局细节

### `desktop/src/features/chat/components`

这一层现在只保留容器组件。

容器组件只负责：

- 调用 runtime selector
- 组装 props
- 连接 `features/chat/core` 暴露的接口配置和时机切面
- 把数据传给 `shared/uchat/ui`

容器组件禁止做：

- 大段 `className`
- 纯展示组件定义
- 抽屉、消息气泡、侧边栏行等视觉结构实现

## 当前约定

### 线程主界面

- 容器：`desktop/src/features/chat/components/UChatThread.tsx`
- 纯 UI：`desktop/src/shared/uchat/ui/UChatThreadView.tsx`

### 线程侧边栏

- 容器：`desktop/src/features/chat/components/UChatThreadListSidebar.tsx`
- 纯 UI：`desktop/src/shared/uchat/ui/UChatSidebarView.tsx`

### RAG 展示

- UI types / parsers / drawers / trace：统一放在 `desktop/src/shared/uchat/ui/*`
- 项目协议到 canonical parts 的映射：留在 `desktop/src/features/chat/core/protocol.ts`

## 当前维护口径

聊天线程与知识库相关改动，当前统一遵守以下维护口径：

- `knowledgeBaseId` 是聊天线程是否走 RAG 的唯一真相源
- 欢迎态知识库选择是本地草稿，不应直接触发线程持久化请求
- 已持久化线程的知识库绑定、换绑、解绑属于线程配置修改
- 聊天界面只允许“针对线程解绑知识库”，不允许把这个动作实现成知识库资源删除
- chat 主链路不再使用 `ragEnabled` 作为运行时语义或文案开关
- 阶段 8 已完成，后续维护优先遵守当前 `uchat` 边界和人工验收清单

## 消息元数据口径

当前线程消息里存在一组 UI 辅助元数据，当前统称为 `assistantUi`。它不是 canonical 消息内容本体，也不是模型输入协议。

### 当前职责

- `assistantUi.attachments`：作为早期历史消息附件回放的兼容辅助
- `assistantUi.textWasEmpty`：标记纯图片 / 无文本消息，避免回放时补出错误文本

### 维护原则

- canonical 真相源仍然是 `parts`
- 线程回放优先读 `parts`
- `assistantUi` 只保留展示辅助职责，不再承载新的消息内容语义
- 分支关系应优先使用显式 `parentId` / `lineage` 字段，不再继续扩展 `assistantUi`
- 线程标题默认在助手首轮回复成功后生成；若 `task` 标题模型不可用，则回退为用户第一句话，而不是停留在 `新对话`
- RAG 若在某个节点失败，assistant 槽位仍必须保留为一条可见消息；当正文为空时，前端应根据 `rag-node(error)` 渲染阶段化错误卡片，而不是让消息在视觉上消失
- 重新生成仍复用同一个 assistant 槽位：成功时替换原错误/原回答，失败时更新同一条错误卡片，不叠加历史错误

### 迁移建议

- 新增字段时优先采用显式命名，不继续扩展 `assistantUi`
- 新写入应直接切向更清晰的消息结构
- 如果某个字段只服务于前端展示，不应继续混入主消息内容模型

## 废弃但未完全移除

以下做法已经废弃；如果现网或本地运行中仍看到相关现象，应按缺陷处理而不是继续沿用：

- 线程默认绑定 `default` 知识库
- 欢迎态知识库操作直接命中 `/threads/:id`
- 设置页知识库选择反向驱动聊天线程默认值
- `ragEnabled` 作为 chat 线程状态字段或文案 key

## 已列入待办的高风险专项

### 欢迎态 / 已持久化线程分离专项

后续如果继续处理线程生命周期问题，统一按以下口径推进：

- 欢迎态草稿不是线程实体
- 点击“新对话”不是创建线程
- 首发发送才是建线程与入库时机
- 任何欢迎态本地状态都不能回写、覆盖或复用旧线程实体

在该专项正式实施前：

- 不要继续在 feature 组件层追加临时线程兜底
- 不要把欢迎态草稿伪装成已持久化线程对象
- 不要引入新的“空线程预创建”行为

### 开发态动态端口治理专项

后续如果调整 dev 启动链路，统一按以下口径推进：

- 不在 server 入口内部做隐式端口自增
- 由 launcher 层负责端口占用探测与复用判断
- 用单一 runtime resolved artifact 作为前后端共享地址源
- 任何新启动器都必须复用同一套端口决议逻辑

## 修改原则

1. 如果代码需要访问 `fetch`、线程接口、上传接口、SSE 协议，它不应该进入 `shared/uchat/ui`。
2. 如果代码主要是 JSX、样式、布局、视觉交互，它不应该继续留在 `features/chat/components` 容器里。
3. 如果代码既依赖运行时状态又包含大量样式，优先拆成：
   - 容器：取状态、组装 props
   - UI：纯展示
4. 如果某段逻辑只属于当前桌面项目，并且属于接口配置、数据转换、事件处理复写、发送/刷新时机控制，应优先放进 `features/chat/core`。
5. 如果某段逻辑只属于当前桌面项目，但主要是视觉实现，不要放进 `features/chat/core`，应拆进 `shared/uchat/ui`。
6. 如果某段抽象未来仍能服务多个聊天页面或壳层，优先放进 `shared/uchat/ui`，不要回流到 feature 目录。
7. 如果某个消息字段同时承担“内容真相源”和“UI 辅助元数据”两种职责，优先拆分，不继续堆叠到同一个命名空间里。

## 代码评审检查项

- `shared/uchat/core` 中是否出现 JSX / `className`
- `shared/uchat/ui` 中是否直接请求后端或依赖项目协议
- `features/chat/core` 中是否出现页面级大段 UI
- `features/chat/components` 中是否重新长出纯展示实现
- 新增能力是否先判断属于 canonical core、shared ui、还是 app adapter
- 任何新的 chat 行为是否仍以 `knowledgeBaseId` 作为线程 RAG 唯一真相源
- 是否避免把欢迎态草稿重新伪装成线程实体
- 是否避免把知识库资源删除和线程解绑混为一谈
