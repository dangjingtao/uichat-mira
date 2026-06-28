# 企业微信后台配置清单

Status: Planned
Owner: runtime / admin / chat
Last verified: 2026-06-27
Layer: raw-source
Module: Develoments
Feature: EnterpriseIntegration
Doc Type: checklist

## 单点真相范围

这页只回答一件事：

如果当前项目要接企业微信，企业微信管理员需要在后台做哪些配置。

它覆盖：

- 自建应用创建
- 应用消息能力准备
- 可选网页授权准备
- 通讯录同步准备
- 我们当前项目实际需要拿到的参数

它不覆盖：

- 后端代码实现
- 飞书后台配置
- 企业微信全部开放能力的完整覆盖

相关文档：

- `integrations/enterprise-wecom-implementation-checklist.md`
- `integrations/wecom-mcp-wrapper-design.md`
- `integrations/wecom-chat-tool-integration-plan.md`
- `integrations/wecom-cloudflare-worker-poc.md`

## 目标

这份清单是给企业微信管理员直接照着操作的。

当前项目第一阶段只需要支持：

- 成员身份绑定
- 应用消息发送
- 组织架构查询摘要

因此你现在重点只要配置 3 组东西：

1. 自建应用
2. 通讯录同步
3. 可选网页授权准备

## 官方入口

先打开官方开发者中心：

