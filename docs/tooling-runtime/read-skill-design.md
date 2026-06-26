# Read 能力设计

Status: Current
Owner: runtime
Last verified: 2026-06-26
Layer: raw-source
Module: tooling-runtime
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
