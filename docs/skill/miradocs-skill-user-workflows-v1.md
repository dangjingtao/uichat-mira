# MiraDocs Skill V1 用户工作流设计

Status: Draft
Protocol: V1 Proposed
Owner: skill / docs
Last verified: 2026-07-26
Layer: raw-source
Module: SKILL
Feature: MiraDocsSkill
Doc Type: design
Canonical: false
Related:
  - ./README.md
  - ./skill-context-design.md
  - ../harness/agentgraph-harness-protocol.md

## Purpose

这页只定义 MiraDocs Skill V1 面向用户的三个任务：

1. 创建站点；
2. 发布博客或文档；
3. 维护已有站点。

它不设计项目管理、里程碑、决策模型、通用 CMS、第二套 Agent Runtime 或新的 GitHub 工具体系。

核心目标不是让 Skill 看起来能力很多，而是让用户说出日常目标后，Mira 能收齐真实参数、给出可审阅配置、完成施工并返回验证证据。

---

## 1. 一个 Skill，三个操作

MiraDocs V1 只有一个 primary Skill：

```text
miradocs
```

Skill 命中后，将当前任务归入一个操作：

```ts
type MiraDocsOperation =
  | "create_site"
  | "publish_content"
  | "maintain_site"
```

三个操作共享同一个站点目标、仓库上下文、配置读取、写入审批、构建和交付格式，因此不拆成三个 Skill。

用户不需要先选择菜单。Mira 根据自然语言判断操作：

```text
“帮我建个文档站”
→ create_site

“把这篇文章发成博客”
→ publish_content

“首页标题改成 Tomz Lab”
→ maintain_site
```

无法判断时才询问：

```text
你是要创建新站，还是修改已有站点？
```

---

## 2. 对话总原则

### 2.1 先收阻塞参数，不盘问全部选项

参数分为四类：

```text
blocking
  缺失后无法安全施工，必须询问

inferable
  可从用户表达、当前会话、仓库或内容中推断

defaultable
  可采用稳定默认值，并在施工草案中展示

deferred
  不阻塞当前任务，后续随时补充
```

禁止逐项盘问 Logo、域名、作者链接、评论系统、统计代码等非阻塞配置。

### 2.2 一次收一组关联参数

建站时，网站名、创建位置和风格属于同一决策包，可以一次询问：

```text
先给我三项：网站名、创建位置（本地 / 新 GitHub 仓库 / 已有仓库），以及风格（默认简洁 / 技术文档 / 个人博客）。
```

不要拆成连续十轮问答。

### 2.3 施工前展示一份配置草案

当参数足够时，Mira 先归一化为用户可读草案：

```text
网站名：Tomz Lab
位置：新建 dangjingtao/tomz-lab
内容：文档 + 博客
风格：默认简洁
部署：GitHub Pages
自定义域名：暂不配置
```

草案不是新的审批系统。真正的仓库创建、文件写入、部署等操作仍走 Harness / GitHub 能力的现有审批合同。

### 2.4 已经明确的内容不重复询问

用户说：

```text
给我在 dangjingtao/tomz-lab 建一个叫 Tomz Lab 的个人博客，用默认简洁风，先不部署。
```

Mira 不再追问站名、仓库、用途、风格和部署方式，直接生成施工草案。

### 2.5 同一任务自然续轮

用户建站完成后说：

```text
再把这篇文章发上去。
```

应继承当前站点目标，不重新询问仓库。

这属于 Base Skill 的 task-context continuation，不引入 SkillInstance、状态机或新的持久化 Runtime。

---

## 3. 共享任务上下文

MiraDocs Skill 在当前任务中维护轻量上下文：

```ts
type MiraDocsTaskContext = {
  operation: MiraDocsOperation
  target?: {
    mode: "local" | "new_github_repo" | "existing_github_repo"
    localPath?: string
    repository?: string
    branch?: string
  }
  site?: {
    name?: string
    description?: string
    contentMode?: "docs" | "blog" | "docs_and_blog"
    appearancePreset?: "minimal" | "docs" | "personal_blog"
    deployment?: "none" | "github_pages"
  }
  content?: {
    kind?: "blog" | "doc"
    title?: string
    source?: string
    status?: "draft" | "published"
  }
}
```

该结构只用于说明对话所需信息，不要求 V1 新建数据库表或持久化状态。

已有站点的事实必须从当前文件、配置和远程状态重新读取，不能用会话记忆覆盖仓库事实。

---

## 4. 操作一：创建站点

### 4.1 用户目标

支持以下自然表达：

```text
帮我建一个 MiraDocs 站。
做一个个人博客。
给这个仓库初始化文档站。
我想先在本地搭起来看看。
```

