# 核心内置工具整改台账

Status: Active
Owner: runtime
Last verified: 2026-07-05
Layer: raw-source
Module: Tool
Feature: CoreToolRectification
Doc Type: checklist

## 目的

这份台账只服务一件事：

按 `core-tool-matrix-review.md` 的整改要求，逐项推进当前核心内置工具矩阵整改。

范围只包括：

- Read
- Edit
- Web Search
- Terminal

不在这里扩新能力，不在这里讨论无关产品面。

## 执行原则

1. 先改高风险输入面，再改语义颗粒度。
2. 先稳真实 runtime tool，再补 LLM-facing action profile。
3. 每完成一项真实整改，都必须带自动化测试。
4. 不让 Terminal 变成读写搜的兜底万能工具。
5. policyNode 负责最终执行 gate，selector 负责语义动作识别。
6. 评审不只看验收项是否满足，还要检查实现是否出现严重越界修改；超出任务卡 `Allowed Changes` 的改动不能按完成处理。

## 关联文档

- `core-tool-matrix-review.md`
- `read-skill-design.md`
- `tools-protocol.md`
- `harness-runtime-design.md`
- `terminal-capability-checklist.md`

---

## 当前矩阵基线

当前真实 runtime tool：

- Read
  - `read_list`
  - `read_locate`
  - `read_open`
  - `read_extract`
  - `read_slice`
  - `read`
- Edit
  - `edit_file`
- Web Search
  - `web_search`
- Terminal
  - `terminal_session`

当前建议的 LLM-facing action profile：

- Read
  - `read_list`
  - `read_locate`
  - `read_open`
  - `read_extract`
  - `read_slice` 降权
  - `read` fallback
- Edit
  - `edit_create_file`
  - `edit_overwrite_file`
  - `edit_replace_block`
- Web Search
  - `web_search`
- Terminal
  - `terminal_execute_command`

这份台账的执行前提：

- runtime tool 保持少量稳定
- LLM / selector 识别 action profile
- policyNode 负责最终执行 gate
- toolNode 执行真实 runtime tool

---

## Read 评审结论台账

### 当前语义矩阵

```txt
read_list    = 看范围
read_locate  = 找目标
read_open    = 开目标
read_extract = 取局部
read_slice   = 裁结果
read         = 统一入口
```

整体链路：

```txt
看范围 → 找目标 → 开目标 → 抽局部 → 裁结果 → 统一入口
```

### 当前治理判断

- `read` 永远降权
  - 只作为 fallback / dispatch / 兼容入口
  - 不作为精细工具首选
- `read_slice` 不作为普通用户意图首选
  - 用于已有读取结果的二次窗口化
  - 不能作为文件系统入口
- 明确目标优先于定位，定位优先于泛读
  - 明确 path / 文件名 / uri：优先 `read_open`
  - 明确行号 / 页码 / section / heading：优先 `read_extract`
  - 模糊目标 / 关键词 / 相似名称：优先 `read_locate`
  - 看目录范围：优先 `read_list`
  - 不明确时：fallback 到 `read`
- 底层实现优先级由 Harness 环境决定
  - 不由 tool schema 绑定 grep / embedding / parser / sqlite-vec 等具体实现

### `read_locate` 结论

- 不新增独立 `read_grep`
- grep / rg / 内容关键词搜索应作为 `read_locate` 的底层实现能力
- `read_locate` 建议支持：
  - path/name locate
  - keyword locate
  - lightweight content match
  - symbol/heading locate
- `read_locate` 只返回候选位置和短 preview
  - 不承担最终阅读
  - 不返回大量正文

### Read 当前需记住的非目标

- 不把 grep 暴露成第 7 个 Read 工具
- 不让 `read_open` 吃掉明确局部范围请求
- 不让 `read_slice` 重新变成 path-based 入口

---

## Edit 评审结论台账

### 当前真实 runtime tool

- `edit_file`

### 当前 runtime 操作

- `write_file`
- `replace_block`
- `dryRun`

### 当前治理判断

- `edit_file` 作为底层执行工具够用
- 当前问题不是底层工具不够
- 当前问题是 LLM-facing 语义入口太粗

典型语义缺口：

- 创建文件
- 覆盖文件
- 局部替换

