# UChat 前端组件插槽设计

Status: Partially implemented
Owner: chat
Last verified: 2026-07-22
Layer: raw-source
Module: Chat
Feature: UChatUISlots
Doc Type: planned-design
Canonical: false
Related:
  - ../uchat.md
  - ../uchat-internal-maintenance.md
  - chat-system-practices.md

> 当前阶段：媒体插槽试点已于 2026-07-22 实施；execution trace 和 Agent 界面能力均明确保留在 UChat 内部。Agent 模式按钮通过 composer 工具插槽渲染，但 Agent 业务逻辑不写在输入组件中。
>
> 本文中的后续插槽不是当前实现合同。任何进一步代码调整都需要单独任务、明确范围和项目负责人确认。

## 这篇文档解决什么问题

当前 `UChatThreadView` 仍同时容纳消息布局、Agent 状态、消息操作、composer 工具和多个浮层。主要风险不是组件知道了业务名词，而是不同故障都集中在同一个大文件中：

- 媒体加载失败时，需要进入线程主视图排查
- Agent 审批异常时，需要进入线程主视图排查
- execution trace 的消息派生已经进入 UChat 内部 `UChatMessageTrace`，不再由线程主视图直接组装
- composer 业务入口异常时，仍然需要进入线程主视图排查

筹划方向是让主视图提供少量、位置固定、名称明确的组件插槽，使各功能拥有独立文件、独立状态和独立测试入口。

## 当前事实

以下内容是当前有效实现：

- `UChatThreadView` 是线程主界面
- `UChatThreadView` 通过可选的 `MessageExtensions` 插槽提供消息正文和消息操作两个挂载位置
- `DesktopChatMessageExtensions` 承担 UIChat Mira 的图片、TTS、媒体加载和失败重试表现
- `getChatMediaPreviewUrl` 只由桌面聊天集成层调用，`shared/uchat` 不再直接依赖项目媒体 API
- `UChatAgentModeControl` 承担 Agent 模式开关，通过 composer 工具插槽显示
- `UChatAgentMessageStatus` 承担消息级审批、阻塞、失败和操作错误状态
- `resolveUChatAgentSubmission` 在输入区外完成普通发送与 Agent 发送的选择，composer 只接收通用提交状态和回调
- `docs/uchat.md` 与 `docs/uchat-internal-maintenance.md` 仍是当前合同

## 设计目标

- 问题可以按功能文件定位，而不是先进入 `UChatThreadView` 搜索
- React 组件树中能直接看到媒体、Agent 等具名组件，execution trace 使用 UChat 内部具名组件
- 各插槽可以单独测试加载、失败、重试和交互状态
- UIChat Mira 的现有调用路径和媒体行为保持不变
- 插槽接入不改变 canonical message、thread、runtime 或后端协议

## 非目标

- 不重写整个聊天界面
- 不一次性迁移全部现有逻辑
- 不引入动态插件注册系统
- 不调整线程全局状态或 runtime 生命周期
- 不借插槽设计改变 Agent、RAG、媒体或 composer 的产品行为
- 不为了拆文件而增加大量透传属性

## 插槽原则

### 使用具名组件插槽

插槽优先接收 React 组件类型，而不是无名称的 `renderExtra` 回调。这样组件名能够出现在 React 调用栈、测试名称和错误边界中。

当前已实施的媒体试点合同等价于：

```ts
type UChatMessageExtensionProps = {
  message: ChatMessage;
  placement: "content" | "actions";
  onPreviewImage: (src: string) => void;
  onRequestLayout: () => void;
};

type UChatThreadSlots = {
  MessageExtensions?: React.ComponentType<UChatMessageExtensionProps>;
  ComposerTools?: React.ComponentType;
};
```

`MessageActions` 和 `ThreadOverlays` 仍只是候选方向，尚未进入当前合同。`ComposerTools` 已进入合同；UChat 的 Agent 模式按钮和宿主追加的 composer 工具在该位置组合渲染。