### 4.2 参数合同

#### 阻塞参数

| 参数 | 说明 | 缺失处理 |
| --- | --- | --- |
| `site.name` | 站点显示名称 | 询问 |
| `target.mode` | 本地、新 GitHub 仓库或已有仓库 | 询问 |
| `target.localPath` | 本地创建位置，仅本地模式需要 | 询问或使用用户当前明确工作区 |
| `target.repository` | `owner/repo`，GitHub 模式需要 | 询问 |
| `repository.visibility` | 新建仓库时的 public / private | 询问，不默认公开 |
| `existingRepo.writePolicy` | 已有非空仓库是否允许修改 | 读取后展示影响并取得明确确认 |

#### 可推断参数

| 参数 | 推断方式 |
| --- | --- |
| `contentMode` | “博客”→ blog；“文档站”→ docs；未说明→ docs_and_blog |
| `appearancePreset` | “个人博客”→ personal_blog；“技术文档”→ docs；未说明→ minimal |
| `description` | 可根据站点名和用户目标生成草案 |
| `deployment` | 用户说“先本地”→ none；用户明确“上线 / Pages”→ github_pages |

#### 可采用默认值

```yaml
contentMode: docs_and_blog
appearancePreset: minimal
deployment: none
customDomain: null
logo: null
accentColor: default
author: null
```

`deployment: none` 是安全默认值。创建 GitHub 仓库不等于自动部署。

#### 延后参数

```text
Logo
自定义主色
自定义域名
作者主页
评论系统
统计代码
社交链接
```

这些参数不得阻塞站点初始化。

### 4.3 建站对话

#### 情况 A：信息不足

```text
用户：帮我建个网站。

Mira：先给我三项：网站名、创建位置（本地 / 新 GitHub 仓库 / 已有仓库），以及风格（默认简洁 / 技术文档 / 个人博客）。
```

用户回复后，如果是新 GitHub 仓库且未说明可见性，再补问一次：

```text
这个新仓库要公开还是私有？
```

#### 情况 B：信息基本完整

```text
用户：在 dangjingtao 新建 tomz-lab，网站叫 Tomz Lab，做个人博客，先不部署。

Mira：
网站名：Tomz Lab
仓库：新建 dangjingtao/tomz-lab
仓库可见性：还未指定
内容：博客
风格：个人博客
部署：暂不部署

新仓库要公开还是私有？
```

#### 情况 C：已有仓库

```text
用户：把 dangjingtao/example-site 改成 MiraDocs 站。
```

Mira 必须先读取：

- 仓库默认分支；
- 是否为空；
- 当前框架和构建脚本；
- 是否已有 MiraDocs 配置；
- 是否存在未合并变更或活跃 PR；
- 当前部署工作流。

读取后再给迁移或初始化草案，不直接覆盖。

### 4.4 建站施工流程

```text
确认参数
→ 读取目标位置或仓库
→ 生成施工草案
→ 创建独立分支
→ 写入最小可运行站点
→ 安装依赖
→ 类型检查
→ 静态构建
→ 验证首页、文档入口和博客入口
→ 按用户要求配置部署
→ 回读文件、CI 或部署状态
→ 交付地址、分支、PR 和未完成项
```

最小站点至少包含：

```text
MiraDocs 配置
首页
文档示例或文档入口
博客示例或博客入口（contentMode 包含 blog 时）
开发命令
构建命令
静态产物输出配置
README 中的本地启动说明
```

示例内容必须明确标记为示例，不能伪装成用户真实内容。

### 4.5 建站完成标准

只有同时满足以下条件，才能说站点已创建：

- 站点文件已写入目标分支；
- 依赖安装结果明确；
- 类型检查结果明确；
- 静态构建结果明确；
- 首页和启用的内容入口可被发现；
- 用户要求部署时，部署工作流和远程状态已回读；
- 用户能看到仓库、分支、PR、预览或部署地址；
- 失败步骤和剩余配置被明确列出。

不能仅凭“模板文件已生成”宣布建站完成。

---

## 5. 操作二：发布博客或文档

### 5.1 用户目标

```text
把这篇文章发成博客。
把这个 Markdown 放到文档站。
帮我写一篇更新说明并发布。
把现有文档改一下重新上线。
```

博客和文档属于同一个发布操作，只是内容类型不同，不拆成两个 Skill。

### 5.2 参数合同

#### 阻塞参数

