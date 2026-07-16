# UChat 边界契约

Status: Current
Owner: chat
Last verified: 2026-07-14
Layer: raw-source
Module: Chat
Feature: UChatGovernance
Doc Type: current-contract
Canonical: false
Related:
  - README.md
  - governance-assessment.md
  - ambiguity-log.md
  - ../../uchat.md
  - ../../uchat-internal-maintenance.md

## 单点真相范围

这页专门定义 `uChat` 治理里最重要的东西：

- `core / ui / integration` 各自该知道什么
- 各自不该知道什么
- 未来新能力接入时，先按什么维度判断落层

一句话：

`uChat` 的治理，本质上不是“代码整理”，而是“边界治理”。

## 为什么边界感最重要

如果边界守不住，`uChat` 后面会同时坏三层：

- `core` 被具体业务对象拖着走，失去 runtime 抽象价值
- `ui` 承接越来越多 feature 判断，最后成为不可维护大组件
- `integration` 变成所有产品能力的收容层，谁都不敢拆

所以治理的第一原则不是“先拆文件”，而是“先守边界”。

## 一层一句话

### `core`

负责聊天 runtime 的通用运行语义。

### `ui`

负责 canonical chat state 的通用展示和交互承载。

### `integration`

负责把 Mira 当前产品能力接进 `uChat`，但不应该反过来定义 `uChat` 的核心形状。

## 三层边界

### 1. `desktop/src/shared/uchat/core`

这一层应该知道：

- thread / message / composer / run 的 canonical 生命周期
- 通用消息 part 模型
- runtime store
- optimistic send / reconcile 机制
- 与具体产品无关的能力抽象

这一层不该知道：

- Mira 的具体页面结构
- 当前 REST 路由名、SSE 事件名
- Role / KnowledgeBase / Workspace / MCP 的领域细节
- Modal、Dropdown、Tooltip 这类 UI 组件概念
- 某个功能按钮应该放在哪

判断标准：

如果一段逻辑离开 Mira 当前页面和接口以后仍然成立，才有资格进 `core`。

### 2. `desktop/src/shared/uchat/ui`

这一层应该知道：

- canonical message / thread / composer 长什么样
- 通用展示形态
- 通用交互承载方式
- execution trace 的通用视图
- 不带业务语义的 slot / callback / capability 呈现

这一层不该知道：

- 某个按钮点开后应该调哪个业务 API
- 角色、知识库、工作空间的后端语义
- 哪些上下文需要持久化
- 当前产品特定的业务判定规则

判断标准：

如果一段逻辑本质上是在决定“业务该怎么做”，而不是“UI 怎么显示”，就不该进 `ui`。

### 3. `desktop/src/features/chat`

这一层应该知道：

- 当前产品的线程领域规则
- 后端协议适配
- Role / RAG / Workspace / Agent / MCP 等能力如何接入聊天
- 当前页面级交互装配

这一层不该变成：

- 新的隐藏核心层
- 永久容纳所有复杂度的巨石层

判断标准：

integration 可以接线，但不能无限膨胀成“把所有未来能力都堆在一起”的默认容器。

## 四类东西必须分开

未来所有能力都先判断自己属于哪类，再谈落层。

### 1. Capability

能力可用性。

它回答的是：

- 当前能不能做某件事
- 当前能显示哪些入口
- 当前哪些动作应该可交互

例子：

- 是否支持附件
- 是否启用 Agent
- 是否可用搜索

### 2. Context

上下文影响因素。

它回答的是：

- 当前回复受哪些隐藏状态影响
- 这些状态是否持久化
- 它们是线程态、欢迎态还是 request-only

例子：

- Role
- Knowledge Base
- Summary
- Future Memory
- 自定义智能体中的静态人格 / 静态知识配置

### 3. Execution

请求执行过程。

它回答的是：

- 这一轮到底做了什么
- 调用了哪些工具 / 节点
- 哪一步成功失败

例子：

- RAG retrieve / rerank
- tool call
- approval flow
- future summary / memory injection trace

### 4. Media

输入输出媒体能力。

它回答的是：

- 用户喂了什么
- 模型回了什么
- 媒体任务如何被表示和呈现

