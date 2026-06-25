# Role 页面设计

Status: Current
Owner: role / frontend
Last verified: 2026-06-25

## 单点真相范围

这页说明 Role 设置页本身负责什么，不负责什么。

对应源码目录：

- `desktop/src/features/Settings/pages/Personas`

## 适合什么时候读

这些场景建议先看这页：

- 想改角色工作台页面
- 想确认某个字段是“角色素材”还是“请求编排结果”
- 想决定某个逻辑该写在页面层还是注入层

## 页面定位

Role 页面是角色 / 提示词素材工作台，用于定义可复用的 prompt prototype。

它的职责是编辑“角色素材”，不是决定最终请求如何拼装。

最终 prompt 编排策略应放在独立的 prompt injection / request builder 层。

## 页面职责

Role 页面负责：

- 创建角色
- 编辑角色字段
- 删除角色
- 预览角色文本素材
- 维护头像、标签、状态

Role 页面不负责：

- 决定最终请求里的 system prompt 排序
- 把角色直接插进聊天消息列表
- 决定 provider-specific 请求格式

## 目录结构

```text
desktop/src/features/Settings/pages/Personas/
  components/
    RoleAvatar.tsx
    RoleCard.tsx
    RoleEditor.tsx
    RoleFieldDrawer.tsx
    RoleList.tsx
    RolePreviewDrawer.tsx
    RoleSectionTitle.tsx
  hooks/
    useRoles.ts
  i18n/
    en-US.ts
    zh-CN.ts
    index.ts
    useRoleTranslation.ts
  constants.ts
  types.ts
  utils.ts
  index.tsx
```

## 字段语义

| 字段 | 含义 | 作用 |
| --- | --- | --- |
| `name` | 角色名称 | 列表标题、Chat 标签、后续 prompt 标识 |
| `summary` | 一句话简介 | 列表副标题、搜索摘要、tooltip |
| `avatarId` | 头像 ID | Chat 助手头像与角色标签头像 |
| `status` | `active` / `draft` | 控制角色是否可被 Chat 选择 |
| `tags` | 标签数组 | 搜索、筛选、辅助识别 |
| `prompt.description` | 角色描述 | 身份、背景、定位 |
| `prompt.worldview` | 世界观 | 判断方式、价值基底 |
| `prompt.persona` | 人格核心 | 稳定行为和口吻 |
| `prompt.scenario` | 场景 | 常见工作环境与关系 |
| `prompt.exampleDialogues` | 示例对话 | 风格示范 |
| `prompt.style` | 表达风格 | 句长、语气、结构 |
| `prompt.constraints` | 约束规则 | 硬边界与冲突优先级 |

## 字段与 Prompt 编排的关系

页面字段本身不是最终 prompt 文本，更适合视作“可编译素材”。

也就是说：

- `description`、`worldview`、`persona` 等字段是结构化输入
- 最终是输出成一条还是多条注入消息，应由 prompt builder 决定
- 同一个字段未来可以在不同 generation type 下采用不同模板

所以 Role 页面保存的是素材，不是最终聊天请求片段。

## 状态管理

当前统一由 `useRoles.ts` 管理：

- `roles`
- `selectedRoleId`
- `draft*`
- `isEdited`
- `formErrors`
- `activeField`
- `fieldEditorValue`

保存链路：

1. 页面初始化请求 `GET /roles`
2. 新建角色调用 `POST /roles`
3. 编辑保存调用 `PATCH /roles/:id`
4. 删除调用 `DELETE /roles/:id`

## 校验约定

### 硬校验

- `name` 必填
- `name` 最长 50 字符
- `summary` 最长 120 字符

### 软提示

- `description`、`persona`、`scenario` 同时为空时，提示“模型可能无法识别该角色”

### `tags`

- 最多 3 个
- `trim` 后过滤空值

## 当前已知边界

下面这些点现在要按真实现状理解：

- 角色与 chat 线程的绑定已经支持 `roleId` 持久化
- 页面里的 Role Preview 仍更接近“素材预览”，不等于真实 request snapshot
- 真正的 request-only 注入已经落到线程上下文层，不由页面本身承担

## 后续最值得补什么

- 把 Preview 从“文本拼接预览”升级为“request messages 调试预览”
- 支持角色字段编译结果的结构化调试
- 当角色编译链更完整后，页面可增加“编译后的注入消息预览”

## 相关文档

- `README.md`
- `role-api.md`
- `chat-integration.md`
- `prompt-injection-design.md`

