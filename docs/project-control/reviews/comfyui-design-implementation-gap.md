# ComfyUI 设计稿对照清单

Status: Draft  
Owner: frontend / design / product  
Last updated: 2026-07-08

## 这份文档干什么

这份文档只做一件事：

把 `C:/Users/Administrator/Downloads/comfyui-workbench.jsx` 这份原型稿，和当前前端实现做逐区块对照。

它不讨论：

- 谁的理念对
- 后端接口怎么改
- 以后要不要支持更多服务商

这里只回答三个问题：

1. 原型稿里到底画了什么
2. 当前页面到底做到了什么
3. 哪些地方我实现偏了

---

## 评估范围

本次只看这些文件：

- `C:/Users/Administrator/Downloads/comfyui-workbench.jsx`
- [desktop/src/features/Settings/pages/MicroApps/ImageGeneration/index.tsx](/D:/workspace/rag-demo/desktop/src/features/Settings/pages/MicroApps/ImageGeneration/index.tsx)
- [desktop/src/features/Settings/pages/MicroApps/ImageGeneration/components/WorkflowRequestCard.tsx](/D:/workspace/rag-demo/desktop/src/features/Settings/pages/MicroApps/ImageGeneration/components/WorkflowRequestCard.tsx)
- [desktop/src/features/Settings/pages/MicroApps/ImageGeneration/components/ResultPreviewCard.tsx](/D:/workspace/rag-demo/desktop/src/features/Settings/pages/MicroApps/ImageGeneration/components/ResultPreviewCard.tsx)
- [desktop/src/features/Settings/pages/MicroApps/ImageGeneration/components/SubmitActionCard.tsx](/D:/workspace/rag-demo/desktop/src/features/Settings/pages/MicroApps/ImageGeneration/components/SubmitActionCard.tsx)

---

## 先说结论

当前实现只对上了原型稿的两件事：

1. `ComfyUI` 已经被单独拆成一个 tab
2. `其它服务商` 没再混进同一套首屏结构

但原型稿真正的主体结构还没有落到位。

目前页面更像：

- “ComfyUI 独立入口 + 旧 workflow 表单”

而不是原型稿里的：

- “连接区 + Flow 区 + 输入区 + 结果区 + 折叠诊断”

所以当前状态不能叫“设计稿已融合”，只能叫：

**只完成了结构切口，还没有完成原型主体。**

---

## 对照总表

| 原型区块 | 原型是否明确存在 | 当前实现状态 | 结论 |
| --- | --- | --- | --- |
| 顶部轻标题 | 是 | 基本有 | 已对上 |
| ComfyUI 独立工作台 | 是 | 有 tab，但内容没完整对上 | 只对上一半 |
| 当前连接区 | 是 | 没做 | 缺失 |
| Flow 选择与管理区 | 是 | 没做独立区块 | 缺失 |
| 本次执行输入区 | 是 | 有 workflow 表单，但还是旧表单形态 | 部分对上 |
| 提交动作区 | 是 | 有 | 部分对上 |
| 右侧结果区 | 是 | 有 | 部分对上 |
| 折叠诊断区 | 是 | 有 | 已对上 |
| 其它服务商占位区 | 是 | 有 | 已对上 |

---

## 逐区块对照

## 1. 顶部区

### 原型稿表达

原型稿顶部非常轻，只保留：

- `ComfyUI 工作台`
- 一句用途说明

它故意不再用大横幅，不再重复标题，也不拿很多 badge 抢注意力。

### 当前实现

当前页面已经去掉了原来的大横幅，保留了：

- 页面标题
- 页面描述
- 上方 tab

对应文件：

- [index.tsx](/D:/workspace/rag-demo/desktop/src/features/Settings/pages/MicroApps/ImageGeneration/index.tsx)

### 结论

这部分基本对上了。

这里不是主要问题。

---

## 2. ComfyUI 独立工作台

### 原型稿表达

原型稿的重点不是“加一个 ComfyUI 标签”这么简单。

它的意思是：

