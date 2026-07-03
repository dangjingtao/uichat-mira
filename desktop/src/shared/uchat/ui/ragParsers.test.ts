import assert from "node:assert/strict";
import { test } from "vitest";
import { getRagFailurePresentation } from "./ragParsers";

test("getRagFailurePresentation reports the latest RAG error phase", () => {
  const presentation = getRagFailurePresentation(
    [
      {
        nodeId: "rewrite-1",
        nodeType: "rewrite",
        phase: "done",
        label: "Rewrite",
      },
      {
        nodeId: "embed-1",
        nodeType: "embed",
        phase: "error",
        label: "Embed",
        summary: "向量化服务当前不可用",
      },
    ],
    "fetch failed",
  );

  assert.equal(presentation.title, "RAG 在生成语义向量阶段失败");
  assert.equal(presentation.detail, "向量化服务当前不可用");
  assert.equal(presentation.rawErrorMessage, "fetch failed");
});

test("getRagFailurePresentation falls back to raw error when no rag phase is available", () => {
  const presentation = getRagFailurePresentation([], "connection refused");

  assert.equal(presentation.title, "本次回复未成功完成");
  assert.equal(presentation.detail, "connection refused");
  assert.equal(presentation.rawErrorMessage, "connection refused");
});

test("getRagFailurePresentation uses a generic message when no details exist", () => {
  const presentation = getRagFailurePresentation([
    {
      nodeId: "generate-1",
      nodeType: "generate",
      phase: "error",
      label: "Generate",
    },
  ]);

  assert.equal(presentation.title, "RAG 在组织最终回答阶段失败");
  assert.equal(
    presentation.detail,
    "组织最终回答阶段执行失败，请检查对应服务与配置。",
  );
});
