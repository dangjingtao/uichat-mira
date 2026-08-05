---
status: current
owner: skill-runtime
last_verified: 2026-08-06
layer: wiki
module: SKILL
feature: SkillSystem
doc_type: current-analysis
canonical: false
related:
  - README.md
  - skill-context-design.md
  - pi-skill-agent-execution.md
  - skill-package-runtime-contract.md
  - skill-discovery-layout-contract.md
---

# 当前 Skill 共性与差异（dev）

> 本文基于 `dev` 分支在 2026-08-06 的代码快照，回答两个问题：当前所有 Skill 共享什么合同；它们真正不同的地方是什么。

## 1. 结论先行

当前 Skill 的**共性不在具体怎么施工，而在统一的治理外壳**：

```text
发现与匹配
→ 渐进式披露
→ 单一 primary Skill
→ 单一 Skill-owned SubAgent
→ Tool / Runtime / Approval 交集
→ Evidence / Artifact / Requirement
→ Parent 统一交付
```

当前 Skill 的**差异主要在执行底座与完成真相源**：

- 有些 Skill 只是对话、判断或创作方法；
- 有些依赖 GitHub 等受治理远程工具；
- 有些依赖 Terminal、staging 和多阶段恢复；
- Office Skill 依赖确定性私有 Runtime；
- `fertility-assessment` 具有专用 Conversation Flow、结构化状态、确定性评分和报告 handoff。

因此，当前系统不是“每个 Skill 都是一套同构状态机”，而是：

```text
统一治理合同
+ 多种执行家族
+ 各自不同的完成标准
```

## 2. 当前盘点口径

### 2.1 Registry 中的 built-in Skill

`server/src/skills/registry.ts` 当前登记 6 个 built-in Skill：

1. `docx`
2. `xlsx`
3. `pdf`
4. `pptx`
5. `github-collaboration`
6. `wechat-article-layout`

### 2.2 分类目录中可发现的 public Skill

当前源码中确认到 6 个分类目录 public Skill：

1. `github-collaboration`
2. `miradocs`
3. `deep-interview`
4. `black-mirror-writer`
5. `product-critic`
6. `fertility-assessment`

`github-collaboration` 同时属于 Registry built-in 与分类目录 public package。按唯一 ID 合并后，本轮涉及 **11 个 Skill 定义**。

> 验证缺口：本轮确认了 `wechat-article-layout` 的 Registry 定义，但未通过 `dev` 内容接口定位到对应 `SKILL.md`。它是否能被 Scanner 实际发现、是否在构建产物中正确打包，需要单独验证，不能只凭 Registry 条目视为已完整可用。

## 3. 当前 Skill 能力矩阵

| Skill | 主要类型 | 核心执行底座 | Workspace | 专用状态流 | 完成真相源 |
| --- | --- | --- | --- | --- | --- |
| `deep-interview` | 对话方法 | SubAgent 对话推理 | 否 | 否 | 用户要求收束后的访谈整理 |
| `black-mirror-writer` | 创作方法 | SubAgent 创作推理 | 否 | 否 | 用户要求的概念、大纲或完整文本 |
| `product-critic` | 判断方法 | SubAgent 产品判断 | 否 | 否 | 明确判断、最大风险、最小下一步 |
| `github-collaboration` | 远程协作 | GitHub 领域工具 | 否 | 否 | 当前远程事实、审批写入、执行后回读 |
| `miradocs` | 多阶段施工 | Read + Terminal + GitHub + staging | 按操作需要 | 无专用 Flow；有 checkpoint / working state | 构建、远程写入、Actions / Pages 与交付验证 |
| `wechat-article-layout` | 内容生成脚本 | Registry 声明的 Python 生成器 / Terminal 路线 | 预计需要输出目录 | 否 | HTML Artifact；当前包路径待验证 |
| `docx` | 文档确定性运行时 | Node / OOXML `office_document` | 是 | 否 | 可读 DOCX、原生批注/修订、非破坏性输出 |
| `xlsx` | 表格确定性运行时 | XML-first + WenShu Runtime | 是 | 否 | Workbook Artifact + 确定性校验 |
| `pdf` | PDF 确定性运行时 | `office_pdf` / WenShu Runtime | 是 | 否 | 可读 PDF 或处理结果 Evidence |
| `pptx` | 演示确定性运行时 | PPTD checker / renderer + `office_presentation` | 是 | 否 | 协议通过、Renderer 成功、PPTX Artifact |
| `fertility-assessment` | 端到端业务流程 | Conversation Flow + TaskModel 归类 + 确定性评分 + 报告 handoff | 非普通文件施工边界 | 是 | 完整 assessment state、评分、行内报告及可选 PDF |

