# 工具协议（Tools Protocol）

本应用采用「文件即工具」的约定：每个工具是一个文件夹，放在 `server/tools/`（内置）或 `server/extendTools/`（扩展）下，通过 `manifest.json` 声明元数据和运行时配置。

## 目录布局

```text
server/
  tools/                 # 内置工具，随应用发布
    web-search/
      manifest.json
  extendTools/           # 用户/第三方扩展工具，覆盖内置同名工具
    my-tool/
      manifest.json
      prompt.md
```

加载规则：

- 启动时扫描 `tools/` 与 `extendTools/`；
- `extendTools/` 中的同名工具会覆盖 `tools/` 中的内置工具；
- 仅读取一级子目录，子目录名不要求与 `id` 一致。

## manifest.json

```json
{
  "id": "web-search",
  "name": "Web Search",
  "description": "Search the public web and return a list of titles, links, and snippets.",
  "version": "1.0.0",
  "category": "tool",
  "tags": ["search", "web"],
  "author": "ui-chat-rag-tester",
  "parameters": {
    "type": "object",
    "required": ["query"],
    "properties": {
      "query": { "type": "string" }
    }
  },
  "runtime": {
    "type": "search",
    "engine": "duckduckgo",
    "maxResults": 5
  }
}
```

### 字段说明

| 字段 | 必填 | 说明 |
| --- | --- | --- |
| `id` | 是 | 工具唯一标识 |
| `name` | 是 | 显示名称 |
| `description` | 是 | 用途说明 |
| `category` | 是 | `rag` / `system` / `tool` |
| `tags` | 是 | 前端分组与筛选标签 |
| `version` | 否 | 版本号 |
| `author` | 否 | 作者 |
| `parameters` | 否 | 调用参数 JSON Schema |
| `runtime` | 是 | 运行时配置，见下文 |

## 运行时类型

### `search`：搜索工具

```json
{
  "type": "search",
  "engine": "duckduckgo",
  "maxResults": 5
}
```

- `engine`：`duckduckgo` 或 `tavily`；
- 使用 Tavily 时需配置环境变量 `TAVILY_API_KEY`。

### `prompt`：提示词工具

```json
{
  "type": "prompt",
  "entry": "prompt.md",
  "modelRole": "task"
}
```

- `entry`：相对于工具目录的 prompt 模板文件；
- 模板使用 `{{key}}` 占位符，渲染后交给指定角色模型执行。

### `filesystem`：文件系统工具

```json
{
  "type": "filesystem",
  "baseDir": "data/tool-files",
  "allowedOperations": ["read", "write", "list"]
}
```

- `baseDir`：允许访问的根目录，相对后端工作目录；
- `allowedOperations`：允许的操作，可选，默认全部；
- 仅支持相对路径，禁止 `..` 和绝对路径。

## 后端接口

- `GET /tools`：返回所有已加载工具的元数据列表，用于「设置-工具」页展示。

## 打包

`server/build.js` 在构建后端产物时会将 `server/tools/` 复制到 `.artifacts/server-bundle/tools/`，最终随 `resources/server/` 一起打包进桌面应用。

## 后续扩展

- 让 Agent 在聊天流程中通过 tool-call 调用这些工具；
- 增加 `script` 运行时类型，支持自定义代码工具；
- 为扩展工具提供导入/导出与版本锁定能力。