### 建议的 action profile

- `edit_create_file`
- `edit_overwrite_file`
- `edit_replace_block`

它们最终都映射到：

- `edit_file`

### 映射规则

```txt
edit_create_file
  → edit_file / write_file / content 默认 ""

edit_overwrite_file
  → edit_file / write_file / 覆盖已有内容

edit_replace_block
  → edit_file / replace_block / expectedOldText + newText
```

### 语义边界

- `edit_file`
  - 真实 runtime 执行工具
  - 不适合作为长期唯一的上层语义入口
- `write_file`
  - 处理完整内容写入
  - 可以写新文件，也可以写已有文件
- `replace_block`
  - 只处理局部替换
  - 依赖旧内容匹配
  - 不负责新建文件
  - 不负责整文件覆盖
- `dryRun`
  - 预演模式
  - 由 policyNode 强制治理

### 风险判断

- 所有 Edit 都属于：
  - `local-write`
  - `workspaceBound`
  - `requiresApproval`
- 风险层次仍需区分：
  - 创建文件：误创建、路径越界
  - 覆盖文件：覆盖已有内容、路径越界
  - 局部替换：错误替换目标块

### Edit 当前非目标

- 创建目录
- 删除文件
- 移动文件
- 重命名文件
- 批量修改
- 二进制文件修改
- 复杂 patch engine

这些不应现在混进 `edit_file`，未来再进 Workspace Mutation。

---

## Web Search 评审结论台账

### 当前真实 runtime tool

- `web_search`

### 当前 provider

- `Tavily`
- `SearXNG`

### 当前治理判断

- `web_search` 统一语义是正确的
- provider 是 Harness Runtime 的实现细节
- selector 只判断“要不要公网搜索”
- selector 不判断“该用 Tavily 还是 SearXNG”

### 输入面判断

当前输入包含：

- `query`
- `maxResults`
- `apiKey`
- `baseUrl`

评审结论：

- 可以暴露给模型：
  - `query`
  - `maxResults`
- 不应暴露给模型：
  - `apiKey`
  - `baseUrl`
  - `provider`

### 治理规则

- `web_search` 是统一公网搜索能力
- provider 不拆成多个工具
- provider 配置只能来自：
  - trusted runtime override
  - `web_search_settings`
  - environment variables
- `baseUrl` 必须来自可信配置或 allowlist
- 搜索结果必须标准化
- provider 失败必须结构化返回
- `search-results` artifact 可保留，但不得写入敏感信息

### Web Search 当前非目标

- 不拆 `tavily_search` / `searxng_search` / `bing_search` / `google_search`
- 不让模型直接控制 provider 细节

---

## Terminal 评审结论台账

### 当前真实 runtime tool

- `terminal_session`

### 当前 runtime 输入

- `command`
- `cwd`
- `env`
- `timeoutMs`
- `attachSessionId`
- `sessionMode`

### 当前治理判断

- `terminal_session` 作为唯一真实 Terminal 工具可以保留
- Terminal 不缺能力
- Terminal 的问题是能力太强、输入面太宽，需要强治理

### 当前语义

`terminal_session` 用于：

- 受 Harness 管控的 shell / process 执行
- 会话生命周期
- 流式 stdout / stderr 观察
- timeout / abort / attach session
- 长任务观察

它不是：

- 任意业务动作工具
- 任意内部集成工具容器
- “什么能跑就往里塞”的万能工具包

### 建议的 action profile

- `terminal_execute_command`

它最终映射到：

- `terminal_session`

### 字段治理判断

- 可以暴露给模型：
  - `command`
  - `cwd`
  - `timeoutMs`
- 不应直接暴露给模型：
  - `env`
  - `attachSessionId`
  - `sessionMode`

### 治理规则

- Terminal 默认高风险
  - `requiresApproval = true`
- 模型生成的 command 只是执行申请，不是直接执行
- `cwd` 必须 `workspaceBound`
- `timeoutMs` 必须限幅
- `env` 只来自 trusted runtime config 或极窄 allowlist
- `attachSessionId` 由 Harness 根据上下文和用户意图决定
- `sessionMode` 默认 `ephemeral`
- `persistent` 只用于明确长任务、watcher、dev server 场景
- Terminal 不能抢 Read / Edit / Web Search 的任务

