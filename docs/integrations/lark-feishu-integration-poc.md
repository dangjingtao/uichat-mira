# 飞书接入 POC

Status: Planned
Owner: runtime / auth / knowledge-base
Last verified: 2026-06-26
Layer: raw-source
Module: Develoments
Feature: EnterpriseIntegration
Doc Type: design

## 单点真相范围

这页只回答一件事：

当前项目如果接入飞书，第一阶段最小可行 POC 应该做什么。

它覆盖：

- 飞书对当前桌面 RAG 应用可扩展的能力边界
- 第一阶段 POC 的目标、范围和成功标准
- renderer / preload / backend 的落点建议
- 风险、合规与后续阶段演进方向

它不覆盖：

- 企业微信接入细节
- 飞书全部开放能力的穷举式调研
- 最终生产级权限模型、审计模型和运维方案

相关概念：

- [[CONCEPT_RUNTIME]]
- [[CONCEPT_UCHAT]]
- [[CONCEPT_KNOWLEDGE_BASE]]
- [[AREA_MAP_RUNTIME]]

## Goal

本 POC 的目标不是一次性把飞书“全面接通”，而是验证：

1. 当前项目能否安全地把飞书作为外部企业身份与消息入口接进来
2. 飞书接入后，是否能为聊天、知识库和通知链路带来明确增量价值
3. 现有桌面壳层 + 本地 backend 架构，是否适合承接这类第三方企业集成

## 为什么值得做

对当前项目来说，飞书最有价值的同样不是“多一个登录方式”，而是把应用从单机测试工具推向企业内协作工具。

最直接的价值有四类：

- 企业身份：把用户、部门、岗位、在职状态接入现有系统
- 企业消息：把机器人问答、通知触达、群内协作接入聊天能力
- 企业知识：把飞书文档、群消息衍生材料、知识内容纳入知识流转
- 企业流程：把知识库导入审核、模型配置审批、告警处置挂到组织流程中

## 能扩展什么能力

### 1. 身份与组织

- 飞书登录
- 通讯录同步
- 部门 / 成员 / 岗位映射
- 按组织维度控制知识库、模型、工具和评测空间访问范围

### 2. 消息与机器人

- 飞书应用消息推送
- 机器人问答入口
- 评测结果、知识库导入结果、运行告警推送
- 人工介入任务通知

### 3. 知识入口

- 把飞书文档作为知识库导入源
- 把业务通知、FAQ、沉淀文档导入知识库
- 记录“哪个团队常问哪些问题”，辅助知识库治理

### 4. 流程与审批

- 新知识库导入审批
- 模型配置变更审批
- 敏感问答复核
- 失败任务分派与提醒

### 5. 检索增强

- 基于部门 / 角色缩小检索范围
- 基于组织关系推荐知识源或责任人
- 在回答里补充“建议联系谁”

## POC 原则

第一阶段必须收窄，不要一开始就碰高风险能力。

POC 原则：

- 先接企业身份和通知，不先接高敏感聊天消息沉淀
- 先做 backend 集成，不把飞书能力散到 renderer
- 先做可验证最小闭环，不先做完整审批平台
- 先做组织信息投影，不先做复杂动态权限引擎

## POC Success Criteria

当且仅当以下目标成立时，可认为 POC 成功：

1. 用户可以通过飞书完成一次身份登录或身份绑定
2. backend 可以拉取并保存最小组织信息投影
3. 系统可以把一个业务事件成功推送到飞书目标用户或群
4. 系统可以基于飞书组织信息，对至少一个知识库访问场景做权限约束
5. 现有 renderer / preload / backend 边界没有被破坏
6. POC 不引入新的公开网络监听面

## Scope

### In scope

- 飞书身份绑定或登录验证
- 最小通讯录同步：
  - 用户
  - 部门
  - 用户部门关系
- 飞书应用消息推送
- 一个最小业务场景联动：
  - 推荐优先做“知识库导入完成通知”
- 一个最小权限场景联动：
  - 推荐优先做“按部门限制知识库可见范围”
- backend 配置、密钥保存和失败日志

### Out of scope

- 消息历史全量归档
- 群消息全文索引
- 全量审批流引擎
- 飞书端完整嵌入式前端
- 复杂多租户设计
- 细粒度 ABAC / PBAC 权限模型
- 企业微信与飞书统一抽象层

## Recommended First Slice

建议第一条垂直切片只做下面这组能力：

- 飞书身份绑定
- 通讯录最小同步
- 知识库按部门可见
- 知识库导入完成后推送飞书通知

原因：

- 这条链路对当前产品最贴近
- 对现有 `auth + knowledge-base + backend event` 边界最友好
- 不需要先处理高敏感消息合规
- 可以快速验证“组织身份 + 业务通知 + 权限收敛”三件事

## Target Flow

```mermaid
flowchart LR
  A["飞书用户"] --> B["飞书身份校验"]
  B --> C["backend identity bridge"]
  C --> D["本地用户 / 组织映射"]
  D --> E["知识库权限判断"]
  E --> F["chat / kb / evaluation 业务访问"]
  F --> G["业务事件"]
  G --> H["飞书通知发送"]
```

## 架构落点

### 运行时边界

飞书集成必须落在 backend，不应直接放到 renderer。

原因：

- 飞书密钥、token、签名校验属于服务端真相
- 组织结构同步和权限映射属于业务契约，不应放到前端
- renderer 不应直接认识第三方企业平台的 secret 和协议细节
- 当前项目的稳定边界已经要求 renderer 通过 backend 访问业务能力

### Renderer

renderer 只负责：

