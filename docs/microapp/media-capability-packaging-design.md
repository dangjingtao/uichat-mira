---
status: proposed
owner: microapp / model-settings / runtime
last_verified: 2026-07-14
layer: architecture
module: MicroAPP
feature: MediaCapabilityPackaging
doc_type: design
canonical: true
related:
  - tts-studio-runtime-notes.md
  - gpt-sovits-microapp-poc.md
  - image-generation-microapp-poc.md
  - ../architecture/model-config-api.md
  - ../developments/project-general-cleanup.md
---

# 生图与 TTS 微应用能力封装设计

## 目标

把现有 `Image Generation Studio` 和 `TTS Studio` 包装成可以被前端和外部接入层识别的两个最小能力，不重做现有工作台，也不重复建设服务商配置系统。

本设计只处理：

- 两个微应用入口卡上的服务能力配置入口
- 复用两个工作台已有的服务商配置
- 对外暴露 `imageGeneration` 与 `tts` 两个能力标识
- GPT-SoVITS 参考 WAV 的一次上传、多次复用
- 参考 WAV 与合成产物的清理边界

本设计不处理：

- Prompt / Workflow / 音色等调试页面重构
- 新增聊天内生图或 TTS 交互
- 新增 MCP Tool
- 新增服务商 API Key、Base URL 或服务商表
- 语音模型下载、打包或托管
- 历史图库、音频作品库和多任务面板

## 已有能力

两个工作台已经分别保存了完整的服务商配置。能力弹窗不读取或编辑模型设置中的
provider connection，也不再次保存 API Key、Base URL、模型 ID 等字段；它只保存用户
选择的微应用 provider ID。真正调用时，由对应工作台按照这个 provider ID 读取已有配置。

### 调用边界

能力绑定属于配置面，负责保存“这个能力选择哪个微应用服务商”。现有工作台内部调试
流程仍由工作台自己的 provider 状态驱动；不能把工作台内部的默认 provider 误认为能力
绑定已经生效。

对外调用入口必须先读取对应能力绑定，再把绑定的 `providerId` 传给生图或 TTS 运行时：

```text
external request
  -> capability binding
    -> providerId
      -> existing micro-app provider configuration
        -> image generation or TTS runtime
```

当前代码已经完成卡片、弹窗、绑定 API 和持久化，但仓库中还没有独立的外部能力调用
入口读取这条绑定。因此在该入口接入前，只能确认“绑定保存正确”，不能声称外部请求
已经会按照绑定自动切换服务商。

## 对外能力

两个微应用只对外声明一个能力字段：

```json
{
  "capability": "imageGeneration"
}
```

```json
{
  "capability": "tts"
}
```

能力字段表示“这个微应用能够处理哪类请求”，不等于具体工具，也不等于服务商协议。

能力与运行配置的关系：

```text
MicroAPP
  -> capability
    -> providerId
      -> existing micro-app provider configuration
```

### 生图

```text
imageGeneration
  -> api_provider | comfyui_local
  -> selected provider's existing Image Generation Studio configuration
```

生图服务商固定为：

- `api_provider`：API 服务商，使用生图工作台中 API 服务商已有的配置
- `comfyui_local`：ComfyUI，使用生图工作台中 ComfyUI 已有的连接和工作流配置

### TTS

```text
tts
  -> piper_local | gpt_sovits | api_provider
  -> selected provider's existing TTS Studio configuration
```

TTS 服务商固定为：

- `piper_local`：Piper，使用 TTS 工作台已有的 Piper 配置；语音模型由用户选择系统语音或外部文件
- `gpt_sovits`：GPT-SoVITS，使用 TTS 工作台已有的服务地址和参考音频配置
- `api_provider`：API 服务商，使用 TTS 工作台已有的 API 服务商配置

TTS 对外统一使用 `tts` 能力名。Windows Voice 仍是 TTS 工作台内部可用的运行 provider，
不作为本次对外能力弹窗的服务商选项。

## 前端交互

在两个微应用入口卡上增加一个齿轮图标按钮：

```text
Image Generation Studio       [进入工作区] [齿轮]
TTS Studio                    [进入工作区] [齿轮]
```

点击齿轮后打开服务能力配置弹框。

弹框只展示：

- 能力名称
- 该能力允许的微应用服务商
- 当前绑定状态
- 确定 / 取消

弹框不展示或重复编辑：

- API Key
- Base URL
- 服务商连接创建表单
- Prompt
- Workflow
- TTS 文本和音色参数

点击“确定”后保存一条微应用能力绑定。取消不改变绑定。

入口卡应能显示：

- 未配置
- 已配置服务商名称

## 能力绑定数据

新增一类微应用能力绑定记录，逻辑上至少包含：

```text
micro_app_code
capability_code
provider_id
enabled
created_at
updated_at
```

约束：

- `micro_app_code + capability_code` 唯一
- 一个能力当前只有一个服务商绑定
- `provider_id` 只允许使用该能力的固定服务商白名单
- 绑定不复制任何工作台配置或连接凭据
- 运行时必须使用绑定的 `provider_id` 选择对应工作台服务商配置

