# 观澜 RSS / Atom 订阅

Status: Implemented
Last verified: 2026-07-30
Layer: MicroAPP
Module: Guanlan

## 当前能力

观澜支持用户粘贴 RSS、Atom 或普通网站首页地址。首页检测会读取页面声明的
`<link rel="alternate" type="application/rss+xml|application/atom+xml">`，以及页面明确链接的
RSS / Atom 文件；同站地址优先验证。系统不会猜测路径或遍历站点。

订阅源保存在本地 SQLite 的 `news_feed_subscriptions` 表，文章继续写入既有的
`news_items` 表。每个订阅源使用独立的 `rss:<uuid>` 来源键，因此可以单独启停、刷新、筛选和删除。

前端“订阅管理”支持：

- 检测首页或 Feed 地址并预览最近文章；
- 选择检测到的 Feed，设置显示名称、分类和语言；
- 启用、停用、立即刷新和编辑订阅；
- 删除订阅，并同时删除该来源的文章、向量索引和抓取状态。

## HTTP 路由

后端路由保持 prefix-free；开发环境由 Vite 通过 `/api` 代理：

- `POST /microapps/news-hub/feeds/detect`
- `GET /microapps/news-hub/feeds`
- `POST /microapps/news-hub/feeds`
- `PATCH /microapps/news-hub/feeds/:id`
- `POST /microapps/news-hub/feeds/:id/refresh`
- `DELETE /microapps/news-hub/feeds/:id`

## 抓取边界

- 只允许 HTTP 和 HTTPS，不允许 URL 携带用户名或密码；
- 拒绝 localhost、内网、链路本地、保留和组播地址；
- DNS 的全部返回地址必须通过检查，请求绑定到已检查的地址；
- 每次重定向都重新执行 URL 和 DNS 检查，最多 3 次；
- 单次请求超时 15 秒，响应正文最多 2 MB；
- 单个 Feed 最多读取 100 篇文章，最多保存 50 个自定义订阅源；
- 一个来源拉取失败不会阻止其他来源刷新。

当前刷新模式是页面按 TTL 刷新或用户手动刷新，没有新增后台定时任务。
