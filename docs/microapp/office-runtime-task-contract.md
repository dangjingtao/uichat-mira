# 文枢 Office Runtime 任务合同

Status: Current
Owner: microapp / runtime
Last verified: 2026-07-23
Layer: raw-source
Module: MicroAPP
Feature: OfficeSuite
Doc Type: current-contract
Canonical: true
Related:
  - office-suite-microapp-design.md
  - ../skill/skill-runtime-design.md
  - ../skill/README.md

## Purpose

这页定义 **文枢当前已经实现的 Office Runtime 任务级调用合同**。

它回答：

- Office 调用方应该调用什么入口
- Inspect / Create / Modify 如何统一表达
- Runtime 返回什么稳定结果
- 文件 bytes、artifact ref 和结果 artifact 的边界
- 当前哪些 Office 行为已经进入合同，哪些还没有
- 未来 Skill 应该如何消费这层能力而不绕过现有 Agent / Harness 合同

它不定义：

- Skill Runtime 本身
- Skill 的选择、状态机或 Planner 行为
- Agent 可见的 Office 原子工具
- 完整 Word / Excel / PowerPoint SDK
- 任意既有 PPTX 的无损修改

## When To Read

在这些场景先读这页：

- 调用或扩展文枢 Office Runtime
- 给 Office Runtime 增加新的任务类型
- 把桌面调试入口迁移到新的 Runtime 能力
- 未来实现 Office Skill Adapter
- 判断某个 Office 行为应该进入任务合同还是留在内部 SDK

## Current Contract

当前唯一任务执行入口是：

```ts
executeOfficeRuntimeTask(task: OfficeRuntimeTask): Promise<OfficeRuntimeTaskResult>
```

合同版本：

```text
office-runtime.v1
```

当前任务只允许三个任务级 operation：

```text
inspect
create
modify
```

调用方不应该绕过任务执行器，直接把 `docx`、`exceljs`、`xlsx`、`pptxgenjs` 或 OOXML patch 当成上层公共合同。

原则：

> 上层描述 Office 任务，Runtime 决定由哪个内部模块和实现完成。

## Task Contract

`OfficeRuntimeTask` 是 discriminated union，不是一个塞满可选字段的大对象。

### Inspect

```ts
{
  operation: 'inspect'
  taskId?: string
  input: {
    fileName: string
    mimeType?: string
    buffer: Buffer
    artifactRef?: string
  }
}
```

当前支持：

- `.docx`
- `.xlsx`
- `.pptx`

输出重点是 `inspection`，不产生新 artifact。

### Create

```ts
{
  operation: 'create'
  taskId?: string
  kind: 'word' | 'excel' | 'powerpoint'
  request: {
    type: 'verification-sample'
  }
}
```

当前事实：

- 三种格式都已经通过统一任务入口进入 Create 链路
- V1 合同目前只公开 `verification-sample` 创建模式
- 这不等于已经定义了通用 Word / Excel / PPT 内容生成 schema

未来增加正式创建任务时，应扩展 `request` union，例如新增明确的 Document / Spreadsheet / Presentation 高层请求类型，而不是把底层 SDK 参数直接透传给 Skill。

### Modify: Word

```ts
{
  operation: 'modify'
  kind: 'word'
  input: OfficeRuntimeFileInput
  request: {
    type: 'append-paragraphs'
    paragraphs: Array<{
      text: string
      bold?: boolean
    }>
  }
}
```

当前行为：

- 修改已有 `.docx`
- 默认输出新副本
- 当前稳定修改动作是追加段落
- OOXML 写入保持 `w:sectPr` 在正文尾部的结构约束

这不代表当前支持任意 Word 无损编辑。

### Modify: Excel

```ts
{
  operation: 'modify'
  kind: 'excel'
  input: OfficeRuntimeFileInput
  request: {
    type: 'patch-cells'
    patches: Array<{
      sheetName: string
      cell: string
      value?: string | number | boolean | null
      formula?: string
      bold?: boolean
      numberFormat?: string
    }>
  }
}
```

当前行为：

- 修改已有 `.xlsx`
- Sheet 不存在时可以创建
- 支持 value / formula / bold / number format 基础写回
- 默认输出新副本

### PowerPoint Modify

当前 **不在合同内**。

PowerPoint 当前合同只覆盖：

- Inspect
- Create `verification-sample`

不要因为 PptxGenJS 能生成 PPTX，就把任意既有 PPTX 的修改声明成已支持。

## File Input Boundary

`OfficeRuntimeFileInput` 当前包含：

```text
fileName
mimeType?
buffer
artifactRef?
```

规则：