例子：

- 附件上传
- 图片输入
- 文生图结果
- TTS 音频输出

这四类东西一旦混掉，后续 UI 和 runtime 都会越来越乱。

## 当前明确要求

### 1. 不把产品领域对象直接下沉进 `core`

像这些概念，默认都不该直接变成 `uChat core` 的一等领域对象：

- Role
- KnowledgeBase
- Workspace
- MCP
- 自定义智能体

除非已经证明它们是“所有聊天 runtime 都必须理解的通用概念”。

### 2. 不让 `ui` 承担业务判断

`ui` 可以接收：

- `capabilities`
- `context tags`
- `execution data`
- `callbacks`

但不应该自己决定：

- 哪类业务上下文该持久化
- 某个业务能力何时启用
- 某个 feature 该调哪个产品接口

### 3. 不让 `integration` 变成默认垃圾场

`integration` 可以暂时承受复杂度，但不能无限透支。

如果未来继续往这里叠：

- 自定义智能体矩阵
- 文生图
- TTS
- 更复杂的 workspace
- 更复杂的 MCP

那就必须先补 contract，不允许只加条件分支。

## 对未来能力的判断基线

### 自定义智能体

先问：

- 它是 context 组合体
- 还是 capability 集合
- 还是新的运行模式

没回答清楚前，不进 `core`。

### 附件

先问：

- 它是输入媒体
- 还是消息正文一部分
- 还是执行任务资源

没回答清楚前，不扩大 message model。

### 文生图

先问：

- 它是普通 assistant 输出
- 还是一个独立任务执行过程
- 结果是否进入普通消息 part

没回答清楚前，不往现有图片消息语义硬套。

### TTS

先问：

- 它是输出媒体
- 还是 assistant 消息的附属播放能力
- 是否需要 execution trace

没回答清楚前，不草率往 `ChatMessagePart` 里加字段。

## 聊天输出媒体接入设计

本节记录已确定的聊天链路接入规则，适用于当前 Mira 的 TTS 和生图能力。

### 0. 硬边界

本需求只处理“现有助手消息完成后的媒体接入”和媒体产物生命周期，不改现有核心执行链路。

明确禁止修改：

- `AgentGraph` 及其节点编排、状态、工具循环和审批逻辑
- RAG 的 rewrite、embedding、retrieve、rerank、generate 核心逻辑
- Chat 的文本请求、流式协议、消息生成和历史上下文核心逻辑
- Role 的数据模型、prompt 注入、角色解析和请求编排核心逻辑

允许新增或调整的范围只有：

- `features/chat` 的媒体按钮显示和操作接线
- 助手消息完成后的 TTS/生图触发器
- 媒体任务与现有 `threadId/messageId` 的关联
- 媒体绝对路径的保存、读取和清理
- 消息下方图片展示和消息操作区的 TTS 播放按钮

媒体接入只能消费现有 Chat、RAG、Role 的结果和状态，不能反过来改变它们的核心行为。

### 1. Role 与 RAG 的判定

当前不新增独立的 RP 模式字段。RP 的判定沿用现有聊天状态：

- 存在 `roleId`：进入 Role 模式（RP）
- 存在 `knowledgeBaseId`：当前请求走 RAG
- 同时存在 `roleId` 和 `knowledgeBaseId`：这是 RP + RAG，不改名为普通 RAG

媒体能力只读取这两个现有上下文，不改变 Role prompt 注入和 RAG 分流规则。

### 2. 微应用配置是模型来源

聊天链路不新增 TTS 或生图的详细配置界面，也不让 Role 持有 provider、模型、声音或生图参数。

- TTS 使用 TTS 微应用已配置的服务和模型
- 生图使用 Image Generation 微应用已配置的服务和模型
- Chat 只提交回复文本或生图 prompt
- provider、模型和详细参数由 backend 根据微应用配置解析

聊天前端不负责选择 provider、模型、voice、size、stylePreset、providerParams 或 workflow 配置。

### 3. 两个按钮的显示和持久化

TTS 按钮在 chat、RAG、RP 和 RP + RAG 中都显示。

图片按钮只在以下条件同时满足时显示：