### approval 现状结论

- 当前 approval 只承接到 invocation 状态
- 还没有完整 thread / session 级持久化 grant
- 在这之前必须坚持：
  - 复用 session 不等于自动继承执行权限

### Terminal 当前非目标

- 不拆出很多 session 管理型 LLM 工具
- 不把 Terminal 当万能兜底

---

## P0

### Edit

- [x] `edit_file` 必须限制 workspace 内路径，禁止路径逃逸
  - 任务卡：
    - `docs/project-control/tasks/core_tools_T001-edit-workspace-boundary.md`
  - 结果标准：
    - 相对路径 resolve 后必须仍在 workspaceRoot 内
    - 拒绝绝对路径越界
    - 拒绝符号链接绕过
  - 测试要求：
    - workspace 内正常写入
    - workspace 外路径拒绝
    - 逃逸路径拒绝
  - 当前实现：
    - `edit_file` 写入前改走 `resolveWorkspaceWritePath()`
    - 最近已存在祖先会先做 `realpath` 校验，阻止链接目录/符号链接把写入导向 workspace 外
  - 验证结果：
    - `pnpm --filter @ui-chat-mira/server typecheck`
      - 结果：当前分支失败
      - 说明：失败点位于 `server/src/microapps/legacy-sync.ts`、`server/src/microapps/runtime.ts`、`server/src/routes/integrations/index.ts`，不属于 `T001` 直接改动范围
    - `pnpm --filter @ui-chat-mira/server test -- src/mcp/tools/edit-file.tool.test.ts src/mcp/workspace.test.ts`
      - 结果：通过，`17 passed`

### Web Search

- [x] `web_search` 的 `apiKey` / `baseUrl` 不允许由模型生成
  - 任务卡：
    - `docs/project-control/tasks/core_tools_T002-web-search-provider-input-hardening.md`
  - 结果标准：
    - LLM-facing schema 不暴露 `apiKey`
    - LLM-facing schema 不暴露 `baseUrl`
    - provider 配置只来自 trusted runtime config / `web_search_settings` / 环境变量
  - 测试要求：
    - 模型输入不含 provider 参数时正常工作
    - 直接传 provider 参数时被忽略或拒绝
  - 已完成：
    - `server/src/mcp/tools/web-search.tool.ts` 移除 LLM-facing `apiKey` / `baseUrl`
    - runtime 只从 trusted runtime config / `web_search_settings` / 环境变量取 provider 配置
    - 已补 `server` / `desktop` 定向测试覆盖输入面治理

### Terminal

- [x] `terminal_session` 的 `env` / `attachSessionId` / `sessionMode` 不应直接暴露给模型
  - 任务卡：
    - `docs/project-control/tasks/core_tools_T003-terminal-llm-input-surface.md`
  - 结果标准：
    - LLM-facing schema 隐藏这些字段
    - 真实 runtime 仍可按 Harness 决策使用它们
  - 测试要求：
    - LLM-facing profile 不包含这三项
    - runtime 侧仍能内部构造 persistent / attach 场景

- [x] `terminal_session` 的 `command` 必须 `requiresApproval`
  - 任务卡：
    - `docs/project-control/tasks/core_tools_T004-terminal-command-approval.md`
  - 结果标准：
    - 所有 terminal command 都先进入 policy / approval gate
    - 不能因为 session 复用绕过 approval
  - 测试要求：
    - 新 command 触发 approval
    - attach 到旧 session 的新 command 仍触发 approval
  - 当前结果：
    - Harness preflight approval 继续按 `toolId + inputHash` 校验
    - `attachSessionId` 复用旧 session 时，只要 `command` 变化，仍然进入 `awaiting_approval`

---

## P1

### Edit

- [x] `write_file` 明确支持创建文件，且 `content: ""` 合法
  - 任务卡：
    - `docs/project-control/tasks/core_tools_T005-write-file-create-empty-content.md`
  - 结果标准：
    - 文件不存在 + `write_file` = 创建文件
    - 空字符串不视为缺失参数
  - 测试要求：
    - 创建空文件
    - 创建非空文件

