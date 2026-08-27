---
status: current
owner: runtime / docs
last_verified: 2026-07-31
layer: runbook
module: ModelSetting
feature: FirstModelSetup
doc_type: runbook
canonical: true
related:
  - ../PROVIDER_CURRENT_TRUTH.md
  - README.md
  - ../architecture/provider-api-standards.md
  - ../architecture/provider-proxy-api.md
---

# 第一次模型配置

> 目标：让一个全新 Mira 安装在完成最少配置后，收到第一条真实聊天回复。

## 1. 完成标准

首次配置只有在下面的闭环完成后才算成功：

```text
Provider Connection 已保存
→ 模型 ID 已绑定到主模型
→ 回到 Chat 发送测试消息
→ Provider 返回非空 assistant 文本
```

以下状态都不能单独作为完成证明：

- 设置页出现 Provider 卡片；
- 模型卡显示“已配置”；
- Provider 状态显示 `connected`；
- 模型下拉框出现了远端模型；
- Base URL 和 API Key 已保存。

## 2. 配置前准备

先选择一种路径。

### 本地路径

常见选择：

- Ollama；
- LM Studio；
- 其他 OpenAI-compatible 本地服务。

准备事项：

1. 启动本地模型服务；
2. 下载或加载一个可聊天模型；
3. 确认服务监听地址；
4. 记录远端模型 ID。

默认地址：

| Provider | 默认 Base URL |
| --- | --- |
| Ollama | `http://localhost:11434` |
| LM Studio | `http://127.0.0.1:1234/v1` |

本地服务未启动时，保存配置不会自动启动它。

### 云端路径

准备事项：

1. 有效 API Key；
2. 正确 Base URL；
3. 账号拥有对应模型访问权限；
4. 网络可以访问服务商。

API Key 应直接填入 Mira，不要粘贴到日志、截图或公开文档。

## 3. 打开模型设置

进入：

```text
设置
→ 模型设置
```

页面当前显示六类默认模型：

- 主模型；
- 小任务模型；
- Agent 任务模型；
- 评测模型；
- 向量模型；
- 排序模型。

第一次只处理 **主模型**。

## 4. 打开主模型选择器

在“主模型”卡片右上角打开更多菜单，选择“选择模型”。

该窗口左侧是 Provider Connection，右侧是当前连接配置和模型选择。

## 5. 选择 Provider Connection

### 使用内置连接

选择 Ollama、LM Studio、OpenAI、Google Gemini、Cloudflare、火山引擎或 Ark Plan 连接。

内置连接可以修改 Base URL 和 API Key，但不能删除。

### 创建自定义连接

当服务提供 OpenAI-compatible API，但不属于内置连接时：

1. 选择创建 Provider；
2. 填写显示名称；
3. 填写 Base URL；
4. 填写 API Key；
5. 创建连接。

当前只能创建 `openai-compatible-custom` 类型的自定义连接。可以创建多个实例。

## 6. 填写连接配置

### Base URL

Base URL 必须是 Provider API 根地址，不要填写模型名称或完整 Chat endpoint。

常见错误：

| 错误 | 示例 | 处理 |
| --- | --- | --- |
| 少了 `/v1` | LM Studio 只填 `http://127.0.0.1:1234` | 使用服务实际暴露的 OpenAI-compatible 根地址 |
| 多填了 Chat 路由 | `.../v1/chat/completions` | 改回 API 根地址 |
| Cloudflare 仍有占位符 | `<ACCOUNT_ID>` | 替换为真实 Account ID |
| 本地端口不一致 | 服务在 1234，配置写 9997 | 以服务实际监听端口为准 |

### API Key

- OpenAI 和 Cloudflare 当前运行时要求 API Key；
- Ollama、LM Studio 等本地服务通常可以留空；
- 某些兼容网关即使本地运行，也可能要求自定义 Key。

保存或同步时，Mira 会加密写入本地数据库。

## 7. 同步模型目录

点击模型选择框右侧的圆形箭头。

实际流程：

```text
保存 Base URL / API Key
→ 请求 Provider 模型目录
→ 将结果写入本地 ProviderModel 缓存
→ 更新 connected / error 状态
```

同步成功只说明**模型目录接口**可用。

它不能证明：

- Chat endpoint 可用；
- 选中的模型支持聊天；
- API 账号还有额度；
- 模型支持图片或工具调用；
- 本地模型已完整加载。

## 8. 选择或填写模型 ID

### 从同步列表选择

同步成功后，从“已同步模型”下拉框选择模型。Model Name 会随选择更新。

### 手工填写

某些 Provider 不公开模型目录，或目录里不包含实际部署 ID。此时可以直接在 Model Name 中填写远端 model id。

手工填写不会自动验证该 ID 是否存在。最终仍要通过真实聊天确认。

## 9. 绑定主模型

确认当前 Provider、Base URL、Model Name 后，点击设置主模型或确认选择。