## 4. 所有 Skill 的共性

### 4.1 都是领域能力包，不是 Tool

统一本体是：

```text
Manifest
+ SKILL.md
+ optional Resources
+ optional Execution Manifest
+ optional Runtime requirements
```

Skill 负责告诉 Agent：

- 什么任务应该命中它；
- 领域规则是什么；
- 应采用什么执行顺序；
- 哪些资料按需继续读取；
- 什么算完成。

Skill 本身不等于：

- Tool 注册；
- MCP server；
- 权限授予；
- Runtime 已就绪；
- 必然存在的状态机。

### 4.2 都遵循渐进式披露

统一分层为：

```text
L0 Manifest
→ L1 SKILL.md
→ L2 references / templates / examples / scripts
→ governed execution boundary
```

启动和匹配阶段不应把全部 references、模板和脚本正文塞入上下文。资源目录先被发现，具体内容按当前阶段读取。

### 4.3 同一时刻最多一个 primary Skill

当前自动路由只激活一个 primary Skill。同一任务续轮可以继承最近有效 Skill，但明显换题、取消或命中新 Skill 时必须切换。

这属于 task-context continuity，不等于为每个 Skill 创建持久化 `SkillInstance`。

### 4.4 当前所有可发现 Skill 都归一到一个 SubAgent 执行档案

Scanner / profile 层会为每个可发现 Skill 生成一个 forked SubAgent profile：

```text
mode: forked-agent
engine: pi-agent-core
```

即使 Skill 没声明工具或 Runtime，也仍可得到一个空能力面的 SubAgent；它可以完成纯对话、判断或创作任务。

这里的“一 Skill 一 SubAgent”是**执行所有权边界**，不是要求每个 Skill 都复制同样的内部状态机。

### 4.5 Skill 声明永远不是能力授予

实际可用能力是交集：

```text
Skill declared requirements
∩ environment registered capabilities
∩ current ToolExposure / binding
∩ Policy / Approval
```

因此：

```text
Skill match
!= Tool exposed
!= Runtime ready
!= Permission granted
```

用户上传 Skill 即使在 frontmatter 中声明工具和私有 Runtime，也不会凭 Markdown 获得这些能力。

### 4.6 Parent 与 Skill-owned SubAgent 的职责一致

Parent 始终负责：

- 用户对话与 global goal；
- Skill routing；
- Policy / Approval；
- checkpoint 治理；
- terminal contract；
- 最终 Generate 与交付。

Skill-owned SubAgent 负责：

- task-local planning；
- 局部工具循环；
- observation 与 Evidence coverage；
- repair / retry；
- Artifact construction；
- task-local completion。

禁止 Parent 和 Child 交替抢夺同一个领域施工循环。

### 4.7 都必须以 Completion Criteria 收口

不同 Skill 的完成条件不同，但共同要求是：

- 不把“已经调用”当成“已经完成”；
- 不把模型感觉“应该成功”当成确定性结果；
- 需要 Artifact 的任务必须真正产出 Artifact；
- 需要远程写入的任务必须回读验证；
- 缺少能力、证据或用户输入时必须结构化上抛；
- terminal failure 不进入虚假的成功交付。

### 4.8 都受同一安全边界约束

共同边界包括：

