# Read 能力设计

Status: Current
Owner: runtime
Last verified: 2026-06-26
Layer: raw-source
Module: Tool
Feature: ReadSkill
Doc Type: design

## 当前实现状态

`Read` 现在不是纯设计草案了。

截至 `2026-06-25`，第一阶段的前后端主链已经打通：

- 后端已注册并可调用：
  - `read_list`
  - `read_locate`
  - `read_open`
  - `read_extract`
  - `read_slice`
  - `read` 兼容入口
- 以上能力都已接入 harness invocation 与 SSE 事件流
- `pdf / docx / pptx / xlsx` 已有可运行的读取路径
- 前端 Tools workbench 已能：
  - 切到 `Read` 域
  - 选择 `read_*` 工具
  - 配置参数
  - 手动执行
  - 查看执行流

当前代码与测试状态：

- `pnpm --filter @ui-chat-mira/server typecheck` 通过
- `pnpm --filter @ui-chat-mira/server test` 通过

这意味着：

- `Read` 第一阶段实现：已完成
- `Read` 最终产品化交付：未完成

未完成的部分主要仍包括：

- chat / agent 自动调用链路尚未接入
- approval / sandbox 的完整用户交互尚未产品化
- tools workbench 仍在持续收敛 UI，不是最终工作台形态
- `read_locate` 虽已可用，但后续仍可能继续增强检索能力

## 单点真相范围

这页把当前工具设计范围收窄到一个能力：

- `Read`

它不试图同时定义：

- `edit`
- `web_search`
- `terminal`
- preview execution

目标不是“做一个能读文件的 demo”，而是把 `Read` 做成一个真正可扩、可测、可追踪的 agent subsystem。

这页默认 `Read` 运行在 harness runtime 里，见：

- `harness-runtime-design.md`

相关概念：

- [[CONCEPT_RUNTIME]]
- [[AREA_MAP_RUNTIME]]

## 适合什么时候读

你在这些场景里应该先读这页：

- 想把读取能力做成正式能力而不是 util function
- 想梳理 roots、resources、result contract 的边界
- 准备给文档、表格、二进制摘要、目录读取补统一协议
- 想决定 parser / adapter 应该放在哪层

## 核心定位

`Read` 不是：

- 一堆 parser 库的堆叠
- 单个 `read file` 函数
- 设置页上的一个按钮

`Read` 是：

- 带边界意识的上下文获取能力
- 标准化抽取协议
- 注册到 harness 的可追踪执行面

## 设计原则

1. 用户侧可以简单，系统侧必须严格。
2. 用户看到的是“读这个文件”，但底层边界与契约不能模糊。
3. parser 选择属于 adapter 问题，不是系统中心。
4. 未知格式要可预测降级，不能只靠扩展名报浅层错误。
5. 第一阶段优先稳 contract 与 harness，不优先追求格式铺满。

## 评审结论补充

这页在 `2026-07-02` 补充一轮 `Read` 工具评审结论。

本轮结论不是删工具，而是把 6 个 `Read` 子工具的边界写死，避免后续代码和 selector 逐渐滑坡。

保留的工具集合：

- `read_list`
- `read_locate`
- `read_open`
- `read_extract`
- `read_slice`
- `read`

必须收紧的硬规则：

1. `read` 只能做兼容 / 聚合 / fallback，不要抢精细工具语义。
2. `read_locate` 只返回候选和短 preview，不承担最终阅读。
3. `read_slice` 更适合内部窗口化，不作为普通用户意图首选。
4. `read_open` 必须支持大文件降级，不保证全文一次返回。

额外判断：

- `read_locate` 必须支持内容定位 / 关键词定位。
- 如果 `read_locate` 只能做路径或文件名定位，后续大量“找配置 / 找调用 / 找关键词”的请求会退化到 `terminal` 去做 `rg / grep`，这会造成终端被滥用。

## 子工具语义

### `read_list`

语义：

- 列目录
- 看资源清单
- 建立局部目录感

职责：

- 返回某个路径下的文件 / 目录候选
- 给后续 `read_open` / `read_locate` 提供入口

非职责：

- 深度内容抽取
- 相关性检索
- 文档正文解析

默认约束：

- `recursive = false`
- 必须支持 `maxDepth`
- 必须支持 `maxEntries`
- 建议支持 `ignorePatterns`

### `read_locate`

语义：

- 定位候选目标

职责：

- path / name locate
- 找文件
- 找名字相近的文件
- 找路径
- 找内容关键词命中
- 找代码符号 / 配置项 / 标题位置
- 在大工作区里缩小候选范围

底层实现说明：

- `read_locate` 可以使用 grep / ripgrep / 索引 / embedding 等底层实现
- 但上层语义不是 grep，而是 locate

