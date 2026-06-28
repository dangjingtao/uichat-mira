# Role 恢复回归清单

Layer: raw-source
Module: Role
Feature: Recovery
Doc Type: checklist

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

- [x] 打开设置页 `Roles`，角色列表正常加载
- [x] 新建角色成功，列表立即出现新项
- [x] 编辑名称 / 简介 / 标签后保存成功
- [x] 编辑 prompt 字段抽屉后保存成功
- [x] 编辑 `llmProfile` 六个参数后保存成功
- [x] 删除角色成功，列表同步移除
- [x] 刷新设置页后，以上变更仍然存在

## B. 线程绑定与展示

- [x] 欢迎态可选择 Role
- [x] 草稿线程状态下选择 Role，首次发送后 `roleId` 一并落库
- [x] 进入已有线程后，Role 标签正常显示
- [x] 输入框旁标签显示 Role 头像 + 名称
- [x] 助手头像切换为 Role 头像
- [x] 助手 “回复中” 文案切换为角色语义
- [x] 刷新后 Role 展示状态可恢复

## C. 普通聊天注入

- [ ] 绑定 Role、关闭知识库，普通聊天可正常回复
- [x] 普通聊天回复风格受 Role 影响
- [x] 线程绑定 `contextSummary` 后，普通聊天仍可正常回复
- [x] `Role + Summary` 不出现在可见消息列表中

## D. RAG 聊天注入

- [x] 绑定 Role + 非空知识库，高命中问题正常回答
- [x] 当前稳定高命中样例：`备孕女性每天应补充多少叶酸？`
- [x] 绑定 Role + 非空知识库，低命中问题不吞消息
- [x] 低命中问题时，回复仍保持 Role 语气，而不是生硬拒答
- [ ] RAG 回答仍保留知识库边界，不因 Role 失去拒答规则
- [x] 关闭知识库后，同线程普通聊天仍然可用

## E. 解绑与切换

- [x] 线程内可解绑知识库
- [x] 线程内可解绑 Role
- [x] 解绑 Role 后，标签 / 头像 / typing label 同步清除
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
- [x] 开发登录链路 `/login -> /me` 已重新回归
- [x] 角色列表真实数据链路 `/roles` 已重新回归
- [x] 角色设置页入口已从 mock 版恢复为真实 CRUD 容器
- [x] 默认聊天 request-only `Role + Summary` 注入已重新回归
- [x] RAG `requestContextMessages -> generate` 已重新回归
- [x] `docs/role/role-api.md` 已补回
- [x] 聊天页 `chat.thread.roles.*` / `chat.thread.contextSummary.*` 共享国际化缺口已补回

说明：

以上 G 项已在 2026-06-26 重新执行。

本轮本地复测方式：

- `desktop` `tsc --noEmit`
- `server` `tsc --noEmit`
- 真实 HTTP 回归 `/login`、`/me`、`/roles`
- Fastify 注入脚本回归 `Role CRUD`
- Fastify 注入脚本回归默认聊天 `Role + Summary + llmProfile`
- Fastify 注入脚本回归 RAG `requestContextMessages`
- 浏览器实测角色设置页 `新建 -> 编辑 -> 保存 -> 刷新持久化`
- 浏览器实测聊天页 `欢迎态选 Role -> 首次发送 -> 角色标签 / 回复中文案 -> 线程内解绑`

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
- 当前 `产后康复指南` 的实际内容更偏“备孕 / 孕期 / 产后康复混合问答”。
- `产后不适合做哪些运动？` 在当前知识库中没有直接命中片段，不适合作为“高命中应答”验收题。
- 适合作为当前高命中验收题的样例包括：
  - `备孕女性每天应补充多少叶酸？`
  - `辅酶Q10对备孕有什么作用？`
  - `Myo-肌醇的推荐剂量是多少？`
