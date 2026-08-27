# 生图微应用 POC

Status: Planned
Owner: microapp / runtime / desktop
Last verified: 2026-07-06
Layer: raw-source
Module: MicroAPP
Feature: ImageGeneration
Doc Type: design
Canonical: false
Related:
  - README.md
  - ../architecture/README.md
  - ../architecture/ipc-and-preload.md
  - ../integrations/third-party-integration-architecture.md

## 单点真相范围

这页只回答一件事：

当前项目如果要做一个“调用生图 API 生成图片”的微应用，第一版 POC 应该怎么收敛范围。

它覆盖：

- `image_generation` 这个 `MicroAPP` 的产品目标
- docs-only POC 的最小范围
- renderer / preload / backend 的落点边界
- provider 兼容底座应该先抽什么，不该先抽什么
- API、配置、密钥、任务状态和结果存储的最小契约
- `ComfyUI workflow JSON` 的本地执行器边界
- 后续从文档进入实现时的切片顺序

它不覆盖：

- 具体 provider 的采购决策
- 最终 UI 视觉稿
- 批量任务队列、商用计费和审核平台
- 任何本轮未批准的 runtime 实现

## Goal

这个 POC 的目标不是把“AI 绘图平台”一次做全，而是先验证四件事：

1. 当前桌面端架构能否安全承接一个外部生图 API 微应用
2. `MicroAPP` 是否可以先只在微应用界面里完成调试闭环，而不提前扩散到其它入口
3. 第一版是否能用最小链路做出“输入 prompt 或 workflow -> 生成图片 -> 本地查看结果”的稳定闭环
4. provider 差异很大的前提下，底座是否还能维持统一任务生命周期

## 结论先说

建议把这次微应用正式命名为：

- `image_generation`

它是一个独立 `MicroAPP`，不是：

- chat 内部的一个临时按钮
- renderer 直连第三方 API 的快捷脚本
- MCP / Tool 的别名
- 某一家模型服务商 SDK 的薄包装

它的最小产品闭环应该是：

```text
用户提交 prompt 或 workflow
  -> renderer 提交生成任务
  -> backend 进入统一任务生命周期
  -> backend 调用外部 provider 或本地 workflow runner
  -> backend 保存结果元数据
  -> renderer 展示图片、参数和失败原因
```

当前建议先把它当成：

- 一个仅供微应用界面调试的桌面内 `AccessPoint`

推荐命名：

- `desktop.image_generation_studio`

这样可以证明 `MicroAPP` 不只是第三方平台入口的附属物，也可以先作为本地桌面工作区内的独立调试单元存在。

## 为什么值得做

这个微应用的价值不在“把 prompt 发出去”本身，而在于它能用很短的链路验证一组关键基础设施：

- 外部 provider 调用边界
- 本地 secret 管理边界
- 二进制结果文件保存边界
- `MicroAPP` 配置和运行时分层
- 统一任务状态机
- prompt 模式与 workflow 模式并存
- 桌面 UI 与 backend 的最小请求闭环

当前阶段这条能力只要求在微应用界面里可调试，不要求同时接入：

- chat 对话入口
- 第三方平台入口
- 通用工具调用面

如果这条链路打通，后续再扩：

- 多 provider
- 图片变体
- 局部重绘
- 批量任务
- 图片资产库

都会更有依据。

## POC 原则

第一版必须故意收窄。

POC 原则：

- 先抽“任务执行层”，不先抽“统一模型参数层”
- 先覆盖主流协议类型，不先追求接入 provider 数量最多
- 只做单次生成，不做任务编排
- prompt 模式和 workflow 模式并列，不把 `ComfyUI` 当成特殊补丁
- 当前只开放给微应用界面调试，不提前抽成 chat / integration 共用入口
- secret 只在 backend 持有，renderer 不直接碰第三方 API
- 所有远端 URL 输出都必须主动拉回本地，不把临时 URL 当业务真相
- 结果先本地落盘和登记元数据，不先做云同步
- 失败要可解释，不做静默 fallback 到别的 provider

## POC Success Criteria

当且仅当下面这些目标成立时，才能认为第一版 POC 成功：

1. 用户能在桌面端填写 prompt 并发起一次生成
2. renderer 请求链路遵守当前项目规则：开发态走 `/api/...`，生产态走 `window.desktopApi.backendUrl`
3. backend 能用受控配置调用至少一类云 provider，并能调用本地 `ComfyUI`
4. backend 能把 base64、远端 URL 或本地 workflow 输出统一收成可落盘图片产物
5. backend 对外暴露统一任务状态：`queued / running / succeeded / failed / cancelled / blocked`
6. 微应用界面能展示成功结果、失败信息和本次使用的输入参数
7. 全链路不要求 renderer 直接持有 provider 密钥
8. 不新增未审计的 fallback 分支

