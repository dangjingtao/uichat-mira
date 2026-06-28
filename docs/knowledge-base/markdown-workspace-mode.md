# Markdown 工作空间能力评估

Status: Current
Owner: knowledge-base
Last verified: 2026-06-26
Layer: raw-source
Module: KnowledgeBase
Feature: MarkdownWorkspace
Doc Type: design

面向当前产品形态，对“允许用户定义工作空间文件夹，并在 Markdown 文档集合上执行轻量检索、读取、分类识别、重建整理、验证”的能力做产品判断、边界定义与 MVP 收敛。

## 结论

这个能力值得做，但前提是把它定义为一个轻量文档工作模式，而不是第二套 RAG 系统。

## 建议的产品定义

建议把这项能力正式定义为：

- 以一组 Markdown 文件为工作对象
- 提供读取、重建、分类辅助和验证能力
- 不要求用户先把内容入库成知识库
