---
status: proposed
owner: build
last_verified: 2026-07-02
layer: project-control
module: Build
feature: TestReportPackaging
doc_type: task-card
canonical: false
related:
  - ../../build/README.md
  - ../../../scripts/generate-test-report.js
  - ../../../scripts/generate-dev-coverage.js
  - ../../../scripts/prepare-desktop-artifacts.js
---

# T-009 测试报告 JSON 合并与瘦身

## 背景

当前测试报告链路已经具备稳定主链：

- 完整测试生成官方 JSON
- 开发页复用官方 JSON
- release 构建把官方 JSON 随包发布

但当前产物体积偏大，而且存在重复拷贝。

2026-07-02 本地观测：

- `desktop/test-report/coverage-report.json` 约 `11 MB`
- `server/test-report/coverage-report.json` 约 `10.8 MB`

同时还会复制到：

- `server/client-coverage/`
- `server/server-coverage/`

## 问题定义

当前债务不是“报告缺失”，而是“报告可用但过重”：

1. `coverage-report.json` 单文件进入 10MB 级别。
2. 官方报告目录和 backend 静态目录各存一份，存在重复 IO 与重复占用。
3. 前后端报告结构平行但分散，后续继续扩展会让打包和加载负担继续上升。

## 目标

后续改造成：

1. 由脚本生成单一测试报告载荷。
2. 单一载荷内部按 `client / server` 分 scope。
3. 公共 metadata 只保留一份。
4. 前端改为读取统一报告入口，而不是多份平行 JSON。
5. 在不破坏现有测试页能力的前提下，降低包内测试报告总体体积。

## 非目标

本任务不要求：

- 改掉当前测试报告前端展示形态
- 移除覆盖率细粒度数据
- 让开发阶段每次临时跑 vitest 都覆盖官方报告

## 建议方向

建议产物形态：

```text
test-report-bundle.json
```

建议结构：

```json
{
  "schemaVersion": 1,
  "generatedAt": "...",
  "scopes": {
    "client": {
      "testReport": {},
      "coverageReport": {}
    },
    "server": {
      "testReport": {},
      "coverageReport": {}
    }
  }
}
```

可以继续评估：

- 是否保留每个 scope 独立文件作为兼容过渡层
- 是否对 coverage 明细做分块或裁剪
- 是否将 backend 静态目录改为只暴露统一 bundle

## 验收标准

1. 文档明确单一 JSON 方案和迁移边界。
2. 构建脚本能够生成统一测试报告载荷。
3. 开发页和 release 包都改为消费统一入口。
4. 不破坏“完整测试失败但报告仍保留”的现有策略。
5. 体积与重复拷贝情况有明确改善证据。

## 当前结论

该项先记为 Build 技术债，等当前构建主链稳定后再实施。
