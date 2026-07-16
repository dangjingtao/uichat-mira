---
status: current
priority: P1
owner: microapp / runtime / desktop
last_verified: 2026-07-15
layer: project-control
module: MicroAPP
feature: ComputerUse
doc_type: task-card
canonical: true
related:
  - docs/microapp/computer-use-feature-design.md
  - docs/project-control/tasks/microapp_T118-computer-use-runtime-and-managed-browser.md
  - docs/project-control/tasks/microapp_T119-computer-use-browser-session-and-tools.md
  - docs/project-control/tasks/microapp_T120-computer-use-mcp-model-governance.md
  - docs/project-control/tasks/microapp_T121-computer-use-debugger-rebuild.md
  - docs/project-control/tasks/microapp_T117-computer-use-browser-smoke.md
task_state: READY_FOR_REVIEW
---

# microapp_T122 Computer Use Integration And Acceptance

## Target

对新 Computer Use 链路做系统级集成验收，清理旧的固定规则主路径，并把真实运行时、浏览器工具、模型调用、审批、Debugger 和证据回放串成可验证闭环。

本卡是验收和必要的集成清理卡，不负责新增浏览器能力，不负责重做 UI，不负责扩大产品范围。

## Allowed Changes

- `.test-artifact/computer-use-acceptance/**`
- `server/src/microapps/computer-use/__tests__/acceptance*.test.ts`
- `server/src/mcp/tools/__tests__/browser-acceptance*.test.ts`
- `desktop/src/features/Settings/pages/MicroApps/ComputerUse/__tests__/acceptance*.test.ts`
- `docs/microapp/computer-use-frontend-manual-smoke-guide.md`
- `docs/project-control/tasks/microapp_T122-computer-use-integration-and-acceptance.md`
- `docs/project-control/project-control-ledger.md`

## Forbidden Changes

- `server/src/agent/**`（除非 T120 明确留下的集成适配点）
- `server/src/harness/**`
- `server/src/index.ts`
- `server/src/routes/microapps/computer-use/**`
- `desktop/src/shared/api/computerUse.ts`
- `desktop/src/features/Settings/pages/MicroApps/ComputerUse/**`（除 acceptance 测试文件）
- 其他 MCP 工具
- 其他 MicroAPP
- `electron/**`
- `tauri/**`
- 宿主桌面自动化
- 浏览器插件接管
- 凭据托管
- CAPTCHA 绕过

## Acceptance Criteria

1. 无浏览器环境时，产品能自动安装固定受管 Chromium，或给出明确、可操作的阻塞原因。
2. 手动调试链路真实完成：session -> observe -> act -> assert -> evidence。
3. 模型链路真实完成：model -> browser tool -> observation -> next decision。
4. 审批拒绝、超时、域名越界、ref 失效、session 丢失和浏览器启动失败都有真实终态。
5. 旧的 `Goal -> regex URL -> fixed navigate/capture` 路径不再作为生产主流程；移除动作归 T120 所有。
6. 页面不显示没有实际模型调用支撑的 planning 或成功状态。
7. 所有关键结果都有 invocation、trace 或 artifact 证据。
8. 旧 T110-T117 的历史证据与新 T118-T122 的验收口径明确区分。

## Verification

- `pnpm check`
- server / desktop computer-use 定向测试
- 无浏览器运行时安装验收
- 手动调试端到端验收
- fake provider 模型循环验收
- 明确配置真实 provider 后的真实模型 smoke；没有配置时标记 `SKIPPED`，不能写成通过
- `.test-artifact/computer-use-acceptance/**` 证据审查

## Owned Test Scope

- clean runtime installation
- existing browser reuse
- session and tool flow
- approval and resume
- model unavailable
- model loop with fake provider
- real provider conditional smoke
- UI evidence and final result

## Evidence

- `server/src/microapps/computer-use/__tests__/acceptance.e2e.test.ts`：T122 server acceptance `5/5`，覆盖运行时不可用、session -> observe -> act -> assert -> artifact，以及 stale snapshot 和域名越界终态。
- `server/src/mcp/tools/__tests__/browser-acceptance.evidence.test.ts`：MCP acceptance `2/2`，覆盖 fake provider tool-loop、Harness invocation、审批参数绑定和变更 snapshot 拒绝。
- `desktop/src/features/Settings/pages/MicroApps/ComputerUse/__tests__/acceptance.evidence.test.tsx`：desktop acceptance `1/1`，覆盖 invocation、artifact、截图结果展示，以及无模型时 Model Run 保持不可用。
- 定向回归：server Computer Use 相关套件 `38/38`，desktop Debugger 相关套件 `4/4`。
- `pnpm check` 通过，`git diff --check` 通过；未修改 `server/src/agent/**` 或 AgentGraph。
- 证据目录：`.test-artifact/computer-use-acceptance/server/**`、`.test-artifact/computer-use-acceptance/mcp/**`、`.test-artifact/computer-use-acceptance/desktop/**`。
- 第一轮验收时真实 provider 未配置，真实模型 smoke 按验收约定记为 `SKIPPED`；该历史结论已由 T123 配置后的第二轮真实前台 smoke 补充，不覆盖第一轮证据。
- 第三轮前台黑盒复测结果已更新到 `.test-artifact/computer-use-acceptance/desktop/manual-blackbox/blackbox-results.json`：`PASS=16`、`FAIL=0`、`SKIPPED=4`。合法 action、审批通过/拒绝、正确/错误断言、非法 ref、域名越界和 Stop 均已获得真实终态；stale snapshot 不能由当前页面表单构造，保持 `SKIPPED`。

## Review Notes