### Execution trace 保留在 UChat 内部

RAG、Agent 和 Tool 共用 canonical message 中的 `execution-node`。这属于 UChat 对聊天执行过程的通用表达，不是应用业务插槽：

- `UChatMessageTrace` 负责从消息中派生步骤、是否存在 trace 和执行失败展示
- `UChatExecutionTrace` 负责渲染统一执行轨迹
- `rag-node` 只作为历史消息兼容输入继续读取
- `metadata.rag.sources` 仍是检索来源数据，不等同于通用 trace
- Agent 的批准、拒绝和运行控制仍是独立业务，不能塞进 trace 解析

后续不得把 execution trace 搬到桌面应用集成层，也不得让 RAG 和 Agent 各自重复解析一套执行步骤。

### 按界面位置定义插槽

主视图只定义稳定的布局位置，不识别具体业务实现：

| 插槽 | 布局位置 | 状态 | 实现或候选实现 |
| --- | --- | --- | --- |
| `MessageExtensions` | 单条消息正文和操作区 | 已实施 | `DesktopChatMessageExtensions` |
| `MessageActions` | 单条消息通用操作区 | 筹划中 | `DesktopChatMessageActions` |
| `ComposerTools` | composer 工具区 | 已实施 | UChat 内建 Agent 模式按钮，并允许宿主追加通用工具 |
| `ThreadOverlays` | 线程级浮层区域 | 筹划中 | `DesktopChatThreadOverlays` |

### 在候选实现中保留具名功能组件

当前媒体实现根据 UChat 提供的稳定位置渲染具名功能组件：

```tsx
function DesktopChatMessageExtensions(props: UChatMessageExtensionProps) {
  if (props.placement === "content") {
    return <ChatMediaOutput {...props} />;
  }

  return (
    <>
      <ChatMediaAudioAction {...props} />
      <ChatMediaImageAction {...props} />
    </>
  );
}
```

因此媒体问题可以直接定位到桌面聊天集成文件。UChat 内建能力也使用独立具名组件，例如：

- `UChatAgentModeControl`：线程级 Agent 模式
- `UChatAgentMessageStatus`：Agent 状态与审批
- `DesktopChatMessageExtensions`：图片、音频、媒体加载与重试

### 状态跟随功能组件

功能专属状态应由对应插槽组件持有：

- 媒体 Blob URL、加载、播放错误和图片请求等待状态属于 `DesktopChatMessageExtensions`
- Agent 批准、拒绝的等待状态和错误属于 `UChatAgentMessageStatus`
- execution trace 的步骤和失败展示属于 UChat 内部 `UChatMessageTrace`
- 检索来源详情仍需单独评估，但不得与 execution trace 重复解析步骤

主视图只传递渲染所需的 canonical message、线程标识和通用布局回调。

## `UChatThreadView` 候选保留职责

- 线程页面布局
- 消息列表与基础消息气泡
- composer 文本和附件草稿区域
- 滚动位置与自动滚动
- 通用 loading、empty 和 error 容器
- 调用具名插槽并提供稳定挂载位置

## 建议的最小试点

媒体插槽试点已经完成：

1. `UChatThreadView` 增加可选的 `MessageExtensions` 插槽
2. 新建 `DesktopChatMessageExtensions`
3. `ChatMediaOutput`、`ChatMediaAudioAction` 和 `getChatMediaPreviewUrl` 调用已移入桌面聊天集成层
4. 图片请求等待状态由媒体扩展 Provider 持有，正文重试和操作栏按钮共享同一状态
5. 未提供插槽时，UChat 只渲染基础消息，不提供 UIChat Mira 的图片生成和 TTS 业务

继续设计 Agent 或 composer 插槽前，需要单独评估媒体试点。

### 2026-07-22 Agent 业务组件拆分