能力绑定的服务商白名单：

```text
image-generation + imageGeneration + api_provider | comfyui_local
tts               + tts               + piper_local | gpt_sovits | api_provider
```

## GPT-SoVITS 参考音频持久化

### 当前问题

历史流程是：

```text
前端 IndexedDB
  -> 每次合成重新上传 WAV
  -> backend 每次生成新文件名并写入 ref-audios
  -> GPT-SoVITS 读取新文件
```

同一份 WAV 多次合成会在服务器产生多份重复文件。历史清理逻辑还会递归删除
`server/data/microapps/tts/ref-audios`，而浏览器 IndexedDB 中的记录不会同步删除，
容易形成前端显示与后端实际状态不一致。

### 目标方案

参考 WAV 作为 TTS 用户素材落入 SQLite，音频内容使用 BLOB 保存；不使用服务器常驻内存作为长期存储，也不把参考音频放入可清理的媒体目录。

建议数据结构：

```text
tts_ref_audios
  id
  original_name
  mime_type
  byte_size
  sha256
  audio_blob
  created_at
  last_used_at
```

约束：

- 只接受 WAV
- `sha256` 建唯一索引，重复音频复用已有记录
- `audio_blob` 保存原始 WAV 字节
- 数据库记录不包含 API Key 或服务商凭据
- `last_used_at` 用于后续资源管理和诊断

### 请求流程

第一次使用：

```text
前端上传 WAV
  -> backend 按 sha256 查找
  -> 不存在则写入 SQLite BLOB
  -> 返回 refAudioId
```

后续使用：

```text
前端只提交 refAudioId
  -> backend 读取 tts_ref_audios.audio_blob
  -> 通过内部参考音频接口提供给 GPT-SoVITS
```

GPT-SoVITS 当前需要可访问的音频 URL，因此后端提供内部读取接口：

```text
GET /microapps/tts/ref-audios/:id
```

该接口从 SQLite 读取 BLOB 并返回 `audio/wav`。不要求把 WAV 长期展开到文件系统，也不要求把 WAV 常驻内存。

### 前端 IndexedDB 的位置

现有 IndexedDB 可以继续作为桌面端选文件缓存，但它不再是服务端复用的依据。成功入库后，前端应保存 `refAudioId`，后续合成只提交这个 ID。

如果 IndexedDB 中的文件存在但服务端记录不存在，前端允许重新上传一次；这属于明确的重新上传，不是静默重复保存。

## 清理边界

一键清理当前会删除：

- `.artifacts/tts/outputs`

参考音频已经改为 SQLite BLOB 后：

- 合成产物仍属于可清理媒体
- `tts_ref_audios` 参考素材默认不属于媒体目录清理
- TTS provider 配置不删除
- 微应用能力绑定不删除
- 参考音频数据库记录不删除
- TTS 合成任务记录是否删除，需要与产物清理单独定义；不能留下大量指向已删除文件的历史记录

清理接口必须明确返回不同类型的清理结果，不能把参考素材和合成产物合并成一个模糊的“音频已清理”。

## 失败与边界

- provider ID 不在该能力白名单中：拒绝保存能力绑定
- 参考音频 ID 不存在：TTS 请求明确失败
- 参考音频不是 WAV：上传阶段拒绝
- GPT-SoVITS 不可用：返回明确的环境错误
- Piper 仍只内置运行时，不打包用户语音模型；用户自行选择系统语音或外部 `.onnx + .onnx.json`

## 验收标准

### 能力封装

1. 两个入口卡各有齿轮图标。
2. 齿轮打开服务能力配置弹框。
3. 弹框只选择该微应用的既有 provider，不重复填写凭据或模型。
4. 确定后能力绑定持久化，刷新页面后仍显示。
5. 生图对外能力名为 `imageGeneration`。
6. TTS 对外能力名为 `tts`。
7. 生图只能绑定 `api_provider` 或 `comfyui_local`；TTS 只能绑定 `piper_local`、`gpt_sovits` 或 `api_provider`。
8. 外部能力调用读取绑定的 `providerId`，不能使用工作台默认 provider 覆盖绑定。

### 参考音频

1. 同一 WAV 多次合成只产生一条 `tts_ref_audios` 记录。
2. 第二次合成只提交 `refAudioId`，不重新提交完整 WAV。
3. GPT-SoVITS 可以通过内部接口读取数据库中的 WAV。
4. 一键清理媒体目录不会删除 `tts_ref_audios`。
5. 删除或清理合成产物不会删除参考音频素材。

### 验证

- provider 能力绑定 API 测试
- provider 能力不匹配拒绝测试
- WAV hash 去重测试
- `refAudioId` 读取接口测试
- GPT-SoVITS 使用已保存参考音频的服务测试
- 一键清理不删除参考音频记录的服务测试

## 非目标

本设计完成后，仍不承诺：

- Piper 语音模型随安装包提供
- GPT-SoVITS 上游服务自动启动
- 参考音频跨设备同步
- 多个 TTS 参考音频的作品库管理
- 聊天消息中直接调用生图或 TTS
