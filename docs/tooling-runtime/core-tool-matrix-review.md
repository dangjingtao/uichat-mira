# 核心内置工具矩阵评审总结

Status: Current
Owner: runtime
Last verified: 2026-07-02
Layer: raw-source
Module: Tool
Feature: CoreToolMatrix
Doc Type: review

## 评审范围

本轮评审范围为当前内置工具矩阵：

- Read
- Edit
- Web Search
- Terminal

目标不是扩工具数量，而是确认：

- 工具语义是否稳定
- LLM 是否能识别
- selector 是否容易误召回
- policyNode 是否能治理风险
- runtime tool 是否能真正闭环执行

---

## 总体结论

当前内置工具数量基本够用，不建议现在大规模新增真实工具。

当前更大的问题不是“工具不够”，而是：

1. 部分工具对 LLM 来说语义颗粒度偏粗
2. 部分高风险工具输入面太宽
3. capability / action profile / runtime tool 的职责需要进一步分清
4. selector 应该识别“语义动作”，runtime 继续保持少量稳定工具
5. policyNode 必须作为最终执行 gate，而不是替 selector 做语义选择

本轮核心原则：

```txt
细语义，粗执行。
LLM / selector 识别 action profile。
policyNode 校验真实 tool call。
toolNode 执行少量稳定 runtime tool。
```

---

# 一、Read 能力结论

## 当前工具

- `read_list`
- `read_locate`
- `read_open`
- `read_extract`
- `read_slice`
- `read`

## 语义矩阵成立

当前 Read 语义可以收成：

```txt
read_list    = 看范围
read_locate  = 找目标
read_open    = 开目标
read_extract = 取局部
read_slice   = 裁结果
read         = 统一入口
```

整体链路完整：

```txt
看范围 → 找目标 → 开目标 → 抽局部 → 裁结果 → 统一入口
```

## Read 核心治理规则

1. `read` 永远降权  
   只作为 fallback / dispatch / 兼容入口，不作为精细工具选择首选。

2. `read_slice` 不作为普通用户意图首选  
   它用于对已有读取结果进行二次窗口化，不能作为文件系统入口。

3. 明确目标优先于定位，定位优先于泛读  
   - 明确 path / 文件名 / uri：优先 `read_open`
   - 明确行号 / 页码 / section / heading：优先 `read_extract`
   - 模糊目标 / 关键词 / 相似名称：优先 `read_locate`
   - 看目录范围：优先 `read_list`
   - 不明确时：fallback 到 `read`

4. 底层实现优先级由 Harness 环境决定，不由 tool schema 决定  
   Tool schema 描述能力语义，不绑定 grep / embedding / parser / sqlite-vec 等具体实现。

## grep 结论

不新增独立 `read_grep`。

grep / rg / 内容关键词搜索应作为 `read_locate` 的底层实现能力。

建议 `read_locate` 支持：

- path/name locate
- keyword locate
- lightweight content match
- symbol/heading locate

但返回候选位置和短 preview，不承担最终阅读。

---

# 二、Edit 能力结论

## 当前真实工具

- `edit_file`

## 当前操作

- `write_file`
- `replace_block`
- `dryRun`

## 总体判断

`edit_file` 作为底层执行工具够用，不建议现在新增大量真实工具。

但它作为 LLM-facing 语义入口太粗。

用户说：

```txt
帮我新建一个 222.txt 的空文档
```

模型未必能稳定推导成：

```json
{
  "toolId": "edit_file",
  "args": {
    "operation": "write_file",
    "path": "222.txt",
    "content": ""
  }
}
```

所以问题不是底层工具不够，而是 LLM / selector 可识别的动作颗粒度不够。

## 建议增加 action profile，不新增 runtime tool

建议新增三个 LLM-facing action profile：

```txt
edit_create_file
edit_overwrite_file
edit_replace_block
```

它们最终都映射到真实工具：

```txt
edit_file
```

## 映射原则

```txt
edit_create_file
  → edit_file / write_file / content 默认 ""

edit_overwrite_file
  → edit_file / write_file / 覆盖已有内容

edit_replace_block
  → edit_file / replace_block / expectedOldText + newText
```

## Edit 核心治理规则

1. `edit_file` 只处理 workspace 内路径  
   必须禁止路径逃逸、绝对路径越界、符号链接绕过等问题。

2. `write_file` 明确支持创建文件  
   - 文件不存在 + `write_file` = 创建文件
   - 文件存在 + `write_file` = 覆盖写入
   - 文件存在 + `content` 为空 = 清空文件，高风险