硬规则：

- `read_locate` 是检索入口，不是最终阅读结果。
- 可以返回短 preview，但 preview 必须短，不能演变成大段正文。
- 返回重点是候选位置，不是最终答案。
- `read_locate` 不负责：
  - 返回大量正文
  - 代替 `read_open` 阅读全文
  - 代替 `read_extract` 抽取完整片段

### `read_open`

语义：

- 打开一个指定资源

职责：

- 在给定明确目标后打开资源本体
- 读取单个文件、文档正文或目录对象的基础内容

硬规则：

- `read_open` 与 `read` 的边界必须写死。
- `read_open` 是精细工具，面向明确目标。
- `read` 是兼容 / 聚合 / fallback，不是首选打开工具。

大文件约束：

- `read_open` 可以打开目标，但不保证始终一次返回全文。
- 对大文件应允许降级到 preview / summary，并明确建议下一步用 `read_extract`。

### `read_extract`

语义：

- 从文件 / 文档源里定点抽取

职责：

- 面向资源本体做局部提取
- 支持 lines / pages / sections / headings 这类范围语义

硬规则：

- `read_extract` 面向文件 / 文档源。
- 不能与 `read_slice` 共享同一种“已有结果切片”语义。

### `read_slice`

语义：

- 对已有文本结果再切片

职责：

- 面向已经产生的文本结果做窗口化
- 适合作为 runtime 内部上下文处理工具

硬规则：

- `read_slice` 不应作为普通用户意图首选工具。
- `read_slice` 必须依赖 `previousResultId` / `sourceArtifactId` / `textRef` 这类已有结果引用。
- `read_slice` 不直接拿 `path` 当入口。

### `read`

语义：

- 统一兼容入口
- 聚合入口
- fallback 入口

职责：

- 供 Harness / 兼容层调度
- 在无法直接选择精细工具时做统一派发

硬规则：

- `read` 不作为第一优先候选。
- Agent / LLM 优先看到精细工具：
  - `read_list`
  - `read_locate`
  - `read_open`
  - `read_extract`
- Harness / 兼容层可以调用 `read`。

如果这条规则不成立，模型会持续偷懒，直接把 `read` 用成“什么都能干”的总入口，最终让其余精细工具失去意义。

## Selector 规则

给模型选工具时：

- 优先暴露 `read_list` / `read_locate` / `read_open` / `read_extract`
- `read` 只作为 fallback / 兼容入口 / 内部聚合入口
- `read_slice` 默认不作为普通用户意图首选

这条规则是能力治理的一部分，不只是 prompt 偏好。

如果 selector 继续把 `read` 放在高优先级，长期一定会退化成：

- 用户：帮我看看 README
- 模型：调用 `read`

这样会直接削弱 `read_open`、`read_extract`、`read_locate` 的存在价值。

## 优先级规则

`Read` 组的内部优先级必须拆成两层：

- 工具选择优先级
- 工具内部执行优先级

二者不能混成一层。

### 工具选择优先级

给 Agent / LLM / selector 的规则：

1. `read` 永远降权，只做 fallback / dispatch。
2. `read_slice` 不作为普通用户意图首选。
3. `read_locate` 优先级高于“泛读”，但低于“明确打开目标”。
4. 底层实现优先级由 Harness 环境决定，不由 tool schema 决定。
5. 明确局部范围优先 `read_extract`。

第 5 条必须写死：

- 如果用户指定行号、页码、section、标题、片段范围，应优先 `read_extract`。
- 不能先走 `read_open` 全量打开，再由模型自己在长文本里找局部。

### 工具内部执行优先级

这层不暴露给模型，而由 Harness / runtime 决定。

例如 `read_locate(mode: "content")` 的底层实现可以是：

- grep / ripgrep
- path scan
- index
- embedding

但对上层来说，它们都仍然属于 `read_locate` 的执行策略，而不是新的工具。

## 范围

当前 `Read` 能力范围建议收敛为：

- root 选择
- authorized root 内的 resource discovery
- read execution
- read traces 与 regression harness

这页明确不管：

- 文件编辑
- shell / terminal 执行
- 网络搜索
- 浏览器自动化
- 超出 read 结果展示需要的重 UI preview 抽象

## 四层模型

### 1. Roots

roots 定义 agent 可见的文件系统边界。

最终架构里，roots 由 harness 持有，`Read` 只消费。

要求：

- 支持 multiple roots
- 用户显式选择 / 授权
- 区分 scope：
  - `read`
  - `write`
  - `debug`
- 不与当前 repo root 强绑定

建议结构：

