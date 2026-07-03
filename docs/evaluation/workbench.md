# 评测工作台与评测中心

Status: Current
Owner: evaluation
Last verified: 2026-06-26
Layer: raw-source
Module: Develoments
Feature: EvaluationWorkbench
Doc Type: current-contract

评测工作台与评测中心技术文档，覆盖当前实现、页面职责、调用链路、接口契约、持久化结构、联调结论与已知限制。

## 概览

当前评测能力已经形成两条相互配合的主链路：

1. 评测工作台 `Workbench`
   负责生成评测包、上传评测包、预检数据集、创建评测任务、查看运行中日志和本次结果快照。
2. 评测中心 `Center`
   负责读取历史 run、搜索记录、查看详情抽屉、导出 Markdown 报告、删除已完成或失败记录。
