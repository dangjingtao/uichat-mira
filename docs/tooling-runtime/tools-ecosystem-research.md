# 内置工具区成熟方案调研

Status: Current
Owner: runtime
Last verified: 2026-06-26
Layer: raw-source
Module: Tool
Feature: ToolsEcosystem
Doc Type: reference

## 单点真相范围

这页整理当前“内置工具区 / MCP runtime”方向的外部调研结论。

它主要回答：

- 市面上哪些能力已经有成熟方案
- 哪些部分适合直接复用，哪些部分仍需要项目自己收协议
- 结合当前 `uchat + provider proxy + RAG` 架构，工具能力应如何落地

这页是调研与判断，不替代当前项目已有真相页：

- `uchat.md`
- `architecture/provider-proxy-api.md`
- `harness-runtime-design.md`
- `read-skill-design.md`

## 适合什么时候读

这些场景建议先看这页：

- 想决定工具区该不该继续扩
- 想判断哪些能力已经没必要重复造轮子
- 想设计 MCP runtime、chat tool loop、artifact viewer 的落地方向

## 当前结论

行业成熟方案基本收敛到三层：

1. 模型层：`tool calling / function calling` 已是主流基础能力
2. 协议层：MCP 正在成为开放互操作标准
3. 结果层：工具结果越来越强调结构化结果、工件和可嵌入 UI

对本项目的直接结论：

- “阅读 / 编辑 / 网络搜索 / 终端 / 预览” 作为产品层五个能力维度是合理的
- 但在协议层，不建议把“预览”和其余四类做成完全同构的执行型工具
- 更稳的分层是：
  - 执行型工具：`read`、`edit`、`web_search`、`terminal`
  - 渲染型能力：`artifact viewer / preview surface`
- 当前项目已经切到 `mcp runtime` 主干，但 chat tool loop、前端执行工作台、artifact registry 还没完全闭环

## 当前设计收口

- 工具实现优先只推进 `Read`
- `Read` 的正式设计见 `read-skill-design.md`
- `Harness` 运行时设计见 `harness-runtime-design.md`
- 其余工具域暂不在本轮作为一等实现目标继续扩展

## 行业风向

### Tool calling 已成熟

主流模型平台已经把工具调用当成标准能力，而不是实验特性。

例如：

- OpenAI：function calling、tools、built-in tools、Apps SDK
- Anthropic：tool use、client tools、server tools、agent loop
- Vercel AI SDK：把 tool calling 直接暴露为应用层组合能力

这意味着：

- 不建议继续设计完全闭门的私有工具语义
- 更适合对齐主流 tool calling 的输入输出结构、调用状态和结果回填方式

### MCP 正在成为开放标准

MCP 的价值不只是 tool，而是把几类关键对象一起标准化：

- tools
- resources
- prompts
- progress / cancellation
- apps / UI extension

对本项目很关键，因为未来不只是“执行一个工具再回一段文本”，还包括：

- 读工作区资源
- 编辑文件
- 启动本地进程
- 搜网页
- 展示 HTML / PDF / diff / 日志 / 截图等工件

从抽象上看：

- `阅读` 更接近 MCP 的 `resources`
- `编辑 / 网络搜索 / 终端` 更接近 MCP 的 `tools`
- `预览` 更接近 `artifacts / apps / ui resources`

### 工具结果正在 UI 化

行业已经从“工具只返回文本”转向：

- 返回结构化结果
- 返回可预览工件
- 必要时直接返回嵌入式交互 UI

所以工具区不能只考虑“怎么让模型调工具”，还要同时考虑：

- 工具结果如何持久化
- 如何在聊天消息中回放
- 如何在侧边或抽屉中预览
- 哪些结果适合直接以内嵌卡片展示

## 五类能力判断

### 阅读

成熟度最高，也最适合快速落地。

成熟方案：

- 文件扫描：`fs/promises`、`fast-glob`、`globby`
- PDF：`pdf.js`、`pdf-parse`、`pdfjs-dist`
- Word：`mammoth`、`docx-preview`
- PowerPoint：`pptxjs`、`jszip + OOXML`
- Excel：`exceljs`、`xlsx`
- 代码结构：`ts-morph`、`tree-sitter`

对本项目的判断：

- `阅读` 的难点不在底层解析，而在格式路由、边界控制、结果归一化和裁剪
- 这也是为什么当前先把主线收窄到 `Read`

