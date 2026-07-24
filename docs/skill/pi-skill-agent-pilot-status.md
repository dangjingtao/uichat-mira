# Pi Skill Agent Pilot 状态

Status: Active Pilot
Last verified: 2026-07-24
Related: `./pi-skill-agent-execution.md`

## 已落地

- `@earendil-works/pi-agent-core@0.74.1` 已加入 `server/package.json`。
- forked Skill Agent 执行合同与结果协议已建立。
- 文枢 `docx / pdf / pptx / xlsx` 已建立首批 server-side execution profile。
- Pi Agent 只接收 profile 允许的 Harness tools 与 Skill-private runtime adapters，不继承 Main Agent 全量 ToolExposure。
- `office_document / office_pdf / office_presentation / office_spreadsheet` 不恢复为全局 Harness Tool；当前仅作为私有 runtime adapter 复用。
- Skill Agent 文件操作绑定当前 workspace。
- Skill Agent private runtime approval 已桥接 Parent `pendingApproval / pendingToolCall / approvedInvocations`，审批绑定 exact `toolId + inputHash + args`，并使用 `origin=skill_agent` 防止 Parent Harness 偷跑 private runtime。
- forked Skill `completed` 会先写入 Evidence，再冻结 Parent finalization；Main Planner task model 不再二次规划/施工，直接进入 Generate 交付。
- `insufficient_evidence` 与 recoverable failure 仍回 Parent recovery；terminal failure 进入现有 Main Agent error/C contract，Generate 不运行。
- WenShu Pi pilot 拒绝无 Evidence 且无 Artifact 的裸 `completed`。
- 已增加 `pnpm smoke:pi-skill-agent -- --skill docx|pdf|pptx|xlsx` smoke 入口；XLSX create/edit bridge 未完成时只允许对已有工作簿做 diagnostics/read smoke。
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

## 尚未完成 / 必须按真实结果验收

1. `pnpm-lock.yaml` 必须由真实 package-manager install 重新生成并提交；不能手工伪造 lockfile。
2. 必须在安装完成后真实执行 server typecheck；未拿到命令成功结果前不能声称通过。
3. 必须在有可用 Mira Model Gateway 配置与 WenShu Runtime Pack 的执行环境跑 DOCX/PDF/PPTX smoke；不能把脚本存在等同于 smoke PASS。
4. XLSX XML-first private runtime bridge 仍未完成；只验收 read/diagnostics，不宣称 create/edit 完整接入。
5. 文枢四个 Skill 的 tool/runtime 声明当前由 pilot profile adapter 表达；后续应把正式 schema 收敛进 Skill package manifest/frontmatter，避免双重真相。

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

## 验收顺序

```text
pnpm install
-> pnpm --filter @ui-chat-mira/server typecheck
-> MIRA_SKILL_AGENT_RUNTIME=pi-core
-> DOCX smoke
-> PDF smoke
-> PPTX smoke
-> XLSX read/diagnostics smoke
-> approval/resume smoke
-> Parent Generate / no-Main-Planner-rework smoke
-> XLSX XML runtime bridge（后续独立完成）
```

任何一步失败都按真实失败处理，不使用 LLM 解释性兜底。
