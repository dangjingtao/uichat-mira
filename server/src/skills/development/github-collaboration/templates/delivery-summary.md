# Delivery Summary Template

```markdown
## 我看到了什么
- 目标仓库：
- 起始分支 / SHA：
- 相关 Issue / PR / Actions：

## 我判断了什么
- 采用的交付路径：
- 主要风险：
- 为什么没有直接写默认分支：

## 我做了什么
- 分支：
- 文件变化：
- commit：
- Pull Request：
- Actions：

## 接下来还差什么
- 等待的 CI / Review：
- 阻塞或人工决策：
- 推荐下一步：
```

状态必须使用真实阶段：

```text
prepared
committed
pr_open
blocked
merged
```

使用规则：

- 每项写入提供可核验的编号、SHA、路径或链接；
- 不把 `pr_open` 表述成已完成上线；
- Actions 尚未结束时明确写“等待”；
- 权限不足、分支保护或审批阻塞必须单独列出；
- 合并后回读 PR 和最终 commit 再标记 `merged`。