- 不因 Skill 命中扩大 ToolExposure；
- 不绕过审批；
- 不把 SkillRoot、RuntimeRoot 当成用户 Workspace；
- 不允许 nested SubAgent / recursive delegation；
- 已完成的 Artifact / Evidence 不应被 Parent 无意义重做；
- Trace 只能观察，不能成为第二控制平面。

## 5. Skill 的主要差异

## 5.1 差异一：执行家族不同

### A. 规则 / 对话型

包括：

- `deep-interview`
- `black-mirror-writer`
- `product-critic`

特点：

- 没有声明 Tool 和私有 Runtime；
- 不要求 Workspace；
- 主要价值是改变提问、判断或创作方法；
- 完成结果通常是文本或对话收束。

它们证明 Skill 不必等于自动化脚本，也不必为了“像 Agent”而强行引入工具循环。

### B. 受治理远程协作型

代表：`github-collaboration`。

特点：

- 依赖 GitHub 领域工具；
- 当前事实优先于模型记忆；
- 写前读取、写入审批、写后回读；
- 完成依据是远程对象的最终状态、编号、链接和 commit / run 标识。

它的核心不是本地 Artifact，而是远程事实与变更闭环。

### C. 多阶段施工型

代表：`miradocs`。

特点：

- 一个 Skill 内包含 `create_site`、`publish_content`、`maintain_site` 三个 operation；
- 组合 Read、Terminal、GitHub、Actions、Pages；
- GitHub 模式使用受管 staging；
- 需要 checkpoint、恢复、幂等与按阶段取用工具；
- 没有注册专用 Conversation Flow，但明显比普通 Tool loop 更接近长任务工作流。

### D. 确定性私有 Runtime 型

包括：

- `docx`
- `xlsx`
- `pdf`
- `pptx`

共同特点：

- Agent 负责领域规划和合法协议输入；
- 受管 Runtime 负责确定性执行；
- Runtime 不作为 Main Planner 全局工具暴露；
- 不允许模型通过 `terminal_session` 自选 Python、`PYTHONPATH`、pip 或 launcher；
- 成功由 Runtime、checker、renderer 或 deterministic validation 判定。

但四者内部仍不同：

- DOCX：Node / OOXML 原生批注、Track Changes、非破坏性副本；
- XLSX：XML-first、保留复杂 Workbook、公式与确定性校验；
- PDF：结构化 ReportLab 创建及 PDF 原生处理；
- PPTX：Kimi PPTD 多文件 DSL、协议检查与确定性渲染。

### E. 专用 Stateful Business Flow

代表：`fertility-assessment`。

这是当前唯一注册在 `conversationFlowRuntimes` 中的 public Skill。

特点：

- 多轮服务建档与信息收集；
- 结构化 assessment state；
- requirements / interruption；
- 一次最终确认；
- TaskModel 负责证据归类，固定规则负责评分；
- 内部 report handoff 仍属于同一个 public Skill；
- 品牌与评分 Source Profile 有安全降级；
- 完成不是“采访结束”，而是报告交付完成。

它真正需要 reducer / phase / persistent state，而不是为了统一外观给所有 Skill 强塞状态机。

## 5.2 差异二：Workspace 依赖不同

- 纯对话、创作和产品判断：不需要 Workspace；
- GitHub 协作：远程对象为主，`workspaceBound=false`；
- Office：输入输出文件必须绑定真实 Workspace；
- MiraDocs：是否需要 Workspace 取决于 operation，但涉及本地构建时必须使用受管 staging；
- 生育评估：主要状态由专用业务 Runtime 管理，报告 Artifact 是交付阶段，不应套用普通源码施工目录逻辑。

因此 `workspaceBound` 不能只按“Skill 是否会产出文件”粗暴推断，而要按执行底座定义。

## 5.3 差异三：状态强度不同

可以分四档：

```text
无专用状态
  deep-interview / black-mirror-writer / product-critic

任务连续性
  github-collaboration / Office Skills

working state + checkpoint + staged recovery
  miradocs

专用 Conversation Flow + reducer + structured state
  fertility-assessment
```

