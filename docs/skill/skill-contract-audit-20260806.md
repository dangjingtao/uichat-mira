---
status: current
owner: skill-runtime / agent-runtime / security
last_verified: 2026-08-06
layer: raw-source
module: SKILL
feature: SkillContractAudit
doc_type: audit
canonical: false
related:
  - README.md
  - skill-authoring-and-governance-contract.md
  - current-skill-commonality-and-differences.md
---

# 当前 Skill 契约审计

## 1. 审计范围

本次依据 `skill-authoring-and-governance-contract.md`，反查以下当前实现：

```text
SkillScanner / SkillRegistry / SkillMatcher / SkillLoader
ExecutionProfile / Skill Worker / Tool adapters
Conversation Flow Registry
built-in Registry
11 个当前已知 Skill 定义
```

审计目标不是要求所有 Skill 长得一样，而是判断：

1. 差异是否有明确责任边界；
2. Markdown 规则是否有 Runtime / Policy / evaluator 支撑；
3. Capability 是否可能越权；
4. completion 是否可能假完成；
5. 当前 execution mode 是否适合该 Skill。

### 严重度

- **P0**：能力越权、错误执行、假完成、公开包不可用或核心模型不成立；
- **P1**：合同漂移、状态丢失、不可维护兼容或高概率行为偏差；
- **P2**：元数据、命名、文档和构建完整性问题。

---

## 2. 总结判断

当前 Skill 系统已经具备：

- package discovery；
- primary matching；
- progressive disclosure；
- bounded Worker；
- private Office adapter；
- exact approval checkpoint；
- 一个真实 Stateful Flow。

但当前最主要的问题不是“Skill 写得不够统一”，而是**把三种不同责任强行统一成一个 forked Worker 外壳**，同时又缺少独立 Capability Grant、route eligibility 和 completion evaluator。

结论：

```text
Base Skill / progressive disclosure：可保留
所有 Skill 一律 fork：应撤回为兼容实现，不应成为目标合同
Office / GitHub delegated worker：方向正确，授权与完成门槛需收紧
Context-only Skills：当前被错误执行
MiraDocs：当前责任超过普通 Worker
Fertility Flow：方向最成熟，但用户对话与高风险校验仍需加强
```

---

## 3. 系统级 P0

### P0-01：External Skill 可借用已知 private Runtime id

代码链：

```text
scanner.ts
external package 保留 declared runtimeBindings

profiles.ts
已知 runtime id -> status=ready

subagent-runtime.ts
ready binding -> createPrivateWenShuRuntimeToolBinding
```

`user` Skill 会被清空 Tool/Runtime，但 `external` 不会。源码侧 public Skill 当前大多属于 `external` origin，因此只要声明 `office_document`、`office_pdf` 等已知 id，理论上就可能获得 private adapter。

这违反：

```text
Package declaration != capability grant
Runtime id known != Skill owns Runtime
```

影响：private Runtime ownership、workspace 文件处理和 side effect 边界。

必须修复：建立独立 Capability Grant Registry，绑定 `skill id + version + publisher/digest`；scanner 只解析 requirement，不授予 Runtime。

---

### P0-02：一律 fork 与 Context-only Skill 的责任冲突

当前 `resolveSubAgentExecutionProfile()` 无条件把所有 Skill 归一为：

```text
mode = forked-agent
context = fork
agent = subAgent
```

但当前 Worker：

- 首次只收到本轮 `goal`；
- final envelope 只有 status / summary / requirements；
- 没有正式 text deliverable 字段；
- completed 后 Parent 直接冻结交付，不再重新施工。

因此：

- `black-mirror-writer` 要求完整草稿时，没有可靠的完整正文交付通道；
- `product-critic` 为一个纯评审方法额外消耗一次模型调用；
- `deep-interview` 依赖上一轮细节，但普通 Worker 没有相关对话历史和非审批 resume state。

这不是“实现风格不同”，而是 execution responsibility 选错。