- [企业微信开发者中心](https://developer.work.weixin.qq.com/)

本清单会反复用到这些官方文档：

- [获取 access_token](https://developer.work.weixin.qq.com/document/path/91039)
- [发送应用消息](https://developer.work.weixin.qq.com/document/path/90236)
- [网页授权获取用户基本信息](https://developer.work.weixin.qq.com/document/path/91023)
- [网页授权开发说明 / 回调域名](https://developer.work.weixin.qq.com/document/path/91335)
- [读取成员](https://developer.work.weixin.qq.com/document/path/90196)

## 最终你要准备好的参数

在开始操作前，先明确最终要拿到这些信息：

- `CorpID`
- `AgentID`
- 自建应用 `Secret`
- 应用可见范围
- 通讯录同步 `Secret`
- 企业可信 IP 白名单配置状态

如果你们后面要验证网页授权绑定，再额外准备：

- 网页授权回调域名
- 回调中转服务说明

## 第 1 步：确认企业 ID

进入：

- 企业微信管理后台

找到：

- `我的企业`

记录：

- `CorpID / 企业ID`

这个值后续一定会用到。

## 第 2 步：创建自建应用

进入：

- `应用管理`

操作：

1. 新建一个自建应用
2. 填应用名称
3. 选应用介绍和应用 Logo
4. 创建完成后进入应用详情页

记录：

- `AgentID`
- 应用 `Secret`

这两个值后续用于：

- 获取应用 `access_token`
- 发送应用消息
- 网页授权挂载应用身份

官方参考：

- [获取 access_token](https://developer.work.weixin.qq.com/document/path/91039)

## 第 3 步：配置应用可见范围

仍在自建应用详情页里，找到：

- 可见范围

操作：

1. 把你自己的测试账号加入可见范围
2. 把后续需要接收消息的测试成员加入可见范围
3. 如果后续要面向部门试点，可以先按部门配置可见范围

为什么这一步重要：

- 不在应用可见范围内的成员，后续身份绑定和消息接收都会出问题

建议：

- 第一阶段先最小化，只加测试成员和测试部门

## 第 4 步：确认应用消息能力

这一步主要是确认自建应用具备发送应用消息的前提。

官方文档：

- [发送应用消息](https://developer.work.weixin.qq.com/document/path/90236)

你现在需要关注的是：

- 应用消息发送接口需要什么参数
- 消息发送对象和应用可见范围的关系
- 哪种消息类型适合第一阶段

第一阶段建议：

- 先只考虑最基础的文本消息

暂时不用折腾：

- 复杂模板消息
- 卡片消息
- 审批通知

## 第 5 步：可选配置网页授权回调域名

这一步不是首期必需项。

因为当前项目是本地桌面应用，首期默认采用“手工绑定 `userid`”而不是强依赖网页授权。

只有当你们要验证“企业微信内授权绑定”这条 POC 时，才需要配置这一项。

如果你当前准备使用的域名是：

- `xxxx.tomz.io`

那么这一页对应的 POC 落地说明见：

- `integrations/wecom-cloudflare-worker-poc.md`

官方文档：

- [网页授权获取用户基本信息](https://developer.work.weixin.qq.com/document/path/91023)
- [网页授权开发说明 / 回调域名](https://developer.work.weixin.qq.com/document/path/91335)

如果要做网页授权 POC，你在后台要做的事：

1. 进入自建应用详情页
2. 找到网页授权相关配置
3. 配置授权回调域名 / 可信域名
4. 保存配置

你需要提前确认：

- 后续桌面端绑定流程是否通过中转网页完成
- 这个中转页将使用哪个域名
- 这个域名是否对目标用户网络环境稳定可达

如果域名还没定，或者当前只做本地应用首期落地：

- 这一步可以先跳过

如果你现在已经确定要用：

- `xxxx.tomz.io`

那么这里可以直接按这个域名配置可信域名。

第一阶段你要重点看懂文档里的这些点：

- `scope=snsapi_base`
- `code` 回调
- `code` 换用户身份

## 第 6 步：开启通讯录同步能力

这是后面做 `wecom_org_lookup` 和部门 ACL 的基础。

进入：

- `管理工具 -> 通讯录同步`

操作：

1. 开启 API 同步
2. 获取 `通讯录同步 Secret`
3. 确认当前组织是否允许 API 读取成员 / 部门

注意：

- 这里的 `通讯录同步 Secret` 和自建应用 `Secret` 不是同一个东西

官方参考：

- [获取 access_token](https://developer.work.weixin.qq.com/document/path/91039)
- [读取成员](https://developer.work.weixin.qq.com/document/path/90196)

## 第 7 步：确认通讯录同步范围

你需要明确：

- 我们是不是能读取全公司组织架构
- 还是只允许读取某些部门

如果企业内部有更严格的权限边界：

- 第一阶段建议先给测试部门范围

因为我们当前只需要：

- 当前用户部门摘要
- 少量目标用户部门摘要

并不需要一上来做全量通讯录开放查询。

## 第 8 步：确认 IP 白名单

如果你们企业微信后台启用了可信 IP 限制或类似白名单控制，你还需要：

1. 确认开发 / 测试环境的后端出口 IP
2. 把这些 IP 加进企业微信后台允许名单

如果没启用 IP 白名单：

- 这一步可以跳过

如果启用了但没配：

- 后端即使拿对了 `Secret`，后续调用企业微信接口也会失败

## 第 9 步：做最小联调前检查

在把参数交给开发前，建议自己做一遍检查：

- [ ] 已拿到 `CorpID`
- [ ] 已创建自建应用
- [ ] 已拿到 `AgentID`
- [ ] 已拿到应用 `Secret`
- [ ] 已配置应用可见范围
- [ ] 已配置网页授权回调域名
- [ ] 已开启通讯录同步
- [ ] 已拿到通讯录同步 `Secret`
- [ ] 已确认是否需要配置 IP 白名单

## 当前项目第一阶段实际会用到什么

### `wecom_notify_send`

依赖：

- `CorpID`
- `AgentID`
- 应用 `Secret`
- 应用可见范围

### 身份绑定

依赖：

- 自建应用
- 网页授权回调域名
- 可见范围覆盖测试成员

### `wecom_org_lookup`

依赖：

- `CorpID`
- 通讯录同步 `Secret`
- 通讯录 API 可用

## 建议你先不要折腾的东西

第一阶段先别做：

- 会话存档
- 外部联系人能力
- 群机器人复杂场景
- 审批流
- 卡片消息深度定制
- 全量组织架构开放搜索

这些不属于当前最小闭环。

## 最终交付给开发的参数清单

建议你最终整理一份给开发的配置表：

```text
CorpID=
AgentID=
AppSecret=
VisibleScope=
OAuthRedirectDomain=
ContactsSyncSecret=
TrustedIpEnabled=
TrustedIps=
```

如果还没确定最终回调域名，也可以先把其它字段准备好，回调域名后补。

## Recommendation

企业微信管理员最稳的操作顺序是：

1. 先确认 `CorpID`
2. 创建自建应用，拿 `AgentID` 和应用 `Secret`
3. 配应用可见范围
4. 配网页授权回调域名
5. 开启通讯录同步并拿到通讯录同步 `Secret`
6. 如果有 IP 白名单，补上开发 / 测试后端出口 IP

这样就能满足我们当前第一阶段：

- 身份绑定
- 应用消息发送
- 组织架构查询摘要

这三条主线的准备条件。
