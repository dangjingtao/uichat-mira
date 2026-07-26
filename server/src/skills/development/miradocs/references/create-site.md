# 创建 MiraDocs 站点

用于 `create_site` 操作。

## 1. 参数合同

### 阻塞参数

| 参数 | 说明 | 缺失处理 |
| --- | --- | --- |
| `site.name` | 站点显示名称 | 询问 |
| `target.mode` | `local` / `new_github_repo` / `existing_github_repo` | 询问 |
| `target.localPath` | 本地创建位置，仅本地模式需要 | 询问，或使用用户已明确的当前工作区 |
| `target.repository` | `owner/repo`，GitHub 模式需要 | 询问 |
| `repository.visibility` | 新建仓库的 `public` / `private` | 询问，不默认公开 |
| `existingRepo.writePolicy` | 已有非空仓库是否允许修改 | 读取后展示影响并取得明确确认 |

### 可推断参数

| 参数 | 推断方式 |
| --- | --- |
| `contentMode` | “博客”→ `blog`；“文档站”→ `docs`；未说明→ `docs_and_blog` |
| `appearancePreset` | “个人博客”→ `personal_blog`；“技术文档”→ `docs`；未说明→ `minimal` |
| `description` | 根据站点名和用户目标生成短草案 |
| `deployment` | “先本地 / 先不部署”→ `none`；明确“上线 / Pages”→ `github_pages` |

### 稳定默认值

```yaml
contentMode: docs_and_blog
appearancePreset: minimal
deployment: none
customDomain: null
logo: null
accentColor: default
author: null
```

创建 GitHub 仓库不等于自动部署。

### 可延后参数

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

## 2. 询问方式

信息不足时，一次询问一组关联参数：

```text
先给我三项：网站名、创建位置（本地 / 新 GitHub 仓库 / 已有仓库），以及风格（默认简洁 / 技术文档 / 个人博客）。
```

新 GitHub 仓库仍缺可见性时，再单独问：

```text
这个新仓库要公开还是私有？
```

不要继续追问 Logo、域名、作者链接等非阻塞配置。

## 3. 目标位置检查

### 本地目录

写入前确认：

- 目标路径是否存在；
- 是否为空；
- 当前工作区是否就是目标目录；
- 是否存在需要保留的文件；
- 依赖与运行环境是否可用。

非空目录不得直接覆盖。先列出影响文件并询问用户是新建子目录、合并还是取消。

### 新 GitHub 仓库

创建前确认：

- owner；
- repository name；
- public / private；
- 是否已经存在同名仓库；
- 用户是否要求立即部署。

创建仓库、写文件和启用部署分别是不同操作，按现有审批合同执行。

### 已有 GitHub 仓库

先读取：

- 默认分支；
- 仓库是否为空；
- 当前框架和构建脚本；
- 是否已有 MiraDocs 配置；
- 是否有未合并 PR 或活跃施工分支；
- 当前部署工作流；
- 可能被覆盖或冲突的文件。

读取后给出初始化、迁移或保持现状的草案，不直接覆盖。

## 4. 站点施工草案

参数足够后使用：

```text
网站名：Tomz Lab
位置：新建 dangjingtao/tomz-lab
仓库可见性：私有
内容：文档 + 博客
风格：默认简洁
部署：暂不部署
自定义域名：暂不配置
```

用户可以直接纠正不对的项。只有草案中的阻塞参数仍缺失时才继续追问。

完整模板：

```text
skill://miradocs/templates/site-draft.md
```

## 5. 施工顺序

```text
确认阻塞参数
→ 读取目标位置或仓库
→ 展示施工草案
→ 创建独立分支
→ 写入最小可运行站点
→ 安装依赖
→ 类型检查
→ 静态构建
→ 验证首页和启用的内容入口
→ 按用户要求配置部署
→ 回读文件、CI 或部署状态
→ 交付地址、分支、PR 和剩余项
```

## 6. 最小可运行站点

至少包含：

```text
MiraDocs 配置
首页
文档示例或文档入口（contentMode 包含 docs 时）
博客示例或博客入口（contentMode 包含 blog 时）
开发命令
构建命令
静态产物输出配置
README 中的本地启动说明
```

示例内容必须明确标记为示例，不得伪装成用户真实内容。

风格预设只应决定必要的布局、字体层级、间距和基础主题，不在 V1 引入复杂主题编辑器。

## 7. 部署规则

- `deployment: none`：只创建并验证项目，不配置远程部署；
- `deployment: github_pages`：读取当前仓库和 Pages 条件，再配置工作流；
- 自定义域名仅在用户明确提出时处理；
- 创建工作流后必须读取 Actions 或部署状态；
- 没有远程证据时只能说“部署配置已写入”，不能说“网站已上线”。

## 8. 完成标准

只有同时满足以下条件，才能说站点已创建：

- 站点文件已写入目标分支；
- 依赖安装结果明确；
- 类型检查结果明确；
- 静态构建结果明确；
- 首页和启用的内容入口可被发现；
- 用户要求部署时，部署工作流和远程状态已回读；
- 用户能看到本地路径或仓库、分支、PR、预览或部署地址；
- 失败步骤和剩余配置被明确列出。

不能仅凭模板文件已生成宣布建站完成。