保存后，主模型卡会显示连接与模型名称。

这里的“已配置”只表示：

```text
provider connection 已保存
+
remote model id 已绑定
```

它不是实时健康检查。

## 10. 执行真实聊天测试

返回 Chat，新建一个普通对话，不绑定知识库，不开启复杂工具任务。

发送：

```text
仅回复：OK
```

成功标准：

- 请求没有立刻报错；
- 收到非空 assistant 回复；
- 回复来自刚配置的模型；
- 不依赖历史缓存或旧线程结果。

这一步通过后，主模型首次配置才完成。

## 11. 常见错误

### `ECONNREFUSED` / Connection refused

含义：目标地址没有服务监听，或端口不可达。

检查：

1. Ollama / LM Studio / 本地网关是否已经启动；
2. Base URL 和端口是否正确；
3. Mira 与模型服务是否在同一台设备；
4. 防火墙、代理或容器端口是否阻断。

### `401` / `403`

含义：凭据无效、权限不足或认证格式不被服务接受。

检查：

- API Key 是否完整；
- Key 是否属于当前 Base URL；
- 账号是否有模型权限；
- 兼容网关是否要求自定义 Header 或 Key。

### `404`

含义：Base URL 或协议路径不匹配。

检查：

- 是否把完整 `/chat/completions` 填进 Base URL；
- 是否缺少 `/v1`；
- 服务是否真的提供 OpenAI-compatible 路由；
- Ark Plan 是否选择了正确连接模板。

### 模型目录为空

可能原因：

- Provider 不提供模型列表；
- API Key 无目录权限；
- 本地模型尚未下载；
- 服务返回格式与当前 adapter 不兼容。

可以先手工填写准确 model id，再用 Chat 测试。

### Ollama 提示模型不可用

Mira 在执行时会检查 `/api/tags`。

处理：

1. 使用 Ollama pull 下载模型；
2. 确认名称和 tag 一致；
3. 重新同步；
4. 重新绑定或手工填写正确模型名。

### Cloudflare Base URL 占位符错误

必须把：

```text
https://api.cloudflare.com/client/v4/accounts/<ACCOUNT_ID>/ai/v1
```

中的 `<ACCOUNT_ID>` 换成真实账号 ID。

### 配置显示正常，但聊天失败

这是允许出现的状态差异：

| 状态 | 只证明 |
| --- | --- |
| 卡片已配置 | 已保存模型绑定 |
| Provider connected | 最近一次模型目录同步成功 |
| Chat 有回复 | 当前 Chat invocation 成功 |

以最后一项作为首次配置验收。

## 12. 主模型成功以后再配什么

推荐顺序：

1. 主模型 `llm`；
2. Agent 任务模型 `agentTask`；
3. 小任务模型 `task`；
4. 评测模型 `evaluation`；
5. 向量模型 `embedding`；
6. 排序模型 `rerank`。

### Agent 任务模型

若 `agentTask` 未绑定，当前 Runtime 会回退使用 `task`。这是一条兼容路径，不代表两个角色长期应当保持相同。

### Embedding

远程 Embedding 需要协议匹配；Mira 同时存在内置本地 Embedding Runtime。远程绑定和内置本地能力是两条不同路径。

### Rerank

只有 Provider Template 明确声明 Rerank adapter 时才可用于远程重排。Chat 兼容不能推出 Rerank 兼容。

### Image 与 TTS

第一次聊天不需要配置 Image Generation 或 Voice。

它们当前主要在各自 Studio 中配置：

- Image Generation Studio；
- TTS Studio。

不要用主模型配置是否成功推断生图或语音已经 ready。

## 13. 参数调整

首次测试阶段建议使用默认参数，不要同时改：

- Temperature；
- Top P / Top K；
- Max Tokens；
- Frequency / Presence Penalty。

先证明连接和模型 ID 正确，再调整生成行为。否则连接错误和参数错误会混在一起。

Task 与 AgentTask 当前详情参数在总览中只读，由系统维护稳定参数；模型选择仍可修改。

## 14. 导入与导出安全

模型设置支持导出和导入。

当前导出 JSON 包含：

- Provider Connection；
- Base URL；
- 可恢复的明文 API Key；
- 模型角色绑定；
- 参数。

它是敏感凭据备份，不是普通偏好文件。

禁止：

- 提交到公开 Git 仓库；
- 上传到公开 Issue；
- 发到不可信聊天；
- 放在无访问控制的网盘链接中。

## 15. 最终验收清单

- [ ] 本地服务已启动，或云端 Key 有效；
- [ ] Base URL 是 API 根地址；
- [ ] Provider Connection 已保存；
- [ ] 模型目录同步成功，或已填写准确 Model ID；
- [ ] 模型已绑定为 `llm`；
- [ ] 新 Chat 已收到真实回复；
- [ ] 未把模型设置备份暴露到公开位置；
- [ ] 其他角色只在主模型成功后继续配置。
