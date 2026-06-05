# UI Chat RAG Tester

一个面向企业知识库验证的 Electron 桌面应用初始化项目，支持本地和远程模型、向量数据库双模式切换。

## 目标功能

- Electron 主进程与桌面应用壳
- 桌面端界面（React + Vite）
- 本地 Node.js 服务（Fastify）
- 桌面应用启动时自动拉起本地 Node 后端
- 健康检查接口：`GET /health`
- 统一模型配置：DeepSeek 远程 / 本地模型（Ollama、vLLM 等）
- 统一向量库配置：本地 sqlite-vec / 远程 pgvector
- 共享类型包，用于前后端配置协议统一

## 技术栈

- 桌面端：Electron + React + Vite + TypeScript
- 本地服务：Node.js + Fastify + Zod
- 共享包：TypeScript declarations
- 包管理：pnpm workspace
- 运行形态：
  - 本地服务 + 本地模型 + 本地向量库
  - 本地服务 + DeepSeek + 远程 pgvector
  - Electron 桌面壳自动启动本地服务

## 项目结构

```text
ui-chat-rag-tester/
  apps/
    desktop/          # 前端界面
    server/           # 本地 Node.js 服务
  packages/
    core/             # 共享类型与协议
  package.json
  pnpm-workspace.yaml
  tsconfig.base.json
```

## 快速开始

1. 安装依赖

```bash
pnpm install
```

2. 启动开发模式（默认由 Electron 自动拉起后端）

```bash
pnpm dev
```

如需同时独立启动所有子项目，可使用：

```bash
pnpm dev:all
```

如果只启动桌面壳：

```bash
pnpm --filter @ui-chat-rag-tester/desktop dev
```

3. 默认地址

- Desktop (Electron shell + Vite): http://localhost:5173
- Server (Fastify): http://localhost:8787
- Health Check: http://localhost:8787/health

4. 开发代理与跨域

- 开发环境：Vite 已配置 `/api` 代理到 `http://127.0.0.1:8787`，前端可直接请求 `/api/*`。
- 生产环境：Fastify 已开启 CORS（`@fastify/cors`），用于 Electron 运行时和其他跨域访问场景。

5. 打包 Windows 安装包

```bash
pnpm --filter @ui-chat-rag-tester/desktop dist
```

打包时会先构建桌面前端，再把后端 bundle 到桌面应用资源里，由 Electron 主进程自动拉起。

## 下一步建议

- 增加文档上传、切分、向量化入库流程
- 增加 RAG 查询链路（检索 + 重排 + 生成）
- 增加 token 统计与成本控制面板
