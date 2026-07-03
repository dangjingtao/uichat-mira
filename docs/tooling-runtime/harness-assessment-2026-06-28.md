# Harness 功能完备度评估

Status: Current
Owner: runtime
Last verified: 2026-06-28
Layer: wiki
Module: Harness
Feature: HarnessAssessment
Doc Type: assessment

## 评估范围

这份文档记录当前项目里 `Harness` 运行时控制面的完备度判断。

评估对象包括：

- capability registry
- invocation 生命周期
- approval / trace / artifact
- `read` / `edit_file` / `web_search` / `terminal_session`
- chat / agent 对 Harness 的接入方式

## 总体结论

当前 `Harness` **已经具备可用主链，但还不能算功能完备**。

更准确地说：

- 基座能力已成型
- 主路径已经能跑通
- 但审批持久化、会话级治理、replay、跨 workspace 调度仍未闭环

## 成熟度判断

### 已较成熟

- 统一注册入口已落地
- 统一 invocation / event / trace 机制已落地
- `read`、`edit_file`、`web_search`、`terminal_session` 都已接入 Harness
- `Harness Tool Exposure Policy` v0 已落地，开始接管工具暴露治理入口
- `web_search` 已有后端持久化配置
- `terminal_session` 已支持 timeout、stdout / stderr、session reuse 和 trace spans

### 部分完成

- approval 已进入统一状态模型，但还不是完整的持久化 grant 编排
- `terminal_session` 还在继续补收口
- 本地 embedding / rerank 当前已收口为内置能力包装层，但默认不作为 MCP tool surface 暴露
- 工具暴露治理已进入 Harness，但当前仍以规则式 v0 为主，尚未形成更完整的语境策略体系
- 外部 MCP 投影能力已有架构位点，但生态层未完全收口
- chat / agent 能消费 Harness，但还不是“完全统一的一条执行链”

### 未闭环

- thread / session 级 approval grant
- replay / 真正可重放执行
- 多 roots / 多 workspace / debug scope 联动
- 全量 trace UI
- 更细粒度风险分层

## 风险判断

当前最大的风险不是“没有 Harness”，而是“Harness 已经存在，但治理边界还不够硬”。

具体表现为：

- 多个执行流并发时，线程级状态可能出现交叉覆盖风险
- 工具完成后是否及时进入最终回答阶段，仍依赖上层编排
- 审批决策还没有完全收口到持久化层

## 一句话结论

当前 `Harness` 是**可用但未完备**，属于“主骨架正确，治理闭环仍在补齐”的阶段。

## 边界对齐结论

当前关于 `Agent`、`Capability Protocol`、`Harness` 的颗粒度，结论统一为三层分工：

- `Agent` 负责意图识别、是否进入工具面、候选能力选择
- `Capability Protocol` 负责定义能力输入输出、阶段语义、产物语义和调用契约
- `Harness` 负责统一执行、审批、trace、生命周期、retention 和风控治理

这意味着：

- `Agent` 不应私自发明工具协议或工作流契约
- `Harness` 也不只是被动执行器，而是统一治理运行时
- 具体能力实现只负责干活，不负责决定平台级协议归属

对应到当前项目：

- `read`、`edit_file`、`web_search`、`terminal_session` 属于已接入 `Harness` 的执行能力
- 本地 `embedding` / `rerank` 当前属于内置能力包装层，不默认作为 MCP tool surface 暴露
- 是否进入工具面，由 `Agent` / 意图识别层决定
- 一旦进入执行面，审批、执行、trace、失败语义应统一收口到 `Harness`

## 当前暴露治理缺口

当前实现里，`Harness` 已经覆盖了工具进入执行面之后的审批、执行和 trace 治理，但**工具暴露治理尚未闭环**。

一个明确现象是：

- 用户仅输入简单寒暄（例如 `Hi`）
- Agent 侧仍可能召回过大的候选能力集合
- 后续甚至可能命中需要审批的能力

这说明当前问题不应简单归因为“`Harness` 完全没管”，更准确的判断是：

- `Harness` 已管执行治理
- 但 `Agent` 进入工具面的条件仍偏宽
- `Tool Exposure` 尚未根据语境做足够收缩
- 低意图输入缺少稳定的对话短路机制

因此，现阶段更准确的结论是：

- `Harness` 不是失效，而是治理覆盖面仍偏后段
- 真正未闭环的是“语境化工具暴露治理”
- 这部分需要 `Agent`、`Tool Exposure`、`Harness` 三层共同收口，而不能只靠执行阶段审批补救

当前进展更新：

- `Harness` 已新增 `Tool Exposure Policy` 作为统一暴露治理入口
- `Agent` 的 capability embedding 召回已改为先经过 `Harness` 暴露过滤
- `chat tool surface` 已改为复用 `Harness` 暴露策略，而不再直接读取全量 registry
- 对低意图寒暄输入（例如 `Hi`）已增加 v0 短路规则，避免无任务情况下扩大工具候选面

## 能力识别方向

当前进一步收口的目标，不是把越来越多原始 `tools` 暴露给 LLM，而是让 `Harness` 把多个 `tools` 治理成更稳定的 `capability`。

建议主线是：

- 底层保留多个真实 `tool`
- 中间层由 `Harness Capability Profile` 把工具聚合成能力
- 上层只让 `Agent` 面对能力候选，而不是原始工具洪水

当前识别链建议采用组合评分，而不是只靠 embedding：

1. `rule filter`
2. `embedding recall`
3. `rerank`
4. `policy / risk score`

其中：

- `embedding` 负责“像不像”
- `rerank` 负责“当前是否更合适”
- `rule / policy` 负责“该不该现在暴露与执行”

推荐输出形态：

- `capabilityId`
- `preferredToolId`
- `supportingToolIds`
- `semantic score`
- `rerank score`
- `rule / policy score`
- `final score`
- `requiresApproval / blockedReason`

当前 v0 已开始落地：

- `Harness Capability Profile` 已引入静态能力分组
- Agent 候选召回已从“直接召回 tool”转向“先召回 capability profile”
- 当前评分已包含 `embedding score + rule score`
- `rerank score` 作为下一步增强位预留

## Harness Context System

Harness 还需要一层“上下文系统”，解决大型代码 + 文档系统里“信息无限，但上下文有限”的问题。

它的目标不是让模型读完整个系统，而是每次动态构建最小但充分的上下文。

建议稳定维护三类索引：

- `Module-centric Index`
  - 模块地图、相关路径、相关文档、关键词
- `Symbol-centric Navigation`
  - 符号索引、调用链、局部跳转、Git 历史
- `Task-centric Context`
  - 任务历史、决策、TODO、日志和回放材料

推荐实施顺序：

1. `Project Map` 自动生成器
   - 必须先做
   - 没有它，后面的检索都会变成瞎检索
2. `Context Builder` 最小版
   - 只做 `module + doc + code chunk`
3. `embedding + rerank`
   - 最后再加

推荐上下文构建链路：

```text
classify -> modules -> docs -> code -> compress
```

其中：

- `Project Map` 负责模块、路径、文档、关键词的基础地图
- `embedding` 负责召回
- `rerank` 负责当前相关性
- `rule / policy` 负责是否应该暴露和执行

这个系统还应显式输出两项解释信息：

- `freshness`
  - 新知识优先于旧知识
- `confidence`
  - 每段上下文为什么被选中

这份设计现在的结论是：

- 方向成立
- 适合接进 Harness 作为上下文编排层
- 还需要和现有 capability profile / exposure / diagnostics 一起统一输出证据链
- 实施顺序必须先 `Project Map`，再 `Context Builder`，最后 `embedding + rerank`
