# 第三方集成前端设计

Status: Planned
Owner: frontend / runtime / auth
Last verified: 2026-06-27
Layer: raw-source
Module: Develoments
Feature: EnterpriseIntegration
Doc Type: design

## 单点真相范围

这页只回答一件事：

当前项目如果接入企业微信、飞书等第三方平台，前端应该怎样设计。

它覆盖：

- `Settings -> Integrations` 的产品定位
- 前端页面结构、交互模型和状态模型
- renderer / preload / backend 的前端侧边界
- 第一期 POC 的最小前端方案

它不覆盖：

- 第三方平台具体 API 细节
- backend provider 实现细节
- 最终视觉稿或像素级 UI 规范

相关文档：

- `integrations/enterprise-wecom-integration-poc.md`
- `integrations/lark-feishu-integration-poc.md`
- `integrations/wecom-vs-lark-integration-selection.md`

## Goal

前端方案的目标不是做一个“应用启动器”，而是做一个：

- 第三方集成控制台
- 集成市场入口
- 集成状态观测面板

换句话说，前端负责：

- 看见有哪些集成
- 看见哪些已接入
- 发起配置、绑定、同步、测试通知等动作
- 在业务页面感知这些集成已经生效

前端不负责：

- 保存第三方 secret 真值
- 拼第三方协议细节
- 直接调用第三方开放平台 API
- 做最终权限判断

## 产品定位

第三方集成在产品语义上应理解为：

- `Integrations`

而不是：

- AI 应用商店
- 小程序启动器
- 单纯的 provider logo 列表

这意味着首页可以借鉴“市场 / 宫格 / 搜索”的视觉方向，但产品语义必须是：

- 首页像市场
- 卡片带状态
- 点击进入管理页
- 配置完成后在业务模块内生效

## 设计原则

### 1. 前端是控制台，不是执行层

renderer 只负责展示、配置、触发和反馈。

第三方平台能力真相必须仍在 backend。

### 2. 首页是概览，不是终点

`Integrations` 首页只负责回答：

- 有哪些平台
- 哪些已接入
- 哪些可接入
- 当前状态如何

具体操作应落到 provider 详情页。

### 3. 统一视图优先于平台特化

企业微信、飞书、未来钉钉，不应一开始就在前端长成三套完全不同的 UI。

前端应先围绕统一状态模型和统一详情布局设计，再逐步容纳平台差异。

### 4. 配置完成后必须能在业务页面被感知

如果前端只有 `Settings -> Integrations`，没有把能力投放到：

- 登录
- 知识库
- 评测任务
- 通知结果

那么集成能力对用户来说就是“配完了但没用起来”。

## 信息架构

建议新增一级设置入口：

- `Settings -> Integrations`

前端结构建议分两层：

### 1. Integrations 首页

作用：

- 展示所有 provider
- 支持搜索
- 区分已接入与未接入
- 提供状态概览

建议区块：

- 搜索框
- `已接入`
- `推荐接入`
- `全部平台`

### 2. Provider 详情页

作用：

- 管理某个具体平台
- 展示该平台配置、同步、能力开关和日志

建议 tab：

- `Overview`
- `Connection`
- `Sync`
- `Capabilities`
- `Logs`

## 首页设计

首页可以借鉴“宫格市场”的视觉方向，但不能做成纯 logo 启动器。

每张卡片至少应有：

- 平台 logo
- 平台名称
- 一行能力摘要
- 状态 badge
- 最近同步或最近错误摘要
- 能力 tags

示例：

- 企业微信
  - 身份、组织同步、通知
  - `Connected`
  - `上次同步 2h 前`
  - tags: `Identity` `Org` `Notify`
- 飞书
  - 文档知识源、通知、身份
  - `Available`
  - tags: `Knowledge` `Notify`

## 详情页设计

建议统一使用同一套详情页骨架。

### Overview

展示：

- 连接状态
- 当前绑定状态
- 最近一次同步
- 最近错误
- 当前启用能力摘要

### Connection

展示和操作：

- 配置摘要
- 绑定入口
- 测试连接
- 启用 / 禁用 provider

### Sync

展示和操作：

- 手动同步按钮
- 最近同步结果
- 同步时间
- 同步错误摘要

