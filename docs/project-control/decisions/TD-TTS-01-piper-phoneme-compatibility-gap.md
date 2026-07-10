---
status: current
owner: project-owner
last_verified: 2026-07-10
layer: project-control
module: ProjectControl
feature: TtsStudioRuntimeDebt
doc_type: decision
canonical: true
related:
  - docs/microapp/tts-studio-runtime-notes.md
  - docs/developments/defect-log.md
  - README.md
  - docs/build/README.md
---

# TD-TTS-01 Piper Phoneme Compatibility Gap

## Decision

接受一项当前版本仍未关闭的技术债：

`TTS Studio` 内置的 `Piper` Windows 运行时，当前只把 `phoneme_type=espeak` 语音包纳入稳定支持范围，不把 `phoneme_type=pinyin` 中文语音包当成当前版本可稳定承诺的能力。

## Reason

这次问题已经确认不是页面表单、provider 保存、测试文案或模型路径填写错误。

当前真实边界是：

- 项目内置 `Piper` 运行时为 `rhasspy/piper` `windows-amd64` `2023.11.14-2`
- 当前链路可以稳定跑通 `phoneme_type=espeak`
- 当前链路不能稳定跑通 `phoneme_type=pinyin`

已确认现象：

- `zh_CN-huayan-medium` 可用
- `zh_CN-xiao_ya-medium` 不兼容
- 典型失败日志为：
  - `"[piper] [error] \"ai\" is not a single codepoint (ids=30,)"`

所以这不是局部交互缺陷，而是运行时兼容边界没有覆盖完整中文语音包。

## Affected Areas

- `TTS Studio` 的 `Piper` provider
- 微应用对外说明里的 “Piper 稳定支持范围”
- 内置运行时打包说明
- 后续中文 `Piper` 语音包选型与验收标准

## Rejected Alternatives

- 继续把问题解释成前端配置错误
- 继续把问题解释成测试文本不合适
- 在当前证据不足的情况下，把所有中文 `Piper` 包都宣传成稳定支持
- 继续在 UI 层补局部兼容处理，掩盖真实运行时边界

## Follow-up

- 如果当前产品目标只是“先稳定可用”，继续明确 `Piper` 路线只支持 `phoneme_type=espeak`
- 如果产品后续要求 `Piper` 路线稳定覆盖更多中文包，需要单独评估：
  - `Piper` runtime 升级
  - 新 runtime 与现有包格式的兼容矩阵
  - `pinyin` 包的最小回归样本
- 在这项技术债关闭前，不要把“可加载 `.onnx` 文件”当成“语音包已稳定支持”的证据
