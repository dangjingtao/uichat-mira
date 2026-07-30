# Office Suite 微应用设计

Status: Planned
Owner: microapp / runtime / desktop
Last verified: 2026-07-22
Layer: raw-source
Module: MicroAPP
Feature: OfficeSuite
Doc Type: design
Canonical: false
Related:
  - README.md
  - ../skill/README.md
  - ../architecture/README.md
  - ../knowledge-system/DOCUMENTATION_STANDARDS.md
  - ../knowledge-system/DIRECTORY_AND_CLASSIFICATION_RULES.md

## 单点真相范围

这页只回答一件事：

`Office Suite` 微应用在当前阶段应该做成什么，以及它怎样为未来的 Skill 消费方式预留边界。

它覆盖：

- `office_suite` 作为一个微应用还是三个微应用
- 当前桌面微应用界面的职责
- Word / Excel / PowerPoint 三类 Office Runtime 的内部边界
- 当前依赖底座如何分工
- 为什么当前不把 Office 原子操作注册成一排 Harness capability
- 当前没有独立 Skill Runtime 时，Office 微应用应该如何设计
- 未来通过 Skill 注入 Chat 的目标关系
- V1 范围、成功标准和明确不做的事项

它不覆盖：

- Skill Runtime 的正式实现合同
- Chat 如何加载、发现或执行 Skill
- Agent Graph / Planner 的改造
- 完整 Office 编辑器实现
- Microsoft Office COM 自动化
- LibreOffice 自动化
- VBA / 宏执行
- 云端协作和多人编辑

## 结论先说

Office 三件套当前只做 **一个微应用**：

- `office_suite`

产品和调试入口保持一个，内部实现拆成三个独立领域：

- Word / Document
- Excel / Spreadsheet
- PowerPoint / Presentation

当前阶段，`office_suite` 的桌面界面不是最终用户的 Office 助手，也不是另一套 Chat。

它首先是：

> Office Runtime 的本地调试、验证和结果检查工作台。

当前不做：

- 在微应用里嵌完整 Chat
- 把 Word / Excel / PowerPoint 拆成三个独立微应用入口
- 把 `set_cell`、`add_slide`、`replace_paragraph` 这类原子操作直接暴露成一排 Harness capability
- 提前实现尚不存在的独立 Skill Runtime

未来目标是：

```text
Chat
  -> Skill
    -> Office Runtime
      -> Word / Excel / PowerPoint
        -> file artifact
  -> result returns to Chat
```

这条链路目前只是设计方向，不是当前已实现合同。

当前 `docs/skill/README.md` 已经定义 Skill 概念，但独立 Skill Runtime 尚不存在。因此本设计只要求 Office Runtime 的边界未来可被 Skill 复用，不要求本轮实现 Skill 接线。

## 为什么是一个微应用，不拆三个

Word、Excel、PowerPoint 在实现上差异很大，但在用户任务里经常属于同一个办公任务。

典型任务可能是：

```text
读取销售数据.xlsx
  -> 分析数据
  -> 生成季度总结.docx
  -> 生成管理层汇报.pptx
```

如果当前就拆成三个微应用，会提前制造：

- 三套入口
- 三套文件上下文
- 三套调试界面
- 跨应用传递文件和状态的问题

这些复杂度对当前阶段没有价值。

因此固定原则：

> 产品上一个 Office Suite，工程上三个 Office 模块。

只有未来某一类能力成长为明显独立产品，例如 Presentation Studio 已经拥有独立任务模型、资产系统和工作流时，才单独评估拆分，不在当前 V1 预拆。

## 当前阶段的产品定位

当前 `office_suite` 不是：

- Word 替代品
- Excel 替代品
- PowerPoint 替代品
- AI Office 全功能办公软件
- Chat 的另一个入口

当前它是：

- Office 文件处理能力的调试入口
- Office Runtime 的行为验证界面
- 输入 / 输出文件的检查窗口
- 错误、耗时和结果元数据的观察窗口
- 未来 Skill 接入前的稳定能力实验场

推荐桌面调试入口命名：

- `desktop.office_studio`

它和 `office_suite` 的关系是：