## Scope

### In scope

- 一个独立 `MicroAPP` 定义：`image_generation`
- 一个桌面内调试入口：`desktop.image_generation_studio`
- 一个统一生成任务模型：
  - `prompt` 模式
  - `workflow` 模式
- 一条 backend 任务提交路由
- 一条任务查询或任务结果路由
- 一个 provider 配置模型
- 一个本地 workflow runner 配置模型
- 一份本地结果元数据记录
- 一套首批适配器范围定义

### Out of scope

- 多 provider 市场和自动路由
- 图片编辑、局部重绘、扩图语义抽象
- 历史图库管理后台
- chat 对话入口集成
- 第三方平台入口集成
- 通用 MCP / Tool 暴露面
- 审核工作流
- 计费、配额和团队权限
- 图片分享链路
- 移动端和第三方平台入口

## 推荐第一刀

建议第一条垂直切片只做：

- 单 prompt
- 单图返回
- 单 provider
- 单页结果预览
- 单条 `ComfyUI workflow API JSON` 执行

推荐用户流程：

1. 打开 `Image Generation Studio`
2. 输入 prompt
3. 选择画幅和风格
4. 点击生成
5. 等待 backend 返回图片
6. 在页面里看到图片、本次参数和 provider 响应摘要

先把这条链路做稳，比一开始堆“风格模板、批量任务、画廊、分享”更重要。

## 当前入口边界

当前能力只需要在微应用界面上调试。

这意味着第一版只承诺：

- 有一个独立微应用调试界面
- 能从这个界面提交任务
- 能从这个界面查看状态和结果

当前不承诺：

- chat 内直接唤起生图
- 企业微信、飞书之类第三方入口复用这套能力
- 把它抽成其它模块默认可调用的通用能力

是否要把这套底座进一步开放给其它入口，属于后续单独任务，不并入当前 POC。

## 为什么底座先抽任务，不先抽模型参数

主流生图服务商的核心差异，不是“模型名字不同”，而是下面这些执行差异：

- 提交方式不同：同步返回、异步任务、队列轮询、Webhook
- 输入形态不同：纯 prompt、prompt + image、workflow JSON
- 输出形态不同：base64、临时 URL、本地文件
- 状态形态不同：排队中、运行中、成功、失败、审核阻断
- 参数形态不同：`size / ratio / steps / seed / guidance` 的字段名和约束都不同

所以底座不应该先做“大而全统一参数表”。

应该先做：

- 统一任务生命周期
- 最小公共字段
- provider 特有参数透传

## Provider 兼容分层

当前目标不是做“支持最多 provider”，而是优先覆盖最主流、最稳定、最能代表不同协议形态的几类 provider。

### 首批必须考虑

- `OpenAI Images`
  - 国际直连样板
  - 代表同步型图片生成 API
- `阿里云 万相`
  - 国内主流云厂商样板
  - 代表国内文生图 / 图像编辑云 API
- `腾讯云 混元生图`
  - 代表异步任务型云接口
  - 同时存在轻量文生图入口
- `ComfyUI Local`
  - 本地 workflow runner
  - 必须支持

### 第二批预留接口

- `百度千帆`
- `Google Vertex AI Imagen`
- `Stability AI`
- `fal`
- `Replicate`
- `火山引擎 / 豆包 Seedream`

第二批不是不重要，而是应该等首批底座稳定后再接，避免一开始就被聚合网关和社区模型差异把底座拉散。

## 首批协议覆盖目标

首批底座不按“接几家”衡量，而按“覆盖几种现实协议”衡量。

第一版至少覆盖：

1. `sync-http`
2. `async-job`
3. `workflow-runner`

同时统一处理三种结果来源：

1. `base64`
2. `remote-url`
3. `local-file`

## 运行时边界

### Renderer

负责：

- 展示表单、加载状态和结果
- 展示本次生成参数
- 展示错误信息和重试入口

不负责：

- 直接调用第三方生图 API
- 保存 provider secret
- 决定最终文件落盘路径

### Preload

POC 阶段不建议扩 preload。

除非后续要接原生文件选择器、系统分享或图片拖放能力，否则先保持：

- renderer 通过现有请求链访问 backend

### Backend

负责：

- 读取 provider 配置
- 持有和解析 API key
- 组装 provider 请求
- 处理超时、失败和 provider 返回
- 跟踪任务状态和轮询
- 保存图片文件
- 保存生成元数据
- 向 renderer 返回受控结果

