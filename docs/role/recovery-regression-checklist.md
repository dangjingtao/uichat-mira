# Role 恢复回归清单

Status: Active  
Owner: role / chat / rag / runtime  
Last verified: 2026-06-26

## 用途

这份清单只用于这次“蓝屏后恢复”的逐项回归。

它和原有文档的关系：

- `migration-checklist.md`：看历史迁移目标是否完整
- `rag-integration-checklist.md`：看 Role + RAG 的边界设计
- 本清单：按今天的代码恢复状态，逐条人工 / 本地验证

## A. 设置页角色 CRUD

- [ ] 打开设置页 `Roles`，角色列表正常加载
- [ ] 新建角色成功，列表立即出现新项
- [ ] 编辑名称 / 简介 / 标签后保存成功
- [ ] 编辑 prompt 字段抽屉后保存成功
- [ ] 编辑 `llmProfile` 六个参数后保存成功
- [ ] 删除角色成功，列表同步移除
- [ ] 刷新设置页后，以上变更仍然存在

## B. 线程绑定与展示

- [ ] 欢迎态可选择 Role
- [ ] 草稿线程状态下选择 Role，首次发送后 `roleId` 一并落库
- [ ] 进入已有线程后，Role 标签正常显示
- [ ] 输入框旁标签显示 Role 头像 + 名称
- [ ] 助手头像切换为 Role 头像
- [ ] 助手 “回复中” 文案切换为角色语义
- [ ] 刷新后 Role 展示状态可恢复

## C. 普通聊天注入

- [ ] 绑定 Role、关闭知识库，普通聊天可正常回复
- [ ] 普通聊天回复风格受 Role 影响
- [ ] 线程绑定 `contextSummary` 后，普通聊天仍可正常回复
- [ ] `Role + Summary` 不出现在可见消息列表中

## D. RAG 聊天注入

- [ ] 绑定 Role + 非空知识库，高命中问题正常回答
- [ ] 绑定 Role + 非空知识库，低命中问题不吞消息
- [ ] 低命中问题时，回复仍保持 Role 语气，而不是生硬拒答
- [ ] RAG 回答仍保留知识库边界，不因 Role 失去拒答规则
- [ ] 关闭知识库后，同线程普通聊天仍然可用

## E. 解绑与切换

- [ ] 线程内可解绑知识库
- [ ] 线程内可解绑 Role
- [ ] 解绑 Role 后，标签 / 头像 / typing label 同步清除
- [ ] 切换到另一个 Role 后，回复风格跟随变化
- [ ] 解绑 Role 后若仍有轻微旧语气，需确认是否来自 `contextSummary`

## F. 后端链路

- [x] `threads` 表恢复 `role_id`
- [x] 线程接口恢复 `roleId`
- [x] 默认聊天恢复 request-only `Role + Summary` 注入
- [x] 默认聊天恢复 role-level `llmProfile` 透传
- [x] RAG 恢复 `requestContextMessages -> generate`
- [x] RAG 不把 Role 混入 `conversationHistory`

说明：

以上 F 项我已经在本地代码和最小脚本里核过，当前主要需要继续做前台人工回归。

## G. 本轮已确认

- [x] 后端类型检查通过
- [x] 前端类型检查通过
- [x] Role CRUD 路由已重新回归
- [x] 角色设置页入口已从 mock 版恢复为真实 CRUD 容器
- [x] 默认聊天 request-only `Role + Summary` 注入已重新回归
- [x] RAG `requestContextMessages -> generate` 已重新回归
- [x] `docs/role/role-api.md` 已补回

说明：

以上 G 项已在 2026-06-26 重新执行。

本轮本地复测方式：

- `desktop` `tsc --noEmit`
- `server` `tsc --noEmit`
- Fastify 注入脚本回归 `Role CRUD`
- Fastify 注入脚本回归默认聊天 `Role + Summary + llmProfile`
- Fastify 注入脚本回归 RAG `requestContextMessages`

## 回归顺序建议

1. 先做 A：确认设置页角色页没再回到 mock 状态
2. 再做 B：确认线程绑定 / 恢复显示
3. 再做 C：确认普通聊天链路
4. 再做 D：确认 RAG 链路
5. 最后做 E：确认解绑和切换

## 备注

- 当前 `vitest` 环境仍有 `vite/module-runner` 启动问题，所以这轮不把它当作阻塞结论来源
- 当前更可靠的是：
  - TypeScript 检查
  - 路由最小注入脚本
  - 你这边的真实手测