必须修复：引入 `context-only | delegated-worker | stateful-flow`，前三个纯上下文 Skill 默认回 Parent inline。

---

### P0-03：Child requirement 直接变成用户问题

目标边界应是：

```text
Child returns business requirement
-> Parent judges global relevance
-> Parent writes user-facing question
```

当前 `prepare-context-with-forked-skill.ts` 直接把：

```text
requirement.userPrompt || requirement.description
```

拼成 `nextAction.ask_user.question`。

问题：

- generic Worker 实际可控制用户可见措辞；
- Parent 没有重新判断该缺口是否阻塞 global goal；
- `description` 的协议本义是业务缺口，不一定是自然问题；
- 医疗/隐私等敏感 Skill 缺少最终用户对话层复核。

必须修复：generic requirement 禁止 user-facing prompt；Parent Planner/Dialogue Policy 生成问题。Flow 可提供 suggested prompt，但不能直接控制 UI。

---

### P0-04：Completion 可以被弱证据错误升级

当前存在三类薄弱点：

1. `normalizeMalformedCompletion()`：只要发生过一个 governed Tool call，并存在任意 Evidence 或 Artifact，invalid completion envelope 可以被归一为 `completed`；
2. 只有 ready private Runtime 的 Skill 被强制要求 Evidence/Artifact，GitHub Harness Skill 没有统一 runtime-level completion gate；
3. 无 Tool 的 Context Skill 可以仅凭 model summary 返回 completed，然后 Parent 冻结交付。

“发生过真实调用”不等于“完成用户目标”。inspect/read/intermediate artifact 也可能只是中间步骤。

必须修复：每个 route 绑定 completion evaluator。Malformed envelope 默认只能降为 `insufficient_evidence`，除非 evaluator 独立验证全部 criteria。

---

### P0-05：扁平 Capability 列表无法表达 route readiness

当前 profile 只有：

```text
allowedHarnessToolIds[]
runtimeBindings[]
```

`prepareSubAgent()` 只在“声明了能力且一个都不可用”时阻断。只要有一个 capability ready，就会继续；缺失项不会形成 route-specific eligibility。

直接影响 XLSX：

```text
office_spreadsheet = ready
wenshu_xlsx_xml_runtime = pending
```

CREATE / EDIT / FIX 明确只允许 XML Runtime，但系统看到一个 ready binding 就允许 Worker 启动。当前主要依赖 SKILL.md 自律，缺少 machine gate。

同样影响 MiraDocs / GitHub：不同操作需要不同 Tool 组合，不能用“至少一个 Tool 可用”判断。

必须修复：先路由，再计算 `requiredAll / requiredAny / optional`。

---

### P0-06：Skill id 冲突静默 first-wins

Scanner 使用 `seen`，重复 id 直接跳过后者。优先级依赖 root 与目录读取顺序，且没有冲突诊断。

用户 root 在系统 root 后能降低用户包覆盖风险，但同一系统 root 内的 external package 仍可能声明 built-in id；`readdir()` 顺序不是安全合同。

必须修复：重复 id fail closed；显式 trust / registry 决定优先级。

---

### P0-07：`wechat-article-layout` Registry 与 Package 闭环未成立

Built-in Registry 声明：

```text
wechat-article-layout
SKILL.md
references/dark-mode-mapping.md
scripts/build_wechat_html.py
```

但在当前工作分支的预期 flat 与 canonical category 路径都未取得 `SKILL.md`，此前搜索也未找到生成脚本。

在确认真实 package/build 路径前，该 Skill 属于：

```text
Registry advertised
!= Scanner discoverable
!= build bundled
```

处理：对应 Catalog/Matcher entry 应 blocked，或补齐 package + build smoke + script digest。

---

## 4. 系统级 P1

### P1-01：Frontmatter 不是完整 YAML，但表现得像 YAML

当前 parser：

- 逐行切 `key:value`；
- 不支持真实 nested object；
- list 仅按逗号拆分；
- 未知字段无诊断；
- 无 schema / SemVer / id 校验；
- 多个旧 alias 被静默接受。