3. `content: ""` 是合法值  
   不能把空字符串当成缺失参数，否则无法创建空文件。

4. 覆盖已有文件必须更严格  
   - 目标不存在：低风险，可直接创建
   - 目标存在 + `write_file`：中风险，默认 dryRun 或确认
   - 目标存在 + `content` 为空：高风险，必须确认

5. `replace_block` 必须唯一匹配  
   `expectedOldText` 必须在目标文件中恰好匹配一次。  
   0 次或多次匹配都不能写入。

6. `dryRun` 由 policyNode 强制治理  
   中高风险编辑必须先 dryRun / approval，不能完全相信模型传入的 dryRun。

## 暂不建议纳入 edit_file 的能力

- 创建目录
- 删除文件
- 移动文件
- 重命名文件
- 批量修改
- 二进制文件修改
- 复杂 patch engine

这些以后可以进入 Workspace Mutation 能力，不建议现在混进 `edit_file`。

---

# 三、Web Search 能力结论

## 当前真实工具

- `web_search`

## 当前 provider

- Tavily
- SearXNG

## 总体判断

统一 `web_search` 语义是正确的。

不要拆成：

```txt
tavily_search
searxng_search
bing_search
google_search
```

provider 是 Harness Runtime 的实现细节，不是用户语义。

selector 只判断：

```txt
当前任务是否需要公网搜索
```

不负责判断：

```txt
该用 Tavily 还是 SearXNG
```

## 最大问题

当前输入支持：

```txt
query
maxResults
apiKey
baseUrl
```

其中：

```txt
query       可以暴露给模型
maxResults  可以暴露给模型，但要限幅
apiKey      不应该暴露给模型
baseUrl     不应该暴露给模型随便指定
```

## Web Search 核心治理规则

1. `web_search` 是统一公网搜索能力  
   Tavily / SearXNG 是 Harness Runtime 的实现细节。

2. LLM-facing tool schema 只暴露：
   - `query`
   - `maxResults`

3. `apiKey` / `baseUrl` / `provider` 不允许由模型生成  
   它们只能来自可信 runtime config：
   - trusted runtime override
   - web_search_settings
   - environment variables

4. `baseUrl` 必须来自可信配置或 allowlist  
   禁止模型任意指定，避免 SSRF / 内网探测风险。

5. `maxResults` 必须限幅  
   建议默认 5，最大 10 或 20。

6. 搜索结果必须标准化  
   上层只消费统一结构，不直接依赖 Tavily / SearXNG 原始格式。

7. provider 失败必须结构化返回  
   不允许静默失败，也不允许 generateNode 在无结果时编造答案。

8. search-results artifact 可以保留  
   但不得写入 apiKey、header、环境变量等敏感信息。

---

# 四、Terminal 能力结论

## 当前真实工具

- `terminal_session`

## 当前输入

- `command`
- `cwd`
- `env`
- `timeoutMs`
- `attachSessionId`
- `sessionMode`: `ephemeral` / `persistent`

## 当前语义

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

## 总体判断

`terminal_session` 作为唯一真实 Terminal 工具可以保留。

Terminal 不缺能力，问题是能力太强、输入面太宽，需要强治理。

## LLM-facing 建议

真实工具名可以继续是：

```txt
terminal_session
```

但建议增加一个 LLM-facing action profile：

```txt
terminal_execute_command
```

它最终映射到：

```txt
terminal_session
```

不要拆出更多普通 LLM-facing 工具，例如：

```txt
terminal_start_session
terminal_attach_session
terminal_stream_output
terminal_abort
```

这些属于 runtime/session 管理语义，不是普通用户动作。

## 字段治理结论

| 字段 | 是否建议暴露给模型 | 结论 |
|---|---:|---|
| `command` | 是 | 核心字段，但必须 approval |
| `cwd` | 可以 | 必须限制在 workspace 内 |
| `timeoutMs` | 可以 | 必须限幅 |
| `env` | 否 | runtime-only 或极窄 allowlist |
| `attachSessionId` | 否 | Harness 根据上下文决定 |
| `sessionMode` | 不建议 | 默认 ephemeral，persistent 走策略判断 |

## Terminal 核心治理规则

1. `terminal_session` 是受控命令执行工具，不是万能业务动作容器。

2. Terminal 默认高风险  
   `requiresApproval = true`。  
   模型生成的 command 只是执行申请，不能直接执行。

3. LLM-facing 输入面只建议暴露：
   - `command`
   - `cwd`
   - `timeoutMs`

4. `env` 不直接暴露给模型  
   环境变量只能来自可信 runtime 配置或受限 allowlist。