## 建议目录落点

如果后续进入实现，建议按下面的边界落点：

```text
desktop/src/features/microapp-image-generation/
server/src/microapps/image-generation/
```

后端内部建议至少拆出：

```text
server/src/microapps/image-generation/
  index.ts
  types.ts
  schema.ts
  job-lifecycle.ts
  adapters/
    openai-images.ts
    aliyun-wanx.ts
    tencent-hunyuan.ts
    comfyui-local.ts
  provider-client.ts
  file-store.ts
  service.ts
  routes.ts
```

目的：

- `service.ts` 负责业务收口
- `job-lifecycle.ts` 负责统一状态机
- `adapters/*` 负责 provider 或 runner 协议差异
- `provider-client.ts` 负责通用远端请求拼装
- `file-store.ts` 负责本地文件与元数据写入
- `routes.ts` 只负责 HTTP 边界

## 统一任务模型建议

```ts
type ImageGenerationExecutionKind =
  | "sync-http"
  | "async-job"
  | "workflow-runner";
```

```ts
type ImageGenerationJobStatus =
  | "queued"
  | "running"
  | "succeeded"
  | "failed"
  | "cancelled"
  | "blocked";
```

```ts
type ImageGenerationArtifact = {
  id: string;
  type: "image";
  mimeType: string;
  source: "base64" | "remote-url" | "local-file";
  localPath?: string;
  remoteUrl?: string;
  expiresAt?: string;
  width?: number;
  height?: number;
};
```

## API 契约建议

backend route 继续保持 prefix-free。

推荐第一轮至少开两条路由：

```text
POST /microapps/image-generation/generations
GET  /microapps/image-generation/generations/:id
```

请求体建议：

```ts
type CreateImageGenerationRequest = {
  providerId: string;
  model?: string;
  prompt?: string;
  negativePrompt?: string;
  size?: string;
  stylePreset?: string;
  count?: number;
  seed?: number;
  providerParams?: Record<string, unknown>;
  workflowApiJson?: Record<string, unknown>;
  inputFiles?: Array<{
    fileId: string;
    role: "image" | "mask" | "reference";
  }>;
};
```

返回体建议：

```ts
type CreateImageGenerationResponse = {
  generationId: string;
  status:
    | "queued"
    | "running"
    | "succeeded"
    | "failed"
    | "cancelled"
    | "blocked";
  executionKind: ImageGenerationExecutionKind;
  artifacts: ImageGenerationArtifact[];
  requestSummary: {
    providerId: string;
    model?: string;
    prompt?: string;
    negativePrompt?: string;
    size?: string;
    stylePreset?: string;
  };
  providerJobId?: string;
  errorMessage?: string;
  createdAt: string;
  updatedAt: string;
};
```

如果 provider 失败，直接返回明确错误，不做 silent fallback。

## Provider 配置边界

第一版不要做“任意 provider 插件市场”。

建议先固定一个内部 provider 配置结构，但允许按 adapter 扩展：

```ts
type ImageGenerationProviderConfig = {
  providerId:
    | "openai_images"
    | "aliyun_wanx"
    | "tencent_hunyuan"
    | "comfyui_local";
  executionKind: ImageGenerationExecutionKind;
  model: string;
  apiKeySecretRef?: string;
  baseUrl?: string;
  timeoutMs: number;
  pollIntervalMs?: number;
  extra?: Record<string, unknown>;
};
```

这里最重要的约束是：

- provider 真相在 backend
- renderer 只知道脱敏后的 provider 元数据
- 不允许把明文 key 放到 renderer store

## ComfyUI Local 支持边界

`ComfyUI` 必须支持，但支持方式故意收窄：

- 用户提供 `workflow API JSON`
- backend 负责提交执行
- backend 负责跟踪状态并回收输出

当前不做：

- 把 `ComfyUI` 的局部重绘、参考图、ControlNet、LoRA 等能力重新抽象成统一产品字段
- 解析每一类节点的业务语义
- 代替用户设计 workflow

第一版只要求：

1. 接受 `API format` workflow JSON
2. 允许用户传入少量运行时替换参数
3. 调本地 `POST /prompt`
4. 通过 `/ws`、`/history` 或 `/queue` 跟踪状态
5. 把输出文件转成本地受控产物

也就是说，在本项目里：

- `ComfyUI` 是本地 workflow runner
- 不是一组我们自己重新定义的“高级图像功能”

## 文件与元数据边界

图片结果既是业务数据，也是本地产物。

第一版建议拆成两层：

### 文件产物

- 图片文件落到应用受控数据目录
- renderer 只消费 backend 暴露出的可读引用

### 元数据记录

