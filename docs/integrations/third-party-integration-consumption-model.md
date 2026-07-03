# 第三方集成能力消费模型

Status: Planned
Owner: runtime / auth / knowledge-base
Last verified: 2026-06-27
Layer: raw-source
Module: Develoments
Feature: EnterpriseIntegration
Doc Type: design

## 单点真相范围

这页只回答一件事：

第三方平台配置完成以后，当前项目应该怎样消费这些能力。

它覆盖：

- 第三方集成的统一能力模型
- 业务层对这些能力的消费路径
- 前后端职责边界
- 第一阶段 POC 的最小消费闭环

它不覆盖：

- 第三方平台的具体开放 API
- 各 provider 的 SDK 细节
- 所有业务模块的最终实施代码

相关文档：

- `integrations/third-party-integration-frontend-design.md`
- `integrations/enterprise-wecom-integration-poc.md`
- `integrations/lark-feishu-integration-poc.md`

## Goal

这篇文档的目标是解决一个关键问题：

如果第三方平台已经配置完成，系统里到底由谁、在什么地方、用什么方式去消费这些能力。

如果没有统一消费模型，`Settings -> Integrations` 最终只会变成一个：

- 能配置
- 能显示状态
- 但业务层感知不到价值

的设置页。

因此设计重点不是“怎么配”，而是：

- 配好之后如何被业务自动或显式使用

这里需要再提前收口一个判断：

- 第三方集成第一阶段，不是为了把设置页做成平台后台
- 也不是为了只多接几个通知通道
- 它的核心目标是让外部平台能够调用我们自己的知识库能力

因此：

- 消息入口是知识库调用的触发方式
- 通知出口是知识库结果的回传方式
- 知识库调用本身才是业务主线

## 核心原则

### 1. 配置层和消费层分离

配置发生在：

- `Settings -> Integrations`

真正消费发生在：

- auth
- knowledge-base
- evaluation / jobs
- chat runtime

### 2. 业务模块消费能力，不消费 provider 细节

业务模块不应直接依赖：

- 企业微信字段
- 飞书字段
- 第三方 SDK

业务模块应只依赖统一能力，例如：

- `identity`
- `org_sync`
- `notify`
- `knowledge_query`
- `knowledge_source`
- `workflow_action`

### 3. backend 是能力消费的主入口

大多数消费路径应在 backend 生效。

renderer 只负责：

- 展示已生效结果
- 提供少量显式触发入口

### 4. 第一阶段先做稳态消费，不先做复杂 runtime 消费

最稳的优先级是：

- 知识库调用
- 身份
- 组织
- 通知
- 知识源入口

而不是一开始就让 chat agent 自动调用一堆第三方动作。

## 能力模型

建议把第三方 provider 投影成统一能力集合。

能力草图：

```ts
export type IntegrationCapability =
  | 'identity'
  | 'org_sync'
  | 'notify'
  | 'knowledge_query'
  | 'knowledge_source'
  | 'workflow_action';
```

解释：

- `identity`
  - 登录、绑定、身份识别
- `org_sync`
  - 部门、用户、岗位等组织信息同步
- `notify`
  - 通知、提醒、告警、消息推送，优先投递到企业微信机器人等群通知出口
- `knowledge_query`
  - 外部平台中的消息入口调用本地知识库问答能力
- `knowledge_source`
  - 文档、文件、公告等可导入知识源
- `workflow_action`
  - 审批、待办、流程动作

不同 provider 实现不同能力组合。

例如：

- 企业微信
  - `knowledge_query`
  - `identity`
  - `org_sync`
  - `notify`
  - 其中 `notify` 首期优先落到企业微信机器人 webhook
- 飞书
  - `knowledge_query`
  - `identity`
  - `org_sync`
  - `notify`
  - `knowledge_source`

## 四类消费方式

第三方能力在当前项目里，建议统一理解为四类消费方式。

## 1. 被动消费

这是最基础的一类。

含义：

用户没有显式点击“使用第三方”，但系统在后台已经把第三方能力消费掉了。

典型场景：

- 登录时识别外部身份
- 绑定本地用户和外部用户
- 根据部门关系决定知识库是否可见
- 根据组织信息决定哪些资源能访问

特点：

- 用户无感触发
- backend 自动生效
- 最适合第一阶段 POC

第一期推荐优先落地：

- `identity`
- `org_sync`

## 2. 事件消费

含义：

业务模块只产生领域事件，不直接调用第三方平台。

然后由集成层根据配置决定是否通知第三方。

例如：

- 知识库导入完成
- embedding 失败
- 评测任务跑完
- chat 工具执行失败
- 审批项待处理

业务模块发出统一事件：

```ts
{
  type: 'knowledge_base.import.completed',
  userId: 'u_123',
  payload: {
    knowledgeBaseId: 'kb_1',
    name: '产品手册'
  }
}
```

由集成层消费：

