# 知识库 API

Status: Current
Owner: knowledge-base
Last verified: 2026-06-25
Layer: raw-source
Module: knowledge-base
Doc Type: reference

## 单点真相范围

这页文档统一说明：

- knowledge-base HTTP 接口分组
- Swagger 标签边界
- Settings 页面里 knowledge base 选择状态的归属规则

相关概念：

- [[CONCEPT_KNOWLEDGE_BASE]]
- [[CONCEPT_RUNTIME]]
- [[AREA_MAP_KNOWLEDGE_BASE]]

## Swagger 分组方式

当前知识库接口拆成三组 Swagger：

- `Knowledge Base - Collections`
- `Knowledge Base - Documents`
- `Knowledge Base - Upload & Preview`

这样拆是为了和当前 UI 责任划分对齐：

- Settings 里的知识库集合管理
- 文档级查看与 CRUD
- 上传流程与 chunk 预览

## 接口列表

### Collections

- `GET /knowledge-bases`
- `GET /knowledge-bases/:knowledgeBaseId`
- `POST /knowledge-bases`
- `PATCH /knowledge-bases/:knowledgeBaseId`
- `DELETE /knowledge-bases/:knowledgeBaseId`

### Documents

- `GET /knowledge-base/documents`
- `GET /knowledge-bases/:knowledgeBaseId/documents`
- `GET /knowledge-base/documents/:id/status`

### Upload & Preview

- 上传、切分预览、导入确认相关接口归到这一组

## 相关文档

- `knowledge-base-backend-schema.md`
- `markdown-workspace-mode.md`