- 展示飞书绑定状态
- 发起绑定动作
- 展示同步结果与错误状态
- 展示基于组织权限过滤后的业务结果

renderer 不负责：

- 直接访问飞书 API
- 保存飞书 secret
- 自己计算签名或 token

### Preload

preload 不需要新增飞书专属能力。

除非后续要处理桌面端深链接回调，否则不建议在 POC 阶段扩 preload 暴露面。

### Backend

backend 负责：

- 飞书凭据配置读取
- token 获取与刷新
- 身份绑定或登录票据校验
- 通讯录最小同步
- 本地组织映射持久化
- 通知发送
- 权限判断接入点

## 建议的数据模型

POC 阶段只保留最小投影，不要先镜像飞书全量对象。

建议新增或扩展以下概念表：

- `external_identity_bindings`
  - 本地用户 id
  - provider = `lark`
  - external user id
  - external union id 或稳定标识
  - bind status
- `org_departments`
  - external department id
  - name
  - parent id
- `org_users`
  - external user id
  - display name
  - mobile / email 摘要字段
  - status
- `org_user_departments`
  - external user id
  - external department id
- `knowledge_base_acl`
  - knowledge base id
  - subject type:
    - user
    - department
  - subject id
  - permission

POC 不建议：

- 先复制全部飞书 profile 字段
- 先引入复杂 group / tenant / scope 继承模型

## 最小业务闭环

推荐闭环场景：

### 场景 A：身份绑定

1. 本地用户进入设置页
2. 发起飞书绑定
3. backend 校验飞书身份
4. 保存本地用户与飞书用户映射
5. 页面显示绑定成功

### 场景 B：知识库部门可见

1. 管理员给知识库配置“某部门可见”
2. 飞书同步任务拉到部门关系
3. 用户访问知识库时，backend 按本地映射后的部门信息判断权限
4. 非授权用户不能看到该知识库

### 场景 C：导入完成通知

1. 用户发起知识库导入
2. backend 完成导入 / 切块 / embedding
3. backend 发送飞书通知
4. 用户在飞书收到结果消息

## Proposed Backend Changes

建议把飞书接入实现成独立集成域，不要散到现有业务模块内部。

建议新增：

- `server/src/integrations/lark/config.ts`
- `server/src/integrations/lark/client.ts`
- `server/src/integrations/lark/auth.ts`
- `server/src/integrations/lark/contacts-sync.ts`
- `server/src/integrations/lark/notifier.ts`
- `server/src/integrations/lark/types.ts`

建议新增 route：

- `GET /integrations/lark/status`
- `POST /integrations/lark/bind/start`
- `POST /integrations/lark/bind/finish`
- `POST /integrations/lark/sync/contacts`
- `POST /integrations/lark/test/send-message`

建议接入点：

- auth：身份绑定
- knowledge-base：访问控制
- job / task / import pipeline：业务通知

## Proposed Frontend Changes

建议只做最小配置和状态展示。

可增加：

- Settings -> Integrations -> 飞书
- 当前绑定状态
- 最近一次同步状态
- 手动触发同步按钮
- 测试通知按钮

不建议在 POC 里做：

- 完整飞书管理后台
- 大量组织树可视化
- 独立复杂审批界面

## 安全与合规边界

这部分需要明确告诉项目 owner：即使只是 POC，也不是纯前端小功能。

### 风险级别

这是一个偏架构层接入，不是单点业务 patch。

原因：

- 它引入外部企业身份源
- 它影响权限边界
- 它可能触及员工信息与组织信息处理
- 它会影响知识库访问控制语义

因此如果要从 POC 走向正式实施，后续会涉及核心架构确认。

### POC 阶段规避策略

- 不接消息历史沉淀
- 不接敏感消息全文检索
- 不把飞书数据直接作为永久知识库默认来源
- 不把本地权限判断完全替换为远端临时查询
- 不开放公网 backend 监听

### Secret 管理

- 飞书凭据只放 backend
- 不写入 renderer 可见配置
- 不把 access token 写入普通前端日志
- 所有失败日志做脱敏

## 验证计划

### Backend

至少验证：

1. 飞书 token 获取失败时，错误可观测
2. 身份绑定成功后，本地映射写入成功
3. 通讯录同步可以更新最小用户 / 部门投影
4. 部门权限判断能拦住未授权知识库访问
5. 通知发送失败不会破坏主业务事务

### Frontend

至少验证：

1. 绑定状态可见
2. 同步状态可见
3. 测试通知结果可见
4. 被权限拒绝的知识库在 UI 上有明确反馈

## Rollout Plan

### Phase POC-1

- 飞书配置接入
- 身份绑定
- 最小通讯录同步
- 测试消息发送

### Phase POC-2

- 知识库按部门授权
- 知识库导入完成通知
- 手动同步与错误观测

### Phase POC-3

- 审批流接入
- 更多业务事件通知
- 检索增强与责任人推荐

## Open Questions

进入正式实施前，至少要回答这些问题：

1. 飞书身份是“主登录方式”还是“已有本地账号的绑定方式”？
2. 组织信息同步频率是手动、定时还是事件驱动？
3. 知识库权限以部门为主，还是同时支持个人白名单？
4. 通知发送失败是否需要重试队列？
5. 后续是否要同时支持企业微信，从而提前抽象统一 `enterprise-platform` 集成层？

## Recommendation

建议从下面这条最小路径启动：

- 先做飞书绑定
- 再做最小通讯录同步
- 把部门信息接到知识库 ACL
- 最后把知识库导入完成结果推送到飞书

这条路径能最快验证飞书接入对当前项目是否有真实产品价值，同时又不会过早把系统拖入高敏感消息合规和复杂审批设计。
