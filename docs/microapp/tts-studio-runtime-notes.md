# TTS Studio 运行时说明

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
  - gpt-sovits-microapp-poc.md
  - ../build/README.md
  - ../developments/defect-log.md
  - ../project-control/decisions/TD-TTS-01-piper-phoneme-compatibility-gap.md

## 单点真相范围

这页只回答一件事：

当前项目里的 `TTS Studio` 微应用，在运行时层面到底支持什么，不支持什么。

它覆盖：

- `Windows 内置语音`
- `Piper`
- `GPT-SoVITS`
- 当前 `Piper` 兼容边界
- 已确认的运行时技术债

它不覆盖：

- UI 版式细节
- 第三方平台入口复用
- `GPT-SoVITS` 上游字段映射细节

## 当前结论

`TTS Studio` 当前是双运行时结构：

- `Windows 内置语音`
  - 直接调用 Windows `System.Speech`
- `Piper`
  - 使用应用内置的 Windows `Piper` 运行时
- `GPT-SoVITS`
  - 调用本机已启动的 `Gradio WebUI`

## 当前运行时边界

### Windows 内置语音

当前支持：

- 枚举系统已安装语音
- 直接合成中英文文本
- 保存默认 voice / rate / volume

### Piper

当前项目内置的是：

- `rhasspy/piper`
- `windows-amd64`
- 版本：`2023.11.14-2`

当前资源目录：

```text
.artifacts/micro-apps/tts/piper/
tauri/resources/micro-apps/tts/piper/
```

当前支持：

- 用户只提供 `.onnx` 和同目录 `.onnx.json`
- 应用内置 `piper.exe`、依赖 DLL 和 `espeak-ng-data`
- `phoneme_type=espeak` 的语音包
- 单 speaker 和显式 `speaker id`

当前不支持：

- `phoneme_type=pinyin` 的语音包

已确认可用示例：

- `zh_CN-huayan-medium`

已确认不兼容示例：

- `zh_CN-xiao_ya-medium`

### GPT-SoVITS

当前接的是本机已启动服务：

- `http://127.0.0.1:9872`

当前边界：

- renderer 用 `IndexedDB` 暂存参考音频
- backend 负责把请求转译成上游 `Gradio` 调用
- 不负责桌面内托管 `api_v2.py`

更细字段映射见：

- [gpt-sovits-microapp-poc.md](/D:/workspace/rag-demo/docs/microapp/gpt-sovits-microapp-poc.md)

## Piper 兼容性技术真相

当前 `Piper` 问题不是“模型路径填错”。

也不是“所有中文模型都能跑，只是文本里不能带英文”。

当前已确认的真实边界是：

- `espeak` 包可以稳定工作
- `pinyin` 包会在当前内置运行时链路下失败

典型失败表现：

- `"[piper] [error] \"ai\" is not a single codepoint (ids=30,)"`

这说明当前问题属于运行时兼容性，不属于页面表单或 provider 持久化问题。

## 当前产品约束

如果目标是“当前版本稳定可用”，那当前产品约束应理解为：

- `Piper` 路线只承诺支持 `phoneme_type=espeak`
- 需要稳定中英文时，优先选 `espeak` 型中文包和英文包
- `pinyin` 型中文包不能作为当前版本的稳定能力承诺

## 已登记技术债

当前已确认的技术债：

- 内置 `Piper runtime` 还不能稳定支持 `phoneme_type=pinyin` 的中文语音包
- 因此当前“Piper 稳定支持中英文”的能力边界并不完整
- 如果产品后续要求 `Piper` 路线稳定覆盖更多中文语音包，需要单独升级运行时兼容策略，而不是继续在 UI 层修补

相关台账：

- [defect-log.md](/D:/workspace/rag-demo/docs/developments/defect-log.md)
- [TD-TTS-01-piper-phoneme-compatibility-gap.md](/D:/workspace/rag-demo/docs/project-control/decisions/TD-TTS-01-piper-phoneme-compatibility-gap.md)
