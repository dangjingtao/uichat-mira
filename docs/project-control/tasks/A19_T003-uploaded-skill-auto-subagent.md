# A19_T003 — 用户上传 Skill 自动获得计划并实例化 subAgent

- 状态：READY
- 仓库：`dangjingtao/uichat-mira`
- 基线分支：`dev`
- 施工分支：`feature/subagent-skill-runtime-v1`
- 类型：Skill 安装 / subAgent 实例化
- 前置任务：`A19_T001`、`A19_T002`
- 合并顺序：第 3 张

## 背景

用户上传的 Skill 不应再要求开发者手工增加专用 profile、专用 runner 或专用 Main Agent 分支。

产品标准已经确定：

> Skill 是说明书和执行计划；Skill 安装成功后，命中时系统按该说明书 `new SubAgent()` 去完成任务。

自动获得 subAgent 不等于自动获得工具、权限或任意代码执行能力。

## 目标

让通过校验并成功安装的用户 Skill 自动进入统一 Skill Registry，并在任务命中时：

1. 读取 Skill 的身份、适用范围、执行计划和渐进式资源；
2. 自动派生 `SubAgentExecutionProfile`；
3. 动态实例化该 Skill 唯一的 subAgent；
4. 注入 Skill 说明书、已披露资源与已授权能力；
5. 按 A19_T002 发布 Working State 和 append-only Trace；
6. 返回 Evidence、Artifact、Requirement 或明确失败。

全过程不得要求为某个上传 Skill 修改主仓代码。

## 第一版边界

### 必须实现

- 支持现有 Skill Package 安装入口接受用户 Skill。
- 对 `SKILL.md` 和包内资源执行结构、安全与兼容校验。
- 安装成功后注册稳定 SkillDefinition，并进入匹配索引。
- profile 由通用 resolver 动态派生，不维护用户 Skill 手工映射表。
- Skill 的说明书 / 工作方法作为 subAgent 的任务计划与执行约束。
- 用户 Skill 与内置 Skill 走同一 subAgent runner、审批、Evidence、Trace 和 UChat 合同。
- 能力缺失时返回标准 `capability` / `resource` / `user_input` requirement。
- 卸载或禁用 Skill 后不得再匹配或实例化。
- Skill 版本升级必须可识别，运行实例绑定明确版本。

### 非目标

- 不允许 Skill 通过 Markdown 自行注册任意 Tool。
- 不允许上传 Skill 自动获得 shell、Python、网络、GitHub 写入或文件系统权限。
- 不执行 Skill 包中的未知二进制或任意安装脚本。
- 不做在线 Skill 市场、评分、支付或自动更新。
- 不做多 Skill 协同编排。
- 不让 subAgent 继续创建下一级 Agent。
- 不为兼容任意格式而放弃包校验。

## Skill 包最低安装合同

上传 Skill 至少应提供：

```text
<skill-package>/
├─ SKILL.md
├─ references/        # 可选，渐进披露
├─ templates/         # 可选
└─ assets/            # 可选，受大小和类型限制
```

`SKILL.md` 至少包含：

- 稳定 `id`；
- `version`；
- `displayName` / 名称；
- 描述和适用范围；
- 明确的工作方法 / 执行计划；
- Completion Criteria；
- 能力与资源需求说明；
- 失败、缺口和用户输入处理规则。

兼容现有 frontmatter 格式时应做规范化，但不得根据自由文本静默授予能力。

## 自动派生合同

安装阶段：

```text
上传
→ 解包到受管目录
→ 路径/文件类型/大小校验
→ 解析 SKILL.md
→ 规范化 SkillDefinition
→ 校验资源 URI 与引用
→ 记录版本和来源
→ 注册到 Skill Registry / Matcher
```

运行阶段：

```text
用户任务
→ Matcher 选择一个 primary Skill
→ Resolver 派生 SubAgentExecutionProfile
→ 按当前真实授权绑定工具 / Runtime
→ new SubAgent(runId, skillVersion)
→ 注入说明书和渐进资源
→ 执行、发布 Working State / Trace
→ Evidence / Artifact / Requirement / Failure
```

约束：

1. 一个已安装 Skill 只有一个逻辑 subAgent profile。
2. 每次命中创建新的 run 实例，不常驻后台养一个进程。
3. run 必须绑定 `skillId + version`，审批恢复不可静默切换版本。
4. Skill 声明的是需求，不是权限；最终能力以 Harness/Policy/安装状态为准。
5. 上传包不能覆盖内置 Skill、其他用户 Skill 或系统路径。
6. 包内引用必须受安装根目录约束，禁止 traversal、绝对路径和外部任意读取。