T122 的自动化验收测试、前台手测指引和第三轮前台黑盒结果记录已经补齐。T122-fix/T123 处理的 action schema、observe/stop route 和 AgentTaskModel 入口问题已通过本轮前台复测；当前没有新的前台 FAIL。stale snapshot 仍需要测试注入能力才能在页面黑盒层执行，不能把 SKIPPED 计为 PASS。

## Frontend Black-box Test Cases

以下用例从 Debugger 页面操作并观察页面与 Network 请求，不依赖服务端内部实现。测试站点使用受控页面 `https://example.com`，允许域名为 `example.com`。

| ID | 场景 | 前端操作 | 通过标准 |
| --- | --- | --- | --- |
| CU-FE-001 | 读取运行状态 | 进入 Debugger | 发出 `GET /microapps/computer-use/debugger/status`；Runtime 和 Model 状态真实展示；无模型时 Model Run 禁用 |
| CU-FE-002 | 无浏览器运行时 | Runtime 不可用时点击 New Session | 发出创建请求并展示明确可操作的阻塞原因；不创建 ready session，不静默切换浏览器 |
| CU-FE-003 | 创建 session | 填写 managed、URL、allowed domains、审批策略并点击 New Session | 发出 `POST /microapps/computer-use/sessions`；展示 session ID 和 ready 状态 |
| CU-FE-004 | Observe | session ready 后点击 Inspect | 发出 `/sessions/:id/observe`；展示 URL、标题、snapshot、hash、visible text、截图、invocation 和 evidence |
| CU-FE-005 | 安全点击 | Observe 后输入合法 ref 并点击 Execute | 发出 `/sessions/:id/action`；`pageUrl`、`snapshotHash`、`ref` 与当前 observation 绑定；写操作进入审批 |
| CU-FE-006 | 审批通过 | Action 等待审批后点击 Approve | 发出 `/sessions/:id/approval`；action 变为 succeeded，浏览器状态和 evidence 更新 |
| CU-FE-007 | 审批拒绝 | Action 等待审批后点击 Reject 并填写原因 | 发出 `/sessions/:id/approval/reject`；action 变为 rejected，浏览器不执行动作，原因留在 evidence |
| CU-FE-008 | Assert 通过 | 输入正确标题并点击 Assert | 发出 `/sessions/:id/assert`；显示 passed、expected、actual 和 `browser_assert` invocation |
| CU-FE-009 | 完整 Manual Debug 闭环 | New Session -> Inspect -> Execute -> Approve -> Assert -> 查看 artifact -> Stop | 请求顺序完整；每一步均有 invocation、trace、artifact 或 evidence；Stop 后不可继续操作 |
| CU-FE-010 | stale snapshot | 使用旧 snapshot hash 执行动作 | 明确返回 stale snapshot；不执行动作；提示重新 Inspect |
| CU-FE-011 | 无效 ref | 使用不存在的 ref 执行动作 | 显示失败原因；不出现 succeeded 或成功 artifact |
| CU-FE-012 | 域名越界 | navigate 到不在 allowed domains 的 URL | action 失败；不发生导航；保留失败 invocation |
| CU-FE-013 | Assert 失败 | 输入错误标题并点击 Assert | 显示 assertion failed、expected 和 actual；不能把失败显示为 session 成功 |
| CU-FE-014 | session 丢失 | session 被停止或清理后点击 Inspect | 显示 session unavailable；旧 session 不再显示 ready；操作按钮不可用 |
| CU-FE-015 | 浏览器启动失败 | launcher 启动失败时点击 New Session | 展示启动失败终态；不生成成功截图，不静默切换执行路径 |
| CU-FE-016 | Stop 中断 | session 运行期间点击 Stop | 发出 `/sessions/:id/stop`；session 为 stopped；已有 invocation 和 evidence 保留 |
| CU-FE-017 | Reset | 已产生结果后点击 Reset | 清除 session、错误、snapshot、artifact、approval 和反馈；配置恢复默认值 |
| CU-FE-018 | 无模型 provider | 未配置模型时查看并点击 Model Run | Model 显示 unavailable，按钮禁用，不发模型请求，不显示 planning 或成功状态 |
| CU-FE-019 | fake provider tool-loop | 注入 fake provider 后执行 Model Run | 观察 `model -> browser_observe -> observation -> next decision`；工具调用有 trace，审批规则仍生效 |
| CU-FE-020 | 真实 provider smoke | 配置真实 provider、受管 Chromium 和测试站点后执行 Model Run | provider 未配置时标记 `SKIPPED`；配置后必须看到真实模型调用和 browser invocation，只有文本 planning 不算通过 |

### Frontend Black-box Request Sequence

CU-FE-009 的完整请求序列为：

```text
GET  /microapps/computer-use/debugger/status
POST /microapps/computer-use/sessions
POST /microapps/computer-use/sessions/:id/observe
POST /microapps/computer-use/sessions/:id/action
POST /microapps/computer-use/sessions/:id/approval
POST /microapps/computer-use/sessions/:id/assert
GET  /microapps/computer-use/sessions/:id/artifacts/:artifactId/content
POST /microapps/computer-use/sessions/:id/stop
```

当前前端的 Model Run 按钮在模型不可用时按设计保持禁用；因此 CU-FE-018 可在当前环境验收通过，CU-FE-019 和 CU-FE-020 只有在模型执行入口及对应 provider 配置存在时才执行。

## Final Boundary

本卡完成后，只能声明：

> Computer Use Debugger 的受控浏览器工具链和真实模型接入已经按证据验收。

不能由本卡声明：

- 支持任意网站和任意任务
- 支持宿主桌面控制
- 支持凭据托管
- 支持浏览器插件接管
- 支持无人审批的高风险操作
