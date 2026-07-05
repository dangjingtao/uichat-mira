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
- API、配置、密钥和结果存储的最小契约
- 后续从文档进入实现时的切片顺序

它不覆盖：

- 具体 provider 的采购决策
- 最终 UI 视觉稿
- 批量任务队列、商用计费和审核平台
- 任何本轮未批准的 runtime 实现

## Goal

这个 POC 的目标不是把“AI 绘图平台”一次做全，而是先验证三件事：

1. 当前桌面端架构能否安全承接一个外部生图 API 微应用
2. `MicroAPP` 是否可以不依赖企业接入入口，也能作为桌面内业务单元存在
3. 第一版是否能用最小链路做出“输入 prompt -> 生成图片 -> 本地查看结果”的稳定闭环

## 结论先说

建议把这次微应用正式命名为：

- `image_generation`

它是一个独立 `MicroAPP`，不是：

- chat 内部的一个临时按钮
- renderer 直连第三方 API 的快捷脚本
- MCP / Tool 的别名

它的最小产品闭环应该是：

```text
用户填写 prompt
  -> renderer 提交生成请求
  -> backend 调用外部生图 provider
  -> backend 保存结果元数据
  -> renderer 展示图片、参数和失败原因
```

当前建议先把它当成：

- 一个桌面内 `AccessPoint`

推荐命名：

- `desktop.image_generation_studio`

这样可以证明 `MicroAPP` 不只是第三方平台入口的附属物，也可以服务本地桌面工作区。

## 为什么值得做

这个微应用的价值不在“把 prompt 发出去”本身，而在于它能用很短的链路验证一组关键基础设施：

- 外部 provider 调用边界
- 本地 secret 管理边界
- 二进制结果文件保存边界
- `MicroAPP` 配置和运行时分层
- 桌面 UI 与 backend 的最小请求闭环

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

- 只做单次生成，不做任务编排
- 只做单 provider 接入，不先抽象多 provider 市场
- 只支持文本 prompt，不做上传草图、局部编辑和 ControlNet 类能力
- secret 只在 backend 持有，renderer 不直接碰第三方 API
- 结果先本地落盘和登记元数据，不先做云同步
- 失败要可解释，不做静默 fallback 到别的 provider

## POC Success Criteria

当且仅当下面这些目标成立时，才能认为第一版 POC 成功：

1. 用户能在桌面端填写 prompt 并发起一次生成
2. renderer 请求链路遵守当前项目规则：开发态走 `/api/...`，生产态走 `window.desktopApi.backendUrl`
3. backend 能用受控配置调用一个外部生图 provider
4. backend 能把图片文件和最小生成元数据保存到本地受控目录
5. renderer 能展示成功结果、失败信息和本次使用的输入参数
6. 全链路不要求 renderer 直接持有 provider 密钥
7. 不新增未审计的 fallback 分支

## Scope

### In scope

- 一个独立 `MicroAPP` 定义：`image_generation`
- 一个桌面内入口：`desktop.image_generation_studio`
- 一个生成表单：
  - `prompt`
  - `negativePrompt`
  - `size`
  - `stylePreset`
  - `count`
- 一条 backend 生成路由
- 一个 provider 配置模型
- 一份本地结果元数据记录
- 一页最小结果展示

### Out of scope

- 多 provider 路由
- 图片编辑、局部重绘、扩图
- 历史图库管理后台
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

推荐用户流程：

1. 打开 `Image Generation Studio`
2. 输入 prompt
3. 选择画幅和风格
4. 点击生成
5. 等待 backend 返回图片
6. 在页面里看到图片、本次参数和 provider 响应摘要

先把这条链路做稳，比一开始堆“风格模板、批量任务、画廊、分享”更重要。

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
  provider-client.ts
  file-store.ts
  service.ts
  routes.ts
