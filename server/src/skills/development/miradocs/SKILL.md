---
id: miradocs
displayName: MiraDocs 建站与内容发布
description: "帮助用户创建 MiraDocs 站点、发布博客或文档，并维护已有站点。"
version: 0.1.0
category: development
visibility: public
source: Mira
status: review
---

# MiraDocs Skill V1

这是 MiraDocs 的 canonical Base Skill。

它只回答一件事：用户想创建、发布或维护 MiraDocs 站点时，Mira 应该收集哪些信息、怎样施工、怎样验证结果。

它不是 Tool，不注册能力，不扩大 `state.toolExposure`，也不重新实现 GitHub API。实际读取、写入、构建和远程操作仍由当前 Harness 已暴露的能力完成。

# 一个 Skill，三个操作

```text
create_site
  创建一个新的 MiraDocs 站点

publish_content
  发布或更新博客、文档

maintain_site
  修改、诊断、升级或迁移已有站点
```

三个操作共享同一个站点目标、仓库上下文、审批、构建和交付格式，因此不拆成三个 Skill。

用户不需要选择菜单。根据自然语言判断当前操作：

```text
“帮我建一个文档站”
→ create_site

“把这篇文章发成博客”
→ publish_content

“把首页标题改成 Tomz Lab”
→ maintain_site
```

确实无法判断时，只问：

```text
你是要创建新站，还是修改已有站点？
```

# 对话原则

## 1. 参数分四类

```text
blocking
  缺失后无法安全施工，必须询问

inferable
  可从用户表达、当前会话、文件或仓库推断

defaultable
  可采用稳定默认值，并在施工草案中展示

deferred
  不阻塞当前任务，后续随时补充
```

禁止把 Logo、主色、域名、统计、评论和社交链接逐项盘问用户。

## 2. 一次询问一组关联信息

建站信息不足时，一次收集：

```text
网站名
创建位置：本地 / 新 GitHub 仓库 / 已有仓库
风格：默认简洁 / 技术文档 / 个人博客
```

不要把它拆成十轮问答。

## 3. 施工前展示草案

参数足够后，先给用户一份短而具体的草案：

```text
网站名：Tomz Lab
位置：新建 dangjingtao/tomz-lab
内容：文档 + 博客
风格：默认简洁
部署：暂不部署
```

草案用于纠正参数，不替代 Harness、GitHub 或其他执行能力的审批合同。

## 4. 不重复询问

用户已明确的网站名、路径、仓库、内容类型、风格和部署方式不得再次询问。

同一任务的自然续轮继承最近明确的目标站点。例如建站后用户说“再把这篇文章发上去”，继续使用刚创建的站点；这属于 Base Skill task-context continuation，不创建 SkillInstance 或新状态机。

已有站点的真实配置必须重新从当前文件和远程状态读取，不能让会话记忆覆盖仓库事实。

# 操作路由

## A. 创建站点

适用于：

```text
帮我建一个 MiraDocs 站
做一个个人博客
给这个仓库初始化文档站
先在本地搭起来看看
```

按需读取：

```text
skill://miradocs/references/create-site.md
skill://miradocs/templates/site-draft.md
skill://miradocs/examples/conversations.md
```

安全默认：

```yaml
contentMode: docs_and_blog
appearancePreset: minimal
deployment: none
```

新 GitHub 仓库的公开或私有不可默认，必须询问。已有非空仓库必须先读取并展示影响，不能直接覆盖。

新 GitHub 站点在能力真实暴露时使用：

```text
github_repository.create
github_repository.ensure_installation_access
github_repository.get_pages
github_repository.configure_pages
```

有能力且用户目标需要，就执行完整闭环；不得因为产品策略而把已存在的能力描述为不可用。每个远程写入仍须走现有审批和回读合同。

## B. 发布博客或文档

适用于：

```text
把这篇文章发成博客
把这个 Markdown 放到文档站
帮我写一篇更新说明并发布
把现有文档改一下重新上线
```

博客和文档是同一个发布操作，不拆 Skill。

按需读取：

```text
skill://miradocs/references/publish-content.md
skill://miradocs/examples/conversations.md
```

目标站点、内容来源和内容类型是关键参数。标题、摘要、slug、日期、分类和作者优先从正文、用户表达与现有站点约定推断；不要让用户填写完整 frontmatter 表单。

## C. 维护已有站点

适用于：

```text
改站点名称、描述、主题或导航
修改、下线或删除内容
修复内容未发现、链接失效、构建或部署失败
升级 MiraDocs
迁移已有内容
配置 GitHub Pages 或域名
```

按需读取：

```text
skill://miradocs/references/maintain-site.md
skill://miradocs/examples/conversations.md
```

维护前先读取当前状态。删除内容、更换永久链接、覆盖已有文件、修改部署工作流、替换域名和批量迁移属于破坏性操作，必须展示精确对象与影响。