5. `attachSessionId` 不直接暴露给模型  
   session 复用由 Harness 根据上下文和用户意图决定。

6. `sessionMode` 不交给模型自由选择  
   默认 ephemeral。  
   persistent 只用于明确长任务、watcher、dev server，且需要用户确认或 policyNode 批准。

7. `cwd` 必须 workspaceBound  
   所有 cwd 解析后必须在 workspaceRoot 内。

8. `timeoutMs` 必须限幅  
   防止模型创建无限长任务或过长阻塞。

9. Terminal 不能抢 Read / Edit / Web Search 的任务  
   - 读文件优先 Read
   - 改文件优先 Edit
   - 搜公网优先 Web Search
   - Terminal 只用于明确命令执行、测试、构建、脚本、git/npm/pnpm/node/python 等任务。

## approval 现状结论

当前 approval 只承接到 invocation 状态，还没有完整 thread / session 级持久化 grant。

这个现状可接受，但必须遵守：

```txt
没有 session/thread 级 grant 之前，不允许因为复用 session 就绕过 approval。
```

`attachSessionId` 复用已有 session 不等于自动继承执行权限。

---

# 五、整体架构结论

## 不建议现在做的事

1. 不建议扩大量真实工具
2. 不建议把 provider 拆成多个 search 工具
3. 不建议把 terminal 拆成很多 session 管理工具
4. 不建议让 terminal 作为读写搜的兜底万能工具
5. 不建议把 `apiKey` / `baseUrl` / `env` / `attachSessionId` / `sessionMode` 暴露给模型

## 建议现在做的事

1. 保持真实 runtime tool 数量稳定
2. 在 Edit / Terminal 上方补 LLM-facing action profile
3. 收窄 Web Search / Terminal 的模型输入面
4. 强化 policyNode 对写入、命令、provider 配置的治理
5. 把 Read 的治理规则写入矩阵文档
6. 给 selector 增加高频任务规则，避免误召回

---

# 六、建议后的核心工具矩阵

## Runtime Tool 层

```txt
Read:
- read_list
- read_locate
- read_open
- read_extract
- read_slice
- read

Edit:
- edit_file

Web Search:
- web_search

Terminal:
- terminal_session
```

## LLM-facing Action Profile 层

```txt
Read:
- read_list
- read_locate
- read_open
- read_extract
- read_slice 降权
- read fallback

Edit:
- edit_create_file
- edit_overwrite_file
- edit_replace_block

Web Search:
- web_search

Terminal:
- terminal_execute_command
```

---

# 七、优先级整改列表

## P0

1. `edit_file` 必须限制 workspace 内路径，禁止路径逃逸。
2. `web_search` 的 `apiKey` / `baseUrl` 不允许由模型生成。
3. `terminal_session` 的 `env` / `attachSessionId` / `sessionMode` 不应直接暴露给模型。
4. `terminal_session` 的 `command` 必须 `requiresApproval`。

## P1

1. `write_file` 明确支持创建文件，且 `content: ""` 合法。
2. `write_file` 覆盖已有文件必须 dryRun 或确认。
3. `replace_block` 必须 `expectedOldText` 唯一匹配。
4. `read_locate` 支持内容定位 / 关键词定位，但只返回候选和短 preview。
5. terminal `cwd` 必须 workspaceBound，`timeoutMs` 必须限幅。
6. selector 中“新建 / 创建 / 写入文件”优先命中 Edit，而不是 Terminal。

## P2

1. `read` 降权，只做 fallback / dispatch。
2. `read_slice` 不作为普通用户意图首选。
3. Web Search 结果标准化，provider 失败结构化返回。
4. Terminal 增加 `terminal_execute_command` action profile。
5. Edit 增加 `edit_create_file` / `edit_overwrite_file` / `edit_replace_block` action profile。

## P3

1. search-results artifact 保留，但清理敏感字段。
2. trace span 保留，用于 Debug Panel 观察工具调用链。
3. 后续再考虑 Workspace Mutation 能力，不要现在塞进 `edit_file`。

---

# 八、最终一句话结论

当前核心工具矩阵基本够用，不要急着扩真实工具。

真正要改的是：

```txt
Read：收紧治理规则。
Edit：补细粒度 action profile。
Web Search：收窄模型输入面，provider runtime 化。
Terminal：强治理，别让它变万能兜底。
```

整体原则：

```txt
工具少一点没问题。
语义要清楚。
模型看到的是动作。
runtime 执行的是稳定工具。
policyNode 兜住安全边界。
```