```

目的：

- `service.ts` 负责业务收口
- `provider-client.ts` 负责外部 API 协议
- `file-store.ts` 负责本地文件与元数据写入
- `routes.ts` 只负责 HTTP 边界

## API 契约建议

backend route 继续保持 prefix-free。

推荐第一轮只开一条主路由：

```text
POST /microapps/image-generation/generations
```

请求体建议：

```ts
type CreateImageGenerationRequest = {
  prompt: string;
  negativePrompt?: string;
  size: "1024x1024" | "1024x1536" | "1536x1024";
  stylePreset?: "cinematic" | "illustration" | "product" | "anime";
  count?: 1;
};
```

返回体建议：

```ts
type CreateImageGenerationResponse = {
  generationId: string;
  status: "completed";
  image: {
    fileId: string;
    mimeType: string;
    width: number;
    height: number;
    localPath: string;
  };
  promptSummary: {
    prompt: string;
    negativePrompt?: string;
    size: string;
    stylePreset?: string;
  };
  provider: {
    id: string;
    model: string;
    requestId?: string;
  };
  createdAt: string;
};
```

如果 provider 失败，直接返回明确错误，不做 silent fallback。

## Provider 配置边界

第一版不要做“任意 provider 插件市场”。

建议先固定一个内部 provider 配置结构：

```ts
type ImageGenerationProviderConfig = {
  providerId: "openai_images";
  model: string;
  apiKeySecretRef: string;
  baseUrl?: string;
  timeoutMs: number;
};
```

这里最重要的约束是：

- provider 真相在 backend
- renderer 只知道脱敏后的 provider 元数据
- 不允许把明文 key 放到 renderer store

## 文件与元数据边界

图片结果既是业务数据，也是本地产物。

第一版建议拆成两层：

### 文件产物

- 图片文件落到应用受控数据目录
- renderer 只消费 backend 暴露出的可读引用

### 元数据记录

- `generationId`
- `prompt`
- `negativePrompt`
- `size`
- `stylePreset`
- `providerId`
- `providerModel`
- `filePath`
- `mimeType`
- `width`
- `height`
- `createdAt`
- `errorMessage`

第一版可以先只保留最小“最近一次结果”或轻量历史，不必立刻做完整图库。

## MicroAPP 契约建议

`image_generation` 作为 `MicroAPP`，至少应声明：

- 支持入口：`desktop.image_generation_studio`
- 绑定配置 schema：provider、model、默认画幅、默认风格
- 运行时执行器：`image_generation`

推荐示意：

```ts
type ImageGenerationMicroAppDefinition = {
  id: "image_generation";
  supportedAccessPoints: ["desktop.image_generation_studio"];
  bindingSchema: {
    providerId: "openai_images";
    model: "string";
    defaultSize: "string";
    defaultStylePreset: "string";
  };
  runtimeKey: "image_generation";
};
```

## UI 形态建议

这轮先不做复杂工作台，保持“唬人但不乱”的最小形态：

- 左侧是参数表单
- 右侧是大图预览
- 顶部显示当前 provider / model
- 结果区显示 prompt 摘要、尺寸和生成时间

第一版视觉重点应放在：

- 大图反馈足够直接
- 加载态不假完成
- 失败态可读

而不是一开始铺满高级控制项。

## 风险与非目标

### 风险

- 这条链路天然涉及外部网络请求，后续实现前需要再次确认 outbound data transfer 风险门槛
- 结果文件是二进制产物，后续实现时要单独确认本地存储目录和清理策略
- 不同 provider 的响应格式、审核策略和超时行为差异很大，第一版不要过早抽象统一层

### 明确非目标

- 不在本轮文档中批准任何实际 provider 接入代码
- 不在本轮文档中批准新打包行为
- 不在本轮文档中批准新的 secret 存储方案实现

## 推荐实施顺序

如果项目 owner 批准进入实现，建议按这个顺序推进：

1. 先做 backend provider client + route 的黑盒最小回归
2. 再做图片文件落盘和元数据记录
3. 再接 renderer 单页表单和结果预览
4. 最后再考虑历史记录、批量生成和多 provider

## 相关文档

- `README.md`
- `../architecture/README.md`
- `../architecture/ipc-and-preload.md`
- `../integrations/third-party-integration-architecture.md`
