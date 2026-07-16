# GPT-SoVITS 微应用对接 POC

Status: Current  
Owner: microapp / runtime / desktop  
Last verified: 2026-07-10  
Layer: raw-source  
Module: MicroAPP  
Feature: TTS  
Doc Type: design  
Canonical: false  
Related:
  - README.md
  - ../architecture/README.md
  - ../architecture/ipc-and-preload.md
  - ./README.md

## 单点真相范围

这页只回答一件事：

当前项目里的 `TTS Studio` 微应用，第一版如何接入本机已经运行起来的 `GPT-SoVITS` 服务。

它覆盖：

- 当前接入的是哪一层上游服务
- 为什么先这样接，不先改桌面运行时托管
- 我们在 backend 暴露出的自有接口
- 前端字段和后端字段的映射关系
- 浏览器侧文件缓存和 backend 临时文件之间的真实边界
- 当前数值控件的真实取值范围
- 当前 POC 的限制

它不覆盖：

- `GPT-SoVITS` 运行时安装器
- `api_v2.py` 的桌面内托管启动
- 多说话人融合、流式分片和高级推理参数全量暴露
- 第三方平台入口复用

## 结论先说

当前 POC 选择接 `Gradio WebUI`，不是直接托管 `api_v2.py`。

当前机器上已验证的可用上游是：

- `http://localhost:9872/`

当前没有启用的上游是：

- `http://localhost:9880/docs`

所以本轮实现遵守两条原则：

1. 只在 `TTS Studio` 微应用内新增 `GPT-SoVITS` tab。
2. renderer 不直接碰 `Gradio` 数组协议，统一经由 backend 的自有接口转译。

## 上游事实

本地目录：

- `D:\tool\GPT-SoVITS-v2pro-20250604`

已确认的上游接口能力：

- `GET /info?serialize=false`
  - 提供 `Gradio` 命名端点定义
- `POST /call/change_choices`
  - 返回当前 `GPT` 和 `SoVITS` 模型选项
- `POST /call/change_gpt_weights`
  - 切换 `GPT` 模型
- `POST /call/change_sovits_weights`
  - 切换 `SoVITS` 模型
- `POST /call/get_tts_wav`
  - 执行合成并返回音频文件

已确认但本轮未接的更干净 HTTP 层：

- `api_v2.py`
  - `POST /tts`
  - `GET /set_gpt_weights`
  - `GET /set_sovits_weights`

没有选 `api_v2.py` 的原因很直接：

- 这台机器当前真正跑起来的是 `9872` 的 `Gradio WebUI`
- 如果改成桌面端托管 `9880`，就会牵扯运行时启动和进程管理边界
- 这超出本轮微应用边界

## 当前项目内的接入设计

### Provider 标识

当前 `TTS Studio` provider 增加：

- `gpt_sovits`

它和现有 provider 并列：

- `windows_builtin`
- `piper_local`

### 后端边界

当前 backend 暴露两条 `GPT-SoVITS` 专用接口：

- `GET /microapps/tts/gpt-sovits/catalog`
- `POST /microapps/tts/gpt-sovits/syntheses`
- `GET /microapps/tts/ref-audios/:id`

设计目标是把上游 `Gradio` 的数组式输入收敛成项目自己的对象契约。

### 前端边界

`TTS Studio` 顶部新增第二个 tab：

- `Piper`
- `GPT-SoVITS`

`GPT-SoVITS` tab 继续沿用当前微应用规范：

- 顶部全宽结果预览
- 下方左侧 provider 配置卡
- 下方右侧合成请求卡

### 浏览器存储边界

当前参考音频上传不是直接写本地业务目录，也不是直接把文件路径交给 backend。

真实行为是：

- renderer 把用户选择的 `wav` 暂存进浏览器 `IndexedDB`
- 第一次用于合成时，renderer 把 `wav` 上传给 backend，backend 按 SHA-256 去重后保存到 SQLite BLOB
- backend 返回 `refAudioId`，后续合成只提交这个 ID，不重复上传完整文件
- backend 通过 `/microapps/tts/ref-audios/:id` 从 SQLite 读取音频并提供给 `GPT-SoVITS Gradio`

当前 `IndexedDB` 落点是：

- database: `uichat-mira-tts-studio`
- object store: `gpt-sovits-ref-audios`

当前单条记录结构包含：

- `id`
- `name`
- `size`
- `type`
- `lastModified`
- `createdAt`
- `blob`

这意味着一件事必须说清楚：

- 浏览器里“已经选择过”只代表前端缓存里有这份音频
- backend 入库成功后，前端记录会关联 `refAudioId`
- 服务端复用以 SQLite 记录为准，不依赖浏览器 IndexedDB

## 字段映射

### 配置卡

前端配置卡字段：

- `服务地址`
- `GPT 模型`
- `SoVITS 模型`

它们保存到 `tts_provider_configs.config_json`：

- `baseUrl`
- `gptModel`
- `sovitsModel`

### 合成请求卡

前端请求字段：

- `参考音频文件`
  - 上传后先存进浏览器 `IndexedDB`
  - 当前只接受 `wav`
  - 允许删除已保存项
- `参考文本`
- `参考语种`
- `目标语言`
- `采样步数`
- `切割方式`
- `语速`
- `句间停顿秒数`
- `温度`
- `Top K`
- `Top P`
- `要合成的文本`

当前请求卡里已经切到滑块交互的字段：