- ComfyUI 自己有一套工作台结构
- 这套结构围绕连接、flow、输入、结果组织
- 不再和其它服务商共用一套 provider 通用表单

### 当前实现

当前实现已经有：

- `ComfyUI`
- `其它服务商`

两个 tab。

对应文件：

- [index.tsx](/D:/workspace/rag-demo/desktop/src/features/Settings/pages/MicroApps/ImageGeneration/index.tsx)

### 偏差

问题在于，我只是把入口切开了，但没把 ComfyUI 里面的结构真正换掉。

现在 `ComfyUI` tab 里仍然主要是：

- 一个说明卡
- 原来的 `WorkflowRequestCard`
- 原来的提交卡
- 原来的结果卡

也就是说：

我做了“独立 tab”，但没有做“独立工作台”。

### 结论

这部分只完成了一半。

---

## 3. 当前连接区

### 原型稿表达

原型稿里有一个非常明确的“当前连接”区块，包含：

- 当前连接名称
- 地址
- 连接状态
- 新建 / 编辑 / 测试连接

这个区块的目的不是填表，而是先确认：

**我现在到底连的是哪个 ComfyUI。**

### 当前实现

当前实现没有这个区块。

页面里只有一块简化说明：

- `ComfyUI Local`
- workflow 模式
- 一句 flow 优先说明

但这不是连接卡。

它没有：

- 连接名
- 地址
- 状态
- 测试动作

### 结论

这是当前最明显的缺失项之一。

如果不补，ComfyUI 工作台会一直像“本地 workflow 提交页”，而不是“可管理连接的工作台”。

---

## 4. Flow 区

### 原型稿表达

原型稿里 `Flow` 是独立主区块，不是一个 JSON 输入框。

它包含：

- 选择 flow
- 上传 flow
- 新建 flow
- 当前 flow 摘要
- 来源
- 最近更新时间
- 编辑 Flow
- 查看原始 JSON

这说明原型稿的核心判断是：

**flow 是资产，不是临时文本。**

### 当前实现

当前实现没有独立 Flow 区。

现在页面里最接近的东西是：

- `WorkflowRequestCard` 里的 JSON 编辑区
- 文件上传入口
- 覆盖项输入

对应文件：

- [WorkflowRequestCard.tsx](/D:/workspace/rag-demo/desktop/src/features/Settings/pages/MicroApps/ImageGeneration/components/WorkflowRequestCard.tsx)

### 偏差

这里是我实现偏得最明显的地方之一。

因为我实际上还是把 flow 当成：

- “一段要提交的 JSON”

而不是：

- “一个可以选择、回看、编辑、复用的 flow”

所以现在页面没有：

- 当前 flow 名称
- flow 来源
- flow 更新时间
- flow 摘要
- flow 管理动作

### 结论

这是当前实现与设计稿的最大落差点之一。

---

## 5. 本次执行输入区

### 原型稿表达

原型稿里“本次执行输入”是一块独立表单区。

关键不是“有没有表单”，而是：

- 这块只展示当前 flow 真正生效的字段
- 让用户感觉自己是在填“本次运行参数”
- 不把 flow 管理和本次输入混成一块

### 当前实现

当前实现有：

- `workflowJson`
- `overridePrompt`
- `overrideSeed`

对应文件：

- [WorkflowRequestCard.tsx](/D:/workspace/rag-demo/desktop/src/features/Settings/pages/MicroApps/ImageGeneration/components/WorkflowRequestCard.tsx)

### 偏差

当前页面虽然也有“输入”，但它和原型稿不是一回事。

原型稿的输入区建立在“已经选中了一个 flow”的前提上。

而当前实现还是：

- `workflow JSON` 本体
- `本次运行输入`

混在同一张卡里。

这会导致：

- flow 管理层没有被抽出来
- 运行输入层也没真正成立

### 结论

这部分只能算部分对上。

---

## 6. 提交动作区

### 原型稿表达

原型稿里的提交区强调三件事：

- 主按钮明确
- 状态明确
- 当前版本不支持取消时，不要假装支持

### 当前实现

当前实现已经做了这些修正：