这四档应继续共存。统一的应该是上抛合同和治理边界，不是内部状态模型。

## 5.4 差异四：完成真相源不同

| 家族 | 完成真相源 |
| --- | --- |
| 对话 / 创作 | 用户目标对应的最终文本与收束状态 |
| 产品判断 | 明确结论、关键风险、最小行动 |
| GitHub | 远程最新事实、审批后的写入、回读状态 |
| MiraDocs | 本地构建、远程文件、CI、Pages、可访问地址 |
| DOCX | OOXML 结构、原生批注/修订、可读 Artifact |
| XLSX | 包结构、公式、确定性校验、Workbook Artifact |
| PDF | Runtime 结果、文档结构、可读 Artifact |
| PPTX | PPTD checker / renderer 与 PPTX Artifact |
| 生育评估 | assessment state、固定评分、Report ViewModel 与交付报告 |

这意味着统一 `completed` 状态可以保留，但不能用一套模糊的 `canAnswer=true` 代替各 Skill 的领域完成判定。

## 5.5 差异五：包复杂度不同

当前包形态跨度很大：

```text
只有 SKILL.md
→ SKILL.md + references
→ SKILL.md + references + templates / examples
→ SKILL.md + scripts / runtime
→ SKILL.md + 专用 TypeScript Runtime / Flow / Renderer
```

Catalog 已能区分 entry、reference、template、example、script、runtime、license 等文件类型，并按需读取详情。这一层不应把“包文件多”误判成“能力更高级”。

## 6. 当前合同漂移与风险

### P0-1：DOCX 的 SKILL.md 仍保留旧叙事

DOCX 文档仍写着“formal Agent integration remains deferred”，并把 Skill Package 描述成尚未正式进入 Agent Skill Runtime。

但当前 `README.md`、Scanner 和 profile 已明确：所有可发现 Skill 都可以归一到 forked SubAgent，DOCX 的 `office_document` binding 也标记为 ready。

这里不是实现缺失，而是文档叙事滞后。应改成：

- 不需要 `SkillInstance` 才能执行；
- 当前已通过统一 SubAgent profile 集成；
- deferred 的只是可选 Stateful Skill Flow，而不是 DOCX Agent 执行本身。

### P0-2：XLSX 的执行合同存在明显漂移

XLSX 的 `SKILL.md` 要求：

- XML-first；
- 不回退到 legacy openpyxl `office_spreadsheet`；
- 使用受管 WenShu Runtime。

但 `profiles.ts` 当前同时声明：

```text
office_spreadsheet           ready
wenshu_xlsx_xml_runtime      pending
```

这会产生两个问题：

1. 文档声称的主执行桥仍是 pending；
2. ready 的 legacy runtime 又被明确禁止作为默认执行路径。

需要尽快决定唯一真相：

- 完成并注册 XML-first runtime binding；或
- 修改 Skill 合同，准确描述当前可用能力与降级边界。

不能继续让“文档完成态”和“Runtime readiness”互相矛盾。

### P0-3：Execution frontmatter 字段命名不统一

当前至少存在：

```text
execution.context
execution.agent
execution.allowedTools

executionContext
agent
allowedTools
```

Scanner 为兼容解析了一部分字段，并对所有 profile 最终强制归一为 `subAgent`，所以某些非 canonical 字段目前“看起来能工作”。

例如：

- GitHub Skill 使用 `executionContext: fork`；
- MiraDocs 声明 `execution.agent: miradocs`，但 profile 最终仍固定为 `subAgent`。

建议只保留 canonical 形式：

```yaml
execution.context: fork
execution.agent: subAgent
execution.allowedTools: ...
execution.runtimeBindings: ...
execution.workspaceBound: ...
```

并通过测试拒绝或显式迁移旧字段，避免作者误以为自定义 agent 名称真的改变了执行引擎。

### P0-4：`wechat-article-layout` 的 Registry 与包发现需要对账

