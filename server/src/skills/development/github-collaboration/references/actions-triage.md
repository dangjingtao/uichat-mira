# Actions Triage

用于查看、诊断和按需操作 GitHub Actions。

## 诊断顺序

1. `github_actions.list_runs`
   - 确认 workflow、branch、event、actor、status 和最新失败 run。
2. `github_actions.get_run`
   - 读取 run 详情、Jobs 和 Steps。
3. `github_actions.get_logs`
   - 只读取失败或可疑 Job 的必要日志。
4. 把失败归类，再给出修复或下一步。

## 失败分类

- **代码/测试失败**：断言、编译、类型、lint、运行时错误；
- **环境失败**：依赖下载、网络、Runner、缓存、磁盘；
- **配置失败**：workflow YAML、权限、secret、路径或事件条件；
- **外部依赖失败**：第三方 API、Registry、服务不可用；
- **取消/超时**：人工取消、并发策略、timeout；
- **证据不足**：日志被截断、Job 不可读或权限不足。

不要看到非零退出码就直接断言业务代码有 bug。

## 输出

```markdown
## 失败位置
workflow / run / job / step

## 直接证据
- 日志片段的语义摘要

## 根因判断
- 已确认 / 高概率 / 待确认

## 影响
- 阻断什么交付

## 建议动作
1. 修复或验证
2. 是否需要 rerun / dispatch

## 信息缺口
- ...
```

## 远程操作

- `rerun`：仅当失败具有可重试性，或修复已经提交；
- `dispatch`：确认 workflow 支持 `workflow_dispatch`、目标 ref 和 inputs；
- `cancel`：高风险操作，确认目标 run 仍在运行且取消理由明确。

诊断不等于执行。用户只问“为什么失败”时，不自动 rerun、dispatch 或 cancel。

## 回读验证

执行后重新读取 run，返回：

- run ID；
- workflow；
- 新状态；
- attempt；
- 链接；
- 是否仍需等待。

## 完成标准

- 失败定位到具体 run / job / step；
- 根因置信度被明确表达；
- 建议动作与证据一致；
- 远程操作经过审批并已回读。