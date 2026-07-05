---
status: current
owner: microapp
last_verified: 2026-07-06
layer: test
module: MicroAPP
feature: ImageGeneration
doc_type: smoke-guide
canonical: true
related:
  - README.md
  - runtime.config.cjs
  - docs/project-control/tasks/microapp_T103-image-generation-server-http-surface.md
  - docs/project-control/tasks/microapp_T105-image-generation-desktop-debug-workspace.md
  - docs/project-control/tasks/microapp_T106-image-generation-desktop-entry-integration.md
---

# Image Generation ComfyUI Smoke Guide

这份指引只覆盖当前已经具备真实验收条件的链路：

- `Settings -> MicroApps` 产品入口
- `Image Generation Studio` 调试页
- `Workflow 模式`
- `ComfyUI Local`

这份指引不覆盖：

- `OpenAI Images`
- `阿里云万相`
- `腾讯混元`
- chat 内唤起
- 第三方平台入口
- 取消任务能力

## 本轮验收目标

确认下面这条真实链路可用：

1. 从当前微应用列表页进入 `Image Generation Studio`
2. 切到 `Workflow 模式`
3. provider 自动收敛到 `ComfyUI Local`
4. 提交合法的 ComfyUI API format workflow JSON
5. 页面能经历 `queued / running / succeeded` 或明确失败
6. 成功时至少出现结构化任务结果和预览信息

## 你需要准备什么

### 1. 本地服务

- 前端开发地址：`http://127.0.0.1:5173`
- 后端健康检查：`http://127.0.0.1:8787/health`
- 开发态浏览器访问走 hash 路由：
  - 登录页：`http://127.0.0.1:5173/#/login`
  - 微应用列表页：`http://127.0.0.1:5173/#/settings/micro-apps`

### 2. ComfyUI 连接配置

当前实现里，`ComfyUI Local` 只需要 `baseUrl`，不需要 `apiKey`。

必须配置的环境变量：

```text
UI_CHAT_IMAGE_GENERATION_COMFYUI_BASE_URL=http://127.0.0.1:8188
```

可选环境变量：

```text
UI_CHAT_IMAGE_GENERATION_COMFYUI_CLIENT_ID=<任意稳定字符串，可留空>
```

说明：

- 如果 `UI_CHAT_IMAGE_GENERATION_COMFYUI_CLIENT_ID` 不配，后端会回退到当前任务 id
- `baseUrl` 必须指向真实可访问的 ComfyUI HTTP 服务
- 常见本地地址就是 `http://127.0.0.1:8188`

### 3. Chrome 登录账号

如果你用 Chrome 打开发开态页面，前端会走浏览器自己的登录态，不会复用 Electron 已登录会话。

本地开发默认 seed 用户：

- 管理员：`Tomz / 123456`
- 普通用户：`Dang / 123456`

如果你本地改过认证 seed，就用你自己的账号。

## 启动前检查

先确认这三个点：

1. 前端 dev server 已启动
2. 后端已启动
3. ComfyUI 已启动，并且 `UI_CHAT_IMAGE_GENERATION_COMFYUI_BASE_URL` 已注入当前 server 进程

建议先做两个快速检查：

```bash
curl http://127.0.0.1:8787/health
curl http://127.0.0.1:8188/history/not-a-real-id
```

预期：

- 第一个返回后端健康响应
- 第二个不要求成功，但至少应该证明 `8188` 上确实有 ComfyUI HTTP 服务在响应

## Chrome 冒烟步骤

### A. 进入产品入口

1. 用 Chrome 打开 `http://127.0.0.1:5173/#/login`
2. 如果已经有会话，可直接跳到设置页；如果没有，就用 `Tomz / 123456` 登录
3. 打开 `http://127.0.0.1:5173/#/settings/micro-apps`

通过标准：

- 页面能进入 `MicroApps` 列表页
- 页面顶部能看到独立的 `Image Generation Studio` 入口卡
- 入口文案里能看到这是“微应用界面调试入口”

失败判定：

- 被重定向回登录页：先排查登录态
- 页面里没有 `Image Generation Studio` 入口卡：这是入口链路故障，不是 ComfyUI 故障

### B. 从真实入口进入调试页

1. 在 `MicroApps` 列表页点击 `Image Generation Studio` 入口卡上的动作按钮
2. 进入 `Image Generation Studio`

通过标准：

- 地址进入 `#/settings/micro-apps/image-generation-studio`
- 页面正常渲染
- 能看到双栏结构
- 左栏至少有模式、workflow 请求、提交动作
- 右栏至少有结果预览、任务状态、请求摘要、执行日志

失败判定：

- 只能手输路由才能进：入口验收不通过
- 页面空白或报错：调试页挂载故障

### C. 验证 Workflow 模式边界

1. 切到 `Workflow 模式`
2. 观察 provider 区

通过标准：

- provider 自动收敛到 `ComfyUI Local`
- 页面不再表现成“任意 provider 都能跑 ComfyUI workflow”
- `Workflow JSON`
- `上传 JSON 文件`
- `运行时覆盖 prompt`
- `运行时覆盖 seed`
- `JSON 状态`
  这些区块都可见

失败判定：

- `Workflow 模式` 下还能自由切到 `OpenAI Images / 万相 / 混元`
- 缺少 `JSON 状态` 提示

### D. 先做一次非法 JSON 检查

1. 在 `Workflow JSON` 输入区填入：

```json
{ invalid
```

2. 观察 `JSON 状态`

通过标准：

- 页面明确提示“不是合法 JSON”
- `开始生成` 不应进入真实提交流程

