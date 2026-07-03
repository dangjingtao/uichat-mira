# Harness 缺口审查清单

Status: Current
Owner: runtime
Last verified: 2026-07-03
Layer: wiki
Module: Harness
Feature: GapReview
Doc Type: checklist
Related:
  - harness-assessment-2026-06-28.md
  - harness-phase-1-implementation-checklist.md
  - sandbox-module.md
  - ../tooling-runtime/harness-runtime-design.md

## 用途

这页只回答一件事：

**Harness 现在明确还缺什么。**

它不是总体评语，也不是路线图美化页，而是给团队逐项审查用的缺口清单。

## 审查原则

- 只列缺口，不重复列已完成项
- 每项都尽量落到具体能力，而不是抽象感受
- 能区分“完全没做”和“做了一半”

## A. 审批授权模型

### 审查结论（2026-07-03）

当前已经有的事实：

- Harness preflight 已支持 invocation 级 approval 判定
- `approvedInvocations` 已按 `toolId + inputHash` 生效
- Agent `approve -> resume` 主链已能恢复同一份冻结调用
- Agent route 已有 `approve / reject / cancel`

当前仍缺的东西：

- 没有 `thread` 级 approval grant
- 没有 `session` 级 approval grant
- 没有统一 grant 持久化模型
- 没有 direct MCP route 的正式 approval resume 体系

代码证据：

- `server/src/mcp/core/permissions.ts`
- `server/src/mcp/core/invocations.ts`
- `server/src/agent/routes.ts`
- `server/src/agent/resume.ts`

- [ ] 缺 `thread` 级 approval grant
  - 现在只有单次 invocation 的 `awaiting_approval`
  - 还没有线程级授权记录、复用、过期、撤销模型

- [ ] 缺 `session` 级 approval grant
  - 还没有会话级授权作用域
  - 还没有“同类动作在同一会话内是否可复用授权”的正式规则

- [ ] 缺 approval grant 持久化闭环
  - 还没有完整的 grant 存储、读取、校验、失效机制

- [ ] 缺 approval resume 闭环
  - 现在能进入等待审批
  - 但 direct MCP route 还没有正式的 approval grant / resume API 体系

## B. 越界统一 Gate

- [ ] 缺“越出 root 时统一进入审批”的硬 gate
  - 当前已有 workspace boundary 检查
  - 但还不是所有执行入口都严格收口到同一套越界规则

- [ ] 缺“越出 sandbox 时统一进入审批”的硬 gate
  - 当前文档语义已确认
  - 但实现还没有形成完整入口级统一判断

- [ ] 缺 root / sandbox / approval 三者统一决策顺序
  - 现在规则分散在 environment、permissions、sandbox、tool runtime 文档与实现里
  - 还没有一个收死的统一决策流程定义

## C. 沙箱能力

- [ ] 缺强沙箱
  - 当前只有 `Sandbox v0.5`
  - 不是完整隔离执行环境

- [ ] 缺并发执行上限
  - 还没有统一的 sandbox / invocation 并发治理

- [ ] 缺联网类命令的独立风险标记
  - 命令策略已存在
  - 但联网类命令还没单独风险建模

- [ ] 缺后台长驻进程逃逸约束
  - 现在还没有完全收死“默认不允许后台驻留”的统一规则

- [ ] 缺 secret env 与普通 env 的正式分层
  - 现在已有 env 白名单
  - 但 secret 类 env 还没有独立治理层

## D. Replay 与执行审计

- [ ] 缺真正 replay
  - 当前能记录 invocation / trace / spans / artifacts
  - 但不能按记录重放一次执行

- [ ] 缺跨 invocation 检索与回放工作流
  - 还没有“从历史执行里查、比、复现”的完整治理面

## E. Trace 展示面

- [ ] 缺完整 Harness trace UI
  - 后端已有 invocation / events / trace / artifacts
  - 前端还没有完整的 Harness 治理视角展示面

- [ ] 缺结构化 spans 展示
  - 当前 trace 数据在后端存在
  - 但没有完整的前端结构化可视化

## F. Root / Workspace / Scope

- [ ] 缺多 roots 模型
  - 当前 root 能力定义存在
  - 但多 root 授权、切换、审计还不成熟

- [ ] 缺多 workspace 联动
  - 当前主要仍是单 workspace 主视角
  - 还不是成熟的多 workspace 调度体系

- [ ] 缺 debug scope 联动
  - root、scope、tool risk、approval、sandbox 之间还没有完整的 debug 权限模型

## G. 风险分层

- [ ] 缺更细粒度风险分层
  - 当前主要看 `sideEffect`
  - 再叠加 `requiresApproval`、workspaceBoundary、external MCP transport
  - 还不够细

- [ ] 缺命令 / 文件写入 / 网络 / 外部 MCP 的统一风险矩阵
  - 现在有事实规则
  - 但没有一份最终收口的统一风险矩阵真相页

## H. 文档与结构真相

- [ ] 缺 Harness runtime 真实模块图
  - 当前还没有正式模块图文档

- [ ] 缺 approval / sandbox / exposure / invocation 的单页总流程图
  - 现在信息分散在多篇文档里
  - 还没有一页把治理主链讲透

## I. 审查顺序建议

建议按这个顺序逐项审：

1. approval grant
2. 越界统一 gate
3. sandbox 强化
4. trace UI
5. replay
6. 多 roots / 多 workspace / debug scope

## 当前一句话结论

Harness 现在**不缺主链**，缺的是：

- 完整授权系统
- 越界统一硬 gate
- 更强沙箱
- replay
- 完整治理可视化
- 多 root / 多 workspace 权限体系
