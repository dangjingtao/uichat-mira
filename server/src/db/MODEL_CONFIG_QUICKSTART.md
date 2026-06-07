# 模型配置 API 快速开始

## 启动服务器

```bash
cd apps/server/db
npm run dev
# 或
npm start
```

服务器将在 `http://127.0.0.1:8787` 启动。

## API 文档

启动后访问 `http://127.0.0.1:8787/docs` 查看 Swagger UI 文档。

## 快速测试

### Linux/macOS

```bash
# 给脚本添加执行权限
chmod +x test-model-config.sh

# 运行测试
./test-model-config.sh
```

### Windows

```cmd
test-model-config.bat
```

### 手动测试

使用 curl 或 Postman：

```bash
# 1. 获取所有配置
curl http://127.0.0.1:8787/api/models

# 2. 获取单个配置
curl http://127.0.0.1:8787/api/models/llm/config

# 3. 更新配置
curl -X PUT http://127.0.0.1:8787/api/models/llm/config \
  -H "Content-Type: application/json" \
  -d '{"params": {"temperature": 0.8}}'

# 4. 获取参数模板
curl http://127.0.0.1:8787/api/models/param-templates
```

## 前端集成示例

### React Hook

```typescript
import { useState, useEffect } from 'react';

const useModelConfig = (type: 'llm' | 'embedding' | 'rerank') => {
  const [config, setConfig] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`http://127.0.0.1:8787/api/models/${type}/config`)
      .then(res => res.json())
      .then(data => {
        if (data.ok) {
          setConfig(data.data);
        }
        setLoading(false);
      });
  }, [type]);

  const updateConfig = async (updates: any) => {
    const res = await fetch(`http://127.0.0.1:8787/api/models/${type}/config`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updates),
    });
    const data = await res.json();
    if (data.ok) {
      setConfig(data.data);
    }
    return data;
  };

  return { config, loading, updateConfig };
};

export default useModelConfig;
```

### Vue Composition API

```typescript
import { ref, onMounted } from 'vue';

export function useModelConfig(type: string) {
  const config = ref(null);
  const loading = ref(true);

  const fetchConfig = async () => {
    loading.value = true;
    const res = await fetch(`http://127.0.0.1:8787/api/models/${type}/config`);
    const data = await res.json();
    if (data.ok) {
      config.value = data.data;
    }
    loading.value = false;
  };

  const updateConfig = async (updates: any) => {
    const res = await fetch(`http://127.0.0.1:8787/api/models/${type}/config`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updates),
    });
    const data = await res.json();
    if (data.ok) {
      config.value = data.data;
    }
    return data;
  };

  onMounted(fetchConfig);

  return { config, loading, updateConfig };
}
```

## 数据库

配置数据存储在 SQLite 数据库中，数据库文件位于 `data/rag-demo.db`。

### 查看数据

```bash
sqlite3 data/rag-demo.db

# 查看模型配置
sqlite> SELECT * FROM model_configs;

# 查看参数模板
sqlite> SELECT * FROM model_param_templates;

# 退出
sqlite> .quit
```

### 重置数据

```bash
# 删除数据库文件
rm data/rag-demo.db

# 重启服务器，会自动重新创建数据库并插入默认数据
npm run dev
```

## 故障排除

### 服务器启动失败

1. 检查端口是否被占用：`lsof -i :8787` (Linux/macOS) 或 `netstat -ano | findstr :8787` (Windows)
2. 检查数据库文件权限
3. 查看服务器日志

### API 请求失败

1. 确认服务器正在运行
2. 检查 CORS 配置
3. 查看浏览器控制台错误信息
4. 查看服务器日志

### 数据库问题

1. 确保 SQLite3 已安装
2. 检查数据库文件是否存在
3. 尝试删除数据库文件并重启服务器

## 下一步

- 查看完整 API 文档: `API_MODEL_CONFIG.md`
- 访问 Swagger UI: `http://127.0.0.1:8787/docs`
- 集成到前端应用
