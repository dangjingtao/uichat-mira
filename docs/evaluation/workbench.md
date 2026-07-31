---
status: current
owner: evaluation
last_verified: 2026-07-31
layer: product
module: Evaluation
feature: EvaluationWorkbench
doc_type: current-contract
canonical: true
related:
  - ../EVALUATION_CURRENT_TRUTH.md
  - package-format.md
  - runtime.md
  - metrics.md
  - ../provider/FIRST_MODEL_SETUP.md
  - ../KNOWLEDGE_BASE_CURRENT_TRUTH.md
---

# 评测工作台与评测中心

## 1. 文档范围

本页说明如何使用当前桌面评测入口：

```text
准备 Knowledge Base 和模型
→ 生成或上传评测 ZIP
→ 检查校验结果
→ 启动 Run
→ 查看日志与样本结果
→ 在评测中心复查或导出报告
```

本页不定义指标数学语义。指标以 [[evaluation/metrics]] 为准。

## 2. 前置条件

至少需要：

- Backend 正常运行；
- 一个存在且有 `ready + enabled` 文档的 Knowledge Base；
- 可用的 Embedding role；
- 当前 RAG 所需的 `llm`；
- 需要自动生成评测包时，额外配置 `evaluation` role；
- 使用 Rerank 时，额外配置可用 Rerank role。

`evaluation` role 当前用于生成 question / expectedAnswer / tags，不承担 Run 的质量裁判。

## 3. 产品入口

### 3.1 评测中心

```text
设置
→ 评测中心
```

可以：

- 查看已持久化 Run；
- 搜索 Run 名、Dataset 名和 Knowledge Base；
- 刷新；
- 打开详情；
- 导出 Markdown；
- 删除单条或批量删除已结束 Run。

### 3.2 新建评测

从评测中心进入：

```text
新建评测
```

当前工作台分为：

- 包上传与数据集摘要；
- 校验结果；
- 运行状态；
- 日志 / 结果控制台；
- 评测包生成器。

## 4. 路径 A：自动生成评测包

打开评测包生成器后：

1. 选择 preset；
2. 选择 Knowledge Base；
3. 确认 ready document / chunk 数；
4. 设置 Dataset 名；
5. 调整样本、文档、Chunk、模式、topK、topN、Repeat、Concurrency 和 Timeout；
6. 生成并下载 ZIP。

当前 preset：

- fast；
- balanced；
- strict。

Preset 会根据当前 Knowledge Base 的 ready document / chunk 数调整部分参数。

### 4.1 生成成功的真实含义

生成成功证明：

- Knowledge Base 当时存在；
- 当时有足够的 ready + enabled Chunk；
- `evaluation` role 成功返回可解析 JSON；
- 已生成目标数量且 question 不重复；
- ZIP 已写出。

它不能证明：

- 当前 Knowledge Base 之后没有变化；
- ZIP 保存了真实文档内容；
- Dataset 已上传并通过校验；
- Run 可以在另一台 Mira 实例复现；
- 自动生成的参考答案一定正确。

### 4.2 当前参数差异

服务端会 clamp 参数。当前 `strict` preset 显示 600 秒 timeout，但生成服务会将 timeout 最大限制为 300 秒，写入 manifest 的也是 300。

## 5. 路径 B：上传已有评测包

工作台上传区只接受：

```text
单个 .zip
最大 100 MB
```

上传后，Backend 会：

```text
Buffer ZIP
→ 查找 manifest / evalset / documents
→ 解析样本与配置
→ 检查 Knowledge Base
→ 保存 Dataset 与 Samples
→ 返回预览和校验结果
```

详细格式见 [[evaluation/package-format]]。

## 6. 数据集校验

当前工作台展示四类校验：

- 包结构；
- reference answer；
- gold sources；
- Knowledge Base。

规则：

```text
任一 error
→ 不能启动 Run

只有 warning
→ 可以启动，但对应分数解释能力受限
```

典型情况：

| 情况 | 当前结果 |
| --- | --- |
| 缺少 manifest | 结构 error；即使部分字段能默认回填也不能运行 |
| 缺少 evalset.json | 解析直接失败 |
| 没有有效 question | 样本 error |
| 缺少 reference answer | warning；生成分数解释能力下降 |
| 缺少 gold sources | warning；Hit / Recall 结果通常失去意义 |
| knowledgeBaseId 缺失或不存在 | error |
| documents 目录为空 | 结构 error |

