# A19_T003 — 用户上传 Skill 自动获得计划并实例化 subAgent

- 状态：IMPLEMENTED — VERIFICATION PENDING
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
- 能力缺失时返回标准 `capability` / `resource` / `user_input` Requirement。
- 卸载或禁用 Skill 后不得再匹配或实例化。
- Skill 版本升级必须可识别，运行实例绑定明确版本。
- 用户 Skill 不得覆盖或继承官方 / 外部 Skill 的 id、来源或私有 Runtime。

### 非目标

- 不允许 Skill 通过 Markdown 自行注册任意 Tool。
- 不允许上传 Skill 自动获得 shell、Python、网络、GitHub 写入或文件系统权限。
- 不执行 Skill 包中的未知二进制或任意安装脚本。
- 不做在线 Skill 市场、评分、支付或自动更新。
- 不做多 Skill 协同编排。
- 不让 subAgent 继续创建下一级 Agent。
- 不承诺把任意一段普通提示词自动变成高质量专业 Skill；只补齐最低可执行合同。

## 最低 Skill Package 合同

上传包至少要能规范化为：

```text
<skill-id>/
└─ SKILL.md
```

`SKILL.md` 至少包含或由安装器补齐：

- 稳定 `id`
- SemVer `version`
- 显示名称与描述
- 何时使用 / 不适用范围
- 执行计划或工作方法
- 安全边界
- 完成标准

安装器保留作者原正文，只追加缺失的合同段落，不任意改写专业内容。

## 权限合同

用户 Skill 的 frontmatter 即使声明：

```yaml
allowedTools: terminal_session, github_repository
runtimeBindings: office_document
workspaceBound: true
```

Scanner 仍必须把它规范化为：

```ts
{
  origin: "user",
  execution: {
    context: "fork",
    agent: "subAgent",
    allowedTools: [],
    runtimeBindings: [],
    workspaceBound: false
  }
}
```

后续若产品提供显式受管授权 / binding 流程，可以另行满足能力 Requirement；Markdown 本身永远不是权限来源。

## 安装与注册流程

```text
上传 Markdown
→ 文件大小 / 格式 / SemVer 校验
→ 保留正文并补齐最低执行说明
→ 写入受管 staging 目录
→ 原子 rename 到用户 Skill 根目录
→ Registry invalidate + rescan
→ 进入匹配索引
→ 命中后动态派生 profile
→ new 单一 subAgent
```

安装过程中若失败，不得留下半个可发现包。

## id 与来源隔离

- 用户根目录中的文件永远视为 `origin: user`。
- 即使用户手工放入 `id: docx`，也不得获得 built-in Office fallback Runtime。
- 默认扫描顺序中系统 / 外部 Skill 优先于用户 Skill。
- 导入前检查当前非用户 Skill id；冲突时回滚用户包并拒绝安装。
- 已禁用用户 Skill 在重新启用时若 id 已被系统占用，必须拒绝启用。

## 禁用 / 启用

第一版采用受管目录状态：

```text
<category>/<skill-id>/SKILL.md
→ disable
<category>/.disabled-<skill-id>/SKILL.md
```

Scanner 忽略点目录，因此禁用后不会匹配；启用后恢复同一 id 与版本。

## 简单 Smoke

### Smoke A：纯说明书 Skill

上传：

```markdown
# 决策复盘教练

帮助用户复盘一个产品决策，并找出关键错误假设。
```

检查：

- 作者正文保留；
- 缺失的适用范围、执行计划、安全边界和完成标准被补齐；
- 安装后 Registry 可发现；
- 自动派生唯一 subAgent profile；
- 不需要修改主仓代码。

### Smoke B：恶意权限声明

上传声明 shell、GitHub、Office Runtime 的 Skill。

检查：

- 安装可以作为说明书完成；
- Scanner 输出零工具、零 Runtime、非 workspace-bound；
- 执行时不会获得声明能力；
- 需要能力时返回 Requirement。

### Smoke C：冒充 built-in id

在用户根目录放入 `id: docx` 或通过导入尝试复用官方 Skill id。

检查：

- origin 保持 `user`；
- 不获得 `office_document`；
- 默认 Registry 仍以官方 docx 为准；
- 正常导入入口拒绝冲突并清理刚写入包。

### Smoke D：禁用与恢复

导入一个 `1.2.3` Skill，禁用后再启用。

检查：

- 禁用后不再被 Scanner 发现；
- 不再匹配或实例化；
- 启用后恢复同一 id / version；
- 若 id 在禁用期间变成系统保留 id，则拒绝启用。

### Smoke E：确定性脚本

```bash
pnpm --filter @ui-chat-mira/server smoke:subagent-skill
```

检查输出：

- `automaticProfile: true`
- `unauthorizedToolGrant: false`
- `disableEnableRoundTrip: true`

## 必须覆盖的测试

- 导入保留作者正文并补齐缺失合同。
- 非 SemVer 版本拒绝且不留下目录。
- Markdown 声明不能授予 Tool / Runtime。
- 任意用户 Skill 自动派生一个 profile。
- 用户根目录中的 built-in 同名包保持无权限。
- 禁用后不发现，启用后恢复版本。
- staging 原子写入失败不产生半包。
- 系统 id 冲突导入回滚。
- 卸载或禁用后 Registry / Provider cache 失效。
- checkpoint 绑定明确 Skill id / version。

## 验收标准

- 用户上传 Skill 不需要专用接线代码即可获得唯一 subAgent。
- Skill 说明书成为执行计划，不成为权限来源。
- 用户 Skill 无法覆盖官方 Skill 或继承其 Runtime。
- 禁用、启用、卸载和版本绑定行为明确。
- 同一 Runtime、审批、Evidence、Trace 和 UChat 合同适用于用户 Skill。
- 单测、typecheck 与 smoke 实际通过后才可把本卡改为 DONE。

## 施工红线

1. 不执行未知二进制、安装脚本或任意依赖安装。
2. 不相信上传包声明的 Tool / Runtime 权限。
3. 不允许用户 Skill 抢占官方 id。
4. 不为每个用户 Skill生成专用代码文件或 Registry 映射。
5. 不在 Main Agent / Graph 中增加 Skill id 特判。
6. 不把失败安装留在 Scanner 可发现目录。
7. 不让 subAgent 创建下一级 Agent。

## 实现记录

已落地：

- Markdown 导入大小、SemVer 与空文件校验。
- 保留作者正文，按缺失情况追加最低执行说明。
- staging 写入 + 原子 rename。
- Scanner 自动标记用户来源并派生 subAgent execution manifest。
- 用户声明的 Tool / Runtime / workspace 不授予权限。
- 通用 profile resolver 自动生成唯一 subAgent profile。
- 用户 Skill 与内置 Skill 复用同一 runner、Trace 和 UChat 合同。
- 新增禁用 / 启用服务端路由与桌面 API。
- 禁用目录退出匹配索引，启用恢复原版本。
- 系统 Skill id 冲突导入回滚；重新启用时再次检查。
- 用户根目录 built-in 同名包无法继承 built-in fallback Runtime。
- 增加用户 Skill 权限隔离、禁用恢复和确定性 smoke。

尚未在当前执行环境运行：

- server Vitest
- routes 集成测试
- `smoke:subagent-skill`
- server / desktop typecheck
- `pnpm check`
- 真实 UI 上传、禁用、启用和会话命中 smoke

在上述验证完成前，本卡保持 `IMPLEMENTED — VERIFICATION PENDING`。