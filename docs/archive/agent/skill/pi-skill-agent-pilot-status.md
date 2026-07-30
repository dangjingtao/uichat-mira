# Pi Skill Agent Pilot 状态

Status: Active Pilot
Last verified: 2026-07-24
Related: `./pi-skill-agent-execution.md`

## 已落地

- `@earendil-works/pi-agent-core@0.74.1` 已加入 `server/package.json`，`pnpm-lock.yaml` 已由真实 `pnpm` 安装流程更新；`pnpm install --frozen-lockfile` 已验证通过。
- forked Skill Agent 执行合同与结果协议已建立。
- 文枢 `docx / pdf / pptx / xlsx` 已建立首批 server-side execution profile。
- Pi Agent 只接收 profile 允许的 Harness tools 与 Skill-private runtime adapters，不继承 Main Agent 全量 ToolExposure。
- `office_document / office_pdf / office_presentation / office_spreadsheet` 不恢复为全局 Harness Tool；当前仅作为 Skill-private runtime adapter 复用。
- Skill Agent 文件操作绑定当前 workspace。
- Skill Agent private runtime approval 已桥接 Parent `pendingApproval / pendingToolCall / approvedInvocations`：
  - approval 绑定 exact `toolId + inputHash + args`；
  - frozen invocation 使用 `origin=skill_agent`，防止 Parent Harness 偷跑 private runtime；
  - re-fork 只携带当前 frozen invocation 对应的 exact approval，历史 approval 不跨 fork 泄漏；
  - private runtime 的 exact approval 在单次 fork 内只允许消费一次，并在副作用执行前标记已消费，避免重复写副作用。
- Pi completion JSON 不能自行铸造 approval；approval authority 只来自实际 tool/runtime requirement。
- forked Skill `completed` 会先写入 Evidence，再冻结 Parent finalization；Pi-loop 在 prepare/resume 后直接进入 Generate，Main Planner task model 不再二次规划/施工。
- forked Skill `needs_input` 会冻结为 Parent `ask_user` 决策；Main Planner task model 不得重新解释该缺口或接管施工。
- `insufficient_evidence` 与 recoverable failure 仍回 Parent recovery；terminal failure 进入现有 Main Agent error/C contract，Generate 不运行。
- WenShu Pi pilot 拒绝无 Evidence 且无 Artifact 的裸 `completed`。
- 已增加根目录 smoke 入口：`pnpm smoke:pi-skill-agent -- --skill docx|pdf|pptx|xlsx`；XLSX create/edit bridge 未完成时只允许对已有工作簿做 diagnostics/read smoke。
- 最终验证源码上 server typecheck 已通过；5 个 focused test files、9 个 tests 全部通过，覆盖 completed finalization、needs_input freeze、recoverable/terminal routing、approval re-fork scope 与 one-shot approval consumption。
- Pilot 通过 `MIRA_SKILL_AGENT_RUNTIME=pi-core` 显式启用；不开启时保持原执行路径。

## 当前 Pilot 边界

### DOCX / PDF / PPTX

已具备 private runtime adapter 接线。PPTX 继续复用现有 WenShu `office_presentation` adapter，因此其内部必须保持：

```text
WenShu managed launcher
-> pptx_runtime.py
-> bundled kimi_ppt_dsl
-> checker
-> Converter
```

Pi Agent 不应自行选择 `python -m kimi_ppt_dsl`。

### XLSX

当前只有 legacy diagnostics adapter (`inspect / recalc / verify`) 可安全私有复用。

MiniMax XML-first CREATE / EDIT 尚缺一个正式的 Skill-private runtime bridge，因此 profile 中 `wenshu_xlsx_xml_runtime` 标记为 `pending`。在该桥接完成前，不得伪装为 XLSX create/edit 已完成接入，也不得恢复 `office_spreadsheet` legacy create/modify。

## 真实验证状态

最终验证针对提交 `b617ebb874eec9f8eaccd6833ebd28de8538f685`：

```text
pnpm install --frozen-lockfile: PASS
server typecheck: PASS
focused test files: 5 PASS
focused tests: 9 PASS
DOCX live smoke: NOT PASSED
PDF live smoke: NOT PASSED
PPTX live smoke: NOT PASSED
XLSX diagnostics/read live smoke: NOT PASSED
```

四个 live smoke 命令均已实际启动，并正确打印 Skill profile / scoped tools / private runtime；但 CI 环境没有 Mira server 必需的 `DATABASE_URL`，因此在进入 Pi model/tool execution 前即以 `DATABASE_URL is not set` 失败。当前不能宣称 artifact smoke 通过，也没有生成可验收 artifact。

这不是 runtime success。下一次 live smoke 必须在具有真实 Mira server DB、Model Gateway/provider 配置以及对应 WenShu Runtime Pack 的开发环境执行；失败继续按失败处理，不使用 LLM 解释性兜底。

## Smoke 输出合同

`smoke:pi-skill-agent` 至少输出并校验：

```text
skillId
engine
workspace
toolExposure
privateRuntime
toolCalls
approval pause/resume
result status
evidence count
artifact paths
artifact byte sizes
mainPlanner execution events
```

DOCX/PDF/PPTX smoke 要求 non-empty workspace artifact；XLSX 在 XML bridge 完成前要求显式传入已有 `.xlsx` 做 diagnostics/read。任何失败必须 exit code != 0。

## 尚未完成

1. 在具备真实 Mira DB / Model Gateway / WenShu Runtime Pack 的开发环境跑通 DOCX/PDF/PPTX artifact smoke 与 approval pause/resume smoke。
2. XLSX XML-first Skill-private create/edit runtime bridge 仍未完成；只验收 read/diagnostics，不宣称 create/edit 完整接入。
3. 文枢四个 Skill 的 tool/runtime 声明当前由 pilot profile adapter 表达；后续应把正式 schema 收敛进 Skill package manifest/frontmatter，避免双重真相。

## 验收顺序

```text
pnpm install --frozen-lockfile
-> pnpm --filter @ui-chat-mira/server typecheck
-> focused forked Skill tests
-> MIRA_SKILL_AGENT_RUNTIME=pi-core
-> DOCX artifact smoke
-> PDF artifact smoke
-> PPTX artifact smoke
-> XLSX read/diagnostics smoke
-> approval/resume smoke
-> Parent Generate / no-Main-Planner-rework smoke
-> XLSX XML runtime bridge（后续独立完成）
```

任何一步失败都按真实失败处理，不使用 LLM 解释性兜底。