Registry 已将它列为 bundled built-in，并声明 `SKILL.md`、reference 和 Python script；但本轮没有在 `dev` 内容接口中确认对应包路径。

需要验证：

- 源码包是否实际存在；
- Scanner 是否能发现；
- 构建/发布时是否被打包；
- Catalog 文件是否可读取；
- 脚本是否只能通过受治理路径执行。

若包已迁移，应修正 Registry 路径与测试；若尚未落地，不应在产品目录中显示为可用 Skill。

### P1-1：Registry、Scanner、Flow Registry 分别维护不同真相

当前能力盘点必须同时读取：

- built-in Registry；
- 文件系统 Scanner；
- SubAgent profiles；
- Conversation Flow Registry；
- 私有 Runtime binding 状态。

任何单一列表都不能完整回答“这个 Skill 当前到底能不能运行、怎样运行”。

建议生成统一的只读 Capability Matrix，而不是再创建第五份手写清单。

## 7. 建议的统一抽象

不建议把所有 Skill 强行改造成同一种 workflow。更适合当前实现的统一抽象是：

```ts
type SkillCapabilitySummary = {
  id: string;
  origin: "built-in" | "external" | "user";
  executionFamily:
    | "reasoning"
    | "governed-tools"
    | "staged-workflow"
    | "private-runtime"
    | "stateful-flow";
  allowedTools: string[];
  runtimeBindings: Array<{
    id: string;
    status: "ready" | "pending" | "unavailable";
  }>;
  workspaceMode: "none" | "required" | "operation-scoped" | "runtime-owned";
  flowRuntime: "none" | "conversation-flow";
  completionAuthority:
    | "model-output"
    | "remote-readback"
    | "deterministic-runtime"
    | "structured-flow";
};
```

这不是新的控制平面，只是从现有真相源派生的可观测矩阵，用于：

- 产品技能页；
- Debug / Trace；
- smoke tests；
- 文档自动生成；
- 发现合同漂移。

## 8. 推荐处理顺序

### P0：先消除会误导执行的漂移

1. 对齐 XLSX runtime binding 与 XML-first 合同；
2. 更新 DOCX 的旧 “formal integration deferred” 叙事；
3. 统一 Execution frontmatter 字段；
4. 核实并修复 `wechat-article-layout` 的实际包路径和打包状态。

### P1：建立自动生成的 Skill Capability Matrix

矩阵从 Registry、Scanner、profiles、Flow Registry 和 Runtime binding 派生；测试至少锁定：

- 每个可发现 Skill 的唯一 ID；
- origin；
- execution family；
- allowed tools；
- runtime readiness；
- workspace mode；
- flow runtime；
- completion authority。

### P2：再讨论长技能统一协议

未来主动任务、定时任务、自主规划和技能学习器，不应直接塞进现有 `SKILL.md` 语义。更合理的是复用当前治理层，并新增长任务所需的：

- durable schedule / trigger；
- persistent run state；
- checkpoint；
- retry / backoff；
- budget；
- external condition watch；
- human intervention；
- resumable artifact / evidence ledger。

普通内容 Skill、Office Skill 和长任务 Skill 可以共享治理合同，但不必共享同一执行器。

## 9. 最终判断

当前 Skill 系统已经形成了一个相对清楚的共同骨架：

```text
Skill 是领域合同
SubAgent 是局部执行所有者
Harness 是能力与审批边界
Runtime / Tool 是实际施工底座
Evidence / Artifact 是完成依据
Parent 是最终治理与交付者
```

真正需要收紧的不是“让所有 Skill 更像”，而是：

1. 把执行家族显式化；
2. 让 Runtime readiness 与文档陈述一致；
3. 统一 frontmatter 元数据；
4. 用自动矩阵替代散落的手写真相；
5. 只给真正需要的 Skill 引入 Stateful Flow。

一句话概括：**当前技能共享的是治理，不同的是施工。这个方向是对的；眼下最大问题是几处合同与实现已经开始错位。**
