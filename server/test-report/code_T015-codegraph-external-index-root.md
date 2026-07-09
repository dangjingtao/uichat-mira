# code_T015 CodeGraph External Index Root / Repo Pollution Control

- status: `PASS`
- smoke root: `C:\Users\ADMINI~1\AppData\Local\Temp\uichat-mira-codegraph-external-index-root\2026-07-09T14-24-18-412Z`

## Investigation
- external index root supported: `false`
- CLI arg support: `false`
- env path support: `false`
- config file path support: `false`
- cwd/project separation supported: `true`
- serve --mcp project/index separation supported: `false`
- repo data dir env: `CODEGRAPH_DIR`
- blocked reason: CodeGraph 1.3.0 does not provide a reliable external index root. `serve --mcp` has no index-root CLI flag, `CODEGRAPH_DIR` only accepts a single directory name inside the project root, and current docs/source do not expose a config-file path override for repo-external index data. Managed CodeGraph must stay blocked because using the real provider would require a repo-root .codegraph directory.

## Startup Policy
- command: `codegraph`
- start args: `["serve","--mcp"]`
- version probe args: `["--version"]`
- telemetry probe args: `["telemetry","status"]`
- cwd strategy: cwd stays at project root; no repo-external index root is passed because CodeGraph 1.3.0 does not support it.

## Clean Repo Pollution Check
- clean repo root: `C:\Users\ADMINI~1\AppData\Local\Temp\uichat-mira-codegraph-external-index-root\2026-07-09T14-24-18-412Z\clean-repo`
- requested external index root: `C:\Users\ADMINI~1\AppData\Local\Temp\uichat-mira-codegraph-external-index-root\2026-07-09T14-24-18-412Z\external-index-root`
- manager preflight detect/start/health before any init: `blocked` / `blocked` / `blocked`
- repo-root .codegraph exists after `CODEGRAPH_DIR=<absolute-path> codegraph init`: `true`
- repo-root .codegraph entries: `.gitignore, codegraph.db`
- external index root entries: `(empty)`
- manager detect/start/health after repo pollution appears: `blocked` / `blocked` / `blocked`

## Existing Repo-root .codegraph
- preexisting repo root: `C:\Users\ADMINI~1\AppData\Local\Temp\uichat-mira-codegraph-external-index-root\2026-07-09T14-24-18-412Z\preexisting-repo`
- sentinel content preserved: `user-owned`
- manager detect/start/health: `blocked` / `blocked` / `blocked`

## Raw Outputs
- version: `server/test-report/code_T015-codegraph-external-index-root-version.txt`
- serve --help: `server/test-report/code_T015-codegraph-external-index-root-serve-help.txt`
- init --help: `server/test-report/code_T015-codegraph-external-index-root-init-help.txt`
- init with absolute CODEGRAPH_DIR: `server/test-report/code_T015-codegraph-external-index-root-init-with-absolute-codegraph-dir.txt`
- summary json: `server/test-report/code_T015-codegraph-external-index-root.json`