- `开始生成`
- `重置`
- 状态 badge
- 运行中但不可取消时，只显示说明，不再摆一个假按钮

对应文件：

- [SubmitActionCard.tsx](/D:/workspace/rag-demo/desktop/src/features/Settings/pages/MicroApps/ImageGeneration/components/SubmitActionCard.tsx)

### 结论

这一块方向基本对了。

它不是当前主要问题。

---

## 7. 右侧结果区

### 原型稿表达

原型稿里右侧是一个独立结果区，重点是：

- 空态清楚
- 运行中清楚
- 成功时预览图是视觉中心
- 失败时有清楚失败说明和进入诊断的入口

### 当前实现

当前实现也已经有：

- 空态
- loading
- 成功态预览
- 失败态

对应文件：

- [ResultPreviewCard.tsx](/D:/workspace/rag-demo/desktop/src/features/Settings/pages/MicroApps/ImageGeneration/components/ResultPreviewCard.tsx)

### 偏差

当前差的不是有没有结果区，而是结果区还没有完全拿到原型稿的“工作台视觉中心”力度。

另外原型稿里的成功态还带有更明确的结果元信息布局。

当前实现的结果区可用，但还不够像设计稿。

### 结论

部分对上，可继续细化。

---

## 8. 折叠诊断区

### 原型稿表达

原型稿明确要求：

- 请求摘要
- 时间线
- 调试日志
- 原始 JSON

全部收到底部折叠区。

### 当前实现

当前实现已经把这些内容降到底部折叠区：

- 请求摘要
- Help
- DebugLog

对应文件：

- [index.tsx](/D:/workspace/rag-demo/desktop/src/features/Settings/pages/MicroApps/ImageGeneration/index.tsx)

### 偏差

折叠这一层是对的，但内容组织还没完全贴着原型稿。

尤其是：

- 还没有单独的原始 JSON 视图
- 还没有任务时间线区块

### 结论

方向对了，但没做全。

---

## 9. 其它服务商占位区

### 原型稿表达

原型稿里没有强行把 OpenAI / 万相 / 混元塞进 ComfyUI 工作台。

它的意思很明确：

- 先把 ComfyUI 做清楚
- 其它服务商以后按自己的模型单独展开

### 当前实现

当前实现已经做成：

- `其它服务商` tab
- 明确占位说明

### 结论

这部分是符合原型稿意图的。

---

## 我做偏的地方

这次我真正做偏的点，不是一个两个细节，而是下面这条：

**我把“ComfyUI 独立工作台”理解成了“ComfyUI 独立 tab”，但原型稿真正要的是“ComfyUI 独立骨架”。**

具体表现为：

1. 我先切了 tab，但没有把连接区补出来
2. 我没有把 Flow 区抽出来
3. 我继续复用了旧的 workflow 表单卡，把 flow 管理和本次输入混在一起
4. 我把“有结果区、有折叠诊断”当成接近原型稿，但其实原型稿的重心是中间两块：连接和 Flow

所以现在页面最像的不是原型稿，而是：

- “旧生图页删掉一些噪音后，再给 ComfyUI 单独开了入口”

这和原型稿不是一回事。

---

## 下一步应该怎么改

如果要真正按设计稿收敛，我建议顺序必须是：

1. 先补 `当前连接区`
目标：让页面第一眼先确认 ComfyUI 连接对象和状态。

2. 再补 `Flow 区`
目标：把 flow 从 JSON 文本框提升为可选择、可回看的资产区。

3. 再拆 `本次执行输入区`
目标：让“flow 本体”和“本次运行输入”不再混在同一张卡里。

4. 最后再细修结果区和诊断区
目标：补齐时间线、原始 JSON、结果元信息布局。

---

## 当前可接受的判断

如果现在要给一个不绕弯的判断，我会这样定性：

- 不是“设计稿已落地”
- 也不是“完全没动”
- 而是“只完成了 ComfyUI 独立入口，没有完成 ComfyUI 独立工作台”

这个判断应该比“差不多了”更接近真实情况。

