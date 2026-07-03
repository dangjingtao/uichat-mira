# Changelog

## 0.7.1 - 2026-06-20

- 新增共享确认弹窗 `ConfirmDialog`，支持默认、警告、危险三种语气与加载态、错误反馈。
- `Modal` 升级为命令式 API（`Modal.show` / `Modal.confirm` / `Modal.close` / `Modal.destroy`），支持多弹窗堆叠、ESC 关闭、遮罩点击关闭与 body 滚动锁定。
- 知识库页面接入新的弹窗能力：新增 `KnowledgeBaseEditorForm`，新建/编辑知识库统一为弹窗表单；文档重建索引、删除、批量删除及知识库删除均接入二次确认。
- 评测中心页面单条/批量删除评测记录接入 `Modal.confirm` 二次确认。
- 更新 `COMPONENTS.md` 与 `ui-design-guidelines-tailwind.md`，补充 `Modal` 与 `ConfirmDialog` 的使用约定。

## 0.6.0 - 2026-06-19

- 重构聊天界面与线程体验，补充欢迎态、消息展示壳层和执行轨迹相关能力。
- 增加附件处理、RAG 来源展示与多 Provider 配置链路，覆盖前后端接口与服务实现。
- 更新品牌资源、设置页与文档索引，统一本次发布的产品说明与视觉素材。