```text
desktop.office_studio
  -> 调试和验证 office_suite

future Skill
  -> 消费同一套 Office Runtime
```

桌面调试入口不是未来唯一消费方，也不应该把 Office Runtime 写死在页面组件里。

## V1 界面

V1 界面保持工具工作台形态，不做办公软件式 Ribbon，也不嵌 Chat。

建议只保留四个区域。

### 1. 文件输入

负责：

- 选择本地 Office 文件
- 显示文件名、类型、大小
- 显示当前识别出的文档类型
- 创建空白测试文件
- 指定输出文件位置或使用默认临时输出目录

支持类型：

- `.docx`
- `.xlsx`
- `.pptx`

V1 不承诺：

- `.doc`
- `.xls`
- `.ppt`
- 带宏的高保真编辑

### 2. 文档结构 / 数据检查

根据文件类型展示不同的结构信息。

Word：

- 段落数量
- 标题层级
- 表格数量
- 图片数量
- 基础文本抽取结果

Excel：

- Sheet 列表
- 当前 Sheet 使用范围
- 行列数据预览
- 公式 / 值基础信息
- 合并单元格等基础结构信息

PowerPoint：

- Slide 列表
- 每页文本摘要
- 基础 shape / image / chart 数量
- 生成任务的页面结构摘要

这里的目标是确认 Runtime 是否正确理解文件，不是做完整 Office 渲染器。

### 3. 操作调试区

V1 不直接把底层 SDK 的每一个函数做成按钮。

调试动作先按任务级别收敛成：

- Inspect：检查文档结构和基础内容
- Create：创建新文档
- Modify：修改现有文档
- Export / Save：生成新的 Office 文件产物

不同文件类型再提供最少必要参数。

例如：

Word：

- 新建标题 / 段落 / 表格
- 替换指定文本
- 添加图片
- 基础样式和页面结构

Excel：

- 读取 / 写入单元格和区域
- 新建 / 修改 Sheet
- 公式
- 样式
- 合并单元格
- 数据验证等常见结构

PowerPoint：

- 新建演示文稿
- 新建 / 删除 / 重排页面
- 添加文本、图片、表格、图表和 shape
- 使用统一主题 / master 生成

这只是调试入口的操作面，不等于未来 Skill 的公开接口。

### 4. 结果与调试信息

每次执行至少显示：

- 执行状态
- 耗时
- 输入文件
- 输出文件
- 操作摘要
- 错误信息
- 可打开或定位的产物路径

默认优先生成新文件，不直接覆盖输入文件。

原因：

- 调试阶段更容易比较结果
- 降低误修改原始文件的风险
- 为未来 Skill 返回 file artifact 保留一致语义

## 当前 Office Runtime 分层

内部建议保持三个模块边界。

```text
Office Suite
  -> Document Runtime
  -> Spreadsheet Runtime
  -> Presentation Runtime
```

它们共享的只是：

- 文件输入输出契约
- 任务结果结构
- 错误结构
- artifact 元数据
- 必要的 OOXML 基础设施

不要为了“统一”强行把三种文档抽成一个巨大通用 Document API。

三者的数据模型不同：

- Word 以文档流、段落、section、表格为主
- Excel 以 workbook、sheet、cell、range、formula 为主
- PowerPoint 以 presentation、slide、shape、layout、master 为主

统一过度会让 Runtime 变弱，而不是更简单。

## 当前依赖底座

`dev` 当前已经声明下面这些 Office 相关依赖。

### Word

- `docx`
  - 用于创建和结构化修改 `.docx`
  - 作为 Word 主执行库

### Excel

- `xlsx`
  - 偏读取、数据提取、工作簿兼容和基础写入
- `exceljs`
  - 偏工作簿编辑、样式、行列、合并、数据验证等更细粒度写入

两者当前允许并存。

分工原则：

> `xlsx` 更偏“读和理解数据”，`exceljs` 更偏“把工作簿编辑好并写回”。

不要在 V1 先强行统一成一个库。

### PowerPoint

- `pptxgenjs`
  - 作为 PowerPoint 创建和生成的主库