# 执行边界

MiraDocs Skill 负责：

```text
识别三个操作
归一化参数
判断何时追问
生成施工草案
规定执行顺序
规定完成标准
```

实际执行复用现有能力：

| 任务 | 能力 |
| --- | --- |
| 读取站点、配置和内容 | Harness Read |
| 修改本地文件 | `edit_file` |
| 安装、检查、构建和本地预览 | `terminal_session` |
| 查询当前公共文档 | `web_search` |
| 已有仓库、分支、文件、PR、Actions | 现有 GitHub 领域工具与 `github-collaboration` Skill |
| 创建 GitHub 仓库 | `github_repository.create` |
| 检查新仓库授权 | `github_repository.ensure_installation_access` |
| 读取 Pages 状态 | `github_repository.get_pages` |
| 启用或修改 Pages | `github_repository.configure_pages` |

Skill 命中不代表工具已经进入本轮 ToolExposure。Planner 只能使用当前真实暴露并通过 Policy 的能力；但已经真实暴露的能力，不应被 Skill 人为回避。

# 交付格式

每次施工后尽量返回：

```text
目标站点
本次变更
写入位置
验证结果
可访问地址
commit / PR / CI / 部署状态
未完成项或需要用户决定的事项
```

不得用底层 JSON 代替用户可理解的结果。

# 失败与恢复

每个已完成的远程动作都是可回读 checkpoint。后续步骤失败时，不撤销已经正确完成的仓库、分支、文件或 PR，也不重复执行不可幂等动作。

```text
仓库创建成功，但 installation 未授权
→ 返回已创建仓库的名称与地址
→ 停止后续仓库写入
→ 用户授权后先重新读取仓库和 installation 状态
→ 从 ensure_installation_access 继续，禁止再次 create

站点文件已写入，但安装、类型检查或构建失败
→ 保留施工分支与已写入文件
→ 返回失败命令、错误层和可核验路径
→ 不配置 Pages，不声称站点可发布
→ 修复后从失败验证层继续

PR 已创建，但 Actions 失败
→ 保留 PR
→ 读取失败 run、job、step 和必要日志
→ 在同一施工分支修复并重新验证

内容和 PR 已完成，但 Pages 配置失败
→ 保留仓库、分支、内容和 PR
→ 先调用 get_pages 回读当前远程事实
→ 只重试未完成的 Pages 配置
→ 不重复写内容或重新创建仓库
```

交付时把每一步标成：`completed`、`blocked`、`failed` 或 `not_run`。恢复前必须重新读取远程状态，不能只依赖上一轮摘要。

# Hard Rules

1. V1 只做创建站点、发布博客或文档、维护已有站点。
2. 不加入项目、里程碑、任务、决策或风险产品模型。
3. 不把一个 Skill 拆成三个 Skill，也不要求用户先选菜单。
4. 不注册新 Tool，不扩大 ToolExposure，不复制 GitHub API。
5. 不修改 Main Agent、Planner、Agent Graph、Harness 审批或 C contract。
6. 修改前读取当前事实；写入后回读文件与相关构建、路由、CI 或部署结果。
7. 默认使用独立分支和 PR，不直接写目标主分支。
8. `deployment: none` 是安全默认；没有用户要求不得自动上线。
9. 新 GitHub 仓库可见性必须询问，不默认公开。
10. 已有非空仓库未经读取和明确确认不得覆盖。
11. 不覆盖同名内容，不擅自改变已有 slug、永久链接、作者、日期或用户正文语气。
12. 未验证的步骤必须标记为缺口，不得冒充成功。
13. 当前环境已暴露且用户目标需要的 GitHub 能力应实际调用，不得用“V1 暂不做”替代能力执行。
14. 新仓库创建后必须检查 installation 授权；Pages 配置后必须回读最终状态和 URL。
15. 恢复任务时先回读 checkpoint，禁止重复创建仓库、重复发布同一内容或重复执行已完成的远程写入。

# Completion Criteria

任务只有在以下条件满足时才算完成：

- 当前操作和目标站点明确；
- 阻塞参数已收齐，默认值与推断值已向用户展示；
- 施工前读取了目标位置、仓库或现有站点事实；
- 写入通过现有审批路径完成；
- 修改后的文件已回读；
- 新 GitHub 仓库已回读创建结果并检查 installation 授权；
- 与任务相关的内容发现、类型检查、构建、路由、CI 或部署验证结果明确；
- 用户要求 Pages 上线时，Pages 最终状态和 URL 已回读；
- 用户获得路径、地址、分支、commit、PR 或远程状态等可核验证据；
- 失败步骤、剩余配置和需要人工决定的事项被清楚列出；
- 恢复执行没有重复已完成的不可幂等动作；
- 没有越过 V1 范围或重写现有 Agent 与工具合同。