1. Office Runtime 当前不负责解析外部 artifact store。
2. `buffer` 必须在进入 Runtime 前已经解析完成。
3. `artifactRef` 当前用于保留上游产物身份和 trace 关联，不代替 `buffer`。
4. 未来 Skill Adapter 应先通过现有文件 / artifact 基础设施解析真实 bytes，再调用 Office Runtime。
5. 不要把大文件 bytes 长期复制进 Skill State、聊天历史或 Evidence。

未来链路应是：

```text
Skill / Consumer
  -> resolve artifactRef / file input
  -> OfficeRuntimeTask with resolved bytes
  -> executeOfficeRuntimeTask
  -> persist output artifact
  -> keep artifact ref in upper-layer state/evidence
```

## Result Contract

`OfficeRuntimeTaskResult` 只有两种状态：

```text
completed
failed
```

共同字段：

```text
contractVersion
taskId?
operation
kind?
durationMs
summary
input?
artifacts[]
warnings[]
```

成功结果可以额外包含：

```text
inspection
```

失败结果必须包含：

```ts
error: {
  code: string
  message: string
}
```

当前稳定错误码：

```text
UNSUPPORTED_FILE_TYPE
INVALID_TASK_INPUT
EXECUTION_FAILED
```

原则：

> Runtime 的可预期失败返回稳定 failed result，不把底层库异常形态直接暴露给未来 Skill。

## Artifact Contract

当前 Runtime 内部 artifact 包含：

```text
kind
fileName
mimeType
byteSize
buffer
```

这里的 `buffer` 是 **Server 内部执行结果**，方便当前 HTTP 调试适配器直接下载。

未来 Skill 不应把完整 `buffer` 写进 Skill State。

正确边界：

```text
Office Runtime output buffer
  -> artifact/file infrastructure persists it
  -> returns artifactRef
  -> Skill State / Evidence only keeps ref +必要摘要
```

Runtime 合同当前不伪造尚不存在的 artifact path 或 artifactRef。

## Current Consumers

### 桌面调试入口

当前 `/microapps/office-suite/*` 路由已经是 Office Runtime 的协议适配层。

职责只包括：

- multipart / JSON 请求解析
- 文件大小和扩展名的 HTTP 边界校验
- 构造 `OfficeRuntimeTask`
- 调用 `executeOfficeRuntimeTask`
- 把结果转换为 JSON 或下载响应

路由不应该再次实现 Word / Excel / PowerPoint 业务逻辑。

### Future Skill

Skill Runtime 仍是独立模块，Office Runtime 不依赖 Skill 才能运行。

未来 Office Skill Adapter 可以消费本合同，但必须遵守 Skill 当前设计：

- Skill 不直接另起 LLM loop
- Skill 不绕过 Planner / Policy / Tool / Evidence 合同
- 大文件使用引用，不复制进 Skill State
- Office Runtime 是确定性执行层，不负责用户意图理解和模糊业务判断

目标关系：

```text
Agent / Chat
  -> Skill（业务语义与状态）
    -> Office Runtime Task（确定性任务合同）
      -> Document / Spreadsheet / Presentation Runtime
        -> artifact
```

## Versioning Rules

当前版本：

```text
office-runtime.v1
```

兼容性规则：

1. 新增 operation 或 request variant 可以在 V1 内向后兼容扩展。
2. 已有字段语义不能静默改变。
3. 已有 error code 不应随意改名。
4. 如果输入输出语义发生破坏性变化，升级 contract version。
5. 不为了“统一”把 Word / Excel / PowerPoint 内部模型合并成一个巨大通用 schema。

## Constraints

必须守住：

1. Office SDK 是内部基础设施，不是上层公共合同。
2. 上层调用优先走 `executeOfficeRuntimeTask()`。
3. 调试 UI 和 HTTP route 都不能成为 Office Runtime 的唯一调用入口。
4. 默认非破坏性输出新 artifact。
5. 不新增一排 Agent 可见 Office 原子工具。
6. 不提前实现或伪造 Skill Runtime。
7. 不把 `verification-sample` 夸大成正式通用文档生成合同。
8. PowerPoint Modify 当前不在合同内。

## Code Anchors

- `server/src/microapps/office-suite/contract.ts`
- `server/src/microapps/office-suite/runtime.ts`
- `server/src/microapps/office-suite/index.ts`
- `server/src/microapps/office-suite/create.ts`
- `server/src/microapps/office-suite/document.ts`
- `server/src/microapps/office-suite/spreadsheet.ts`
- `server/src/microapps/office-suite/runtime.test.ts`
- `server/src/routes/microapps/office-suite/index.ts`

## Related Docs

- `office-suite-microapp-design.md`
- `README.md`
- `../skill/skill-runtime-design.md`
- `../skill/README.md`
- `../knowledge-system/DOCUMENTATION_STANDARDS.md`
