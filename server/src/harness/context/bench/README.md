# Context Read Bench

这个 bench 只验证 `Context / Read` 路径，不跑 terminal command。

它集中覆盖：

- `read_list`
- `read_locate`
- `read_open`
- `read_extract`
- `read_slice`
- `inspect` 预算内 context 构建
- 中文路径、BOM、GBK、二进制和大文件边界

## 运行

```bash
pnpm --filter @ui-chat-mira/server exec tsx src/harness/context/bench/runner.ts
```

## 输出

bench 输出固定包含：

- `caseId`
- `operation`
- `input`
- `status`
- `filesRead`
- `charsRead`
- `encoding`
- `truncated`
- `diagnostics`
