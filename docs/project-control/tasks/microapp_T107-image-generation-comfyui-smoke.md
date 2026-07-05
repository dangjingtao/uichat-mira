---
status: current
priority: P1
owner: microapp
last_verified: 2026-07-06
layer: project-control
module: MicroAPP
feature: ImageGeneration
doc_type: task-card
canonical: true
related:
  - docs/project-control/tasks/microapp_T103-image-generation-server-http-surface.md
  - docs/project-control/tasks/microapp_T105-image-generation-desktop-debug-workspace.md
  - docs/project-control/tasks/microapp_T106-image-generation-desktop-entry-integration.md
  - docs/microapp/image-generation-comfyui-smoke-guide.md
  - docs/microapp/workflows/image_z_image_turbo.comfyui-api.json
task_state: DONE
---

# microapp_T107 Image Generation ComfyUI Smoke

## Target

执行一轮真实的 `ComfyUI Local` 冒烟，覆盖：

- 当前微应用产品入口
- `Image Generation Studio`
- `Workflow 模式`
- 合法 `ComfyUI API format` workflow 提交
- 真实任务终态与结果反馈

这张卡不是实现卡，不改业务代码，只产出冒烟证据。

## Allowed Changes

- `docs/project-control/tasks/microapp_T107-image-generation-comfyui-smoke.md`
- `docs/project-control/project-control-ledger.md`
- `.test-artifact/image-generation-smoke/**`

## Forbidden Changes

- `desktop/src/**`
- `server/src/**`
- `electron/**`
- `tauri/**`
- `docs/project-control/tasks/microapp_T103-image-generation-server-http-surface.md`
- `docs/project-control/tasks/microapp_T105-image-generation-desktop-debug-workspace.md`
- `docs/project-control/tasks/microapp_T106-image-generation-desktop-entry-integration.md`

## Test Boundary

本卡只验当前已经具备真实条件的链路：

1. 从 `Settings -> MicroApps` 列表页进入 `Image Generation Studio`
2. 切到 `Workflow 模式`
3. provider 自动收敛到 `ComfyUI Local`
4. 使用仓库内样例 workflow：
   - `docs/microapp/workflows/image_z_image_turbo.comfyui-api.json`
5. 不改 workflow 主 prompt，只改别的可观察参数后提交
6. 观察真实任务终态，或者在进入任务生命周期前拿到明确的环境阻塞错误，并保留证据

## Acceptance Criteria

1. 后端 `http://127.0.0.1:8787/health` 可用。
2. 前端 `http://127.0.0.1:5173` 可用。
3. ComfyUI `http://127.0.0.1:8188` 可用。
4. 可从当前微应用列表页点击进入 `Image Generation Studio`，不手输内部调试路由。
5. `Workflow 模式` 下 provider 必须自动收敛到 `ComfyUI Local`。
6. 使用合法样例 workflow 提交后，页面必须出现真实结果：
   - 要么进入真实任务生命周期
   - 要么明确暴露环境阻塞错误，而不是本地伪造成功
7. 本轮测试必须保留证据：
   - 入口页截图
   - 调试页截图
   - 成功态或失败态截图
   - 任务结论写回本卡

## Verification

- `curl http://127.0.0.1:8787/health`
  - purpose: 验证 backend 可用
- `curl http://127.0.0.1:5173`
  - purpose: 验证 frontend dev server 可用
- `curl http://127.0.0.1:8188`
  - purpose: 验证 ComfyUI HTTP 服务可用
- Chrome 插件真实冒烟
  - purpose: 验证入口、调试页、Workflow 模式、ComfyUI Local 与任务终态

## Evidence

- Evidence directory:
  - `.test-artifact/image-generation-smoke/`

- Required evidence:
  - 产品入口截图
  - `Image Generation Studio` 工作区截图
  - 提交后的终态截图
  - 本次提交修改了哪一个非 prompt 参数
  - 最终结论

### Execution Result

本卡共执行了两轮真实 Chrome 冒烟，第二轮已成功跑通。

#### Round 1

- 使用 workflow：
  - `docs/microapp/workflows/image_z_image_turbo.comfyui-api.json`
- 本次没有改 workflow 主 prompt。
- 本次只改了两个非 prompt 参数：
  - `57:3.inputs.seed`
    - from: `93419429860859`
    - to: `93419429860999`
  - `9.inputs.filename_prefix`
    - from: `z-image-turbo`
    - to: `z-image-turbo-smoke`
- 结果：
  - 失败
  - 页面明确暴露：
    - `Image generation provider is not registered: comfyui_local`

