# Pull Request Review

用于理解、审查和推进 Pull Request。

## 审查读取面

至少读取：

1. PR 元数据：title、body、head、base、draft、mergeable、作者；
2. changed files 和 patch；
3. 会话评论与行级评论；
4. 已有 Reviews；
5. 对应 Actions run、Jobs 和失败日志。

不要仅凭标题、描述或文件数量给出 approve / request changes。

## 审查维度

按以下顺序判断：

- **目标覆盖**：改动是否解决声明的问题；
- **正确性**：边界、异常路径、状态变化、并发和数据一致性；
- **回归风险**：是否破坏既有合同、兼容性或用户数据；
- **安全边界**：权限、凭据、注入、越权、危险操作；
- **可维护性**：重复逻辑、隐式耦合、命名和可观察性；
- **验证质量**：测试是否覆盖核心成功、失败和恢复路径；
- **CI 状态**：失败、跳过、未运行或长时间 pending。

## 严重度

```text
blocker  会导致严重错误、数据/安全问题，必须修复
high     很可能产生真实故障或破坏关键合同
medium   有明显风险或维护成本，应在合并前处理
low      非阻塞改进
note     说明、疑问或可选建议
```

每个 finding 应包含：位置、事实、影响和建议。没有足够证据时写成问题或缺口，不写成确定 bug。

## Review 决策

- `approve`：没有阻塞问题，CI 与必要验证满足；
- `request_changes`：存在 blocker/high 或明确未满足的关键合同；
- `comment`：需要讨论、补证据或仅有非阻塞建议。

用户只要求“帮我审查”时，默认只生成审查结论，不向 GitHub 提交 Review。提交 Review 必须获得明确意图和 Harness 审批。

## 合并前检查

合并前确认：

- PR 仍为 open；
- head SHA 与审查时一致，或重新审查新提交；
- mergeable / mergeable state 可接受；
- 必需 Checks 已通过；
- 没有未解决 blocker/high；
- merge / squash / rebase 策略符合仓库约定。

## 输出

使用 `templates/pr-review-template.md`。优先列出 findings；没有问题时明确说明审查范围和残余风险。

## 完成标准

- 阅读了代码变化、讨论和 CI；
- finding 可定位、可验证、可行动；
- Review 决策与 finding 一致；
- 提交 Review 或合并后已回读验证。