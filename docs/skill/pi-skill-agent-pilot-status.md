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
- Skill Agent 结果先进入现有 Evidence，再由 Parent Planner / Generate 接管最终输出。
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

## 尚未完成

1. `pnpm-lock.yaml` 尚未由真实 package-manager install 重新生成；当前仅完成依赖声明。必须在可访问 npm registry 的开发环境执行 `pnpm install` 后提交 lockfile。
2. 未跑 typecheck / runtime smoke；不能声称 Pi Core 已在 Mira 内成功启动。
3. Approval 目前在 forked Skill Agent 内以 governed requirement 上抛；尚未完整映射到 Parent `pendingApproval` / resume checkpoint。
4. 文枢四个 Skill 的 tool/runtime 声明当前由 pilot profile adapter 表达；后续应把正式 schema 收敛进 Skill package manifest/frontmatter，避免双重真相。
5. XLSX XML-first private runtime bridge 未完成。

## 验收顺序

```text
pnpm install
-> pnpm --filter @ui-chat-mira/server typecheck
-> MIRA_SKILL_AGENT_RUNTIME=pi-core
-> DOCX smoke
-> PDF smoke
-> PPTX smoke
-> XLSX read/diagnostics smoke
-> XLSX XML runtime bridge
-> approval/resume smoke
-> Parent Generate smoke
```

任何一步失败都按真实失败处理，不使用 LLM 解释性兜底。
