# 模型配置 API 快速开始

## 启动服务

```bash
cd server
npm run dev
# 或 npm start
```

服务启动后默认监听 `http://<backend-host>:<backend-port>`。

## API 文档

启动后访问 `http://<backend-host>:<backend-port>/docs` 查看 Swagger UI 文档。

## 快速测试

### Linux / macOS

```bash
chmod +x test-model-config.sh
./test-model-config.sh
```

### Windows

```cmd
test-model-config.bat
```

### 手动测试

你也可以使用 `curl` 或 Postman：

```bash
# 1. 获取所有配置
curl http://<backend-host>:<backend-port>/models

# 2. 获取单个配置
curl http://<backend-host>:<backend-port>/models/llm/config

# 3. 更新配置
curl -X PUT http://<backend-host>:<backend-port>/models/llm/config   -H "Content-Type: application/json"   -d '{"params": {"temperature": 0.8}}'

# 4. 获取参数模板
curl http://<backend-host>:<backend-port>/models/param-templates
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

1. 检查端口是否被占用：`lsof -i :<backend-port>`（Linux/macOS）或 `netstat -ano | findstr :<backend-port>`（Windows）
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
3. 尝试删除数据库文件并重启服务

## 下一步

- 查看完整 API 文档：`API_MODEL_CONFIG.md`
- 访问 Swagger UI：`http://<backend-host>:<backend-port>/docs`
- 集成到前端应用