- [x] `write_file` 覆盖已有文件必须 dryRun 或确认
  - 任务卡：
    - `docs/project-control/tasks/core_tools_T006-write-file-overwrite-approval.md`
  - 结果标准：
    - 目标存在时进入更严格治理
    - 高风险覆盖不应直接落盘
  - 测试要求：
    - 已有文件覆盖进入 dryRun / approval 流
  - 当前实现：
    - `server/src/mcp/edit/runtime.ts` 在目标已存在且未显式 `dryRun` 时自动升级为 dry-run
    - 覆盖场景会追加 `Escalated existing-file overwrite to dry-run` progress 事件
  - 验证结果：
    - `pnpm --filter @ui-chat-mira/server typecheck`
      - 结果：通过
    - `pnpm --filter @ui-chat-mira/server test -- src/mcp/tools/edit-file.tool.test.ts`
      - 结果：通过，`13 passed`

- [x] `replace_block` 必须 `expectedOldText` 唯一匹配
  - 任务卡：
    - `docs/project-control/tasks/core_tools_T007-replace-block-unique-match.md`
  - 结果标准：
    - 0 次匹配拒绝
    - 2 次及以上匹配拒绝
    - 只允许恰好一次匹配
  - 测试要求：
    - 唯一匹配成功
    - 无匹配失败
    - 多匹配失败
  - 当前实现：
    - `server/src/mcp/edit/runtime.ts` 对 `expectedOldText` 执行非空和唯一匹配校验
    - 多命中时明确拒绝 `expectedOldText must match exactly once`
  - 验证结果：
    - `pnpm --filter @ui-chat-mira/server typecheck`
      - 结果：通过
    - `pnpm --filter @ui-chat-mira/server test -- src/mcp/tools/edit-file.tool.test.ts`
      - 结果：通过，`13 passed`

### Read

- [x] `read_locate` 支持内容定位 / 关键词定位，但只返回候选和短 preview
  - 任务卡：
    - `docs/project-control/tasks/core_tools_T008-read-locate-keyword-preview.md`
  - 结果标准：
    - 支持 keyword locate
    - preview 必须短
    - 不返回大量正文
  - 测试要求：
    - path/name locate
    - keyword locate
    - preview 长度限制
  - 当前实现：
    - `server/src/mcp/read/locate.ts` 保留 path/name locate 与 content locate，但内容命中 preview 统一裁到短摘要
    - `server/src/mcp/tools/read-locate.tool.test.ts` 补了 preview 长度限制回归
  - 验证结果：
    - `pnpm --filter @ui-chat-mira/server typecheck`
      - 结果：通过
    - `pnpm --filter @ui-chat-mira/server test -- src/mcp/tools/read-locate.tool.test.ts src/agent/intent/task-capability-selector.test.ts`
      - 结果：通过，`10 passed`

### Terminal

- [x] `terminal_session` 的 `cwd` 必须 workspaceBound
  - 任务卡：
    - `docs/project-control/tasks/core_tools_T009-terminal-cwd-workspace-bound.md`
  - 结果标准：
    - 所有 `cwd` resolve 后必须在 workspaceRoot 内
  - 测试要求：
    - workspace 内 cwd 成功
    - 越界 cwd 拒绝
  - 当前实现：
    - `server/src/mcp/workspace.ts` 新增 `resolveWorkspaceDirectoryPath()`
    - ephemeral / persistent terminal `cwd` 都改为同一目录边界校验入口
  - 验证结果：
    - `pnpm --filter @ui-chat-mira/server typecheck`
      - 结果：通过
    - `pnpm --filter @ui-chat-mira/server test -- src/mcp/tools/terminal-session.tool.test.ts src/mcp/core/invocations.test.ts`
      - 结果：通过，`27 passed`

- [x] `terminal_session` 的 `timeoutMs` 必须限幅
  - 任务卡：
    - `docs/project-control/tasks/core_tools_T010-terminal-timeout-bounds.md`
  - 结果标准：
    - 默认值稳定
    - 超出上限后 clamp 或拒绝
  - 测试要求：
    - 默认 timeout
    - 小于下限处理
    - 大于上限处理
  - 当前实现：
    - `server/src/mcp/terminal/runtime.ts` 维持 `normalizeTimeoutMs()` 的默认值与上下限收敛
    - `server/src/mcp/tools/terminal-session.tool.test.ts` 补齐默认值、下限 clamp、上限 clamp 回归
  - 验证结果：
    - `pnpm --filter @ui-chat-mira/server typecheck`
      - 结果：通过
    - `pnpm --filter @ui-chat-mira/server test -- src/mcp/tools/terminal-session.tool.test.ts`
      - 结果：通过，测试包含在终端定向集内，总计 `18 passed`