## 7. Dataset 预览

预览区当前展示：

- Dataset 名称；
- 文件大小和上传时间；
- Document 数；
- Sample 数；
- mode / topK / topN / repeat；
- documents 清单；
- 前四条 Sample；
- validation items。

预览不显示完整 Sample 集合，也不会展示 ZIP documents 的正文。

## 8. 启动 Run

只有满足以下条件时按钮才可运行：

- Dataset 已解析；
- 没有 validation error；
- 当前不在 parsing / queued / running。

启动后：

```text
POST /evaluation/runs
→ Run queued
→ Backend microtask 开始执行
→ Workbench 每 1.5 秒轮询
→ completed 或 failed
```

`queued` 当前通常很短，但不是 durable queue 状态。

## 9. 日志与进度

日志控制台显示：

- 包和 manifest 摘要；
- validation summary；
- Run 创建与开始；
- worker / sample / repeat；
- 命中、延迟和错误；
- 汇总完成。

Run 最多保留 200 条日志。更早日志会从内存记录和持久化 JSON 中裁掉。

进度条主要由 `sampleResults.length / sampleCount` 推算：

- queued 固定约 18%；
- running 最低约 24%，最高约 96%；
- completed / failed 为 100%。

它不是底层节点精确进度。

## 10. 结果

结果页展示：

- Run 名、模式、状态和时间；
- Metric Grid；
- 当前已完成 Sample 数；
- 前几条问题、状态和耗时。

详细 Sample、Attempt、Sources 和回答在评测中心详情与 Markdown 报告中更完整。

## 11. 评测中心

评测中心读取 SQLite 已持久化 Run。

当前支持：

- 全量列表；
- 客户端搜索；
- 详情 Drawer；
- Markdown 导出；
- 单条删除；
- 批量删除。

当前不支持：

- 分页；
- Run 对比；
- Baseline；
- 筛选 UI；
- 重新运行；
- 取消或恢复；
- Dataset 管理。

运行中或排队中的 Run 不能删除。

## 12. Markdown 导出

导出在桌面客户端发生：

```text
当前 Run JSON
→ 当前版本 exportMarkdown 代码
→ Markdown 字符串
→ Browser 下载
```

它不是 Backend 生成并冻结的 Artifact。报告中的加权平均、Mermaid 图和建议属于客户端解释层。

## 13. 失败排查

### 包生成失败

检查：

1. `evaluation` role 是否真实可调用；
2. Knowledge Base 是否有 ready + enabled 文档；
3. Chunk 数是否能满足 sampleCount；
4. 模型是否输出合法 JSON；
5. 是否生成重复 question；
6. Timeout 是否足够。

### ZIP 解析失败

检查：

1. 是否只上传一个 `.zip`；
2. 是否超过 100 MB；
3. `evalset.json` 是否存在且 JSON 合法；
4. manifest、documents 和 Sample 是否完整；
5. knowledgeBaseId 是否指向当前实例的真实 KB。

### Run 无法启动

检查 validation error，尤其是：

- Knowledge Base 不存在；
- knowledgeBaseId 缺失；
- 没有有效 Sample；
- 包结构不完整。

### Run 卡在 queued / running

当前没有重启恢复合同。若 Backend 在运行中重启，记录可能保持原状态但不再执行，而且当前删除接口会拒绝删除它。这是已知 Runtime 缺口，不应通过重复刷新假装正在恢复。

## 14. 验收清单

一次最小评测闭环应确认：

1. Knowledge Base 有 ready + enabled 文档；
2. ZIP 通过结构和 KB 校验；
3. Dataset 预览中的问题和 gold sources 合理；
4. Run 从 queued 进入 running；
5. Sample Results 持续增加；
6. 最终状态和失败样本一致；
7. Sources 对应当前 Knowledge Base；
8. 指标按 [[evaluation/metrics]] 的当前算法解释；
9. Markdown 可以导出；
10. 不把分数直接当作生产通过证明。