#### Round 2

- 在工作区 `.env` 补入 `UI_CHAT_IMAGE_GENERATION_COMFYUI_BASE_URL=http://127.0.0.1:8188`，并重启当前开发态 backend 进程后重新执行。
- 仍使用同一份 workflow 样例。
- 本次没有改 workflow 主 prompt。
- 本次只改了两个非 prompt 参数：
  - `57:3.inputs.seed`
    - from: `93419429860859`
    - to: `93419429861077`
  - `9.inputs.filename_prefix`
    - from: `z-image-turbo`
    - to: `z-image-turbo-smoke-rerun`
- 结果：
  - 成功
  - 页面真实进入：
    - `queued -> running -> succeeded`
  - 页面真实显示本地预览图与产物元数据

### Verification Results

- `curl http://127.0.0.1:8787/health`
  - 通过
- `curl http://127.0.0.1:5173`
  - 第二轮前重新拉起 Vite 后通过
- `curl http://127.0.0.1:8188`
  - 通过
- Chrome 产品入口级冒烟
  - 已执行两轮
  - 第一轮失败原因明确
  - 第二轮成功到终态

### Observed Product Flow

1. 从 `http://127.0.0.1:5173/#/settings/micro-apps` 进入当前微应用列表页。
2. 页面顶部真实可见 `Image Generation Studio` 入口卡。
3. 从入口卡点击“进入工作区”，成功进入：
   - `http://127.0.0.1:5173/#/settings/micro-apps/image-generation-studio`
4. 切到 `Workflow 模式` 后，provider 自动收敛到 `ComfyUI Local`。
5. 将修改过 `seed` 与 `filename_prefix` 的合法 ComfyUI API format workflow 粘贴进 `Workflow JSON`。
6. 页面正确判定：
   - `JSON 合法，且看起来是 ComfyUI API format。`
7. 第二轮点击 `开始生成` 后，页面真实进入：
   - `queued`
   - `running`
   - `succeeded`
8. 成功态页面真实显示：
   - 本地预览图
   - `Provider Job ID: 72784a5f-aa4e-4b49-9309-acf19a48e417`
   - `Artifact ID: 1ad4bff3-e6a3-4708-b14f-273ddcc4451c`
   - 本地预览文件：
     - `file:///D:/workspace/rag-demo/server/.artifacts/image-generation/imggen_mr8ayxui_5mk0slmp/1ad4bff3-e6a3-4708-b14f-273ddcc4451c.png`

### Conclusion

- `Image Generation Studio` 当前产品入口链路正常。
- `Workflow 模式 -> ComfyUI Local` 自动收敛正常。
- 合法 `ComfyUI API format` workflow 可被页面正确识别。
- 当前开发运行时在补齐 `UI_CHAT_IMAGE_GENERATION_COMFYUI_BASE_URL` 并重启 backend 后，已经可以真实跑通：
  - 提交
  - 轮询
  - 结果回收
  - 本地预览
- 当前仍保留的已知缺口只有：
  - desktop client 仍未接 cancel endpoint，所以运行中“取消任务”按钮继续禁用

### Evidence Files

- 第一轮入口页截图：
  - `.test-artifact/image-generation-smoke/02-microapps-entry.png`
- 第一轮工作区初始截图：
  - `.test-artifact/image-generation-smoke/03-studio-initial.png`
- 第一轮已填入合法 workflow 的截图：
  - `.test-artifact/image-generation-smoke/04-workflow-prepared.png`
- 第一轮提交后失败态截图：
  - `.test-artifact/image-generation-smoke/05-post-submit.png`
- 第二轮入口页截图：
  - `.test-artifact/image-generation-smoke/06-microapps-entry-rerun.png`
- 第二轮工作区初始截图：
  - `.test-artifact/image-generation-smoke/07-studio-rerun-initial.png`
- 第二轮已填入合法 workflow 的截图：
  - `.test-artifact/image-generation-smoke/08-workflow-rerun-prepared.png`
- 第二轮提交后运行态截图：
  - `.test-artifact/image-generation-smoke/09-after-submit-rerun.png`
- 第二轮成功终态截图：
  - `.test-artifact/image-generation-smoke/10-terminal-rerun.png`

## Review Outcome

- 当前状态：`DONE`
- 本卡已完成内容：
  - 已执行真实 Chrome 冒烟
  - 已保留入口、工作区、运行态和成功终态证据
  - 已确认当前开发运行时下 `ComfyUI Local` 可以跑通真实任务生命周期
