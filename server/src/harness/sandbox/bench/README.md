# Sandbox Direct Bench

这个 bench 只直连 `SandboxExecutor` 合同层。

它明确绕过：

- LLM
- Planner
- Tool Selection
- `read_list`
- Generate

## 用途

- 验证 `SandboxRunRequest / SandboxRunResult` 最小合同
- 验证 direct bench 正向与负向样例
- 产出可被后续 L1 runner 扩展消费的结构化 JSON

## 运行

```bash
pnpm --filter @ui-chat-mira/server exec tsx src/harness/sandbox/bench/runner.ts
```

也可以显式传入 workspace root：

```bash
pnpm --filter @ui-chat-mira/server exec tsx src/harness/sandbox/bench/runner.ts D:\workspace\rag-demo
```

## 当前覆盖

- 正向：`echo hello`、中文输出、非零 `exitCode`
- 负向：`cwd` 越界、超短 `timeout`、巨量输出
- 覆盖说明：`read_only` 这类当前未落地的 profile 会输出 `not_implemented`