### Selector

- [x] “新建 / 创建 / 写入文件”优先命中 Edit，而不是 Terminal
  - 任务卡：
    - `docs/project-control/tasks/core_tools_T011-selector-create-file-prefers-edit.md`
  - 结果标准：
    - selector 对这类语义动作优先映射 Edit
  - 测试要求：
    - 创建文件意图不召回 Terminal
  - 当前实现：
    - `server/src/agent/intent/task-capability-selector.ts` 已把“创建文件”与结构化“写入文件”语义优先收敛到 `workspace_edit`
    - 同文件的 tool 解析已让这类文件写请求优先落到 `edit_file`
    - 同时保留回归约束，避免把普通“写一段内容/写一份总结”误判成文件编辑
  - 验证结果：
    - `pnpm --filter @ui-chat-mira/server typecheck`
      - 结果：通过
    - `pnpm --filter @ui-chat-mira/server test -- src/mcp/tools/read-locate.tool.test.ts src/agent/intent/task-capability-selector.test.ts`
      - 结果：通过，`13 passed`

---

## P2

### Read

- [x] `read` 降权，只做 fallback / dispatch
  - 任务卡：
    - `docs/project-control/tasks/core_tools_T012-read-fallback-dispatch-demotion.md`
  - 结果标准：
    - selector 不把 `read` 作为精细工具首选
  - 测试要求：
    - 明确 path 时优先 `read_open`
    - 明确 range 时优先 `read_extract`
  - 当前实现：
    - `server/src/mcp/harness/exposure.ts` 已把 `read` 从 `agent_intent` / `chat_surface` 暴露面隐藏
    - `server/src/agent/intent/task-capability-selector.ts` 已保证 `read_open` / `read_extract` 优先于 `read`
  - 验证结果：
    - `pnpm --filter @ui-chat-mira/server test -- src/mcp/harness/exposure.test.ts src/agent/intent/task-capability-selector.test.ts`
      - 结果：通过，包含在定向测试集中
    - `pnpm --filter @ui-chat-mira/server typecheck`
      - 结果：通过

- [x] `read_slice` 不作为普通用户意图首选
  - 任务卡：
    - `docs/project-control/tasks/core_tools_T013-read-slice-non-primary-intent.md`
  - 结果标准：
    - `read_slice` 只用于已有结果窗口化
  - 测试要求：
    - 无 sourceId / previousResultId 时不作为首选
  - 当前实现：
    - `server/src/mcp/harness/exposure.ts` 已把 `read_slice` 从 `agent_intent` / `chat_surface` 暴露面隐藏
    - `server/src/agent/intent/node.ts` 已把 `read_slice` 纳入显式目标守卫
  - 验证结果：
    - `pnpm --filter @ui-chat-mira/server test -- src/mcp/harness/exposure.test.ts src/agent/intent/task-capability-selector.test.ts`
      - 结果：通过，包含在定向测试集中
    - `pnpm --filter @ui-chat-mira/server typecheck`
      - 结果：通过

### Web Search

- [x] 搜索结果标准化，provider 失败结构化返回
  - 任务卡：
    - `docs/project-control/tasks/core_tools_T014-web-search-normalized-results-and-provider-errors.md`
  - 结果标准：
    - 上层只消费统一搜索结果结构
    - provider 失败有结构化错误
  - 测试要求：
    - Tavily 结果标准化
    - SearXNG 结果标准化
    - provider 失败结构化返回
  - 当前实现：
    - `server/src/mcp/tools/web-search.tool.ts` 把成功返回统一收口为同一结果结构，不再暴露 provider 专属 `baseUrl`
    - 同文件把 provider 失败归一为结构化错误明细，并在全 provider 失败时挂到统一错误对象的 `errors`
  - 验证结果：
    - `pnpm --filter @ui-chat-mira/server test -- src/mcp/tools/web-search.tool.test.ts`
      - 结果：通过，`14 passed`
    - `pnpm --filter @ui-chat-mira/server typecheck`
      - 结果：当前分支失败
      - 说明：失败点位于 `server/src/mcp/harness/capability-profiles.ts`，是当前分支既有 `actionProfileId` / `actionProfileTitle` 字段类型未对齐，不属于 `T014` 允许改动范围

