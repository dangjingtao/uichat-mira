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
  - server/src/services/tts-ref-audio-storage.service.ts
  - server/src/microapps/tts/index.ts
  - server/src/routes/microapps/tts/index.ts
---

# TD-TTS-02 TTS 音频持久化可见性缺口

## Decision

接受一项当前版本仍未关闭的技术债：

`TTS Studio` 现在把“参考音频”和“合成产物音频”分别落在两套不同的后端路径与访问模型里，但前台没有把这层差异明确暴露给 owner，导致运行时排查时很容易误判“产物没有生成”或“后端把前端 IndexedDB 音频错误写成了产物目录”。

## Reason

当前实现已经确认是双轨存储：

- 参考音频：
  - 持久化到 `server/data/microapps/tts/ref-audios`
  - 通过静态 public path 暴露
- 合成产物音频：
  - 持久化到 `.artifacts/tts/outputs`
  - 不走静态目录
  - 通过 `/microapps/tts/syntheses/:id/audio` 按任务读取

这套设计本身不是错误，但当前产品面存在两个明显缺口：

- owner 在文件系统里只能直观看到 `ref-audios` 静态目录，容易把它误当成“全部 TTS 音频目录”
- 前台没有明确显示“本次产物真实落盘路径 / 当前播放来源 / 这是任务产物不是静态参考音频”

因此这不是单点 bug，而是存储模型和可观察性之间存在解释缺口。

## Affected Areas

- `TTS Studio` 的运行时排障体验
- GPT-SoVITS 参考音频与产物音频的存储心智模型
- owner 对“是否生成成功”的现场判断
- 后续清理策略、导出策略、保留策略的产品说明

## Rejected Alternatives

- 把这次现象解释成 owner 看错目录
- 把静态参考音频目录当成产物目录继续沿用，不补任何说明
- 在没有产品对齐的前提下，临时把产物也复制进静态目录
- 用聊天说明替代正式技术债登记

## Follow-up

- 后续需要明确一件事：`TTS Studio` 是否真的要长期保留当前双轨持久化模型
- 如果保留：
  - 前台应显式标明参考音频目录、产物目录、当前播放来源和最近任务产物路径
  - 应补清理策略和保留策略
- 如果不保留：
  - 需要重新设计纯前端临时预览、后端短期缓存或统一 artifact 管理模型
- 在这项技术债关闭前，不要把“用户在静态目录没看到产物”直接解释成“没有生成产物”