例如 XLSX：

```yaml
metadata:
  upstream: ...
  upstreamCommit: ...
```

`metadata` 结构不会进入 Manifest；子字段会被当成无关 flat 字段并丢弃，导致 provenance 在 Catalog/Trace 中不可用。

修复：真实 YAML parser + schema validation + migration diagnostics。

---

### P1-02：公开了不可达或装饰性字段

- `SkillExecutionContextMode = inline | fork`，但 resolver 永远改成 fork；
- `execution.agent: miradocs` 最终仍归一成 product-level subAgent；
- `embedding` 是 MatchSource 枚举，但当前 Matcher 无 embedding path；
- `status: review` 不进入 SkillManifest，也不阻止自动匹配。

原则：正式字段要么实现，要么删除；禁止“写了但无效”。

---

### P1-03：Routing 真相仍硬编码在 Matcher

`SEMANTIC_HINTS` 只为少数 Skill 写在 TypeScript：

```text
docx / xlsx / pdf / pptx / miradocs / fertility-assessment
```

`deep-interview`、`black-mirror-writer`、`product-critic` 没有 package-level intent metadata，只能主要依赖 id / displayName。

这违背 Package 自包含，也使新增 Skill 必须改核心代码。

修复：routing aliases/intents/file hints 移入 Manifest；Matcher 只实现通用算法。

---

### P1-04：Legacy Office profile 会静默补能力

`LEGACY_OFFICE_EXECUTION` 与 Registry / SKILL.md 并存，`resolveExecution()` 采用 union 合并，目的是避免迁移时“能力减少”。

但安全合同应该 fail closed：声明缺失时暴露迁移错误，而不是悄悄补回旧能力。

当前真相分散在：

```text
registry.ts runtimeCapabilities
profiles.ts LEGACY_OFFICE_EXECUTION
SKILL.md narrative
private adapter map
```

修复：集中到 Capability Grant Registry，完成迁移后删除 legacy union。

---

### P1-05：Runtime readiness 是静态标签，不是环境事实

`profiles.ts` 把多个 private binding 硬编码为 `ready`。`prepareSubAgent()` 以该标签和 adapter 构造是否成功作为 available 计数，但没有在 profile resolution 阶段验证 Runtime Pack / module health。

结果：

```text
profile says ready
!= environment ready
```

可能直到 invocation 才失败。

修复：binding declaration、grant、adapter registration、environment health 分层；Trace 显示每层状态。

---

### P1-06：普通 needs_input 没有可靠 Worker resume

Approval 有 transcript checkpoint；模型返回普通 `needs_input` 时没有对应 Worker checkpoint。下一轮通常重新创建 Worker，并只使用新的本轮 goal。

如果产品语义是“继续原 Worker”，当前合同不成立。

修复：

- context-only 交给 Parent continuation；
- delegated Worker 的可恢复 needs_input 增加 checkpointRef；
- stateful 任务使用 Flow session。

---

### P1-07：DOCX 专属业务规则进入通用 Runtime

`subagent-runtime.ts` 内置了“验收报告事实不足”的 DOCX 特判。这让通用 Worker Runtime 开始理解具体文档类型和业务字段。

修复：移入 DOCX route validator / requirement provider，通用 Runtime 只处理统一协议。

---

### P1-08：Package file inventory 与真实 Resource 漂移

Built-in Registry 的 `packageFiles` 没有完整覆盖当前 SKILL.md 引用的资源，例如 PDF TOC reference、PPTX 多个 references。若该字段用于展示、安装或构建，它不是可靠真相。

修复：由 build 扫描 Package boundary 自动生成 inventory + digest；禁止手工维护不完整清单。

---

### P1-09：Script materialization 与执行边界混杂

Worker 可以读取 script resource 并 materialize 到 workspace；Tool 描述又提示“execute that path directly”。这容易诱导 Skill 通过 `terminal_session` 把 package script 当运行时。

