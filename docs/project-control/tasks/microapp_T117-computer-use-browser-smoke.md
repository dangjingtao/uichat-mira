---
status: current
priority: P1
owner: microapp
last_verified: 2026-07-06
layer: project-control
module: MicroAPP
feature: ComputerUse
doc_type: task-card
canonical: true
related:
  - docs/project-control/tasks/microapp_T113-computer-use-server-http-surface.md
  - docs/project-control/tasks/microapp_T115-computer-use-desktop-studio-workspace.md
  - docs/project-control/tasks/microapp_T116-computer-use-desktop-entry-integration.md
  - docs/microapp/computer-use-feature-design.md
task_state: READY_FOR_REVIEW
---

# microapp_T117 Computer Use Browser Smoke

## Target

执行一轮真实的 `computer_use` 浏览器产品入口级冒烟，覆盖：

- 当前微应用产品入口
- `Computer Use Studio`
- 浏览器运行时状态暴露
- 计划生成
- 任务启动
- 审批 / 执行 / 终态或明确环境阻塞

这张卡不是实现卡，不改业务代码，只产出冒烟证据和任务结论。

## Allowed Changes

- `docs/project-control/tasks/microapp_T117-computer-use-browser-smoke.md`
- `docs/project-control/project-control-ledger.md`
- `.test-artifact/computer-use-smoke/**`

## Forbidden Changes

- `desktop/src/**`
- `server/src/**`
- `electron/**`
- `tauri/**`
- `docs/project-control/tasks/microapp_T113-computer-use-server-http-surface.md`
- `docs/project-control/tasks/microapp_T115-computer-use-desktop-studio-workspace.md`
- `docs/project-control/tasks/microapp_T116-computer-use-desktop-entry-integration.md`

## Test Boundary

本卡只验证当前已经落地的一期真实链路：

1. 从 `Settings -> MicroApps` 列表页进入 `Computer Use Studio`
2. 不手输内部调试路由
3. 观察页面是否真实暴露浏览器运行时状态
4. 输入一个明确的浏览器任务目标并生成 plan
5. 在可执行条件下启动任务
6. 观察真实生命周期：
   - 要么进入 `queued / running / awaiting_approval / succeeded / failed / cancelled / blocked` 中的真实状态
   - 要么在进入执行前暴露明确环境阻塞，例如运行时缺失、浏览器下载失败、启动失败
7. 保留截图和结论，不得通过修改实现代码让流程“看起来通过”

## Smoke Goal Recommendation

为了让不同执行线程的结果可比较，本卡推荐优先使用简单、低风险、可观察的浏览器任务，例如：

- 打开一个公开网页并读取标题
- 在限定站点范围内进入首页并记录页面关键信息

约束：

- 目标必须是浏览器内动作
- 不做登录态依赖任务
- 不做文件下载、系统写入或外发数据类动作
- 如果审批链出现，按页面真实要求执行，不要跳过

## Acceptance Criteria

1. 后端 `http://127.0.0.1:8787/health` 可用。
2. 前端 `http://127.0.0.1:5173` 可用。
3. 用户可从当前 `Settings -> MicroApps` 页面点击进入 `Computer Use Studio`，不需要手输内部路径。
4. 工作台必须真实显示浏览器运行时状态，而不是本地伪造固定文案。
5. 输入任务后，页面必须对 plan 结果给出真实反馈：
   - 要么显示 plan
   - 要么显示明确错误或阻塞原因
6. 点击启动后，页面必须给出真实生命周期反馈：
   - 要么进入真实任务状态
   - 要么暴露明确环境阻塞
7. 如果进入审批态，必须记录审批前后页面状态变化。
8. 本轮测试必须保留证据：
   - 微应用列表入口截图
   - `Computer Use Studio` 初始截图
   - plan 已生成或报错截图
   - 启动后运行态、审批态、终态或阻塞态截图
   - 本卡内的人话结论

## Verification

- `curl http://127.0.0.1:8787/health`
  - purpose: 验证 backend 可用
- `curl http://127.0.0.1:5173`
  - purpose: 验证 frontend dev server 可用
- 产品入口级真实冒烟
  - purpose: 验证入口、工作台、运行时状态、plan、启动和真实任务反馈

## Evidence

- Evidence directory:
  - `.test-artifact/computer-use-smoke/`

- Required evidence:
  - 产品入口截图
  - `Computer Use Studio` 初始截图
  - plan 生成结果截图或明确报错截图
  - 启动后的运行态 / 审批态 / 终态 / 阻塞态截图
  - 本次测试使用的任务目标
  - 最终结论

## Execution Notes

- 如果本机存在可用浏览器运行时，优先走真实执行，不要故意停在安装提示页。
- 如果本机不存在可用运行时，可以验证安装引导或下载动作，但必须把真实阻塞点写清楚：
  - 是全局 Playwright 缺失
  - 还是下载失败
  - 还是浏览器 launch 失败
- 如果链路在 `plan` 之前就失败，必须说明阻塞发生在哪一层：
  - 产品入口
  - 工作台初始化
  - 运行时探测
  - 任务创建

## Execution Record

### Smoke Environment

- Date: `2026-07-06`
- Backend health:
  - `http://127.0.0.1:8787/health`
  - result: 返回 `{"success":true,...,"message":"Service is healthy"}`
- Frontend health:
  - `http://127.0.0.1:5173`
  - result: `200`