### Capabilities

展示和操作：

- 身份接入：开 / 关
- 组织同步：开 / 关
- 通知：开 / 关
- 知识源：开 / 关
- 审批 / workflow：开 / 关

### Logs

展示：

- 最近 20 条集成事件
- 失败、成功、重试状态
- 失败摘要

## 状态模型

前端不要围着平台原生字段建模，应围绕统一集成状态建模。

建议前端类型草图：

```ts
export type IntegrationProvider = 'wecom' | 'lark';

export type IntegrationStatus =
  | 'not_configured'
  | 'connected'
  | 'degraded'
  | 'error';

export type IntegrationCapabilityKey =
  | 'identity'
  | 'org_sync'
  | 'notify'
  | 'knowledge_source'
  | 'workflow';

export interface IntegrationCapabilitySummary {
  key: IntegrationCapabilityKey;
  enabled: boolean;
  available: boolean;
}

export interface IntegrationSummary {
  provider: IntegrationProvider;
  name: string;
  status: IntegrationStatus;
  enabled: boolean;
  description: string;
  lastSyncAt?: string;
  lastError?: string;
  capabilities: IntegrationCapabilitySummary[];
}
```

这样前端就不会被企业微信、飞书各自字段牵着走。

## 关键交互

第一阶段建议只支持这些明确动作：

- 查看连接状态
- 配置基础连接信息
- 发起身份绑定
- 手动同步组织
- 发送测试通知
- 查看最近错误
- 查看能力开关状态

不建议第一期支持：

- 复杂组织树编辑器
- 可视化权限编排器
- 多平台工作流设计器
- 大型审批设计后台

## 与业务页面的连接

前端不能只把第三方能力困在设置页里。

配置完成后，能力必须在具体业务页被感知。

### 登录 / 账户页

应体现：

- 绑定企业微信
- 绑定飞书
- 当前外部身份状态

### 知识库页

应体现：

- 按部门 / 用户授权
- 外部知识源入口
- 导入完成后的通知结果

### 评测 / 任务页

应体现：

- 任务完成后是否通知第三方
- 失败时是否通知负责人

### 聊天页

第一阶段不建议直接暴露大量第三方入口。

后续如果需要，可逐步接入：

- 外部知识源引用
- 发消息 / 发审批动作
- 责任人推荐

## 前端边界

这几个边界应在前端设计时固定：

- 不在 renderer 保存第三方 secret 真值
- 不在前端做最终权限判断
- 不在前端拼第三方 API 协议细节
- 不让业务页面直接依赖平台原生字段
- 所有 provider 差异优先由 backend 归一

## 建议目录结构

结合当前项目，建议前端目录落在：

- `desktop/src/features/Settings/pages/Integrations/`

建议文件结构：

- `index.tsx`
- `api.ts`
- `types.ts`
- `hooks/useIntegrations.ts`
- `components/IntegrationProviderCard.tsx`
- `components/IntegrationDetailLayout.tsx`
- `components/IntegrationStatusPanel.tsx`
- `components/IntegrationSyncPanel.tsx`
- `components/IntegrationCapabilitiesPanel.tsx`
- `components/IntegrationLogsPanel.tsx`

如果现有 Settings 页面已有稳定 layout 和 panel 模式，应优先复用现有组件风格，不另起一套视觉语言。

## POC 最小前端方案

如果只做第一阶段 POC，前端一个页面加一个详情页就够。

### 首页

展示：

- 企业微信
- 飞书
- 状态
- 能力摘要
- 搜索

### 企业微信详情页

展示和操作：

- 已连接 / 未连接
- 已绑定 / 未绑定
- 最近同步时间
- 手动同步按钮
- 测试通知按钮
- 最近一次错误

这已经足够支撑企业微信 POC 的业务闭环。

## Recommendation

前端最稳的方案是：

- 用 `Settings -> Integrations` 作为统一入口
- 首页做带状态的集成市场
- 点击卡片进入 provider 详情页
- 配置、绑定、同步、测试都放在详情页
- 配置完成后的价值在登录、知识库、任务页面被感知

前端不要做成纯 logo 宫格应用商店，而应做成：

- 第三方集成控制台
- 集成市场入口
- 集成状态观测面板