### Terminal

- [x] 增加 `terminal_execute_command` action profile
  - 任务卡：
    - `docs/project-control/tasks/core_tools_T015-terminal-execute-command-action-profile.md`
  - 结果标准：
    - LLM-facing action profile 存在
    - runtime tool 仍映射到 `terminal_session`
  - 测试要求：
    - action profile 到 runtime tool 的映射正确
  - 当前实现：
    - `server/src/mcp/harness/action-profiles.ts` 已定义 `terminal_execute_command -> terminal_session`
    - diagnostics / capability profiles 现在都会返回 action profile 元数据
  - 验证结果：
    - `pnpm --filter @ui-chat-mira/server test -- src/mcp/harness/action-profiles.test.ts src/mcp/harness/capability-profiles.test.ts src/mcp/harness/capability-diagnostics.test.ts`
      - 结果：通过，包含在定向测试集中
    - `pnpm --filter @ui-chat-mira/server typecheck`
      - 结果：通过

- [x] `terminal_session` 增加 Tool Exposure 风险门禁
  - 任务卡：
    - `C:/Users/Administrator/Downloads/mira-v16-classified-taskcards/01-tool-exposure/task/02-risk-gate-terminal-exposure.md`
  - 结果标准：
    - 文件读取问题不暴露 `terminal_session`
    - 闲聊不暴露 `terminal_session`
    - 明确命令请求可暴露 `terminal_session`，且必须保留 `requiresApproval = true`
    - `sandboxProfile: command` 不可用时，`terminal_session` 不进入 `agent_intent`
    - `chat_surface` 不暴露 Terminal
    - `tools_list` 可保留完整 runtime schema，不等于模型意图暴露
  - 当前实现：
    - `McpCapabilityMetadata` 增加 `sandboxRequired` / `sandboxProfile`
    - `terminal_session` 标记为 `sandboxRequired: true`、`sandboxProfile: command`
    - Harness Tool Exposure 对 `terminal_session` 增加明确命令意图检查、approval 元数据检查、sandbox profile 可用性检查
    - `tools_list` 继续返回 `env` / `attachSessionId` / `sessionMode` 等完整 runtime schema
  - 验证结果：
    - `pnpm --filter @ui-chat-mira/server test -- src/harness/exposure.test.ts`
      - 结果：通过，`13 passed`
    - `pnpm --filter @ui-chat-mira/server test -- src/harness/tool-candidates.test.ts src/harness/capability-profiles.test.ts src/harness/capability-diagnostics.test.ts`
      - 结果：通过，`9 passed`
    - `pnpm --filter @ui-chat-mira/server typecheck`
      - 结果：通过
  - 2026-07-05 回归包补强：
    - `server/src/harness/exposure.test.ts` 增加工具暴露 direct regression pack，覆盖：
      - workspace README 文件内容请求
      - workspace 目录列表
      - workspace 模糊查找
      - `chat_surface` safe domains
      - terminal 明确命令 / 非命令
      - 小聊天
      - external MCP default hidden / `allowExternal=true`
    - `server/src/harness/tool-candidates.test.ts` 补齐 12 类工具暴露 regression pack，逐条断言：
      - `exposedToolIds`
      - `blockedCapabilityIds`
      - `reasons`
      - `toolCandidates` topN
      - `preferredForQuery`
    - `server/src/harness/capability-diagnostics.test.ts` 补 diagnostics 层回归，确认 `allowExternal` / `sandboxProfiles` 能继续透传到候选与诊断输出
  - 2026-07-05 本地验证：
    - `pnpm --filter @ui-chat-mira/server test -- src/harness/exposure.test.ts src/harness/tool-candidates.test.ts src/harness/capability-diagnostics.test.ts`
      - 结果：通过，`3 files`、`60 passed`
    - `pnpm --filter @ui-chat-mira/server exec tsc --noEmit -p tsconfig.json`
      - 结果：通过
    - `pnpm check`
      - 结果：通过

