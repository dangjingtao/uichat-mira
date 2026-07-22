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
- Word / Excel 当前有哪些已实现的 Modify request
- Runtime 返回什么稳定结果
- 文件 bytes、artifact ref 和结果 artifact 的边界
- 未来 Skill 应该如何消费这层能力

它不定义：

- Skill Runtime 本身
- Skill 选择、Planner 或 Agent Graph 行为
- Agent 可见的 Office 原子工具
- 完整 Word / Excel / PowerPoint SDK
- 任意复杂 Office 文件的无损编辑承诺

## Current Contract

唯一任务执行入口：

```ts
executeOfficeRuntimeTask(task: OfficeRuntimeTask): Promise<OfficeRuntimeTaskResult>
```

合同版本：

```text
office-runtime.v1
```

顶级 operation 只有：

```text
inspect
create
modify
```

调用方不应该绕过任务执行器，把 `docx`、`exceljs`、`xlsx`、`pptxgenjs` 或 OOXML patch 直接作为上层公共合同。

原则：

> 上层描述 Office 任务，Runtime 决定由哪个内部领域模块和实现完成。

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
- V1 当前只公开 `verification-sample` 创建模式
- 这不等于已经定义通用 Word / Excel / PPT 内容生成 schema

正式 Create 应继续扩展高层 request union，而不是把底层 SDK 参数直接透传给 Skill。

## Modify: Word

Word 当前有两个 request variant。

### `append-paragraphs`

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
- 向正文尾部追加段落
- 写入时保持尾部 `w:sectPr` 的结构位置

### `review`

```ts
{
  operation: 'modify'
  kind: 'word'
  input: OfficeRuntimeFileInput
  request: {
    type: 'review'
    author?: string
    comments?: Array<{
      targetText: string
      text: string
      author?: string
    }>
    insertions?: Array<{
      afterText: string
      text: string
      author?: string
    }>
    deletions?: Array<{
      targetText: string
      author?: string
    }>
  }
}
```

当前实现：

- 添加 Word 原生 comment
- 创建并维护 `word/comments.xml`
- 维护 document → comments relationship 和 `[Content_Types].xml`
- 生成 `w:commentRangeStart` / `w:commentRangeEnd` / `w:commentReference`
- 生成 `w:ins` 修订插入
- 生成 `w:del` + `w:delText` 修订删除
- 在有修订任务时启用文档 Track Changes 标记
- 默认输出新 DOCX artifact，不覆盖原文件

当前 Review 的定位合同是 **精确可见文本锚点**。

为避免破坏复杂原文档，当前实现只改写可以安全确认的简单文本 run：

- 目标文本必须能在单一简单 `w:r` / `w:t` 中定位
- 如果目标处包含复杂 run 子节点或无法唯一安全改写，Runtime 失败而不是做有损重写
- 当前没有承诺跨多个 run 的模糊文本定位
- 当前没有进入合同的能力包括 comment reply / resolved、接受/拒绝既有修订、任意复杂结构编辑

这是一条保守边界：

> 宁可明确失败，也不为了“编辑成功”静默破坏原 DOCX 结构。

## Modify: Excel

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

## PowerPoint Modify

当前 **不在合同内**。

PowerPoint 当前只覆盖：

- Inspect
- Create `verification-sample`

不要因为 PptxGenJS 能生成 PPTX，就把任意既有 PPTX 修改声明成已支持。

## File Input Boundary

`OfficeRuntimeFileInput`：

```text
fileName
mimeType?
buffer
artifactRef?
```

规则：

1. Office Runtime 当前不负责解析外部 artifact store。
2. `buffer` 必须在进入 Runtime 前已经解析完成。
3. `artifactRef` 用于保留上游产物身份和 trace 关联，不代替 `buffer`。
4. 未来 Skill Adapter 应先通过现有文件 / artifact 基础设施解析 bytes，再调用 Office Runtime。
5. 不要把大文件 bytes 长期复制进 Skill State、聊天历史或 Evidence。

目标链路：

```text
Skill / Consumer
  -> resolve artifactRef / file input
  -> OfficeRuntimeTask with resolved bytes
  -> executeOfficeRuntimeTask
  -> persist output artifact
  -> keep artifact ref in upper-layer state/evidence
```

## Result Contract

`OfficeRuntimeTaskResult` 只有：

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

失败结果：

```ts
error: {
  code: string
  message: string
}
```

稳定错误码：

```text
UNSUPPORTED_FILE_TYPE
INVALID_TASK_INPUT
EXECUTION_FAILED
```

原则：

> 可预期失败返回稳定 failed result，不把底层库异常形态直接暴露给未来 Skill。

## Artifact Contract

Runtime 内部 artifact：

```text
kind
fileName
mimeType
byteSize
buffer
```

`buffer` 是 Server 内部执行结果，当前 HTTP 调试适配器可以直接下载。

未来 Skill 不应把完整 `buffer` 写进 Skill State：

```text
Office Runtime output buffer
  -> artifact/file infrastructure persists it
  -> returns artifactRef
  -> Skill State / Evidence only keeps ref + 必要摘要
```

Runtime 当前不伪造尚不存在的 artifact path 或 artifactRef。

## Current Consumers

### HTTP / 桌面调试适配层

`/microapps/office-suite/*` 路由只负责：

- multipart / JSON / query 输入解析
- 文件大小和扩展名边界校验
- 构造 `OfficeRuntimeTask`
- 调用 `executeOfficeRuntimeTask`
- 把结果转换为 JSON 或下载响应

路由不实现 Word / Excel / PowerPoint 业务逻辑。

当前 Word Review 调试路由：

```text
POST /microapps/office-suite/document/review-copy
```

上传 `.docx`，query 可组合：

```text
author
commentTarget + commentText
insertAfter + insertText
deleteTarget
```

至少提供一项 review action。

该路由是调试适配器，不是 Agent 工具合同。

### Future Skill

Skill Runtime 仍是独立模块，Office Runtime 不依赖 Skill 才能运行。

未来 Office Skill Adapter 消费本合同时必须遵守：

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
4. 输入输出语义发生破坏性变化时升级 contract version。
5. 不为了“统一”把 Word / Excel / PowerPoint 内部模型合并成巨大通用 schema。

## Constraints

必须守住：

1. Office SDK / OOXML 实现是内部基础设施，不是上层公共合同。
2. 上层调用优先走 `executeOfficeRuntimeTask()`。
3. 调试 UI 和 HTTP route 不能成为 Office Runtime 的唯一调用入口。
4. 默认非破坏性输出新 artifact。
5. 不新增一排 Agent 可见 Office 原子工具。
6. 不提前实现或伪造 Skill Runtime。
7. 不把 `verification-sample` 夸大成正式通用文档生成合同。
8. 不把当前保守的 Word Review 文本锚点能力夸大成任意 DOCX 无损编辑。
9. PowerPoint Modify 当前不在合同内。

## Code Anchors

- `server/src/microapps/office-suite/contract.ts`
- `server/src/microapps/office-suite/runtime.ts`
- `server/src/microapps/office-suite/index.ts`
- `server/src/microapps/office-suite/create.ts`
- `server/src/microapps/office-suite/document.ts`
- `server/src/microapps/office-suite/document-review.ts`
- `server/src/microapps/office-suite/spreadsheet.ts`
- `server/src/microapps/office-suite/runtime.test.ts`
- `server/src/routes/microapps/office-suite/index.ts`

## Related Docs

- `office-suite-microapp-design.md`
- `README.md`
- `../skill/skill-runtime-design.md`
- `../skill/README.md`
- `../knowledge-system/DOCUMENTATION_STANDARDS.md`