这与“Script resource 不是执行许可”冲突，也复现过行内命令/脚本边界混乱。

修复：引入 managed Script Runtime，使用 resource URI + digest + args；通用 Terminal 不作为 package script 默认 launcher。

---

## 5. 逐 Skill 审计

### 5.1 `docx`

目标类型：`delegated-worker`

通过：

- private semantic Runtime；
- 非破坏性副本；
- approval / artifact / readback 思路明确；
- complex run fail-safe。

问题：

- execution requirements 主要依赖 built-in fallback / legacy profile；
- DOCX 专属 acceptance-report 缺口判断写进通用 Runtime；
- legacy merge 可静默补 read capabilities。

结论：**可用，P1 整理**。

---

### 5.2 `xlsx`

目标类型：`delegated-worker`，按 route eligibility。

通过：

- 已明确区分 inspect Runtime 与 XML create/edit Runtime；
- 明确禁止 lossy fallback；
- provenance/license 已写入文件。

问题：

- CREATE / EDIT / FIX 当前 binding pending；
- runtime 仍以扁平 capability 继续执行，不会 machine-block 当前 route；
- Registry 只列 `office_spreadsheet`，legacy profile 再注入 XML pending，真相分裂；
- nested metadata 当前 parser 不保留。

结论：

```text
READ / INSPECT / VERIFY：conditional pass
CREATE / EDIT / FIX：blocked
```

---

### 5.3 `pdf`

目标类型：`delegated-worker`

通过：

- structured create spec；
- native operation 路由；
- create 后提取验证；
- source preservation 与 TOC acceptance 明确。

问题：

- package execution/provenance 依赖 Registry fallback；
- packageFiles inventory 不完整；
- private Runtime grant 受系统级 P0-01 影响；
- 非 create route 的 completion 仍主要依赖 Tool result + prompt hard rules。

结论：**可用，需 grant 与 route completion 收紧**。

---

### 5.4 `pptx`

目标类型：`delegated-worker`

通过：

- protocol-first；
- deterministic validator/renderer；
- artifact completion 清晰；
- references 已细分为按需披露。

问题：

- packageFiles 与实际 references 不一致；
- execution 依赖 fallback；
- source/license/protocol provenance 需要进入可验证 manifest；
- private Runtime grant 受系统级 P0-01 影响。

结论：**可用，P1 治理整理**。

---

### 5.5 `github-collaboration`

目标类型：`delegated-worker`

通过：

- read-before-write；
- exact approval；
- branch-first；
- post-write readback；
- Evidence 规则明确。

问题：

- broad flat Tool list，没有 route-specific requirements；
- Runtime 层没有强制“completed 必须存在远程 Evidence”；
- continuation Worker 只拿本轮 goal；
- built-in Child capability 的授予逻辑与文档所称 parent exposure intersection 不完全一致，需要正式 Grant 模型解释。

结论：**方向正确，但 completion gate 与 grant 必须补齐**。

---

### 5.6 `wechat-article-layout`

目标类型：

```text
delegated-worker
+ managed script runtime
```

问题：

- Registry 有定义，但当前 branch 未验证到 package 文件；
- 当前描述依赖通用 terminal 执行 Python generator，边界过宽；
- 缺 package digest / build smoke / script runtime grant。

结论：**blocked**。

---

### 5.7 `miradocs`

目标类型：`stateful-flow` 或 durable workflow controller。

通过：

- 操作路由清楚；
- 固定建站阶段；
- staging / approval / Pages 验证意识完整；
- 对失败恢复和幂等有真实要求。

越界：

- 当前只是普通 forked Worker，却要求 durable taskKey、阶段 checkpoint、失败续跑和不重复施工；
- generic checkpoint 主要服务 exact approval，不是完整业务 workflow state；
- `status: review` 不影响 public matching；
- `execution.agent: miradocs` 实际被归一为普通 subAgent；
- flat Tool list 无法表达 local/github/create/publish/maintain 的不同能力组合。

