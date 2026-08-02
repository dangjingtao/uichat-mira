# MiraDocs 施工草案模板

用于在实际写入前，把已知参数、推断值、默认值和缺口整理成一份用户可审阅的短草案。

## 创建站点

```text
操作：创建站点

网站名：{{site.name}}
站点描述：{{site.description | 未设置}}
创建位置：{{target}}
仓库可见性：{{repository.visibility | 不适用 / 待确认}}
内容：{{contentMode}}
风格：{{appearancePreset}}
部署：{{deployment | GitHub 目标默认 GitHub Pages / 本地目标默认暂不部署}}
自定义域名：{{customDomain | 暂不配置}}

将创建：
- MiraDocs 配置
- 首页
- {{enabledContentEntrances}}
- 开发、类型检查与构建脚本
- 本地使用说明
- {{githubPagesWorkflow | GitHub Pages workflow / 不适用}}

固定施工阶段：
inspect_target → prepare_staging → render_scaffold → install_dependencies → typecheck → build → render_pages_workflow → write_remote → verify_actions → configure_pages → verify_pages → deliver

需要确认：
{{blockingQuestions | 无}}
```

展示规则：

- 只展示用户能理解和纠正的字段；
- 默认值明确写出，不隐藏；
- GitHub `create_site` 默认展示“GitHub Pages”，只有用户明确要求暂不上线时展示“暂不部署”；
- 阻塞参数仍缺失时，在“需要确认”中集中列出；
- 不把 Logo、统计、评论等延后参数展开成表单；
- GitHub 模式的内部 staging 不作为用户参数盘问；
- 不在草案里声称仓库、构建或部署已经完成。

## 发布博客或文档

```text
操作：发布内容

目标站点：{{targetSite}}
类型：{{content.kind}}
标题：{{content.title}}
路径：{{content.path}}
状态：{{content.status}}
日期：{{content.date | 不适用}}
作者：{{content.author | 使用站点默认 / 未设置}}
分类：{{content.category | 未设置}}
导航：{{navigationAction}}
资源：{{assetSummary | 无}}

需要确认：
{{blockingQuestions | 无}}
```

## 维护站点

```text
操作：维护站点

目标站点：{{targetSite}}
对象：{{targetObject}}
期望结果：{{desiredOutcome}}

拟议差异：
{{diffSummary}}

影响：
{{impactSummary}}

验证：
{{verificationPlan}}

需要确认：
{{blockingQuestions | 无}}
```

## 交付结果

```text
目标站点：{{targetSite}}
已完成：{{changeSummary}}
本地目标：{{localTarget | 不适用}}
受管施工现场：{{stagingPath | 不适用}}
远程写入：{{remotePaths | 不适用}}
远程 commit：{{commitSha | 无}}
验证结果：{{verificationResults}}
Actions：{{actionsStatus | not_run}}
GitHub Pages：{{pagesStatus | not_run}}
访问地址：{{pagesUrl | 无}}
版本控制：{{branchCommitPr | 无}}
剩余事项：{{remainingItems | 无}}
```

规则：

- local 模式填写 `localTarget`；
- GitHub 模式填写 exact `stagingPath`、远程文件与 commit；
- PR 只在用户要求或仓库策略要求时填写，不作为默认完成条件；
- `Mira BASE` 或 Workspace root 不能冒充站点路径；
- staging 只证明本地施工现场存在，不证明远程写入或部署完成；
- GitHub `create_site` 默认只有 Actions 成功且 Pages URL 已回读，才可写“建站完成”；
- 用户明确选择 `deployment: none` 时，Actions 与 Pages 必须写 `not_run`，不得使用“已上线”。

存在部分成功、阻塞或失败时，改用分步状态：

```text
currentStage
{{currentStage}}

completed
{{completedSteps | 无}}

blocked
{{blockedSteps | 无}}

failed
{{failedSteps | 无}}

not_run
{{notRunSteps | 无}}

恢复入口
{{resumeFrom | 无}}

本地施工现场
{{stagingPath | 不适用}}
```

结果中的“已完成”或 `completed` 只能包含已有回读或运行证据的事项。未执行、失败或无法确认的步骤必须单独列出；恢复入口必须指向第一个未完成阶段，并复用已记录的 staging / remote checkpoint，不得要求从头重跑。