### 编辑

底层 patch 算法有成熟库，但产品级编辑协议仍需要项目自己收。

成熟方案：

- `diff-match-patch`
- `fast-json-patch`
- `micromatch`

结论：

- 可复用 patch 能力
- 不能把最终执行协议完全外包给模型
- 项目更适合优先走 `apply_patch` 风格

### 网络搜索

搜索能力更适合 provider 化，不适合长期围绕 HTML 抓取打磨。

成熟方案：

- Tavily
- Brave Search API
- Exa
- SerpAPI

对本项目的建议：

- `web_search` 应保持统一 capability 面
  - provider 选择应来自 harness environment 与当前可用配置
  - 不应从 UI 拆成多个搜索工具
  - 当前 DuckDuckGo lite 抓取只适合作为开发兜底

当前已确认的落地约束：

- 内置 `Search` 第一阶段只做 `web_search`
- `web_search` 第一阶段保持统一工具面，下挂 provider chain
- 内置 `Edit` 第一阶段只做 `edit_file`
- `edit_file` 当前只开放：
  - `write_file`
  - `replace_block`
- `edit_file` 当前执行实现由 harness environment 选择 edit capability，而不是在 tool 层散落硬编码分支
- 后续如果扩 provider，仍然应该由 harness/runtime 决定 provider strategy，而不是在 capability 内部堆散落分支

### 终端

如果目标是真实终端体验，成熟标准解基本就是：

- 前端：`xterm.js`
- 后端：`node-pty`

结论：

- 不建议自造 PTY 抽象
- 真正需要关注的是会话生命周期、安全边界、日志裁剪与审批

### 预览

预览在产品信息架构上可以保留为第五维，但在协议层更适合作为：

- artifact viewer
- preview surface
- UI resource

而不是普通执行型工具。

成熟方案：

- 执行侧：`playwright`、`puppeteer`、隐藏 `WebContents`
- 渲染侧：`pdf.js`、`react-markdown`、`Shiki`、`CodeMirror`、`Monaco`

## 对当前项目的启发

### 产品层

继续保留五维分组：

1. 阅读
2. 编辑
3. 网络搜索
4. 终端
5. 预览

### 协议层

建议拆成两层：

- 执行型工具
  - `read`
  - `edit`
  - `web_search`
  - `terminal`
  - `browser_action`
- 渲染型能力
  - `artifact viewer`
  - `preview surface`
  - `inline result card`

### 落地口径

更适合的实现主张是：

- 内部协议直接采用 MCP 模型
- 第一阶段只实现最小可用子集
- 外部继续以“工具区”产品形态组织能力

## 面向当前仓库的建议架构

建议把后续能力收成三层：

1. `MCP core`
2. `chat / RAG adapter`
3. `tooling UI`

### `MCP core`

负责：

- definitions
- registry
- invocation lifecycle
- event stream
- artifact model
- permission / capability metadata

### `chat / RAG adapter`

负责：

- 接收模型的 tool call 决策
- 调用 MCP core 执行 invocation
- 把结果回填为模型可继续消费的上下文
- 把 invocation event 映射为前端可消费的流式事件

### `tooling UI`

继续保持“工具区”产品形态：

- 左侧：五维能力分类
- 中间：调用过程、状态、日志
- 右侧：预览与工件

## 第一阶段最值得补什么

第一阶段最值得补的是：

- `tool definitions`
- `tool invocations`
- `tool stream events`
- `artifact model`
- `tool-call / tool-result` 消息语义

优先能力：

1. `read_resource`
2. `edit_file`
3. `web_search`
4. `terminal_session`

其中：

- `read_resource` 最适合先打稳
- `预览` 第一阶段更适合作为 viewer，而不是独立执行器

## 当前项目现状判断

当前项目已经有：

- `server/src/mcp/*` 运行时骨架
- 四个核心能力的 backend 实现
- 设置页工具区展示

但还没有形成完整端到端闭环：

- chat 主链路还未正式接入 tool-calling loop
- 当前聊天消息协议还缺 `tool-call / tool-result`
- 工具结果还没有统一 artifact 模型
- 终端与预览还未形成独立会话 / 工件承载协议

所以更准确的判断是：

- backend MCP runtime 已成型
- 但 chat tool loop、前端执行交互、artifact preview registry 还没闭环

## 最终结论

这份调研的最终判断是：