- `generationId`
- `executionKind`
- `status`
- `prompt`
- `negativePrompt`
- `size`
- `stylePreset`
- `providerId`
- `providerModel`
- `providerJobId`
- `filePath`
- `mimeType`
- `width`
- `height`
- `createdAt`
- `updatedAt`
- `errorMessage`

第一版可以先只保留最小“最近一次结果”或轻量历史，不必立刻做完整图库。

## MicroAPP 契约建议

`image_generation` 作为 `MicroAPP`，至少应声明：

- 支持入口：`desktop.image_generation_studio`
- 绑定配置 schema：provider、model、默认画幅、默认风格、可选 workflow runner 配置
- 运行时执行器：`image_generation`

推荐示意：

```ts
type ImageGenerationMicroAppDefinition = {
  id: "image_generation";
  supportedAccessPoints: ["desktop.image_generation_studio"];
  bindingSchema: {
    providerId:
      | "openai_images"
      | "aliyun_wanx"
      | "tencent_hunyuan"
      | "comfyui_local";
    model: "string";
    defaultSize: "string";
    defaultStylePreset: "string";
    workflowRunnerProfile: "string?";
  };
  runtimeKey: "image_generation";
};
```

## 风险与非目标

### 风险

- 这条链路天然涉及外部网络请求，后续实现前需要再次确认 outbound data transfer 风险门槛
- 结果文件是二进制产物，后续实现时要单独确认本地存储目录和清理策略
- 不同 provider 的响应格式、审核策略和超时行为差异很大，第一版不要过早抽象统一参数层
- 远端 URL 型产物可能有很短的有效期，必须尽快回收成本地文件
- `ComfyUI` workflow JSON 本身会带来执行边界和资源占用风险，后续实现时需要单独评估本地 runner 的超时、并发和错误回收
- 如果过早把这套能力开放给 chat 或第三方入口，会把当前调试型底座提前抬升成通用产品契约，影响面会变大

### 明确非目标

- 不在本轮文档中批准任何实际 provider 接入代码
- 不在本轮文档中批准新打包行为
- 不在本轮文档中批准新的 secret 存储方案实现
- 不在本轮文档中批准 UI 形态和交互稿
- 不在本轮文档中批准“统一图片编辑语义层”
- 不在本轮文档中批准 chat / integration / MCP 入口复用

## 推荐实施顺序

如果项目 owner 批准进入实现，建议按这个顺序推进：

1. 先做统一任务状态机和图片产物落盘规则
2. 再做 `openai_images`、`aliyun_wanx`、`tencent_hunyuan`、`comfyui_local` 四个 adapter 的协议边界
3. 再做任务提交 / 查询 route 的黑盒最小回归
4. 最后再考虑第二批 provider、历史记录和批量生成

## 外部参考

- OpenAI:
  - [Image generation guide](https://developers.openai.com/api/docs/guides/image-generation)
  - [gpt-image-2](https://developers.openai.com/api/docs/models/gpt-image-2)
  - [Images API generate](https://developers.openai.com/api/reference/resources/images/methods/generate)
- Google:
  - [Vertex AI Imagen sample](https://docs.cloud.google.com/vertex-ai/generative-ai/docs/samples/generativeaionvertexai-imagen-generate-image)
- 阿里云:
  - [万相图像生成与编辑 API](https://help.aliyun.com/zh/model-studio/wan-image-generation-api-reference)
- 腾讯云:
  - [混元生图接口](https://cloud.tencent.com/document/product/1729/105968)
  - [文生图轻量版](https://cloud.tencent.com/document/product/1729/108738)
- 百度千帆:
  - [通用图像生成](https://cloud.baidu.com/doc/qianfan-api/s/8m7u6un8a)
- Stability AI:
  - [API reference](https://platform.stability.ai/docs/api-reference)
- fal:
  - [Docs](https://fal.ai/docs/documentation)
  - [Async queue inference](https://fal.ai/docs/documentation/model-apis/inference/queue)
- Replicate:
  - [Docs](https://replicate.com/docs)
  - [Create a prediction](https://replicate.com/docs/topics/predictions/create-a-prediction)
  - [Output files retention](https://replicate.com/docs/topics/predictions/output-files)
- ComfyUI:
  - [Workflow API format](https://docs.comfy.org/development/api-development/workflow-api-format)
  - [Cloud/API overview](https://docs.comfy.org/development/cloud/overview)
  - [Server routes](https://docs.comfy.org/development/comfyui-server/comms_routes)

## 相关文档

- `README.md`
- `../architecture/README.md`
- `../architecture/ipc-and-preload.md`
- `../integrations/third-party-integration-architecture.md`