| 参数 | 说明 | 缺失处理 |
| --- | --- | --- |
| `target site` | 目标站点或仓库 | 当前任务已明确则继承，否则询问 |
| `content source` | 正文、附件、已有文件或可读取来源 | 没有内容时询问 |
| `content kind` | blog / doc | 用户明确则直接使用；确实无法判断时询问 |

#### 可推断参数

| 参数 | 推断方式 |
| --- | --- |
| `title` | 从明确标题或正文首个标题推断 |
| `summary` | 从正文生成短摘要 |
| `slug` | 从标题生成并检查冲突 |
| `date` | 新博客默认使用当前日期；迁移时保留原日期 |
| `author` | 读取站点默认作者；没有则留空，不伪造 |
| `category` | 从用户指令或相邻内容约定推断 |
| `status` | “发 / 发布 / 上线”→ published；“写 / 整理 / 准备”→ draft |

### 5.3 内容类型判断

优先使用用户明确表达：

```text
博客 / 随笔 / 更新日志
→ blog

文档 / 指南 / 教程 / API 说明
→ doc
```

仍然模糊时，只问一个问题：

```text
这篇内容放在博客，还是文档目录？
```

不要让用户填写完整 frontmatter 表单。

### 5.4 发布草案

写入前展示关键字段：

```text
类型：博客
标题：MiraDocs 0.1 发布记录
路径：blogs/miradocs-0-1-release.md
状态：立即发布
日期：2026-07-26
分类：工程记录
导航：不需要手工更新
```

用户可直接修改不对的项。

### 5.5 发布施工流程

```text
确定目标站点
→ 读取站点配置和相邻内容
→ 解析或整理正文
→ 生成并展示发布草案
→ 检查重名、永久链接和资源路径
→ 写入内容
→ 必要时更新导航或索引
→ 回读文件
→ 执行内容发现和静态构建
→ 验证目标路由
→ 用户要求上线时检查 CI / 部署
→ 返回页面地址、提交和验证结果
```

### 5.6 内容处理规则

- 不覆盖同名内容；先读取旧文件并说明是更新、另存还是冲突。
- 迁移内容保留原作者、原日期、永久链接和外链语义。
- 图片和附件必须确认来源可访问，并使用站点支持的资源路径。
- 普通修改默认保留原 slug，避免旧链接失效。
- 删除或更换 slug 时，必须说明链接影响并提供重定向或兼容方案。
- 用户提供的正文是主内容，不因“统一风格”大幅重写事实或语气。
- 未确认作者时留空或使用站点已配置作者，不虚构署名。

### 5.7 发布完成标准

- 内容文件已写入并回读；
- frontmatter 符合当前站点约定；
- 内容能被 MiraDocs 发现；
- 目标路由明确且无冲突；
- 静态构建结果明确；
- 用户要求上线时，远程 CI / 部署结果明确；
- 返回内容路径、页面地址、commit 或 PR；
- 未完成的图片、导航、域名或部署问题被明确列出。

---

## 6. 操作三：维护已有站点

### 6.1 V1 范围

维护站点只覆盖以下真实需求：

```text
站点配置
  名称、描述、Logo、主色、风格预设、作者信息

导航与内容结构
  导航项、栏目、首页入口、文档与博客目录

内容生命周期
  修改、下线、删除、重命名、链接兼容

诊断与修复
  内容未发现、路由失效、构建失败、部署失败

升级与迁移
  MiraDocs 版本升级、已有内容迁入、配置兼容

部署设置
  GitHub Pages、自定义域名和现有工作流检查
```

不把维护操作扩张成通用后台管理系统。

### 6.2 参数合同

维护任务通常只需要：

```text
目标站点
要改变或诊断的对象
期望结果
```

例如：

```text
把站点名字改成 Tomz Lab。
```

当前对话没有目标站点时，Mira 询问：

```text
要修改哪个本地项目或 GitHub 仓库？
```

目标明确后先读取现有配置，再展示具体差异：

```text
site.name
- Mira Docs
+ Tomz Lab
```

### 6.3 诊断流程

```text
读取失败现象和当前状态
→ 找到对应层：内容 / 配置 / 构建 / 部署
→ 复现或读取 CI 证据
→ 说明原因、影响和建议修复
→ 经批准后修改
→ 重跑失败层及必要的上层验证
→ 回读结果
```

不能把未知问题直接归因于 MiraDocs，也不能为了通过验证加入未批准 fallback。

### 6.4 破坏性操作

以下操作必须展示精确对象和影响：

```text
删除内容
覆盖已有仓库文件
更改永久链接
修改默认分支或部署工作流
替换自定义域名
批量迁移
```

确认示例：

```text
将删除 blogs/old-post.md，并使 /blogs/old-post/ 失效。要直接删除，还是保留重定向？
```

