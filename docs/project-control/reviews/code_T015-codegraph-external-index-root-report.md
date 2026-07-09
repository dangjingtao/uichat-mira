---
status: current
owner: runtime
last_verified: 2026-07-09
layer: project-control
module: ProjectControl
feature: CodeGraphExternalIndexRootRepoPollutionControlReport
doc_type: review
canonical: true
related:
  - docs/project-control/tasks/code_T015-codegraph-external-index-root-repo-pollution-control.md
  - docs/project-control/project-control-ledger.md
  - server/test-report/code_T015-codegraph-external-index-root.md
---

# code_T015 CodeGraph External Index Root / Repo Pollution Control Report

## Conclusion

- 结论：`PASS`
- 真实 provider 状态：仍然 `blocked`
- 含义：T015 成功把 “repo pollution risk” 从运行后才暴露的问题，前移成了 detect/start/health 的刚性阻断。

## Investigation Result

- `CodeGraph 1.3.0` 不支持可靠 external index root。
- `serve --mcp --help` 没有 index root / cache root / data dir 参数。
- `CODEGRAPH_DIR` 不是 repo 外部路径，只是项目根目录里的 data dir 名称。
- 当前 docs/source 没有可验证的 config-file path override 去把 index/cache/state 移到 repo 外。
- cwd 与 project root 可以分离，但这只能帮助会话定位项目，不能把 `.codegraph/` 移出 repo。

## Runtime Decision

- 对真实 `codegraph` 命令：
  - `planner-exposure-config` 直接给出 `externalIndexSupport.status = blocked`
  - `managed-codegraph-process-manager` 在 detect 阶段就标记 `repo_pollution_risk`
  - clean repo 不等 provider ready 就先 blocked
  - 一旦 repo-root `.codegraph/` 已存在，health 也不会继续 ready
- 对 fake provider / fixture provider：
  - 不强行套用真实 provider 的 external index root 结论
  - 现有隔离测试仍可继续验证 wrapper / verification / trace 行为

## Repo Pollution Evidence

- clean temp repo 上执行 `CODEGRAPH_DIR=<absolute-path> codegraph init <repo>` 后：
  - repo root 新增 `.codegraph/`
  - 指定的 repo 外部路径保持空目录
- clean temp repo 在任何 `init` 前就已经被 managed guard 阻断：
  - `detect = blocked`
  - `start = blocked`
  - `health = blocked`
- 已存在 repo-root `.codegraph/` 的 temp repo：
  - sentinel 文件内容仍然是 `user-owned`
  - manager 只报告 blocked，不删除用户目录

## Evidence Index

- summary markdown：`server/test-report/code_T015-codegraph-external-index-root.md`
- summary json：`server/test-report/code_T015-codegraph-external-index-root.json`
- raw output：
  - `server/test-report/code_T015-codegraph-external-index-root-version.txt`
  - `server/test-report/code_T015-codegraph-external-index-root-serve-help.txt`
  - `server/test-report/code_T015-codegraph-external-index-root-init-help.txt`
  - `server/test-report/code_T015-codegraph-external-index-root-init-with-absolute-codegraph-dir.txt`

## Remaining Boundary

- T015 已通过，不等于真实 CodeGraph provider 现在可 dogfood。
- 只要 `CodeGraph 1.3.0` 仍然没有 repo 外部 index root，managed CodeGraph 就必须保持 blocked。
- 后续如果 provider 升级并公开 external index root 能力，需要单独新任务重新调查，再决定是否解除 blocked。