### E. 再做一次合法但不是 ComfyUI API format 的检查

1. 把输入替换成：

```json
{
  "foo": "bar"
}
```

2. 观察 `JSON 状态`

通过标准：

- 页面明确提示“JSON 合法，但不是 ComfyUI API format”
- `开始生成` 不应进入真实提交流程

### F. 提交一份最小可执行 workflow

请使用你自己本地已经验证能在 ComfyUI 里执行成功的 workflow API JSON。

不要用 UI 导出的 workflow 结构去赌；本页要求的是 ComfyUI API format。

当前仓库里已经放好一份从 `http://127.0.0.1:8188/#9ae6082b-c7f4-433c-9971-7a8f65a3ea65` 导出的现成样例：

- [image_z_image_turbo.comfyui-api.json](/D:/workspace/rag-demo/docs/microapp/workflows/image_z_image_turbo.comfyui-api.json)

如果你只是做链路冒烟，至少保证 workflow 里最终有可产出图片的节点，并且历史结果能在 ComfyUI `/history/:prompt_id` 里看到图片输出。

建议做法：

1. 从你本地 ComfyUI 已经跑通过的一条工作流，导出 API format JSON
2. 粘贴到 `Workflow JSON`
3. 如有需要，填：
   - `运行时覆盖 prompt`
   - `运行时覆盖 seed`
4. 点击 `开始生成`

通过标准：

- 页面进入 `queued` 或 `running`
- 右侧 `任务状态` 卡有真实状态变化
- `请求摘要` 里能看到本次模式和 provider
- `执行日志` 至少出现提交和运行阶段事件

说明：

- 当前轮询会带 `refresh=true` 去向后端请求最新状态
- 当前“取消任务”按钮展示但禁用，这属于预期，不算缺陷

### G. 观察成功结果

如果你的 ComfyUI 工作流执行成功，继续看右栏。

通过标准：

- 页面最终进入 `succeeded`
- 结果区进入成功态
- 至少出现：
  - 主预览区
  - 尺寸
  - 产物来源
  - 生成时间
- `请求摘要` 里能看到：
  - provider
  - mode
  - provider job id
  - artifact id

当前真相说明：

- 后端会优先把结果回收到本地 artifact
- 前端成功态预览优先使用 `localPath`
- 如果本地预览不可直接打开，才会退回看远端 URL 信息

### H. 观察失败结果

如果你的 ComfyUI 服务可达，但 workflow 本身有问题，也属于有效冒烟结果。

通过标准：

- 页面最终进入 `failed` 或 `blocked`
- 失败态里能看到：
  - 失败标题
  - 失败摘要
  - 详细诊断入口或结构化日志
- 如果是 ComfyUI 节点校验失败，后端不应伪造 queued 成功，而应明确失败

## 可直接复制的验收结论模板

### 通过模板

```md
ComfyUI Local 冒烟通过。

- 入口链路通过：可从 `Settings -> MicroApps` 列表页点击进入 `Image Generation Studio`
- Workflow 模式边界通过：provider 自动收敛到 `ComfyUI Local`
- 非法 JSON / 非 ComfyUI API format 校验通过
- 合法 workflow 可提交，页面经历真实 `queued/running/succeeded`
- 成功态能看到结构化结果、执行日志和预览信息
- 当前取消按钮禁用，符合已知边界，不计为失败
```

### 失败模板

```md
ComfyUI Local 冒烟未通过。

失败位置：
- 入口链路 / 调试页渲染 / Workflow 模式约束 / JSON 校验 / 任务提交 / 轮询 / 成功态预览

实际现象：
- <写清楚页面文案、报错信息、停留状态和是否出现 provider job id>

环境信息：
- frontend: http://127.0.0.1:5173
- backend: http://127.0.0.1:8787
- comfyui baseUrl: <你的实际地址>
- 登录账号: <Tomz 或其他账号>
```

## 失败分流

### 1. 连入口卡都没有

先看：

- `T106` 产品入口是否被本地改坏
- 当前访问的是不是 `#/settings/micro-apps`

### 2. 入口能进，但页面提交立刻失败

先看：

- 后端是否启动
- 是否已经登录
- 浏览器开发者工具里 `/api/microapps/image-generation/generations` 是否返回 `401`

### 3. Workflow 模式一直失败，提示 ComfyUI 不可达

先看：

- `UI_CHAT_IMAGE_GENERATION_COMFYUI_BASE_URL` 是否真的注入到了 server 进程
- 该地址是否就是 ComfyUI HTTP 服务地址
- ComfyUI 是否能返回 `/prompt` 和 `/history/:id`

### 4. JSON 合法，但仍然失败

先看：

- 你提供的是不是 ComfyUI API format，而不是 UI graph 格式
- 工作流里是否真的有可输出图片的节点
- ComfyUI 返回里是否有 `node_errors`

### 5. 任务成功了，但预览不显示

先看：

- 右栏里是否已有 `artifact id`
- 后端本地 artifact 是否已回收
- 是否是本地文件预览权限或浏览器对 `file:///` 渲染限制

## 这轮不用验的内容

下面这些当前不要拿来判这轮失败：

- 取消任务不能点
- 详情页没有 studio 入口
- 没有 chat 内入口
- 没有第三方平台入口
- 没有历史图库
- 没有多任务并发面板

## 一句话结论

当前这轮真正要验的，不是“所有生图 provider 都通了”，而是：

`Chrome -> 登录 -> MicroApps 列表页 -> Image Generation Studio -> Workflow 模式 -> ComfyUI Local -> 合法 workflow 提交 -> 页面拿到真实任务终态`
