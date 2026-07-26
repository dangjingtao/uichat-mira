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
部署：{{deployment}}
自定义域名：{{customDomain | 暂不配置}}

将创建：
- MiraDocs 配置
- 首页
- {{enabledContentEntrances}}
- 开发与构建脚本
- 本地使用说明

需要确认：
{{blockingQuestions | 无}}
```

展示规则：

- 只展示用户能理解和纠正的字段；
- 默认值明确写出，不隐藏；
- 阻塞参数仍缺失时，在“需要确认”中集中列出；
- 不把 Logo、统计、评论等延后参数展开成表单；
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
写入位置：{{paths}}
验证结果：{{verificationResults}}
访问地址：{{urls | 无}}
版本控制：{{branchCommitPr | 无}}
远程状态：{{ciDeployment | 未执行}}
剩余事项：{{remainingItems | 无}}
```

结果中的“已完成”只能包含已有回读或运行证据的事项。未执行、失败或无法确认的步骤必须单独列出。