- `UChatThreadSlots` 增加可选的 `ComposerTools` 位置
- 后续确认 Agent 是 UChat 内建能力，因此移除桌面层的 `DesktopChatComposerTools` 实现
- `UChatAgentModeControl` 保持在 composer 工具插槽的原有位置
- `UChatAgentMessageStatus` 从消息主组件中接管审批、拒绝、阻塞、失败和操作错误
- `resolveUChatAgentSubmission` 在输入区外保留原有普通发送与 Agent 发送选择
- `UChatComposerActions` 只接收通用的 `composerTools` 节点，以及 `submitDisabled`、`submitDisabledReason`、`submitLabel` 和 `onSubmit` 等通用提交属性
- `UChatAgentUIController` 将模式、运行态、可用性和操作意图组成单一 UChat 合同，`UChatThreadView` 不再暴露 8 个分散的 Agent 属性
- `UChatAgentComposerTools` 负责把内建 Agent 按钮与宿主追加工具组合到原有 composer 插槽，未改变 DOM 顺序和样式
- runtime、canonical message、协议、审批接口和后端均未调整

### 2026-07-22 验证记录

- `UChatThreadView` 插槽和现有主视图测试：18 个通过
- `DesktopChatMessageExtensions` 独立媒体测试：6 个通过，包含音频播放动画状态
- `UChatAgentControls` 独立测试：3 个通过，覆盖开关、工作空间禁用原因和 Agent 发送选择
- `UChatAgentMessageStatus` 独立测试：3 个通过，覆盖审批、操作错误和失败信息去重
- `UChatThreadView`、Agent 组件与桌面装配相关测试：29 个通过
- `UChatMessageTrace` 内部 trace 派生测试：3 个通过，覆盖 Agent、历史 RAG 和 Agent 失败
- 流式渲染回归测试：2 个通过
- 桌面端 `pnpm --filter @ui-chat-mira/desktop typecheck`：通过
- 全仓 `pnpm check`：desktop、core、deepagents-spike 和 docs-site 已通过；server 在既有的 `src/mcp/terminal/dev-runtime.ts:140` 因 `bundledComponent` 可能为 `undefined` 而失败，本步骤未修改该文件
- `shared/uchat` 中不存在 `getChatMediaPreviewUrl`、`onRequestTts`、`onRequestImage` 或 `showImageAction`

## 实施约束

- 不得依据本文中尚未实施的候选方向直接修改代码
- 每次只处理一个插槽或一个功能领域
- 插槽属性必须保持可选；需要 UIChat Mira 媒体能力的调用方由应用集成层显式注入
- 不允许同时改 runtime、协议、状态模型和 UI 插槽
- 不允许使用字符串业务 ID 在主视图中判断插槽类型
- 每个功能组件必须拥有独立测试文件
- 每次实施必须记录修改文件、验证结果和未处理内容

## 未来评估标准

只有同时满足以下条件，试点才可视为有效：

- 媒体问题无需进入 `UChatThreadView` 即可定位
- React 调用栈能显示具名媒体组件
- 现有聊天、图片和 TTS 行为没有变化
- UIChat Mira 的图片和 TTS 行为保持兼容
- 类型检查和相关测试通过
- 没有引入新的动态注册或状态复制机制

## Code Anchors

- `desktop/src/shared/uchat/ui/UChatThreadView.tsx`
- `desktop/src/shared/uchat/ui/UChatThreadSlots.ts`
- `desktop/src/shared/uchat/ui/UChatAgentControls.tsx`
- `desktop/src/shared/uchat/ui/UChatAgentMessageStatus.tsx`
- `desktop/src/features/chat/components/UChatThread.tsx`
- `desktop/src/features/chat/components/DesktopChatMessageExtensions.tsx`
- `desktop/src/features/chat/adapters/chatMediaOrchestration.ts`
- `desktop/src/shared/api/thread.ts`
- `docs/uchat.md`
- `docs/uchat-internal-maintenance.md`

## 相关文档

- `../uchat.md`
- `../uchat-internal-maintenance.md`
- `chat-system-practices.md`
- `uchat-agent-ui-assessment.md`