```ts
type RootSpec = {
  id: string;
  uri: string;
  name: string;
  scopes: {
    read: boolean;
    write: boolean;
    debug: boolean;
  };
  source: "user-selected" | "configured";
};
```

### 2. Resources

resources 是 root 内可发现、可读取的对象。

例如：

- directory
- text file
- structured document
- spreadsheet
- binary file summary

建议结构：

```ts
type ReadResourceSpec = {
  resourceId: string;
  rootId: string;
  path: string;
  kind: "directory" | "file" | "document" | "table" | "binary";
  mimeType?: string;
  sizeBytes?: number;
};
```

### 3. Read Contract

不管底层 adapter 是什么，`Read` 对外都应该只暴露一个标准执行契约。

建议输入：

```ts
type ReadInput = {
  source: {
    kind: "root_path" | "absolute_path";
    rootId?: string;
    value: string;
  };
  mode?: "auto" | "text" | "structured" | "metadata_only";
  options?: {
    maxBytes?: number;
    pageLimit?: number;
    sheetLimit?: number;
    slideLimit?: number;
    includeMetadata?: boolean;
  };
};
```

建议输出：

```ts
type ReadResult = {
  target: {
    path: string;
    name: string;
    mimeType?: string;
    sizeBytes?: number;
  };
  detected: {
    kind: "directory" | "text" | "document" | "table" | "binary" | "unknown";
    format: string;
    confidence?: number;
  };
  content: {
    text?: string;
    entries?: Array<{ name: string; type: "file" | "directory" }>;
    pages?: Array<{ page: number; text: string }>;
    slides?: Array<{ slide: number; text: string }>;
    sheets?: Array<{ name: string; rows: string[][] }>;
    sections?: Array<{ title?: string; text: string }>;
    tables?: Array<{ name: string; rows: string[][] }>;
  };
  metadata: Record<string, unknown>;
  warnings?: string[];
};
```

## 子工具协议约束

上面的统一 `ReadContract` 只适合描述总能力，不足以约束每个子工具的边界。

为了避免 `read_locate` 滑向“全文搜索 + 阅读”，以及 `read_extract` / `read_slice` 在 schema 上重新混掉，本页补充下面这些子协议约束。

### `read_locate` 结果约束

建议结果：

```ts
type ReadLocateResult = {
  candidates: Array<{
    path: string;
    kind: "file" | "directory" | "section" | "page" | "symbol";
    score?: number;
    reason?: string;
    preview?: string;
    location?: {
      lineStart?: number;
      lineEnd?: number;
      page?: number;
      section?: string;
    };
  }>;
};
```

规则：

- `preview` 可以有，但必须短。
- `read_locate` 负责定位，不负责回答。
- 如果 locate 结果需要正文，下一步应由 `read_open` 或 `read_extract` 接手。

### `read_extract` 输入约束

建议输入：

```ts
type ReadExtractInput = {
  path: string;
  range: {
    lines?: [number, number];
    pages?: [number, number];
    section?: string;
    heading?: string;
  };
};
```

规则：

- `read_extract` 面向文件 / 文档源。
- 它以 path / resource 为主入口。

### `read_slice` 输入约束

建议输入：

```ts
type ReadSliceInput = {
  sourceId: string;
  offset?: number;
  limit?: number;
  strategy?: "head" | "tail" | "window" | "around_match";
};
```

规则：

- `read_slice` 面向已经产生的文本结果。
- 它必须依赖 `sourceId` / `previousResultId` / `textRef` 一类结果引用。
- 如果 `read_slice` 的 schema 重新回到 `{ path, start, end }`，它会和 `read_extract` 再次混掉。

### `read_open` 结果约束

建议结果：

```ts
type ReadOpenResult =
  | {
      mode: "full";
      path: string;
      content: string;
    }
  | {
      mode: "summary_or_preview";
      path: string;
      preview: string;
      totalSize: number;
      continuation: {
        canExtract: true;
        recommendedTool: "read_extract";
      };
    };
```

规则：

- `read_open` 可以“打开”，但不保证一次性返回全文。
- 对超大文件或超长文本，必须允许降级，并明确下一步工具建议。

### 4. Harness Integration

harness 不是 `Read` 的附属模块，反过来，`Read` 是接入 harness 的能力。

最低要求：

- invocation trace
- parser / fallback spans
- fixture corpus
- golden output assertion
- deterministic failure taxonomy

建议结构：

```ts
type ReadHarnessSpec = {
  trace: boolean;
  validator: boolean;
  fixtureSet: string;
  parserSpans: boolean;
  fallbackPolicy: "strict" | "probe" | "summary";
};
```

## 执行策略

`Read` 应该优先走 strategy selection，而不是把扩展名白名单硬编码一地。

也就是说，不要把系统写成：

