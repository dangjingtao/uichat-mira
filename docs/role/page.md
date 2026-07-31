---
status: current
owner: role / frontend
last_verified: 2026-08-01
layer: wiki
module: Role
feature: Workbench
doc_type: current-contract
canonical: true
related:
  - ../ROLE_CURRENT_TRUTH.md
  - README.md
  - role-api.md
  - preview-and-media.md
---

# Role 工作台

## 文档范围

本页说明设置页 Role Workbench 的字段、保存行为和用户可见操作。真实请求注入见 [[role/runtime]]。

## 当前入口

```text
Settings
→ Roles / Personas
```

源码：

```text
desktop/src/features/Settings/pages/Personas/
```

## 当前对象

| 字段 | 工作台用途 | 是否进入真实 Role Prompt |
| --- | --- | --- |
| name | 列表、Thread 标签、Role system message 中的角色名 | 是 |
| summary | 列表摘要、tooltip、Preview 展示 | 否 |
| avatarId | 设置页和 Chat 助手头像 | 否 |
| status | draft / active | 否 |
| tags | 列表识别，最多三个 | 否 |
| description | 身份与背景 | 是 |
| worldview | 判断与价值基底 | 是 |
| persona | 稳定人设 | 是 |
| scenario | 场景 | 是 |
| exampleDialogues | 示例对话文本 | 是 |
| style | 表达风格 | 是 |
| constraints | 文本约束 | 是 |
| llmProfile | 可选采样参数 | 独立作为 params，不进入 Prompt 文本 |

`{{user}}` 和 `{{char}}` 当前只是普通文本，不会做变量替换。

## 新建行为

点击 New 时，页面会立即调用后端创建 Role：

```text
POST /roles
status = draft
```

它不是浏览器里的未保存临时对象。离开页面不会自动删除。

## 保存行为

### 主保存

主保存提交完整工作台 draft，并固定写入：

```text
status = active
```

因此新角色第一次主保存相当于激活。

当前 UI 没有完整的下架 / 发布版本管理。

### Prompt 字段抽屉

字段抽屉中的 Save 只把文本写回页面 draft；仍需点击主保存才会写入后端。

### LLM Profile 抽屉

LLM Profile Drawer 的 Save 会立即调用 `PATCH /roles/:id`，单独持久化参数。

这两类“保存”语义不同。

## Reset

Reset 只恢复当前页面 draft 到最近一次已加载的 Role 数据，不会创建版本，也不会撤销此前已单独保存的 LLM Profile。

## Delete

删除会调用 `DELETE /roles/:id`。

由于 Thread 外键使用 `ON DELETE SET NULL`：

- Role row 被删除；
- 已绑定 Thread 的 roleId 变为空；
- Thread 和 Messages 保留。

## 状态

工作台列表读取当前用户全部 Role，包括 active 和 draft。

Chat picker 只读取 active。

工作台普通保存总是 active，因此当前 status 更接近“新建未确认 / 已保存可选”，不是完整发布生命周期。

## 表单约束

### Desktop

- name 必填；
- name 最长 50；
- summary 最长 120；
- Prompt 核心字段全空时只做软提示；
- LLM Profile 只接受可解析 finite number。

### Backend

- name 空值创建时回退 `Untitled Role`；
- tags trim、去空并截取前三个；
- Prompt 缺字段补空字符串，Patch 时 merge；
- LLM Profile 只保留 number；
- 没有 name / summary / Prompt 长度限制；
- 没有 LLM Profile 数值范围限制。

## 当前操作矩阵

| 操作 | 当前状态 |
| --- | --- |
| 新建 | 已实现，立即创建 backend draft |
| 编辑字段 | 已实现 |
| 保存完整 Role | 已实现，写 active |
| 单独保存 LLM Profile | 已实现 |
| Reset 页面 draft | 已实现 |
| Preview | 已实现，但不是实际请求或模型回复 |
| 删除 | 已实现，Thread 解除绑定 |
| 复制 | 未实现 |
| 导入 | 未实现 |
| 导出 | 未实现 |
| 版本历史 | 未实现 |
| 发布 / 下架流程 | 未完整实现 |

## Starter Role

真实 starter data 由 backend 在 roles 全表为空时写入，内容为英文。

桌面存在本地化 `buildStarterRoles(...)`，当前没有真实调用方，不能以它判断新用户一定获得本地化示例。

## 验证清单

- [ ] 点击 New 后理解它已经写入后端；
- [ ] Prompt Drawer 修改后点击主保存；
- [ ] LLM Profile 单独保存后确认其他 draft 是否仍未保存；
- [ ] active Role 能在 Chat picker 中出现；
- [ ] 删除 Role 后重要 Thread 仍存在且 roleId 为空；
- [ ] 不把 Preview 当成模型测试；
- [ ] 不向用户宣称 Copy / Import 已实现。
