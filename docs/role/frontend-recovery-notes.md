# Role / Summary 前端恢复锚点

Last checked: 2026-06-25

这份文件只记录这次蓝屏后重新核对出的“前端应有能力边界”，作为恢复锚点。

## 线程元数据

聊天前端线程元数据必须持续透传以下字段：

- `knowledgeBaseId`
- `roleId`
- `contextSummary`
- `contextSummaryUpdatedAt`

这些字段必须同时存在于：

- `desktop/src/shared/api/thread.ts`
- `desktop/src/features/chat/core/protocol.ts`
- `desktop/src/features/chat/core/runtime.tsx`

## Role 聊天接入

聊天页应具备以下能力：

- 弹出菜单中存在 `role-picker`
- 欢迎态可暂存 `draftRoleId`
- 线程态可从 `thread.metadata.roleId` 恢复当前 Role
- 选择 Role 后：
  - 线程 metadata 持久化 `roleId`
  - 头部 / 输入框旁显示 Role 标签
  - 助手头像切换为 Role 头像
  - typing label 使用角色名语义
- 在线程内解绑 Role 后：
  - `roleId` 置空
  - 标签 / 头像 / typing label 同步消失
  - 不再被欢迎态草稿 Role 回填

## 摘要聊天接入

聊天页应具备以下能力：

- 弹出菜单中存在 `context-summary`
- 可打开线程摘要 modal
- 可执行：
  - 自动生成摘要
  - 手动保存摘要
  - 清空摘要
- 摘要更新后线程 metadata 同步更新：
  - `contextSummary`
  - `contextSummaryUpdatedAt`

## 设计备注

- `Role` 与 `contextSummary` 都属于 request-only context，不出现在可见聊天消息列表中
- `解绑 Role` 不会自动清空 `contextSummary`
- 因此解绑 Role 后若仍有少量历史语气残留，优先视为摘要继续生效，而不是 Role 解绑失败
