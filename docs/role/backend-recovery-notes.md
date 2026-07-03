# Role / Summary Backend Recovery Notes

Status: Current
Owner: role
Last verified: 2026-06-26
Layer: raw-source
Module: Role
Feature: Recovery
Doc Type: implementation-notes

本文件记录当前后端对 `Role` 与线程 `contextSummary` 的正确接入边界，避免后续回退时再次把“可见消息”和“请求态上下文”混在一起。