- [x] `terminal_session` / SandboxExecutor 达到 L1 Workspace Sandbox Runner 最小能力
  - 任务卡：
    - `docs/project-control/tasks/T-012-l1-workspace-sandbox-runner.md`
    - `C:/Users/Administrator/Downloads/mira-v16-classified-taskcards/03-sandbox-runtime/task/02-l1-workspace-runner.md`
  - 结果标准：
    - cwd 锁定 workspace，拒绝 `..`、绝对路径和 symlink escape
    - 空 cwd 默认 workspaceRoot
    - env 默认白名单，不透传完整 `process.env`
    - timeout 与 output limit 有执行层硬上限
    - result 包含 status、exitCode、stdoutText、stderrText、durationMs、truncated、violations
    - Windows kill tree 明确标记 best-effort limitation
    - sandbox unavailable / L1 不满足时，`terminal_session` 不进入 `agent_intent`
  - 当前实现：
    - `server/src/sandbox/executor.ts` 补齐 cwd/env/timeout/output/result violations
    - `server/src/mcp/terminal-sessions.ts` 的 persistent PTY 创建路径复用 sandbox cwd/env 入口
    - `server/src/harness/sandbox/index.ts` 将 executor 的 `truncated` / `violations` 回传到 direct result contract
    - `server/src/harness/sandbox/index.ts` 暴露 L1 workspace runner status；`command` profile 只有在所有 L1 requirement 通过时才是 `implemented`
    - `server/src/harness/exposure.test.ts` 覆盖 sandbox unavailable 时不暴露 `terminal_session`，并补 terminal exposure 风险矩阵
  - 验证结果：
    - `pnpm --filter @ui-chat-mira/server test -- src/harness/exposure.test.ts src/mcp/tools/terminal-session.tool.test.ts src/harness/sandbox.test.ts src/harness/sandbox/index.test.ts src/sandbox/executor.test.ts`
      - 结果：通过，`78 passed`
    - `pnpm --filter @ui-chat-mira/server bench:sandbox:direct D:\workspace\rag-demo`
      - 结果：通过，JSON summary 为 `total=8`、`passed=7`、`failed=0`、`notImplemented=1`
    - `pnpm --filter @ui-chat-mira/server exec tsc --noEmit -p tsconfig.json`
      - 结果：通过
    - `pnpm check`
      - 结果：通过

- [x] Sandbox direct result 补齐 artifact/output 合同
  - 任务卡：
    - `docs/project-control/tasks/T-013-sandbox-artifact-output-contract.md`
    - `C:/Users/Administrator/Downloads/mira-v16-classified-taskcards/03-sandbox-runtime/task/03-artifact-output-contract.md`
  - 结果标准：
    - result 包含 `stdoutText` / `stderrText`、`stdoutEncoding` / `stderrEncoding`、`truncated`、`binaryDetected`
    - binary 输出不直接按文本展开
    - 命令生成的 workspace 内文件/目录可显式注册为 artifact
  - 当前实现：
    - `server/src/harness/sandbox/contract.ts` 新增本地产物 artifact 合同与输出编码字段
    - `server/src/sandbox/executor.ts` 增加编码归一、二进制检测和 artifact 注册
    - `server/src/harness/sandbox/index.ts` 把 executor 的编码 / binary / artifact 结果回传到 direct contract
    - `server/src/harness/sandbox/bench/cases.ts` 新增 artifact 注册正向 bench case
  - 验证结果：
    - `pnpm --filter @ui-chat-mira/server test -- src/sandbox/executor.test.ts src/harness/sandbox/index.test.ts`
      - 结果：通过，`31 passed`
    - `pnpm --filter @ui-chat-mira/server bench:sandbox:direct D:\workspace\rag-demo`
      - 结果：通过
    - `pnpm --filter @ui-chat-mira/server exec tsc --noEmit -p tsconfig.json`
      - 结果：通过
    - `pnpm check`
      - 结果：通过

### Edit