V1 对复杂既有 PPT 的无损编辑能力保持保守，不把“能生成”误写成“能无损修改所有 PowerPoint 文件”。

### 通用基础设施

- `adm-zip`
  - 用于必要时检查或修改 OOXML ZIP 包内部结构
- `sharp`
  - 用于图片处理、尺寸转换和资源准备
- `jsdom`
  - 用于 DOM / HTML 结构处理
- `turndown`
  - 用于必要的 HTML -> Markdown 内容转换

OOXML 直接处理是 escape hatch，不是默认主路径。

优先顺序：

```text
成熟专用库
  -> 必要的 OOXML patch
  -> 更重的外部 Office Runtime（未来单独评估）
```

## 开源和安装约束

Office 微应用属于开源项目主线，因此依赖选择遵守：

- 优先标准 npm / pnpm 可直接安装的开源依赖
- 用户 clone 仓库后应能通过正常 `pnpm install` 获取依赖
- 不把手工下载 CDN tarball 作为默认安装步骤
- 不把某台开发机上的 Microsoft Office 安装状态当成基础前提
- 不在 V1 强制依赖 LibreOffice
- 外部二进制 Runtime 如果未来引入，必须单独定义版本、来源、打包和许可边界

## 为什么不直接暴露一排 Harness capability

Office 的底层操作数量天然非常多。

如果直接暴露：

- `set_cell`
- `merge_cells`
- `add_paragraph`
- `replace_text`
- `add_slide`
- `add_shape`
- `set_theme`
- ...

会迅速形成 tool explosion。

当前设计不要求把这些原子操作注册到 Agent / Planner 可见工具面。

原则：

> Office SDK 是内部执行基础设施，不等于 Agent 公共工具面。

未来 Skill 如何消费 Office Runtime，由 Skill Runtime 的正式设计决定。

当前只要求：

- Office Runtime 不和调试 UI 写死
- 核心操作可以被代码层复用
- 输入输出结构稳定到足以被未来 Skill 包装

## 和 Skill 的关系

这里必须区分“已经定义的概念”和“已经存在的运行时”。

当前事实：

- 项目已经有 Skill 概念和文档定义
- 项目目前没有独立、完整的 Skill Runtime
- Office Suite 当前不能依赖一个尚不存在的 Skill Runtime 才能工作

设计方向：

- Office Runtime 的最终主要消费方式预计是 Skill
- Skill 再进入 Chat 的工作上下文
- 普通用户最终主要在 Chat 中提出办公任务
- `desktop.office_studio` 继续保留为开发、调试、验证入口，而不是主要产品入口

因此当前阶段不要做两件事：

1. 不要为了 Office 提前造一套临时 Skill Runtime
2. 不要因为 Skill 还没落地，就把 Office Runtime 锁死成只能由微应用页面调用

## 未来目标链路

目标链路可以表达为：

```text
User
  -> Mira Chat
    -> Skill（未来正式运行时）
      -> Office Runtime
        -> Document / Spreadsheet / Presentation
          -> artifact
    -> Chat 展示结果和继续交互
```

典型任务：

```text
“分析这个 Excel，生成季度经营报告和汇报 PPT。”
```

未来可能执行：

```text
Spreadsheet Runtime
  -> 数据读取 / 分析输入
  -> Skill 组织任务语义
  -> Document Runtime 生成报告
  -> Presentation Runtime 生成汇报
  -> artifacts 返回 Chat
```

本设计不规定 Skill 内部如何编排，也不规定 Planner 是否直接参与这些步骤。

## 文件处理原则

### 1. 默认非破坏性

修改已有 Office 文件时：

- 默认输出新文件
- 明确用户要求后才考虑覆盖
- 结果必须返回实际 artifact 路径

### 2. 不承诺无损编辑所有 Office 特性

V1 明确不承诺完整保留：

- VBA / Macro
- 复杂 SmartArt
- 全部动画和切换效果
- 所有第三方插件对象
- 特殊嵌入对象
- 极复杂 Pivot / external link
- Office 私有扩展

遇到无法安全修改的结构，应明确返回限制或失败，不静默破坏文件。

### 3. 读和写可以使用不同实现