- 企业微信已启用通知 -> 发送企业微信机器人消息
- 飞书已启用通知 -> 发送飞书消息
- 都未启用 -> 不发送

特点：

- 业务模块发事件
- 集成层做路由
- provider 做发送

这类消费路径应是通知能力的主模型。

## 3. 主动消费

含义：

用户在 UI 上显式发起某个集成动作。

典型动作：

- 从飞书导入文档到知识库
- 手动同步组织架构
- 给企业微信群机器人发送测试通知
- 给某个知识库绑定“某部门可见”
- 发起身份绑定

执行链路：

- 前端按钮
- backend action
- provider 执行

这类消费不是聊天自动调工具，而是：

- 设置页
- 知识库页
- 管理页

里明确的业务动作。

## 4. 运行时消费

这是能力最强的一类，也应当是后期阶段。

含义：

第三方平台不仅提供配置和通知，还进入运行时主链路，被 chat、RAG、workflow 真正调用。

典型场景：

- Chat 在回答时可引用飞书文档作为知识源
- 知识库导入器可枚举飞书文档 / 企业微信文件
- Agent 可调用“发送飞书消息”
- Workflow 可触发审批动作、通知动作

特点：

- 接近 runtime capability provider
- 会进入 chat / RAG / workflow 主链路
- 设计复杂度最高

第一阶段不建议做重。

## 业务模块怎么消费

统一思路是：

- provider 配置
  - 投影为能力
  - 业务模块按能力消费

而不是：

- 业务模块直接依赖某个平台

## Auth

主要消费：

- `identity`

典型用法：

- 外部身份绑定
- 登录身份识别
- 当前账户展示外部身份状态

## Knowledge Base

主要消费：

- `org_sync`
- `knowledge_source`
- `notify`

典型用法：

- 按部门 / 用户做知识库授权
- 从外部文档源导入知识
- 导入完成时通知用户，优先走企业微信机器人 webhook

## Evaluation / Jobs

主要消费：

- `notify`
- 后续可能消费 `workflow_action`

典型用法：

- 任务完成通知，优先走企业微信机器人 webhook
- 失败告警
- 待处理事项提醒，优先走企业微信机器人 webhook

## Chat Runtime

第一阶段建议少量消费，后续再增强。

后续可消费：

- `knowledge_source`
- `workflow_action`
- `notify`

典型用法：

- 引用外部知识源
- 调用审批或通知动作
- 给责任人发协同消息，必要时也可落到机器人群通知

## 前端怎么让用户感知这些能力

配置完成后，不能只停留在 `Settings -> Integrations`。

能力必须投放到真正的业务页面。

### 登录 / 账户页

应体现：

- 绑定企业微信
- 绑定飞书
- 当前外部身份状态

### 知识库页

应体现：

- 知识库按部门 / 用户授权
- 外部知识源入口
- 导入完成后的通知结果

### 评测 / 任务页

应体现：

- 是否通知第三方
- 通知结果
- 失败时是否提醒负责人

### 聊天页

第一阶段不建议变成第三方能力控制台。

后续如确有价值，可逐步扩展：

- 外部知识引用
- 通知动作
- 审批动作

## 前后端职责

### Frontend

负责：

- 展示配置状态
- 发起显式动作
- 展示已生效结果

不负责：

- 保存 secret
- 直接调用第三方开放平台
- 做最终权限判断

### Backend

负责：

- provider 配置读取
- 能力注册
- 身份与组织能力消费
- 事件路由
- 通知发送
- 知识源接入
- 运行时能力提供

## 第一阶段最小消费闭环

如果先做企业微信，最合理的闭环是：

1. 在 `Settings -> Integrations` 配置企业微信
2. 在账户页完成身份绑定
3. 在知识库页给某知识库配置“某部门可见”
4. backend 消费组织同步结果做 ACL 判断
5. 用户访问知识库时自动感知权限效果
6. 知识库导入完成时 backend 消费通知能力发送企业微信消息

这就形成了真正闭环：

- 配置了
- 被业务消费了
- 用户在业务页面感知到了

## 推荐实施顺序

### Phase 1

- `identity`
- `org_sync`
- `notify`

先解决：

- 身份绑定
- 通讯录同步
- 部门授权
- 导入完成通知

### Phase 2

- `knowledge_source`

再接：

- 外部文档知识源
- 知识导入入口

### Phase 3

- `workflow_action`

最后再考虑：

- 审批动作
- 机器人动作
- chat / workflow 深度联动

## Recommendation

第三方集成配置完成后，不应要求用户再回设置页“手动使用”它。

最合理的消费方式是：

- 在身份里自动生效
- 在知识库里作为授权和知识源生效
- 在任务和评测里作为通知通道生效
- 在后续 runtime 中作为可调用能力生效

也就是说，第三方集成真正的价值链应当是：

`配置 -> 能力注册 -> 业务消费 -> 用户在业务场景中感知价值`