- `语速`
- `句间停顿秒数`
- `温度`
- `Top K`
- `Top P`

当前取值范围来自已验证的 `Gradio` 元信息和上游组件约束：

- `语速`: `0.6 ~ 1.65`
- `句间停顿秒数`: `0.1 ~ 0.5`
- `温度`: `0 ~ 1`
- `Top K`: `1 ~ 100`
- `Top P`: `0 ~ 1`
- `采样步数`: 当前仍按上游枚举值选择，选项来自 `/info?serialize=false`

当前前端会根据引用音频来源走两种请求：

- 有上传文件时：
  - `multipart/form-data`
  - 字段名 `refAudioFile`
- 仍然保留路径模式时：
  - JSON
  - 字段名 `refAudioPath`

当前 backend 统一接收的对象字段：

```ts
type CreateGptSovitsSynthesisPayload = {
  text: string;
  refAudioPath: string;
  promptText: string;
  promptLanguage: string;
  textLanguage: string;
  gptModel: string;
  sovitsModel: string;
  cutMethod: string;
  sampleSteps: number;
  speed: number;
  pauseSecond: number;
  temperature: number;
  topK: number;
  topP: number;
};
```

它会被转译成上游 `Gradio` 的 `get_tts_wav` 参数数组。

## 文件生命周期真相

当前参考音频素材落到 SQLite BLOB，再通过本地 HTTP 接口提供给上游。

具体流程：

1. 用户上传 `wav`
2. renderer 存入 `IndexedDB`
3. 用户点击“开始合成”
4. renderer 把选中的 `wav` 连同表单字段一起提交给 backend
5. backend 按 SHA-256 将这份文件保存到 SQLite `tts_ref_audios.audio_blob`
6. backend 通过 `GET /microapps/tts/ref-audios/:id` 从数据库返回音频
7. backend 用这个静态 URL 调用上游 `GPT-SoVITS`

所以当前真实落盘分成两类：

- 浏览器持久缓存
  - `IndexedDB`
  - 用于前端下次还能看到和复用这份 `wav`
- backend 参考音频素材
  - SQLite `tts_ref_audios`
  - 通过内部读取接口提供给 `Gradio` 读取
- backend 输出文件
  - `.artifacts/tts/outputs`
  - 作为合成结果产物保留

当前实现没有做的事：

- 参考音频仍未做跨设备同步
- 没有跨设备同步浏览器里的 `IndexedDB`

## 后端执行流程

当前合成链路：

```text
renderer
  -> 用户上传 wav 到浏览器 IndexedDB
  -> POST /microapps/tts/gpt-sovits/syntheses
  -> 第一次使用时 backend 按 SHA-256 写入 SQLite 并返回 refAudioId
  -> 后续请求只传 refAudioId
  -> backend 通过 /microapps/tts/ref-audios/:id 生成本地 URL
  -> backend 读取 provider 配置
  -> backend 调 /call/change_gpt_weights
  -> backend 调 /call/change_sovits_weights
  -> backend 调 /call/get_tts_wav
  -> backend 对返回的 PCM wav 做受控增益，避免成品音量明显偏小
  -> backend 把处理后的音频保存到 .artifacts/tts/outputs
  -> backend 记录 tts_synthesis_jobs
  -> renderer 用现有音频预览链路播放结果
```

补充一个当前事实：

- `tts_synthesis_jobs.request_config_json` 会记录本次请求参数和本次使用的参考音频路径
- 如果这次是上传文件，该路径是 backend 临时文件路径，不是浏览器 `IndexedDB` 内部标识

## 数据落盘

当前复用现有表，并新增参考音频素材表：

- `tts_provider_configs`
- `tts_synthesis_jobs`
- `tts_ref_audios`

音频产物继续落盘到：

- `.artifacts/tts/outputs`

参考音频素材保存到：

- SQLite `tts_ref_audios.audio_blob`

## 当前限制

当前限制必须明确：

1. 依赖用户自己先把 `GPT-SoVITS Gradio WebUI` 跑起来。
2. 默认服务地址是 `http://127.0.0.1:9872`，当前不负责拉起或守护这个进程。
3. 参考音频首次使用时写入 SQLite，后续合成通过 `refAudioId` 复用，不重复上传。
4. 当前没有接 `aux_ref_audio_paths`、`ref_free`、`super_sampling`、`streaming_mode` 等高级参数。
5. 当前 catalog 主要取自 `Gradio` 的元信息和模型列表，没有进一步抽象到跨供应商统一参数层。
6. 当前 `IndexedDB` 里的参考音频删除后不可恢复，也不会联动删除历史任务里已经生成的输出文件。
7. 当前滑块上下限来自现有上游元信息和组件约束，不代表未来所有 `GPT-SoVITS` 版本都完全一致。
8. 当前产物侧增益只对 backend 能识别的 PCM wav 生效，不会强行改写未知音频格式。

## 后续扩展建议

如果后面要把这条链路做稳，建议按这个顺序继续：

1. 桌面端托管 `api_v2.py`，替代对 `Gradio` 事件流的依赖。
2. 给 `GPT-SoVITS` 参考音频增加桌面文件选择器，但仍然只通过 preload 暴露。
3. 再考虑把更多高级参数逐步放进微应用请求卡。
4. 等 `GPT-SoVITS` 稳定后，再接后续供应商 tab，而不是先做跨供应商大抽象。
