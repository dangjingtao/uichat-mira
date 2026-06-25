# 可视化与 AI 接入

Status: Current
Owner: docs
Last verified: 2026-06-25
Layer: wiki
Module: docs-system
Doc Type: overview

## 单点真相范围

这页说明这套 markdown 知识库如何同时服务三类事情：

- 人怎么更舒服地读
- Codex 之外的 AI 工具怎么接进来
- 什么时候值得上图谱或图形化视图

## 适合什么时候读

这些场景建议先读这页：

- 想把 `docs/` 接给别的 AI 客户端
- 想知道 Obsidian、Logseq、MCP、知识图谱各自适合干嘛
- 想判断“纯 markdown 是否已经够用”
- 想做可视化，但不想为了工具反过来重写文档结构

## 当前事实

- 当前源材料就是普通 markdown + 目录层级
- 这套系统不要求改写现有 authoring 模式
- 最低摩擦路径仍然是：markdown 作为唯一真相，在外面叠阅读器与接入层

## 人类阅读与可视化

### Obsidian

最适合：

- markdown 阅读
- backlinks 导航
- local graph 浏览
- vault 风格的轻量知识库体验

对本项目的适配：

- 直接打开 `docs/`
- 围绕 `uchat`、`role`、`architecture` 之类主题看局部图
- 保持 plain markdown 写作，不引入额外锁定

### Logseq

最适合：

- 更强的 graph-first 体验
- block-level linking
- 偏概念卡片式浏览

对本项目的适配：

- 如果团队更喜欢“概念节点 + 双链回看”的阅读方式，会比纯文件树更有感觉
- 但维护习惯也会更偏 note-driven

## AI 接入方式

### 直接读文件系统

最适合：

- 本地 agent
- IDE assistant
- 小型脚本化处理

接法：

- 给工具读 `docs/`
- 默认只开 read access
- 如有需要，默认排除 `archive/`

优点：

- 零迁移
- 成本最低
- 最容易和原始文件核对

### MCP Resource Layer

最适合：

- 多个 AI 客户端共用一套访问方式
- 想控制哪些文档默认暴露、哪些只按需暴露
- 未来想在不改 markdown 的前提下补更强 resource 视图

接法：

- markdown 继续作为源材料
- 通过 MCP server 暴露成 resources
- 按 area 或主题再做聚合 resource

优点：

- AI 侧接口更标准
- 过滤、限流、按 area 暴露更自然
- 后续可以加 richer resource view，而不用重写文档

## 图形化方式

### 笔记图

当目标是：

- 看链接邻域
- 浏览相关笔记
- 直觉式找概念群

优先用：

- `Obsidian`
- `Logseq`

### 真正的知识图谱

当目标变成：

- 查询实体与关系
- 横跨大量文档做结构化链接分析
- 把文档知识做成可查询 graph

才考虑：

- `Neo4j Bloom`
- 其他 graph database UI

代价也更高：

- 要做 markdown -> graph 的抽取
- 要维护关系模型
- 要接受更重的维护成本

## 推荐路径

最推荐的推进顺序仍然是：

1. 先用 `Obsidian` 解决“人怎么舒服地读”
2. 保持 markdown 作为唯一真相
3. 如果有多 AI 客户端接入需求，再加 MCP resource layer
4. 只有当 note-link 可视化已经不够用时，才上 graph database

## 约束

- `archive/` 不应作为 AI 默认输入
- 可视化工具应读取 markdown，而不是逼文档反向迁移格式
- 站点层、MCP 层、Obsidian 层最好共用同一份 `docs/`

## 相关文档

- `README.md`
- `VAULT_HOME.md`
- `DOCUMENTATION_STANDARDS.md`
- `OBSIDIAN_QUICKSTART.md`
- `architecture/README.md`