```text
roleId 存在 && knowledgeBaseId 不存在
```

因此：

- 无 Role：不显示图片按钮
- RP：显示图片按钮，并默认开启图片能力
- RP + RAG：不显示图片按钮，也不自动生图
- 普通 chat / 普通 RAG：不显示图片按钮

两个按钮的开关状态需要持久化到线程。欢迎态使用现有 draft state，首次创建线程时一并写入；已有线程以服务端线程状态为准。

图片按钮因 RP + RAG 被隐藏时，不删除此前的持久化状态。移除知识库后恢复 RP 时，读取原来的开关状态。

### 4. 媒体与消息的绑定

TTS 音频和生图结果是助手消息的附属输出媒体，不是新的对话消息，也不是现有输入附件 part。

现有 `ChatMessagePart` 保持不变，不新增 `audio` part，也不把生图结果伪装成用户输入用的 `image` part。媒体信息放在助手消息的 `metadata` 扩展中，建议形状如下：

```json
{
  "media": {
    "image": {
      "status": "succeeded",
      "jobId": "...",
      "absolutePath": "D:\\...\\image.png",
      "mimeType": "image/png"
    },
    "tts": {
      "status": "succeeded",
      "jobId": "...",
      "absolutePath": "D:\\...\\reply.wav",
      "mimeType": "audio/wav"
    }
  }
}
```

媒体记录必须至少关联 `threadId`、`messageId`、任务 ID 和绝对文件路径。媒体不能只按回复文本或线程复用。

数据库保存绝对路径；renderer 不直接读取本地路径。backend 根据已保存路径提供受控媒体读取接口，前端用接口响应渲染图片或播放音频。

### 5. 展示和生成行为

- 生图结果显示在对应助手消息文字的下方
- TTS 只显示播放按钮，不在消息正文中展示音频卡片
- 点击 TTS 播放按钮时，已有成功产物且文件存在则直接播放
- 没有成功产物时，调用 TTS 微应用服务生成，再保存媒体关联信息并播放
- RP 回复完成后自动生成图片；RP + RAG 不执行这一步
- 媒体任务失败不覆盖或删除文字回复，失败状态只归属于对应媒体

### 6. 重新生成和媒体清理

重新生成某条助手消息时，旧消息关联的图片和音频必须先从媒体记录中解除，并删除对应的本地文件；新回复生成新的媒体任务。

媒体生命周期必须跟随对话消息：

- 重新生成：删除旧消息媒体，再创建新媒体
- 删除消息或清理消息分支：删除关联媒体记录和文件
- 删除线程：删除线程下所有媒体记录和文件
- 新旧回复即使文本相同，也不能复用旧消息媒体

清理逻辑由 backend 负责，不能只在前端隐藏旧图片或清除播放状态。

### 7. 接入层落点

- `uchat core`：不理解 Role、KnowledgeBase、TTS、生图 provider，也不修改 canonical `ChatMessagePart`
- `uchat ui`：提供图片展示位、TTS 播放按钮和通用 loading/error 展示能力，不决定业务规则
- `features/chat`：只根据现有 Role/RAG 状态决定按钮是否显示、何时触发媒体任务，并把交互接到线程和消息接口；不得修改 Chat/RAG/Role 核心逻辑
- backend：解析微应用默认服务，创建媒体任务，保存绝对路径，提供媒体读取和清理能力

`AgentGraph` 不属于本次接入范围。即使 RP + RAG、Agent 或其他执行能力产生了助手消息，媒体接入也只在现有消息完成后读取结果，不进入图编排和节点执行。

这项设计优先扩展消息 metadata 和聊天 integration，不改变现有文本、附件、RAG 来源和执行 trace 的语义。

## 当前治理动作

后续只要是 `uChat` 相关改动，先过三步：

1. 这次改动属于 `capability / context / execution / media` 哪一类
2. 它应该落在 `core / ui / integration` 哪一层
3. 如果边界不清，先记入 `ambiguity-log.md`，再讨论，不直接改

## 一句话结论

`uChat` 后续能不能继续健康演进，不取决于我们能写多少功能，而取决于：

- 能不能持续把产品复杂度挡在正确的边界之外