不要为了“一个文件只能由一个库处理”制造限制。

例如 Excel 可以：

- 使用 `xlsx` 做快速读取和数据抽取
- 使用 `exceljs` 做更细的编辑和样式写回

只要最终行为和 artifact 可验证即可。

## V1 Scope

### In scope

- 一个 `office_suite` 微应用定义
- 一个桌面调试工作台 `desktop.office_studio`
- `.docx` 基础读取 / 创建 / 修改 / 保存验证
- `.xlsx` 基础读取 / 创建 / 修改 / 样式 / 保存验证
- `.pptx` 基础创建 / 生成 / 保存验证
- 基础文件结构检查
- 输入和输出 artifact 展示
- 操作摘要、耗时和错误展示
- 三类 Runtime 的内部模块边界

### Out of scope

- 微应用内 Chat
- Skill Runtime 实现
- Chat -> Skill -> Office 正式接线
- Agent Graph 改造
- 一排 Office Harness tools
- 完整 Office 编辑器
- Word / Excel / PowerPoint 三个独立微应用
- Microsoft Office COM
- LibreOffice Runtime
- VBA / Macro 执行
- 云文档和多人协作
- 100% Office 视觉保真预览
- 对所有复杂既有 PPT 的无损编辑

## V1 Success Criteria

当下面条件都成立时，第一阶段可以认为 Office Runtime 已经具备继续向 Skill 方向演进的基础：

1. 桌面端存在一个统一 Office Studio 调试入口
2. `.docx` 可以完成至少一条“创建 -> 保存 -> 再读取验证”的闭环
3. `.docx` 可以完成至少一条“读取现有文件 -> 修改 -> 输出新文件”的闭环
4. `.xlsx` 可以完成读取多个 Sheet、修改单元格 / 公式 / 基础样式并输出新文件
5. `.pptx` 可以完成多页演示文稿生成，包含文本、图片和至少一种结构化元素
6. 所有操作都能返回明确的成功 / 失败结果和 artifact 路径
7. 原始文件默认不被覆盖
8. Office 核心执行逻辑不写死在 renderer 页面组件里
9. 不为完成 V1 新增一排 Agent 可见 Office 原子工具
10. 依赖安装保持标准 pnpm / npm 开源项目路径

## 推荐实现顺序

第一刀：

- 建立 `office_suite` 微应用和 `desktop.office_studio` 调试入口
- 建立统一 artifact / operation result 结构
- 不先做复杂预览

第二刀：

- 打通 Excel
- 原因：当前 `xlsx + exceljs` 的读取和编辑闭环最容易完整验证

第三刀：

- 打通 Word 创建和修改

第四刀：

- 打通 PowerPoint 创建和生成

第五刀：

- 补三类文件的结构检查、错误可视化和回归样例

Skill 接线不属于这五刀。

## 设计约束

后续实现需要守住：

1. 一个 Office Suite 微应用，不预拆三个产品入口
2. 内部 Word / Excel / PowerPoint 模块独立，不做巨大统一文档模型
3. 微应用界面是当前调试入口，不嵌完整 Chat
4. Office Runtime 不写死在微应用 UI 内
5. 当前不新增 Office 原子 Harness capability
6. Skill Runtime 尚未存在，不提前伪造实现状态
7. 未来优先允许 Skill 复用 Office Runtime，并由 Skill 进入 Chat
8. 默认非破坏性输出新 artifact
9. 不把“能生成”夸大为“能无损编辑所有 Office 文件”
10. 开源依赖必须优先保持标准安装路径

## Code Anchors

当前可核对：

- `server/package.json`
- `server/src/microapps/`
- `docs/microapp/README.md`
- `docs/skill/README.md`

后续实现后应补充：

- Office Runtime 实际目录
- Office Studio renderer 页面
- backend route / service
- artifact contract
- 对应测试文件

## Related Docs

- `README.md`
- `../skill/README.md`
- `../architecture/README.md`
- `../knowledge-system/DOCUMENTATION_STANDARDS.md`
- `../knowledge-system/DIRECTORY_AND_CLASSIFICATION_RULES.md`