### Tested Goal

- Goal: `打开 https://example.com ，读取页面标题，并在结果里说明页面主标题文本。`
- Site scope: `example.com`

### Real Smoke Path

1. 从首页点击“检查设置”进入 `Settings`。
2. 在左侧导航点击 `微应用`，进入 `Settings -> MicroApps` 列表页。
3. 在 `Computer Use Studio` 卡片点击“进入工作区”，没有手输内部调试路由。
4. 工作台初始状态真实显示：
   - `运行时 · 已就绪`
   - `任务 · 空闲`
5. 输入 goal 和 site scope 后点击 `Create Plan`。
6. 页面真实进入 plan 已生成状态，显示：
   - `任务 · 计划已就绪`
   - 三步计划：打开目标页面、采集证据、高风险动作需要审批
7. 点击 `Start Task` 后，当前任务没有卡在安装、下载、启动失败或审批等待，而是直接进入：
   - `任务 · 已成功`
8. `Evidence` 页签真实显示动作日志和产物信息，包括：
   - `navigated to https://example.com`
   - `captured screenshot ...landing-page.png`
   - `Opened https://example.com and captured the landing page.`
9. 当前这组证据只能证明“导航到目标页面并截图成功”，还不能证明任务真的完成了“读取页面标题，并在结果里说明页面主标题文本”。

### Evidence Files

- Evidence directory:
  - `.test-artifact/computer-use-smoke/2026-07-06-T117/`
- Files:
  - `01-landing-home.png`
  - `02-settings-microapps-list.png`
  - `03-computer-use-studio-initial.png`
  - `04-plan-attempt-state.png`
  - `05-after-start.png`
  - `06-evidence-tab.png`
  - `07-round2-studio-initial-desktop.png`
  - `08-round2-plan-desktop.png`
  - `09-round2-result-desktop.png`
  - `goal.txt`
  - `goal-round2.txt`
  - `health-backend.json`
  - `health-frontend.txt`
  - `summary.md`

- Evidence note:
  - `goal.txt` 是在 review 指出缺失后补回的证据文件，内容来自已保存截图和本卡 `Tested Goal`，不是新的运行结果。

### Round2 Retry

1. 第二轮仍然从 `Settings -> MicroApps` 真实进入 `Computer Use Studio`，不手输内部调试路由。
2. 因为当前浏览器自动化输入层缺少虚拟剪贴板，`fill` / `type` 会报 `Browser Use virtual clipboard is not installed`，所以第二轮改用逐字符按键方式输入目标和站点范围。
3. 第二轮目标改成：
   - `Open https://example.com and include the page title and H1 text in the final result summary.`
   - site scope: `example.com`
4. 第二轮 plan 真实结果仍然只有：
   - `Open target page`
   - `Capture evidence`
   - `Approve high-risk browser actions`
5. 第二轮点击 `Start Task` 后，任务再次进入：
   - `任务 · 已成功`
6. 但第二轮真实终态结果仍然是：
   - `Opened https://example.com and captured the landing page.`
7. 第二轮没有产出页面标题，也没有产出主标题文本。

## Acceptance Check

1. `AC1` satisfied: backend health endpoint returned success JSON.
2. `AC2` satisfied: frontend dev server returned `200`.
3. `AC3` satisfied: 从 `Settings -> MicroApps` 列表页进入 `Computer Use Studio`，没有手输路径。
4. `AC4` satisfied: 工作台真实显示 `运行时 · 已就绪`，不是固定占位文案。
5. `AC5` satisfied: 输入任务后页面真实生成 plan，并展示具体步骤。
6. `AC6` partially satisfied: 两轮点击启动后页面都确实进入真实终态 `已成功`，不是伪造成功提示；但第二轮已经把目标明确收紧到“结果里写出页面标题和主标题文本”，真实 plan 和真实终态仍然只完成“导航 + 截图”，所以这一轮已经能确认当前一期链路还不能按该目标通过验收。
7. `AC7` not applicable in this run: 本轮低风险任务没有进入审批态，因此不存在审批前后状态切换证据；页面本身已展示“高风险动作需要审批”的计划步骤。
8. `AC8` satisfied after evidence repair: 入口截图、工作台初始截图、plan 截图、启动后终态截图、人话结论和目标文本文件现在都已落到 `.test-artifact/computer-use-smoke/2026-07-06-T117/`；但 `goal.txt` 是 review 后补回，不构成新的运行结果。

## Review Outcome

- 当前状态：`READY_FOR_REVIEW`
- 结论：当前证据已经不只是“首轮没补够”，而是两轮真实运行都证明了同一个事实：产品入口、工作台、运行时状态、plan 生成和“导航到页面并截图”这条执行链路是真实通的，但当前一期链路还不能把页面标题和主标题文本产出到最终结果里，因此本卡不能按 `DONE` 验收。
- 阻塞说明：
-  - 如果后续要把 `T117` 做到 `DONE`，需要先补实现，让 plan / executor / result surface 里至少有一层能真实产出页面标题和主标题文本。
-  - 如果项目 owner 只想验收当前一期“导航 + 截图”边界，需要另开或改卡，把 smoke 目标和验收口径改成与当前真实能力一致的人话。
- 未完成项：本轮没有覆盖审批态；如果后续要单独验收审批链，需要另选会进入 `awaiting_approval` 的任务目标再开冒烟。