- [x] 增加 `edit_create_file` / `edit_overwrite_file` / `edit_replace_block` action profile
  - 任务卡：
    - `docs/project-control/tasks/core_tools_T016-edit-action-profiles.md`
  - 结果标准：
    - 三个 action profile 存在
    - 最终都映射到 `edit_file`
  - 测试要求：
    - action profile 到 runtime tool 的映射正确
  - 当前实现：
    - `server/src/mcp/harness/action-profiles.ts` 已定义三个 Edit action profile，统一映射到 `edit_file`
    - diagnostics / capability profiles 现在都会返回 action profile 元数据
  - 验证结果：
    - `pnpm --filter @ui-chat-mira/server test -- src/mcp/harness/action-profiles.test.ts src/mcp/harness/capability-profiles.test.ts src/mcp/harness/capability-diagnostics.test.ts`
      - 结果：通过，包含在定向测试集中
    - `pnpm --filter @ui-chat-mira/server typecheck`
      - 结果：通过

---

## P3

### Web Search

- [x] `search-results` artifact 保留，但清理敏感字段
  - 任务卡：
    - `docs/project-control/tasks/core_tools_T017-web-search-artifact-sensitive-field-scrubbing.md`
  - 结果标准：
    - artifact 不包含 `apiKey`
    - artifact 不包含 header
    - artifact 不包含环境变量
  - 测试要求：
    - artifact metadata 敏感字段校验
  - 当前实现：
    - `server/src/mcp/tools/web-search.tool.ts` 的 `search-results` artifact metadata 只保留 `query / provider / capabilityId / resultCount`
    - 不再把 `baseUrl`、密钥、header 或环境变量相关字段写入 artifact
  - 验证结果：
    - `pnpm --filter @ui-chat-mira/server test -- src/mcp/tools/web-search.tool.test.ts`
      - 结果：通过，`14 passed`
    - `pnpm --filter @ui-chat-mira/server typecheck`
      - 结果：当前分支失败
      - 说明：失败点位于 `server/src/mcp/harness/capability-profiles.ts`，是当前分支既有 `actionProfileId` / `actionProfileTitle` 字段类型未对齐，不属于 `T017` 允许改动范围

### Observability

- [x] trace span 保留，用于 Debug Panel 观察工具调用链
  - 任务卡：
    - `docs/project-control/tasks/core_tools_T018-observability-trace-debug-panel-contract.md`
  - 结果标准：
    - Trace 查询链继续可用
  - 测试要求：
    - invocation trace 查询正常
  - 当前实现：
    - `server/src/mcp/core/traces.ts` 已为 trace 输出增加 `debugView`
    - `/mcp/invocations/:id/trace` 返回体已携带 `debugView`
  - 验证结果：
    - `pnpm --filter @ui-chat-mira/server test -- src/mcp/core/invocations.test.ts src/mcp/routes.test.ts`
      - 结果：通过，包含在定向测试集中
    - `pnpm --filter @ui-chat-mira/server typecheck`
      - 结果：通过

### Workspace Mutation

- [x] 后续再考虑 Workspace Mutation 能力，不要现在塞进 `edit_file`
  - 任务卡：
    - `docs/project-control/tasks/core_tools_T019-workspace-mutation-boundary-retention.md`
  - 当前处理方式：
    - 先保持边界隔离
    - 不把目录创建 / 删除 / 移动 / 重命名混进 `edit_file`
  - 当前实现：
    - `server/src/mcp/edit/runtime.ts` 明确拒绝目录路径与目录目标，保持 `edit_file` 只承接文件写入/局部替换
    - `server/src/mcp/tools/edit-file.tool.test.ts` 补了 `delete / move` 不支持、目录路径拒绝、目录目标拒绝回归
  - 验证结果：
    - `pnpm --filter @ui-chat-mira/server test -- src/mcp/tools/edit-file.tool.test.ts src/agent/intent/task-capability-selector.test.ts`
      - 结果：通过，`27 passed`
    - `pnpm --filter @ui-chat-mira/server typecheck`
      - 结果：当前分支失败
      - 说明：失败点位于 `server/src/mcp/harness/capability-profiles.ts`，是当前分支既有 `actionProfileId` / `actionProfileTitle` 字段类型未对齐，不属于 `T019` 允许改动范围

---

## 当前备注

- 本台账是执行清单，不是讨论稿。
- 每一项完成后，需要同步：
  - 对应实现
  - 自动化测试
  - 关联文档状态
