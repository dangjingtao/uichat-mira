---
status: current
owner: runtime / integrations / desktop
last_verified: 2026-07-30
layer: wiki
module: MicroAPP
feature: Overview
doc_type: overview
canonical: true
related:
  - ../MICROAPP_CURRENT_TRUTH.md
  - ../CURRENT_PRODUCT_TRUTH.md
  - office-runtime-task-contract.md
  - wenshu-skill-runtime.md
  - tts-studio-runtime-notes.md
  - github-capability-design.md
  - ../archive/microapp/README.md
---

# MicroApp 模块入口

> 先读 [[MICROAPP_CURRENT_TRUTH]]。本页只提供当前模块导航，不再用一张候选清单替代每项能力的真实生命周期。

## 一句话定义

Mira 的“微应用”目前有两层含义：

1. **MicroApps Hub**：设置页中的能力中心，容纳独立 Studio、领域 Runtime、Skill、Tool / MCP 集成和外部连接；
2. **Integration MicroAPP Runtime**：AccessPoint 绑定并调用标准化业务工作流的窄协议。

```text
产品入口集合
!= Integration MicroAPP registry
```

## 当前严格 Registry

`server/src/microapps/runtime.ts` 当前注册：

```text
knowledge_query
news_hub
image_generation
computer_use
tts
codegraph
evolving_knowledge
```

其中只有 `knowledge_query` 当前完成外部 AccessPoint invoke，并且只支持 `wecom.smart_robot`。

其余 definition 主要为桌面 Studio 保留共享定义和稳定 runtime key；真实能力由各自 service / routes 提供，统一 `MicroAppDefinition.invoke()` 当前明确返回 Studio-only 或 not implemented。

## 当前能力索引

| 能力 | 当前身份 | 当前状态 | 主要参考 |
| --- | --- | --- | --- |
| Knowledge Query | Integration MicroAPP | WeCom smart robot 可绑定并真实调用 | [[MICROAPP_CURRENT_TRUTH]] |
| Image Generation | Studio + Domain Runtime | 有任务、实时进度、Artifact、Provider / ComfyUI；无 external invoke | [[microapp/image-generation-comfyui-smoke-guide]] |
| Computer Use | Studio + Managed Browser Runtime + Tool | 有持久任务、Evidence、模型执行器、审批；无 external invoke | [[microapp/computer-use-frontend-manual-smoke-guide]] |
| TTS | Studio + Domain Runtime | Windows / Piper / GPT-SoVITS / API Provider 已接 | [[microapp/tts-studio-runtime-notes]] |
| News Hub | Studio + Domain Service + Tool source | 有抓取、缓存、搜索；通过 `news_search` 进入 Harness | [[MICROAPP_CURRENT_TRUTH]] |
| CodeGraph | Studio + Managed Runtime + Tool | Agent 只看 `codebase_explore`；无 external invoke | [[TOOL_CURRENT_TRUTH]] |
| 智识进化库 | Experimental Studio + Service | 有真实入口，稳定产品合同仍在演进 | [[MICROAPP_CURRENT_TRUTH]] |
| Mail Center | Product Studio + Domain Service + Tool | 有 SMTP / IMAP、本地缓存和 `mail_query`；不在 strict registry | [[MICROAPP_CURRENT_TRUTH]] |
| 文枢 | Studio + Domain Runtime + Skill-private Runtime | Office Runtime 与 Skill-owned execution 已成立 | [[microapp/office-runtime-task-contract]] / [[microapp/wenshu-skill-runtime]] |
| GitHub | Connection UI + Governed Tool Pack | Device Flow、installation 与四领域工具已成立 | [[microapp/github-capability-design]] |
| 问策 | External Expert Bridge + Tool | 网页桥接可用，Provider 独立握手仍有限 | [[microapp/external-expert-bridge-design]] |
| Notion | Connection / AccessPoint partial implementation | 连接和部分资源能力存在；完整 Agent / sync 未完成 | [[microapp/notion-microapp-functional-design]] |

## 当前合同

### 文枢 / Office

- [[microapp/office-runtime-task-contract]]：`office-runtime.v1`；
- [[microapp/wenshu-skill-runtime]]：DOCX / XLSX / PDF / PPTX Skill 与 Runtime；
- [[skill/pi-skill-agent-execution]]：Skill-owned SubAgent 执行边界。

### TTS

- [[microapp/tts-studio-runtime-notes]]：Windows、Piper、GPT-SoVITS、API Provider；
- [[microapp/gpt-sovits-microapp-poc]]：当前 GPT-SoVITS bridge 细节。

### Mail Center / 工作台邮件摘要

- Mail Center 保存本地邮箱账号配置，通过 SMTP 发送测试邮件，通过 IMAP 拉取并缓存真实收件箱邮件；
- Mira 工作台按上海自然日同步各账号邮件并生成关注摘要，邮件轮播展示关注数量、内容摘要、量化优先级、关注原因和建议下一步；
- 邮件优先级由服务端按 0–100 分统一计算，不直接采用模型给出的等级。24 小时内截止、明确行动要求、工作阻塞、安全或法律风险、财务影响、直接点名、邮箱星标和未读状态加分，群发营销和纯通知扣分；25 分进入关注列表，50 分为高优先级，75 分为紧急；
- 模型只提取内容摘要和评分信号，邮件中心保存的未读、星标状态由服务端直接计分；
- `GET /dashboard/mail` 按用户、日期和语言缓存邮件摘要 1 小时。缓存有效期内不访问 IMAP，也不重复调用 Task Model；缓存到期后的首次访问执行一次当日范围的只读 IMAP 同步；
- 邮件状态指纹未变化时复用既有分析并续期缓存；相同缓存键的并发请求共用一次刷新。结果按分数降序排列，同分按收件时间倒序排列；
- 该接口不发送邮件，也不改变远端已读或星标状态。

### GitHub

- [[microapp/github-capability-design]]：连接入口、仓库边界和四个领域工具。

### 问策

- [[microapp/external-expert-bridge-design]]：External Expert / WebBridge 当前边界。

## 验收与操作指引

- [[microapp/image-generation-comfyui-smoke-guide]]；
- [[microapp/computer-use-frontend-manual-smoke-guide]]；
- `project-control/tasks/`、`project-control/reviews/` 与 `project-control/testEvidence/` 中的对应施工证据。

这些文档说明某条链路如何验收，不自动扩大产品能力边界。

## 方案与部分实现

以下内容仍需按正文范围阅读，不能提升为完整产品事实：

- [[microapp/notion-microapp-functional-design]]；
- 智识进化库相关设计与 Studio 记录；
- 尚未完成 external invoke 的各 Studio definition；
- 未进入 current contract 的未来 Integration provider / AccessPoint。

## 四条阅读规则

### 1. 不从页面卡片推断 Runtime

设置页出现入口，只说明产品提供了进入点。

### 2. 不从 definition 推断可调用

definition 可能只是稳定 ID、binding schema 和 desktop access-point 的共享注册。

### 3. 不从 HTTP route 推断 Agent access

Agent 必须通过明确 Tool 或 Skill contract 使用能力。

### 4. 不从 Agent access 推断 Integration invoke

`news_search`、`mail_query`、GitHub tools、Browser tools 和文枢 Skill 都不因此成为 `MicroAppDefinition.invoke()`。

## 历史归档

旧的 MicroAPP 总纲、实现前 POC、早期 Studio 设计和迁移前 GitHub 合同保存在：

- [[archive/microapp/README]]

原路径的兼容页只用于旧链接跳转，不再定义当前实现。