### 6.5 维护完成标准

- 修改前的当前事实已读取；
- 变更差异和影响明确；
- 写入后文件已回读；
- 与该变更相关的类型检查、构建、路由或部署验证已完成；
- 未经验证的部分没有被描述为成功；
- 返回可核验的路径、commit、PR、CI 或部署状态。

---

## 7. Tool 与 Skill 边界

MiraDocs Skill 负责：

```text
识别三个用户操作
归一化参数
判断何时追问
生成施工草案
规定执行顺序
规定完成标准
```

现有能力负责实际执行：

| 任务 | 现有能力 |
| --- | --- |
| 读取站点、配置和内容 | Harness Read |
| 修改文件 | `edit_file` |
| 安装、检查、构建和本地预览 | `terminal_session` |
| 读取当前公共文档 | `web_search` |
| 仓库、分支、PR、Actions | 现有 GitHub 领域工具与 `github-collaboration` Skill |

MiraDocs Skill：

- 不注册新 Tool；
- 不扩大 ToolExposure；
- 不复制 GitHub API；
- 不绕过 Harness 审批；
- 不修改 Main Agent、Planner、Agent Graph 或 C contract。

---

## 8. Skill 包建议

V1 实现应保持紧凑：

```text
server/src/skills/development/miradocs/
├── SKILL.md
├── references/
│   ├── create-site.md
│   ├── publish-content.md
│   └── maintain-site.md
├── templates/
│   └── site-draft.md
└── examples/
    └── conversations.md
```

`SKILL.md` 只保留：

- 三个操作的路由；
- 参数分类原则；
- 对话总规则；
- Hard Rules；
- Completion Criteria；
- Resource URI。

详细参数、流程和样例按需披露，避免每次命中都加载全部正文。

---

## 9. V1 验收场景

实现完成后至少验证以下真实对话：

### 场景 1：新建本地站点

```text
帮我在 D:\sites\tomz-lab 建一个叫 Tomz Lab 的文档和博客站，用默认简洁风，先不部署。
```

期望：不重复询问；展示草案；创建站点；完成类型检查和构建；返回本地路径和验证结果。

### 场景 2：新建 GitHub 站点，缺少可见性

```text
在 dangjingtao 新建 tomz-lab，做个人博客。
```

期望：只补问仓库公开或私有；不盘问域名、Logo 等；经审批后创建分支、写入、验证并交付 PR。

### 场景 3：发布博客并继承站点

```text
再把这篇文章发成博客。
```

期望：继承刚创建的站点；从内容推断标题和摘要；展示发布草案；写入并验证页面。

### 场景 4：发布文档但目标未知

```text
把这个 Markdown 发到文档站。
```

期望：只询问目标站点；不重新询问用户已提供的正文信息。

### 场景 5：修改站点名称

```text
把首页和站点标题都改成 Tomz Lab。
```

期望：读取现有配置和首页；展示差异；修改后回读并构建验证。

### 场景 6：已有非空仓库初始化

```text
把 dangjingtao/example-site 改成 MiraDocs。
```

期望：先读取仓库技术栈、分支和部署；说明迁移范围；未经确认不覆盖现有文件。

### 场景 7：删除已发布博客

```text
把旧的发布记录删掉。
```

期望：定位精确文件和路由；说明链接影响；询问删除或重定向；不模糊删除。

### 场景 8：构建失败诊断

```text
这个 MiraDocs 站为什么构建不过？
```

期望：读取或复现错误；指出失败层和原因；先说明影响再施工；修复后重跑对应验证。

---

## 10. Non-goals

V1 明确不做：

- 项目、里程碑、任务、决策和风险产品模型；
- 通用 CMS 后台；
- 多站点集中管理控制台；
- 自动写回 GitHub Issues / Projects；
- 新的 Skill Runtime、状态机或数据库；
- 新的 GitHub API 封装；
- 主题市场、插件市场或复杂主题编辑器；
- 未经用户要求自动配置域名、统计、评论和第三方服务。

---

## 11. 设计完成条件

本设计进入实现前，需要项目 owner 确认：

- 一个 Skill、三个操作的范围是否正确；
- 建站阻塞参数是否足够且不过度；
- `deployment: none` 是否作为安全默认；
- 新 GitHub 仓库可见性必须询问；
- 发博客和发文档是否共享一个发布工作流；
- 维护站点的 V1 范围是否需要继续收缩；
- 旧 `feature/miradocs-skill-v1` 实现是否废弃并按本设计重做。

在这些决策确认前，不把该设计描述为 Settled，也不继续扩大 MiraDocs Skill 实现范围。
