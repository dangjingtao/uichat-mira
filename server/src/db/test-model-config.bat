@echo off
REM 模型配置 API 测试脚本 (Windows)

set BASE_URL=http://127.0.0.1:8787

echo === 测试模型配置 API ===
echo.

echo 1. 获取所有默认模型配置...
curl -s %BASE_URL%/api/models
echo.
echo.

echo 2. 获取 LLM 默认配置...
curl -s %BASE_URL%/api/models/llm/config
echo.
echo.

echo 3. 获取 Embedding 默认配置...
curl -s %BASE_URL%/api/models/embedding/config
echo.
echo.

echo 4. 获取 ReRank 默认配置...
curl -s %BASE_URL%/api/models/rerank/config
echo.
echo.

echo 5. 获取参数模板...
curl -s %BASE_URL%/api/models/param-templates
echo.
echo.

echo 6. 更新 LLM 配置 ^(修改 temperature^)...
curl -s -X PUT %BASE_URL%/api/models/llm/config -H "Content-Type: application/json" -d "{\"params\": {\"temperature\": 0.9}}"
echo.
echo.

echo 7. 创建新模型配置...
curl -s -X POST %BASE_URL%/api/models/configs -H "Content-Type: application/json" -d "{\"type\": \"llm\", \"name\": \"test-model\", \"params\": {\"enabled\": true, \"temperature\": 0.5}}"
echo.
echo.

echo 8. 获取所有 LLM 配置...
curl -s "%BASE_URL%/api/models/configs?type=llm"
echo.
echo.

echo === 测试完成 ===
pause
