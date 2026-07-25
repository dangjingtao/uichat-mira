# Delivery Flow

用于把明确修改安全地推进到 GitHub。

## 默认路径

```text
确认仓库与目标
→ 读取默认分支和相关文件
→ 创建独立分支
→ 读取目标文件及 SHA
→ 写入或删除文件
→ 回读文件与 commit
→ 创建 Pull Request
→ 检查 Actions
→ 交付摘要
```

## 分支规则

- 默认创建 feature / fix / docs 等独立分支；
- 不直接写默认分支，除非用户明确要求且仓库策略允许；
- 分支名应短、可读、与任务相关；
- 创建前检查是否已有同名或等价工作分支。

## 文件写入规则

写文件前必须：

- 读取目标 branch 上当前文件；
- 获得当前 `sha`；
- 判断是创建还是更新；
- 保留用户未要求修改的内容；
- 使用能解释目的的 commit message。

删除文件前必须说明影响，并使用高风险审批。

不得用 `overwrite=true` 代替对当前内容的理解。

## Pull Request

创建 PR 时应包含：

- 目的和背景；
- 主要改动；
- 验证方式；
- 风险与回滚；
- 关联 Issue；
- 尚未完成或需要人工判断的内容。

创建后回读 PR，并确认 head、base、draft、编号和链接。

## Actions

- PR 创建后读取相关 run；
- 失败时定位 job / step / logs；
- 先给出诊断，再决定是否改动或 rerun；
- 不把“workflow 已触发”视为“交付成功”。

## 完成状态

区分：

```text
prepared   已准备内容，尚未远程写入
committed  已提交到远程分支
pr_open    PR 已创建，等待审查或 CI
blocked    权限、CI、冲突或人工决策阻塞
merged     PR 已合并并回读确认
```

不要把 `committed` 或 `pr_open` 表述成已上线。

## 完成标准

- 修改位于正确分支；
- 文件和 commit 已回读确认；
- PR 信息完整；
- Actions 状态已检查；
- 用户清楚当前交付阶段与剩余阻塞。