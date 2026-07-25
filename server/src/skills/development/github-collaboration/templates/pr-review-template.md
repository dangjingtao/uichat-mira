# Pull Request Review Template

```markdown
## 审查结论
Approve / Comment / Request changes / 暂无法判断

## 改动摘要
- 目标：
- 主要变化：
- 影响范围：

## Findings

### [blocker|high|medium|low|note] 标题
- 位置：文件 / 行 / 模块
- 事实：
- 影响：
- 建议：

## CI 与验证
- Checks：
- 失败或缺失：
- 已覆盖：
- 未覆盖：

## 残余风险
- ...

## 建议下一步
1. ...
2. ...
```

使用规则：

- Findings 按严重度排序；
- 没有 finding 时，明确说明审查范围，不写空泛的“看起来不错”；
- 结论必须与 Findings 和 CI 一致；
- 未提交到 GitHub 的审查稿要明确标记为“仅建议”；
- 提交 Review 后回读 Review 状态。