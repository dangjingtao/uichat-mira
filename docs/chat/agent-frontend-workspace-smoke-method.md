## Agent Frontend Workspace Smoke Method

Status: Current
Owner: chat / runtime
Last verified: 2026-07-04
Layer: wiki
Module: Chat
Feature: AgentWorkspaceBinding
Doc Type: runbook
Canonical: false
Related:
  - README.md
  - agent-runtime-design.md
  - agent-workspace-context-system.md
  - agent-workspace-context-checklist.md
  - ../project-control/tasks/agent_node_T011-workspace-path-argument-contract.md

## 这篇文档解决什么问题

这篇文档只讲一件事:

- 怎么做智能体前台 smoke，才能真的验证线程已经绑定到目标 workspace

它专门避免两类误判:

- 只是在左侧栏点中了某个 workspace，就误以为线程已经绑定
- 直接调后端接口建线程，就误以为已经覆盖了前台真实绑定流程

## 结论先说

做前台 Agent workspace 测试时，必须使用当前线程输入框左侧的 `+` 弹框，把线程加入目标 workspace。

只做下面这些动作，都不能当作线程 workspace 绑定已经成立的证据:

- 只在左侧栏选中某个 workspace
- 只看到线程挂在某个 workspace 分组下
- 直接通过 API 建线程

真实绑定成功以后，当前线程里的 `Agent` 按钮会从禁用态恢复为可点击态。

## 标准前置条件

开始 smoke 前，先确认:

1. 前台已经打开聊天页 `/#/chat`
2. 目标 workspace 已存在
3. 你知道目标 workspace 的真实根路径
4. 本次测试的问题只针对一个 workspace，不混用多个 workspace

推荐使用一个独立、非默认、不会和历史污染路径混淆的目录作为 smoke workspace，例如:

- workspace 名称: `CODEX TEST FOLDER`
- workspace 根路径: `D:\CODEX_TEST_FOLDER`

这个目录适合做前台 smoke 的原因:

- 不是运行态默认路径
- 不会和旧的 `D:\testData` 污染证据混在一起
- 里面可以自由新增、修改、删除测试文件
- 适合验证 `read_list`、`read_open`、`cwd` / `terminal_session` 等场景

## 正确操作路径

### 1. 新建真实前台线程

在聊天页创建一条新对话。

这一步只是在前台拿到一个线程草稿，还没有证明它已经绑定 workspace。

### 2. 使用输入框左侧 `+` 绑定 workspace

不要把左侧栏 workspace 选中状态当成绑定完成。

必须在当前线程主区里操作:

1. 点击输入框左侧 `+`
2. 打开 `Workspace`
3. 点击 `Add to workspace`
4. 在弹框里选择目标条目

正确的目标条目应该同时包含:

- workspace 名称
- workspace 根路径

例如:

- `CODEX TEST FOLDER  D:\CODEX_TEST_FOLDER`

### 3. 用 Agent 按钮状态确认绑定成功

绑定前常见状态:

- `Agent` 按钮禁用
- hover 或 title 提示为 `请先绑定工作空间，再使用 Agent。`

绑定后应该变成:

- `Agent` 按钮可点击
- 可以切换到智能体模式

这一步是前台绑定是否成立的第一条强证据。

### 4. 再开启 Agent 做 smoke

只有在线程已经绑定成功后，才开始问真实 smoke 问题，例如:

1. `看看当前 workspace 有哪些文件`
2. `打开 README.md 看看内容`
3. `看看 README.md 的内容`

## 推荐 smoke 观察点

### 必看 1: 有没有卡在 workspace approval

正常情况下，workspace 内的读工具不应该因为路径审批卡住。

如果 trace 里再次出现下面这类提示，就说明前台绑定或 workspace 传递链还有问题:

- `requests path outside the current workspace root`

### 必看 2: 有没有进入 ToolNode

前台 trace 至少要看到这条链路继续往后走:

- `工具调用规范化`
- `审批策略`
- `工具执行`
- `证据写回`
- `组织最终回答`
- `检查结果`

如果工具停在审批等待，不能算 smoke 通过。

### 必看 3: 最终回答是不是基于真实目标 workspace

最终回答里的目录、文件、README 内容，必须来自目标 workspace，而不是当前仓库根或别的 workspace。

最简单的确认方法:

- 问文件列表
- 问 `README.md`
- 看回答里的路径和内容是否属于目标 workspace

## 不合格的测试方法

下面这些方法不要再当成前台 workspace smoke 证据:

### 只选左侧 workspace

只点左侧某个 workspace，不等于线程已绑定这个 workspace。

### 只看线程显示在哪个分组

线程显示在某个 workspace 分组下面，只能说明 UI 归类结果，不足以证明 Agent runtime 已经拿到正确 workspace root。

### 直接打后端接口建线程

API 建线程可以用来测后端链路，但不能替代前台真实绑定流程验证。

## 2026-07-04 这次手测得到的关键经验

这次前台实测确认了两件事:

1. 输入框左侧 `+ -> Workspace -> Add to workspace` 才是线程绑定 workspace 的有效入口
2. `Agent` 按钮从禁用变为可点击，可以作为前台绑定成立的直接信号

这次修复前暴露过一个真实缺陷:

- 线程前台已绑定到目标 workspace 后，Agent 最终回答仍然可能识别成别的 workspace root

这说明前台线程绑定成功，不自动等于后端 Agent runtime 已经消费了同一个 workspace root。

同时也确认过一类运行态污染问题:

- 历史上的 `D:\testData` 不能再当作前台 smoke 证明路径
- 如果运行态有默认 workspace root 注入，线程即使已绑定，结果也可能被污染
- 所以前台 smoke 必须优先使用像 `D:\CODEX_TEST_FOLDER` 这种非默认、独立目录

所以 smoke 验收不能只看:

- `Agent` 按钮是否可点
- trace 是否进入 `工具执行`

还必须继续核对:

- 最终回答引用的 workspace 路径
- 最终回答读取的真实文件内容

如果目标 workspace 本身没有 `README.md`，不要为了凑问题去换成仓库根目录的 `README.md`。应当改问当前 workspace 里真实存在的文件。

例如对 `D:\CODEX_TEST_FOLDER`:

- 可以先手工放一个 `README.md`
- 或放一个唯一文件，例如 `ONLY_CODEX_TEST_FOLDER.txt`
- 再分别做：
  - `看看当前 workspace 有哪些文件`
  - `打开 README.md 看看内容`
  - `执行 dir 命令看看结果`

## 最小验收模板

每次前台 smoke 后，至少记录下面这些事实:

1. 目标 workspace 名称和根路径
2. 是否通过输入框左侧 `+` 弹框完成绑定
3. 绑定前后 `Agent` 按钮状态变化
4. trace 是否进入 `工具执行` 和 `证据写回`
5. 是否出现 workspace approval
6. 最终回答实际引用的是哪个 workspace 路径
7. `README.md` 实际读到的是哪个 workspace 的内容

## 一句话规则

前台智能体测试里，线程 workspace 绑定的单点真相不是左侧栏，而是当前线程输入框左侧 `+` 弹框里的 `Add to workspace` 流程。