## 现有 Skill 规范对齐

本任务可以修订现有 Skill 包作为兼容样本，但必须遵守：

- 先检查现有专业内容是否已经满足合同；
- 只补缺失的身份、计划、边界、Evidence 和 Completion Criteria；
- 不为了模板一致而大面积改写；
- GitHub Skill 已完成，优先作为合格样本，不重做其业务方法；
- 文枢、MiraDocs、备孕等 Skill 的专业逻辑不得被通用安装器稀释；
- 对不合格包给出清晰校验错误，不静默猜测。

## 施工范围

优先检查或修改：

- Skill upload / import / install route
- package scanner / loader / validation
- SkillDefinition normalization
- Skill Registry / matcher index refresh
- SubAgentExecutionProfile resolver
- Skill version binding 与 checkpoint
- 安装目录和资源 URI 边界
- 安装、禁用、卸载后的缓存刷新
- 服务端测试、安装 fixture 与最小 smoke

UChat 只复用 A19_T002 合同，本任务不再次重做展示组件。

## 简单烟测用例

### Smoke 1：上传纯说明书 Skill

准备一个最小测试 Skill：

```text
id: uploaded-summary-review
version: 1.0.0
目标：读取用户提供的文本，按说明书完成结构化审阅。
计划：读取输入 → 检查结构 → 提出问题 → 输出 Evidence。
```

1. 上传并安装。
2. 断言 Registry 出现该 Skill，版本和来源正确。
3. 发起匹配任务。
4. 断言无需修改代码即创建一个 subAgent run。
5. 断言 subAgent 获得说明书和允许的只读能力并完成任务。

### Smoke 2：能力缺失不越权

1. 上传一个声明需要 GitHub 写入的测试 Skill，但不给 GitHub 授权或写工具。
2. 触发任务。
3. 断言 profile 不自动增加 GitHub ToolExposure。
4. 断言 subAgent 返回 capability requirement，而不是伪造完成。

### Smoke 3：恶意包拒绝

分别上传包含以下内容的 fixture：

- `../` 路径引用；
- 绝对路径；
- 未知二进制 / 安装脚本；
- 缺失 id 或 version；
- 重复覆盖已安装 Skill id；
- 超出大小限制的资源。

断言安装失败，错误原因明确，Registry 无残留半安装记录。

### Smoke 4：版本与恢复

1. 安装 Skill `1.0.0`，运行到审批 checkpoint。
2. 安装或准备 `1.1.0`。
3. 恢复旧任务。
4. 断言旧 run 仍绑定 `1.0.0`，不会静默切换说明书。
5. 新任务命中当前启用版本。

### Smoke 5：禁用 / 卸载

1. 安装并成功匹配测试 Skill。
2. 禁用后再次发起同类任务，断言不再匹配。
3. 卸载后断言 Registry、资源索引和 profile resolver 均无残留。

## 验收标准

- 用户 Skill 安装成功后无需改代码即可获得一个逻辑 subAgent。
- Skill 说明书和计划成为 subAgent 的执行依据。
- 动态 profile 不依赖手工 Skill ID 映射。
- 上传 Skill 与内置 Skill 共用统一 runner、Trace、审批、Evidence 和 Artifact 合同。
- 自动实例化不扩大 ToolExposure，不绕过 Policy。
- 包路径、版本、资源、禁用和卸载边界可靠。
- 安装失败不会留下可匹配的半成品。
- 单测、集成测试、smoke、server typecheck 通过。

## 施工红线

1. 不从 SKILL.md 自由文本解析并自动授予工具权限。
2. 不执行任意安装脚本、二进制或未受管 Runtime。
3. 不允许用户 Skill 覆盖系统 Skill 或逃逸安装目录。
4. 不为某个上传 Skill添加 Main Agent / Graph 特判。
5. 不允许一个 Skill 创建多个或嵌套 subAgent。
6. 不把安装成功等同于任务可完成；缺能力必须返回 requirement。
7. 不为“兼容”静默修复严重缺失的 Skill 说明书。
8. 如现有安装合同不足，先记录合同缺口，不绕开校验。

## 交付要求

完成后提供：

- 支持的 Skill 包格式与示例；
- 安装校验错误清单；
- 自动 profile 派生说明；
- 权限与能力绑定说明；
- 版本、禁用、卸载和恢复测试结果；
- 一个可重复执行的上传 Skill smoke fixture；
- 一个聚焦提交，不夹带 Skill 市场或无关 UI 功能。