- 五维工具区方向本身合理
- 阅读、终端、搜索都已有成熟标准方案，不需要从零造轮子
- 编辑能力没有完整现成平台解，但有成熟工程路径可复用
- 预览在产品视角应保留独立地位，在协议视角应下沉为 artifact / viewer
- 对本项目来说，最优路径不是先做一个“大而全工具平台”，而是：
  - 内部协议直接采用 MCP 模型
  - 第一阶段只实现最小可用子集
  - 先接少量高价值内置能力
  - 再把结果预览和工件展示做完整

## Search 当前落地状态

截至 `2026-06-25`，`Search` 已明确收敛为：

- 内置能力：`web_search`
- 当前 provider chain：
  - `Tavily`
  - `SearXNG`
  - 不再保留 DuckDuckGo 作为正式 provider

当前实现链路是：

- `web_search` 由 harness environment 提供可用 provider 视图
- tool 层根据环境与配置选择 `Tavily` 或 `SearXNG`
- 具体执行不依赖第三方搜索 SDK，直接使用原生 `fetch`
- `Tavily` 直连 `https://api.tavily.com/search`
- `SearXNG` 直连 `${baseUrl}/search`
- 前端配置只保留两项：
  - `Tavily API key`
  - `SearXNG baseUrl`
- 这两项当前通过后端配置接口持久化：
  - `GET /mcp/web-search/config`
  - `PUT /mcp/web-search/config`
- 后端存储表为：`web_search_settings`

当前已完成：

- `web_search` 后端 capability 已收口为 provider chain
- `web_search` 单元测试已覆盖 Tavily / SearXNG / provider 选择 / 缺配置失败
- `edit_file` 后端 capability 已收口到独立 edit runtime
- `edit_file` 单元测试已覆盖成功、dry-run、参数缺失、内容不匹配、越界路径
- 前端工具草稿默认值已对齐统一工具面：
  - `apiKey`
  - `baseUrl`
- 搜索配置真相已从前端本地存储迁移到后端 SQLite 持久化

当前仍未完成：

- `Search` 的最终产品化 UI 收敛
- 如果未来要扩 provider，仍需重新走 harness/runtime provider strategy 设计

## 参考资料

- OpenAI Tools
  - https://developers.openai.com/api/docs/guides/tools
- OpenAI Function Calling
  - https://developers.openai.com/api/docs/guides/function-calling
- OpenAI Apps SDK
  - https://developers.openai.com/apps-sdk
- Anthropic Tool Use Overview
  - https://platform.claude.com/docs/en/agents-and-tools/tool-use/overview
- Anthropic Build with Claude
  - https://www.anthropic.com/learn/build-with-claude
- MCP Intro
  - https://modelcontextprotocol.io/docs/getting-started/intro
- MCP Tools Specification
  - https://modelcontextprotocol.io/specification/2025-06-18/server/tools
- MCP Resources Specification
  - https://modelcontextprotocol.io/specification/2025-06-18/server/resources
- MCP Apps
  - https://blog.modelcontextprotocol.io/posts/2026-01-26-mcp-apps/
- CodeMirror Docs
  - https://codemirror.net/docs/
- Monaco Editor
  - https://microsoft.github.io/monaco-editor/
- xterm.js
  - https://xtermjs.org/docs/
- node-pty
  - https://github.com/microsoft/node-pty
- Playwright
  - https://playwright.dev/
- Puppeteer
  - https://pptr.dev/
- PDF.js
  - https://mozilla.github.io/pdf.js/
- pdf-parse
  - https://www.npmjs.com/package/pdf-parse
- mammoth
  - https://github.com/mwilliamson/mammoth.js
- docx-preview
  - https://www.npmjs.com/package/docx-preview
- ExcelJS
  - https://github.com/exceljs/exceljs
- SheetJS xlsx
  - https://sheetjs.com/
- Shiki
  - https://shiki.style/
- react-markdown
  - https://remarkjs.github.io/react-markdown/
- fast-glob
  - https://www.npmjs.com/package/fast-glob
- globby
  - https://github.com/sindresorhus/globby
- ts-morph
  - https://ts-morph.com/
- tree-sitter
  - https://tree-sitter.github.io/
- Tavily Search API
  - https://docs.tavily.com/documentation/api-reference/endpoint/search
- Brave Search API
  - https://brave.com/search/api/
- Exa Search
  - https://exa.ai/docs/reference/search
- SerpAPI
  - https://serpapi.com/