结论：**当前 public execution 不应视为 settled；迁移 Flow 前至少 lifecycle=review 且禁自动匹配**。

---

### 5.8 `deep-interview`

目标类型：`context-only`

当前问题：

- 需要完整对话语境和动态追问；
- forked Worker 只接收本轮 goal；
- ordinary needs_input 没有 resume state；
- Child requirement 会直接变成用户问题。

结论：**当前 fork mode 不规范，应回 Parent context-only**。

---

### 5.9 `black-mirror-writer`

目标类型：`context-only`

当前问题：

- 完整草稿是用户回答，不是 Tool Artifact；
- Worker final envelope 没有正式长文本 deliverable；
- Parent 又被禁止重做，形成交付责任断层；
- 额外一次模型调用没有治理收益。

结论：**当前 fork mode 不规范，应回 Parent context-only**。

---

### 5.10 `product-critic`

目标类型：`context-only`

当前问题：

- 纯判断框架，无 Tool / Runtime / Artifact；
- fork 增加延迟和成本；
- Child 不掌握完整产品讨论上下文时，批判质量会下降。

结论：**当前 fork mode 属于过度工程化**。

---

### 5.11 `fertility-assessment`

目标类型：`stateful-flow`

通过：

- 单一 public Skill；
- structured state；
- phase / round / requirements；
- deterministic scoring / report handoff；
- 访谈完成与最终交付分离；
- 隐私与医学边界有明确说明。

问题：

- requirement/userPrompt 当前可直接进入 ask_user，Parent dialogue ownership 不完整；
- high-stakes 关键边界有多少由 Policy/validator 而非 prompt 执行，仍需专项代码审计；
- scoring/source profile 的授权、版本和修改审计需要 machine enforcement 证明；
- built-in Registry 的 `statefulRuntime=deferred` 只描述 built-in，不是系统级 Flow 真相，命名容易误导。

结论：**当前最接近正确的 Stateful Skill；通过但需高风险专项加固**。

---

## 6. 不应当统一的差异

以下差异是合理的，不应强行抹平：

- context-only 没有 Tool / Evidence；
- Office Skill 使用 deterministic private Runtime；
- GitHub 使用 Harness + remote approval/readback；
- Fertility 使用 structured Flow；
- MiraDocs 需要 durable phase/checkpoint；
- PPTX 以 renderer success 为权威，不需要模型二次判图；
- DOCX 对复杂 run 可以拒绝修改；
- XLSX create/edit 可以因 binding pending 而禁用部分路线。

应该统一的是：

```text
身份
路由声明
信任与授权
用户对话所有权
Requirement schema
Workspace
Approval
Completion proof
Trace
```

---

## 7. 建议修复顺序

### 第一批：封边界

1. Capability Grant Registry；
2. external private Runtime deny-by-default；
3. duplicate id fail closed；
4. route-specific eligibility；
5. completion evaluator；
6. needs_input 交回 Parent。

### 第二批：纠正执行类型

1. 恢复 `context-only`；
2. 迁移 black-mirror / product-critic / deep-interview；
3. MiraDocs 标记 review 并设计 durable Flow；
4. 保留 Office/GitHub delegated worker；
5. Fertility 保留 Flow。

### 第三批：清债

1. YAML schema；
2. package routing metadata；
3. 删除 hardcoded semantic map；
4. 删除 legacy Office union；
5. Runtime health truth；
6. package inventory/digest；
7. managed Script Runtime；
8. 删除不可达字段与 aliases。

---

## 8. 本次没有做的事

本审计和规范没有声称以下代码已经修复：

- execution mode 分流；
- Capability Grant Registry；
- Matcher schema 化；
- route evaluator；
- completion evaluator；
- MiraDocs Flow；
- WeChat package 补齐；
- health safety validator。

这些应按 P0/P1 顺序进入实现任务，不能通过继续修改 Markdown 假装完成。
