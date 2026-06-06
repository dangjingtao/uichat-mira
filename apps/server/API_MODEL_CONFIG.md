# 模型配置 API 文档

## 基础信息

- **Base URL**: `http://127.0.0.1:8787`
- **API 文档**: `http://127.0.0.1:8787/docs`

## 接口列表

### 1. 获取所有默认模型配置

```
GET /api/models
```

**响应示例:**
```json
{
  "ok": true,
  "data": [
    {
      "id": "abc123...",
      "type": "llm",
      "name": "gemma4:e4b",
      "params": {
        "enabled": true,
        "temperature": 0.7,
        "topP": 0.9,
        "topK": 40,
        "maxTokens": 2048,
        "frequencyPenalty": 0,
        "presencePenalty": 0
      },
      "isDefault": true,
      "createdAt": "2026-06-07T10:00:00.000Z",
      "updatedAt": "2026-06-07T10:00:00.000Z"
    }
  ]
}
```

---

### 2. 获取指定类型的默认配置

```
GET /api/models/:type/config
```

**参数:**
- `type`: `llm` | `embedding` | `rerank`

**示例:**
```bash
curl http://127.0.0.1:8787/api/models/llm/config
```

**响应示例:**
```json
{
  "ok": true,
  "data": {
    "id": "abc123...",
    "type": "llm",
    "name": "gemma4:e4b",
    "params": {
      "enabled": true,
      "temperature": 0.7,
      "topP": 0.9,
      "topK": 40,
      "maxTokens": 2048,
      "frequencyPenalty": 0,
      "presencePenalty": 0
    },
    "isDefault": true,
    "createdAt": "2026-06-07T10:00:00.000Z",
    "updatedAt": "2026-06-07T10:00:00.000Z"
  }
}
```

---

### 3. 更新指定类型的默认配置

```
PUT /api/models/:type/config
```

**参数:**
- `type`: `llm` | `embedding` | `rerank`

**请求体:**
```json
{
  "name": "new-model-name",
  "params": {
    "temperature": 0.8,
    "topP": 0.95
  }
}
```

**示例:**
```bash
curl -X PUT http://127.0.0.1:8787/api/models/llm/config \
  -H "Content-Type: application/json" \
  -d '{
    "name": "gemma4:e4b",
    "params": {
      "temperature": 0.8
    }
  }'
```

**响应示例:**
```json
{
  "ok": true,
  "data": {
    "id": "abc123...",
    "type": "llm",
    "name": "gemma4:e4b",
    "params": {
      "enabled": true,
      "temperature": 0.8,
      "topP": 0.95,
      "topK": 40,
      "maxTokens": 2048,
      "frequencyPenalty": 0,
      "presencePenalty": 0
    },
    "isDefault": true,
    "createdAt": "2026-06-07T10:00:00.000Z",
    "updatedAt": "2026-06-07T10:30:00.000Z"
  }
}
```

---

### 4. 获取参数模板

```
GET /api/models/param-templates
```

**查询参数 (可选):**
- `type`: `llm` | `embedding` | `rerank`

**示例:**
```bash
# 获取所有模板
curl http://127.0.0.1:8787/api/models/param-templates

# 获取指定类型模板
curl http://127.0.0.1:8787/api/models/param-templates?type=llm
```

**响应示例:**
```json
{
  "ok": true,
  "data": {
    "llm": [
      {
        "key": "temperature",
        "label": "Temperature",
        "type": "number",
        "step": 0.1,
        "defaultValue": 0.7
      },
      {
        "key": "topP",
        "label": "Top P",
        "type": "number",
        "step": 0.1,
        "defaultValue": 0.9
      }
    ],
    "embedding": [...],
    "rerank": [...]
  }
}
```

---

### 5. 获取所有模型配置

```
GET /api/models/configs
```

**查询参数 (可选):**
- `type`: `llm` | `embedding` | `rerank`

**响应示例:**
```json
{
  "ok": true,
  "data": [
    {
      "id": "abc123...",
      "type": "llm",
      "name": "gemma4:e4b",
      "params": {...},
      "isDefault": true,
      "createdAt": "2026-06-07T10:00:00.000Z",
      "updatedAt": "2026-06-07T10:00:00.000Z"
    },
    {
      "id": "def456...",
      "type": "llm",
      "name": "qwen3:latest",
      "params": {...},
      "isDefault": false,
      "createdAt": "2026-06-07T11:00:00.000Z",
      "updatedAt": "2026-06-07T11:00:00.000Z"
    }
  ]
}
```

---

### 6. 创建新模型配置

```
POST /api/models/configs
```

**请求体:**
```json
{
  "type": "llm",
  "name": "qwen3:latest",
  "params": {
    "enabled": true,
    "temperature": 0.7,
    "topP": 0.9
  }
}
```

**示例:**
```bash
curl -X POST http://127.0.0.1:8787/api/models/configs \
  -H "Content-Type: application/json" \
  -d '{
    "type": "llm",
    "name": "qwen3:latest",
    "params": {
      "enabled": true,
      "temperature": 0.7
    }
  }'
```

**响应示例:**
```json
{
  "ok": true,
  "data": {
    "id": "new-id...",
    "type": "llm",
    "name": "qwen3:latest",
    "params": {
      "enabled": true,
      "temperature": 0.7
    },
    "isDefault": false,
    "createdAt": "2026-06-07T12:00:00.000Z",
    "updatedAt": "2026-06-07T12:00:00.000Z"
  }
}
```

---

### 7. 删除模型配置

```
DELETE /api/models/configs/:id
```

**示例:**
```bash
curl -X DELETE http://127.0.0.1:8787/api/models/configs/def456...
```

**响应示例:**
```json
{
  "ok": true,
  "message": "Config deleted"
}
```

**注意:** 默认配置无法删除，只能删除非默认配置。

---

## 数据库表结构

### model_configs 表

| 字段 | 类型 | 说明 |
|------|------|------|
| id | TEXT | 主键 (UUID) |
| type | TEXT | 模型类型 (llm/embedding/rerank) |
| name | TEXT | 模型名称 |
| params | TEXT | JSON 格式的参数 |
| is_default | INTEGER | 是否为默认配置 (0/1) |
| created_at | TEXT | 创建时间 |
| updated_at | TEXT | 更新时间 |

### model_param_templates 表

| 字段 | 类型 | 说明 |
|------|------|------|
| id | TEXT | 主键 (UUID) |
| model_type | TEXT | 模型类型 |
| param_key | TEXT | 参数键名 |
| param_label | TEXT | 参数显示标签 |
| param_type | TEXT | 参数类型 (number/select/boolean) |
| step | REAL | 数字输入的步长 |
| options | TEXT | 下拉选项 (JSON) |
| default_value | TEXT | 默认值 (JSON) |
| created_at | TEXT | 创建时间 |

---

## 使用建议

### 前端集成

1. **获取配置**: 页面加载时调用 `GET /api/models` 获取所有默认配置
2. **更新配置**: 用户修改参数后调用 `PUT /api/models/:type/config`
3. **参数模板**: 调用 `GET /api/models/param-templates` 获取参数元数据，动态渲染表单

### 配置持久化

前端可以按以下策略保存配置：

1. **实时保存**: 用户修改时自动调用 API 保存
2. **手动保存**: 提供"保存"按钮，用户点击后保存
3. **批量保存**: 页面离开时检查是否有未保存的修改

### 错误处理

所有接口都返回统一格式：

**成功:**
```json
{
  "ok": true,
  "data": {...}
}
```

**失败:**
```json
{
  "ok": false,
  "message": "错误描述"
}
```
