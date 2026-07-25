# Project Pulse

用于回答“这个项目最近怎么样”“今天有什么需要我处理”等项目级问题。

## 读取顺序

1. `github_repository.get`
   - 默认分支、更新时间、语言、开放 Issue 数、最近提交。
2. `github_issue.list`
   - `state=open`，按 `updated desc`。
3. `github_pull_request.list`
   - `state=open`，按 `updated desc`。
4. `github_actions.list_runs`
   - 最近运行，优先识别失败、取消、超时和长时间进行中的 run。
5. 仅当风险判断需要时继续读取具体 Issue、PR、run 或日志。

## 判断规则

将事实归入：

- **正在进行**：活跃 PR、近期提交、进行中的 Actions；
- **阻塞与风险**：失败 CI、长期未更新 PR、无人负责的高优先 Issue、合并冲突；
- **需要用户决定**：范围取舍、关闭/合并、权限或组织审批；
- **可自动继续**：进一步读取、比较提交、整理摘要。

不要仅凭 Issue 数量判断项目健康。至少结合更新时间、PR、CI 和最近提交。

## 输出模板

```markdown
## 项目状态
一句话总览。

## 正在进行
- ...

## 阻塞与风险
- [高/中/低] 事实、影响、依据

## 最近失败
- workflow / run / job / step / 失败原因

## 建议优先处理
1. ...
2. ...

## 信息缺口
- ...
```

## 完成标准

- 结论覆盖 Repository、Issue、PR、Actions 中适用的领域；
- 风险均能追溯到具体对象；
- 没有为了“看起来完整”而虚构优先级；
- 用户能直接决定下一步。