- 遇到这个扩展名就走 A
- 另一个扩展名就走 B
- 到处散着 `if / else`

更好的方式是：

- 由注册好的 strategy 链决定优先级
- 由 harness / runtime 环境决定当前哪条路径最适合

### Tier 1：纯文本快速路径

当目标明显是文本时，直接走 text read。

例如：

- `.txt`
- `.md`
- `.json`
- `.yaml`
- `.xml`
- `.log`
- 源码文件
- 配置文件

### Tier 2：结构化抽取

真正需要时才启用专用 adapter。

例如：

- `pdf`
- `docx`
- `pptx`
- `xlsx`

### Tier 3：探测与降级

对未知扩展名：

- 先 inspect bytes
- 判断更像 text 还是 binary
- 若像 text，则按 text 读取
- 若像 binary，则返回 binary summary

## Strategy Chain 模型

`Read` 最终应该实现成 strategy chain，而不是散落在代码里的硬编码分支。

建议结构：

```ts
type ReadStrategy = {
  id: string;
  kind:
    | "node_text"
    | "node_structured"
    | "external_command"
    | "binary_summary";
  supports: (input: ReadInput, env: HarnessRuntimeEnvironment) => boolean;
  priority: (input: ReadInput, env: HarnessRuntimeEnvironment) => number;
  execute: (input: ReadInput, context: ReadExecutionContext) => Promise<ReadResult>;
};
```

harness / runtime 应负责：

- 收集已注册 read strategies
- 检查当前环境
- 排序 candidate strategies
- 执行最高优先级且允许的路径
- 在 policy 允许时回退到下一条 strategy

### 为什么 strategy chain 很重要

正确的 read 路径依赖当前环境：

- 可用库
- 可用系统工具
- host 类型
- sandbox 限制
- root permission
- 文件大小 / 格式 / 编码线索

所以决定权应该来自：

- strategy registry
- harness runtime environment

而不是来自零散分支。

### 当前方向

在现有代码里，Node API 仍然是第一阶段最稳的默认实现路径，因为它最可控、最贴近边界模型。

但它应该只是 strategy chain 里的一条，而不是永久架构中心。

## Adapters

adapter 是 read contract 下面的实现细节。

当前或近期需要的 adapter：

- plain text reader
- directory lister
- pdf extractor
- docx extractor
- pptx extractor
- xlsx extractor
- binary summarizer

后续可能再补：

- csv / tsv structured reader
- notebook reader
- code outline reader
- archive reader

## 基础读取之外最值得补什么

如果当前阶段仍专注 `Read`，下一批最值得补的是这些。

### 必补

- multiple roots
- `metadata_only` mode
- structured `csv/tsv` output
- directory metadata：
  - size
  - modified time
  - file type
- 明确的 binary summary contract
- read trace / parser span 模型

### 应该补

- 大文件内容 chunking
- page / slide / sheet limit
- 无扩展名文件探测
- encoding metadata

### 暂时别补

- write 行为
- terminal execution
- search provider
- browser execution
- 与 read 结果无关的重型 preview abstraction

## 测试矩阵

read harness 至少应覆盖：

- plain text file
- large log file
- extensionless text file
- binary file
- directory listing
- `pdf`
- `docx`
- `pptx`
- `xlsx`
- malformed / partially damaged document
- out-of-root access rejection
- missing file
- unsupported-but-readable text file

每次 adapter 变更都要带对应 regression coverage。

## 分阶段计划

### Phase 1

- 单个 active read tool
- root 选择
- directory + text + document + spreadsheet + binary summary
- 标准化 result contract
- unit tests 与 fixture coverage

当前状态：已完成第一阶段主链。

已落地能力：

- `read_list`
- `read_locate`
- `read_open`
- `read_extract`
- `read_slice`
- `read`

已验证内容：

- office 文档读取路径
- invocation / route 链路
- read tool 单元测试
- workspace resource 读取测试

### Phase 2

- multiple roots
- 更丰富 metadata
- structured csv / tsv
- read traces 与 parser spans 暴露到 UI

当前状态：未完成

### Phase 3

- code outline adapter
- notebook adapter
- archive adapter
- 基于稳定 read contract 的 chat / RAG integration

当前状态：未开始

## 当前结论

如果当前工具链继续往前走，最合理的主线仍然是：

- 稳 roots
- 稳 resources
- 稳 read contract
- 稳 harness

不是先去追求“更多扩展名支持”。

补充判断：

- 不应再把 `Read` 描述成“还没做”
- 但也不能把它描述成“已经完整产品化完成”

更准确的表述应该是：

- `Read` 第一阶段能力已经前后端打通并通过测试
- `Read` 仍处于持续产品化阶段
