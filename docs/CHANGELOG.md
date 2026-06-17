
# 更新日志

本项目所有重要变更将记录在此文件中。

格式基于 [Keep a Changelog](https://keepachangelog.com/zh-CN/1.1.0/)，
版本遵循 [语义化版本](https://semver.org/lang/zh-CN/)。

---

## [0.5.0] - 2026-06-17

### 新增

#### 桌面端
- **国际化（i18n）架构** - 新增 i18n 分片机制，支持在各 `features/` 与 `app/` 目录下自建 `i18n/` 翻译文件，通过 `deepMerge` 汇入同一命名空间；新增 Dashboard、Chat、Settings、App 布局、通用 UI 五大模块翻译文件
- **页面级全面国际化** - `ChatPage`、`ThreadListSidebar`、`RagProgressDetailDrawer`、`HomePage`、`About`、`Tools`、`KnowledgeBase/Add`、`ModelSetting`、`Evaluation/exportMarkdown` 等页面与组件全部接入 `useTranslation`
- **布局与通用组件国际化** - `Sidebar`、`ErrorBoundary`、`FileUploadDropzone`、`FileListItem`、`StatusIndicator` 接入 `useTranslation`
- **主题与语言系统** - 新增 `LanguageProvider`、`ThemeProvider` 与 `shared/theme/` 主题体系，支持亮色/暗色切换与语言状态管理
- **评测工作台** - 新增 `Evaluation/Workbench.tsx`、`Center.tsx` 与配套组件（`DetailDrawer`、`MetricGrid`、`StatusBadge`、`EvaluationPackageGeneratorModal`），支持评测执行、结果查看与报告导出
- **聊天体验增强** - 新增 `ThreadComposer`、`ThreadHeader`、`thread.parsers` 与 `useThreadComposerState`，重构 `BackendThreadListAdapter` 与 `Thread/` 组件目录
- **RAG 进度详情** - 新增 `RagProgressDetailDrawer` 与 `RagExecutionTrace`，可视化展示检索与生成流程细节
- **UI 组件扩展** - 新增 `Modal`、`Select`、`Table` 等共享组件，完善 `COMPONENTS.md` 与 `ui-design-guidelines-tailwind.md`

#### 服务端
- **评测服务** - 新增 `evaluation.service.ts`、`evaluation-package-generator.service.ts`、`evaluation.db.ts` 与 `evaluation/` 路由，支持评测数据集管理、执行记录存储与 Markdown 报告生成
- **RAG 运行时观测** - 新增 `rag-runtime-observer.ts` 与 `rag-runtime/` 路由，支持对 RAG Pipeline 执行过程的实时观测与事件推送
- **RAG 节点增强** - 新增 `retrieve.service.ts`、`rerank.service.ts`，完善 `rag-node-contract.ts` 与 `rag-node-observation.ts`，规范节点输入输出与观测数据
- **供应商代理增强** - 新增 `provider-proxy.service.ts`，支持 OpenAI 兼容供应商的统一代理与转发
- **公共 API 配置** - 新增 `public-api.ts`，集中管理对外暴露的服务接口与配置
- **数据库扩展** - 扩展 `schema.ts` 与相关数据库模块，支撑评测、RAG 观测等新业务表结构

#### 文档
- **评测工作台文档** - 新增 `docs/evaluation-workbench.md`，说明评测功能的使用方式与指标含义
- **RAG 流程文档** - 更新 `docs/rag-langgraph-flow.md`，补充运行时观测与节点契约说明

### 变更

#### 桌面端
- **i18n 配置重构** - 将内联的单一 `resources` 对象拆分为独立的 `zh-CN.ts` 与 `en-US.ts`，提升可维护性
- **模型与平台配置** - 重构 `ModelSetting`、`ModelConfig`、`ModelRow`、`ApiConfigCard`、`DefaultModelCard`、`PlatformCard`、`PlatformConfigModal` 等组件，优化配置交互与状态同步
- **设置页面增强** - 优化 `General/index.tsx`、`HealthCheck`、`LogsButtons` 等设置子页面结构与样式
- **关于页优化** - `fallbackAppMeta` 改为 `getFallbackAppMeta(t)` 函数，使 fallback 元数据随语言切换
- **知识库页面增强** - 优化 `KnowledgeBase/index.tsx`、`Detail.tsx`、`Add.tsx` 的交互与展示

#### 服务端
- **模型配置服务** - 重构 `model-config.service.ts`、`model-config.defaults.ts` 与 `model-config.db.ts`，优化默认配置加载与持久化逻辑
- **供应商设置服务** - 重构 `provider-settings.service.ts` 与相关路由/schema，增强参数校验与错误处理
- **RAG 流程重构** - 优化 `rag-graph.ts`、嵌入/生成/重排/检索节点，提升 Pipeline 稳定性与可观测性
- **应用元数据路由** - 更新 `app-meta.ts` 路由，支持返回当前 Git 分支与版本提交记录

### 修复

#### 桌面端
- **TypeScript 类型错误** - 修复 `zh-CN.ts` 中文引号导致的解析错误，以及 `TFunction` 从 `react-i18next` 错误导入的问题
- **UI 样式修复** - 修复 `styles.css` 与 `tailwind.config.cjs` 中的样式冲突与配置遗漏

---

## [0.4.0] - 2026-06-15

### 新增

#### 桌面端
- **当前会话上下文** - 新增 `CurrentThreadProvider`，统一管理当前对话线程状态
- **知识库可用性上下文** - 新增 `KnowledgeBaseAvailabilityProvider`，用于跨页面共享知识库可用状态
- **角色模型配置上下文** - 新增 `RoleModelConfigProvider`，支持按角色维护模型配置
- **评测模块** - 新增评测相关设置页面与组件入口
- **RAG 进度详情抽屉** - 新增 `RagProgressDetailDrawer`，用于展示检索与生成流程细节
- **线程 UI 组件** - 新增 `Thread/` 组件目录，增强对话线程展示能力
- **关于页 Git 信息** - 在关于页展示当前 Git 分支与基于 tag 的版本提交记录，无数据时自动隐藏

#### 服务端
- **知识库预览服务** - 新增 `knowledge-base.preview.service.ts`
- **RAG 事件模型** - 新增 `rag-events.ts`，统一描述 RAG 流程事件
- **RAG 节点契约** - 新增 `rag-node-contract.ts` 与 `rag-node-observation.ts`，规范节点输入输出与观测数据
- **检索增强节点** - 新增查询改写、词法检索等 RAG 节点服务
- **RAG 响应常量** - 新增 `rag-response-constants.ts`，统一响应状态与提示文案

#### 文档
- **RAG 节点开发文档** - 新增 `docs/architecture/rag-node-development.md`

### 变更

#### 桌面端
- **应用布局优化** - 调整 `App`、基础布局、侧边栏与线程侧栏结构
- **设置页面重构** - 优化 API 配置、默认模型、模型配置、平台配置、通用设置、日志按钮等设置组件
- **知识库页面增强** - 优化知识库列表、新增、详情页面与知识库 API 调用
- **模型设置页面增强** - 完善模型设置页面与相关配置交互
- **登录与入口优化** - 调整登录页、路由与应用入口初始化流程
- **UI 组件升级** - 优化 Divider、Input、NavItem、Thread、Tooltip 等共享组件
- **品牌资源更新** - 更新应用 Logo 与图标资源
- **样式系统优化** - 调整全局样式与 Tailwind 配置

#### 服务端
- **知识库服务增强** - 优化知识库仓储、拆分、向量存储、常量与路由实现
- **RAG 流程重构** - 优化 RAG Graph、Pipeline、Runables 及嵌入、生成、重排、检索节点
- **供应商代理增强** - 优化 provider catalog、代理路由、OpenAI 兼容供应商与供应商设置服务
- **模型配置优化** - 调整模型配置数据库、默认配置与服务逻辑
- **服务入口与日志优化** - 更新服务入口注册流程与日志实现

#### 桌面壳与打包
- **Electron 主进程更新** - 优化 Electron 主进程运行逻辑
- **Tauri 桌面端更新** - 调整 Tauri 主进程与配置
- **构建脚本优化** - 更新 Electron、Tauri 打包脚本与版本同步脚本

#### 文档
- **项目文档更新** - 更新 README、文档索引、架构说明、聊天系统实践、知识库 MVP、平台说明、供应商代理 API、RAG LangGraph 流程与版本管理文档

### 移除

#### 桌面端
- 移除旧的 `threadListRefresh.ts` 线程刷新工具，改由新的上下文与线程组件机制承载

---

## [0.3.0] - 2026-06-09

### 新增

#### 桌面端
- **平台配置模态框** - 新增 `PlatformConfigModal.tsx` 组件
- **知识库功能** - 新增 `KnowledgeBase/Add.tsx`、`KnowledgeBase/Detail.tsx` 页面
- **模型设置 API** - 新增 `modelSettings.ts` API 模块
- **UI 组件库文档** - 新增 `COMPONENTS.md` 组件文档
- **Modal 组件** - 新增 `Modal.tsx` 模态框组件
- **状态指示器** - 新增 `StatusIndicator.tsx` 组件
- **Tailwind UI 设计指南** - 新增 `ui-design-guidelines-tailwind.md` 设计规范
- **开发启动器** - 新增 `electron/dev-launcher.cjs` 开发环境启动器

#### 服务端
- **供应商设置仓储层** - 新增 `provider-settings.repository.ts`
- **账户路由** - 新增 `account.ts` 路由
- **供应商设置路由** - 新增 `provider-settings.ts` 路由
- **默认模型配置服务** - 新增 `model-config.defaults.ts`
- **供应商设置服务** - 新增 `provider-settings.service.ts`
- **加密工具** - 新增 `crypto.ts` 加密工具模块
- **Swagger/OpenAPI 文档完善** - 为 `health`、`dbHealth`、`login`、`me`、`account`、`knowledge-base`、`model-config`、`provider-settings`、`proxy-ollama` 路由补充完整的 `tags` / `summary` / `description` / `operationId` / `responses` 定义，OpenAPI 规范覆盖全部 17 个接口

### 变更

#### 桌面端
- **Sidebar 组件** - 重构布局和样式
- **AuthProvider** - 认证逻辑优化
- **路由配置** - `router.tsx` 路由调整
- **设置页面重构** - `ApiConfigCard`、`DefaultModelCard`、`ModelConfig`、`ModelRow`、`PlatformCard` 等组件大幅重构
- **关于页面** - `About/index.tsx` 界面优化
- **账户页面** - `Account/index.tsx` 功能完善
- **健康检查** - `HealthCheck/index.tsx` 重构
- **知识库页面** - `KnowledgeBase/index.tsx` 完整重写
- **模型设置页面** - `ModelSetting/index.tsx` 优化
- **登录页面** - `LoginPage.tsx` UI 改进
- **首页** - `HomePage.tsx` 界面重构
- **运行时健康检查** - `useRuntimeHealth.ts` Hook 优化
- **API 模块** - `auth.ts`、`index.ts` 重构
- **UI 组件** - `Button`、`Card`、`FullPageStatus`、`IconButton`、`Input`、`Message`、`NavItem`、`Table`、`Tooltip` 等组件样式和功能优化
- **样式系统** - `styles.css` 和 `tailwind.config.cjs` 全面升级

#### 服务端
- **数据库 Schema** - `schema.ts` 重构，支持更多字段
- **数据库索引** - `index.ts` 优化
- **模型配置数据库** - `model-config.db.ts` 重构
- **仓储层** - `model-config.repository.ts` 优化
- **数据库快速入门** - `MODEL_CONFIG_QUICKSTART.md` 文档更新
- **认证数据库** - `auth.db.ts` 扩展功能
- **服务层** - `model-config.service.ts` 重构
- **路由优化** - `dbHealth.ts`、`health.ts`、`login.ts`、`me.ts`、`model-config.ts` 等路由优化
- **路由注册风格统一** - `model-config.ts` 和 `provider-settings.ts` 由命名导出 `xxxRoutes(fastify: FastifyInstance)` 改为 default export 的 `FastifyPluginAsync`，与其他路由文件保持一致
- **服务器入口** - `index.ts` 重构
- **OpenAPI Tags 补充** - `index.ts` 中 swagger 注册的 tags 列表补齐 `Knowledge Base` 并为每个 tag 添加中文描述
- **构建脚本** - `build.js` 优化
- **数据库文件** - `uichat-rag-test.db` 数据更新

#### 项目整体
- **Electron 配置** - `package.json` 和 `preload.cjs` 更新
- **文档更新** - `AGENTS.md`、`ARCHITECTURE.md`、`README.md` 全面更新

### 移除

#### 桌面端
- 临时构建文件清理

---

## [0.2.0] - 2026-06-08

### 新增

#### 桌面端
- **Message 组件** - 新增 `Message.tsx` UI 组件
- **代码规范文档** - 新增 `CODING_STANDARDS.md`、`ARCHITECTURE.md`、`IPC_GUIDE.md`
- **项目配置文件** - 新增 `.codex/` 和 `.trae/` 配置目录
- **运行时配置** - 新增 `runtime.config.cjs` 统一管理网络配置
- **图标资源** - 新增 `icons/` 目录，包含多种尺寸的应用图标

#### 服务端
- **数据库 Schema 重构** - 新增 `schema.ts` 统一数据模型定义
- **Repository 模式** - 新增 `repositories/` 目录，实现数据访问层抽象
- **数据库统一入口** - 新增 `db/index.ts` 统一数据库管理
- **模型配置服务增强** - `model-config.service.ts` 功能完善
- **数据库快速入门指南** - `MODEL_CONFIG_QUICKSTART.md` 文档完善

#### 项目整体
- **AGENTS.md** - 新增项目智能体配置文档
- **版本同步脚本** - `sync-version.js` 增强版本管理功能
- **构建脚本优化** - `build-dist.js` 构建流程优化

### 变更

#### 桌面端
- **网络请求优化** - `request.ts` 支持开发/生产环境自动切换
- **Vite 代理配置** - `vite.config.ts` 更新代理规则
- **健康检查功能** - `useRuntimeHealth.ts` 和 `HealthCheck/index.tsx` 重构
- **首页优化** - `HomePage.tsx` 界面改进
- **路由配置** - `router.tsx` 路由结构调整

#### 服务端
- **配置管理** - `config/index.ts` 支持 `runtime.config.cjs` 配置
- **数据库层重构** - `auth.db.ts` 和 `model-config.db.ts` 优化
- **构建系统** - `build.js` 构建脚本升级
- **依赖管理** - `package.json` 更新依赖版本
- **数据库文件** - `uichat-rag-test.db` 数据更新

#### 项目整体
- **pnpm-lock.yaml** - 依赖版本大幅更新
- **Electron 配置** - `main.cjs` 和 `preload.cjs` 功能增强
- **electron-builder.yml** - 打包配置完善
- **README.md** - 项目文档更新
- **文档增强** - `API-Response-Spec.md`、`API_MODEL_CONFIG.md`、`前端-axios封装说明.md`、`版本管理.md` 等文档完善

### 移除

#### 桌面端
- 删除临时构建文件 `vite.config.ts.timestamp-1780855846163-39ef82eadb1e2.mjs`

---

## [0.1.0] - 2026-06-07

### 新增

#### 桌面端
- **登录系统** - 新增登录页面和认证功能
- **聊天功能** - 新增聊天页面、线程列表侧边栏
- **设置页面** - 完整的设置模块，包括：
  - 常规设置（健康检查）
  - 模型配置
  - API 配置
  - 账户管理
  - 知识库设置
  - 关于页面
- **项目结构重构**
  - `app/` - 应用核心（布局、路由、认证提供者）
  - `features/` - 功能模块（认证、聊天、设置、仪表盘）
  - `shared/` - 共享组件和工具
- **路由守卫** - 实现 `RequireAuth`、`GuestOnly` 等路由守卫
- **UI 组件库** - Button、Input、Table、Tooltip 等通用组件

#### 服务端
- **模型配置 API** - 新增模型配置管理接口
- **数据库迁移脚本** - `migrate-db.ts`、`reset-db.ts`、`cleanup-db.ts`
- **日志系统** - 新增 `logger.ts` 日志模块
- **配置管理** - 新增 `config/index.ts` 配置模块
- **数据库层重构**
  - `db/auth.db.ts` - 认证数据库
  - `db/model-config.db.ts` - 模型配置数据库
- **Swagger 文档** - API 文档支持
- **构建脚本** - `build.js` 用于服务端构建

### 变更

#### 桌面端
- 重构 `App.tsx`，拆分为模块化结构
- 更新 `main.tsx` 以支持新的路由系统
- 调整 `vite.config.ts` 和 `tsconfig.json` 配置

#### 服务端
- 重构 `index.ts`，新增路由和服务注册
- 更新 `dbHealth.ts` 健康检查路由
- 调整 `login.ts` 和 `me.ts` 认证路由

### 移除

#### 桌面端
- 删除旧的 `HealthCheck/index.tsx`（已迁移到新位置）

#### 服务端
- 删除旧的 `auth.ts`（已重构为 `db/auth.db.ts`）

---

## [0.0.2] - 2026-06-07

### 新增

- 服务端新增 Swagger API 文档支持

---

## [0.0.1] - 2026-06-07

### 新增

- 项目初始化
- 基础 Electron 桌面应用框架
- Fastify 服务端框架
- pnpm workspace 配置
- TypeScript 配置

