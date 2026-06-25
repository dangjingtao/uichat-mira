# Role 迁移清单

Status: Active
Owner: role / chat / runtime
Last verified: 2026-06-25

## 单点真相范围

这份清单只服务当前这轮 Role 主链迁移的执行跟踪。

它不讨论抽象方案，不替代设计文档，重点是：

- 哪些已经落地
- 哪些还在人工验收
- 下一轮该继续补什么

## 本轮迁移目标

把 Role 从“设置页素材 + Chat UI 选择态”推进到：

- 线程级真实持久化
- request-only 注入
- 与 `contextSummary` 共用统一线程上下文注入层
- 为后续 memory / tool policy / growth state 预留扩展位

## 已完成

- [x] Role 设置页真实 CRUD 已完成
- [x] Role API 已接入真实后端
- [x] Role API 已接入 Swagger / OpenAPI
- [x] Role 初始化示例数据已补齐
- [x] Chat 加号菜单已接入 Role 入口
- [x] Role 搜索选择弹窗已接入真实 `/roles` 数据
- [x] 选择 Role 后，聊天头像切换为角色头像
- [x] 选择 Role 后，助手回复中的提示改为角色名语义
- [x] 输入框旁线程标签已显示 Role 头像与名称
- [x] `contextSummary` 已落为线程级 request-only 能力
- [x] 后端已新增共享 LLM node 能力底座
- [x] 线程已支持 `contextSummary` 持久化
- [x] 线程已支持 `roleId` 持久化
- [x] 后端已新增 `thread-request-context.node`
- [x] `Role` 与 `contextSummary` 已共用同一套 request-only 注入层
- [x] 默认 chat 请求前已统一 prepend 线程上下文 system messages
- [x] 前端 Role 选择状态已从本地 thread map 收口到线程 metadata
- [x] 欢迎态下选择 Role，首次发消息创建线程时会一并落库
- [x] 线程内已支持解绑 Role，且不会再被欢迎态草稿角色错误回填
- [x] 后端相关测试已补齐并通过
- [x] desktop 相关适配层测试已通过

## 人工验收

- [x] 新建线程前选择 Role，首次发消息后线程持久化成功
- [x] 重新加载线程后，Role 标签、头像、助手显示名恢复正确
- [x] 线程内解绑 Role 后，标签、头像、replying label 同步清除
- [x] 默认 chat 请求可稳定注入 Role + Summary
- [x] Role 与 Summary 不出现在可见聊天消息列表中

说明：

本轮已完成真实界面点验，welcome 选择、线程落库、请求注入、刷新恢复与线程内解绑链路均已通过。
保留设计说明：解绑 Role 不会自动清空 `contextSummary`，因此线程仍可能保留少量历史语境，这不视为解绑失败。

## 下一步

- [x] 在 Role 文档中补齐最新实现边界  
  验收：`docs/role/chat-integration.md`、`docs/role/prompt-injection-design.md` 与现状一致

- [x] 为 `thread-request-context.node` 增加独立测试文件  
  验收：直接覆盖 role resolver / summary resolver / resolver order

- [x] 把 `thread-request-context.node` 拆成独立 resolver 文件  
  验收：`resolveRoleContext` / `resolveSummaryContext` 已拆到独立模块，聚合 node 仅保留顺序编排与出口职责

## 后续再做

- [ ] 接入 `roleState` / 成长态  
  说明：这是线程内逐步演化的人设状态，不等于 Role 本体。

- [ ] 接入向量记忆命中结果到线程 request context  
  说明：本质属于动态上下文层，不直接写进 Role。

- [ ] 接入 tool policy / tool usage constraints  
  说明：工具约束属于 request-only 上下文层，不直接写进 Role 本体。

- [ ] 接入长期用户偏好  
  说明：更适合作为独立 resolver，而不是并入 Role 或 Summary。

- [ ] 给线程上下文层增加可观测调试视图  
  说明：建议能看到“本轮实际 prepend 了哪些 request-only messages”。

## 明确不要做

- [ ] 不要把 Role prompt 写进普通线程消息表
- [ ] 不要让 provider adapter 直接理解 Role 数据库结构
- [ ] 不要把 memory / tool / growth 直接混进 Role CRUD 数据结构
- [ ] 不要再恢复前端本地 `threadRoleIds` 影子状态

## 风险提醒

- [ ] 线程 metadata 与 UI 展示状态再次分叉
- [ ] Role 注入和 Summary 注入顺序被改乱
- [ ] 新增 memory / tool resolver 时，直接在 route 里硬编码拼接
- [ ] 测试环境初始化顺序再次破坏 `roles -> threads` 外键依赖

## 完成验收

以下条件都满足，才算这一轮 Role 主链迁移完成：

- [x] 新建线程前选择 Role，首次发消息后线程持久化成功
- [x] 重新加载线程后，Role 标签、头像、助手显示名恢复正确
- [x] 默认 chat 请求可稳定注入 Role + Summary
- [x] Role 与 Summary 不出现在可见聊天消息列表中
- [x] server `test` 与 `test:coverage` 通过
- [x] desktop `test` 通过

## 相关文档

- [[role/README]]
- [[role/chat-integration]]
- [[role/prompt-injection-design]]
- [[prompt-manager-rules/normal-chat-node-plan]]
- [[prompt-manager-rules/rag-demo-integration]]
