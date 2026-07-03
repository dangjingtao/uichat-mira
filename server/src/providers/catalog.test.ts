import assert from "node:assert/strict";
import { test } from "vitest";
import { getProviderDefinition } from "./catalog.js";

test("rerank support is declared independently from chat compatibility", () => {
  assert.equal(getProviderDefinition("volcengine").rerankAdapter, "openai-compatible");
  assert.equal(getProviderDefinition("openai").chatAdapter, "openai-compatible");
  assert.equal(getProviderDefinition("openai").rerankAdapter, "none");
  assert.equal(getProviderDefinition("cloudflare").chatAdapter, "openai-compatible");
  assert.equal(getProviderDefinition("cloudflare").rerankAdapter, "none");
});
