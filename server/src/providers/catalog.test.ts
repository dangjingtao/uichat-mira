import assert from "node:assert/strict";
import { test } from "vitest";
import {
  getProviderCapabilities,
  getProviderDefinition,
  supportsRoleForProvider,
} from "./catalog.js";

test("rerank support is declared independently from chat compatibility", () => {
  assert.equal(getProviderDefinition("volcengine").rerankAdapter, "openai-compatible");
  assert.equal(getProviderDefinition("openai").chatAdapter, "openai-compatible");
  assert.equal(getProviderDefinition("openai").rerankAdapter, "none");
  assert.equal(getProviderDefinition("cloudflare").chatAdapter, "openai-compatible");
  assert.equal(getProviderDefinition("cloudflare").rerankAdapter, "none");
});

test("image-generation capability is declared independently from chat compatibility", () => {
  assert.equal(getProviderDefinition("openai").imageAdapter, "openai-images");
  assert.equal(getProviderDefinition("volcengine").imageAdapter, "openai-images");
  assert.equal(getProviderDefinition("ollama").imageAdapter, "none");

  const openAiCapabilities = getProviderCapabilities("openai");
  assert.ok(openAiCapabilities.supportsRoles.includes("imageGeneration"));
  assert.equal(supportsRoleForProvider("openai", "imageGeneration"), true);
  assert.equal(supportsRoleForProvider("volcengine", "imageGeneration"), true);
  assert.equal(supportsRoleForProvider("cloudflare", "imageGeneration"), false);
});

test("Volcengine Plan templates expose separate services under one provider", () => {
  assert.equal(
    getProviderDefinition("volcengine-code-plan").displayName,
    "火山引擎 Code Plan",
  );
  assert.equal(
    getProviderDefinition("volcengine-agent-plan").displayName,
    "火山引擎 Agent Plan",
  );
  assert.equal(
    getProviderDefinition("volcengine-code-plan").embeddingAdapter,
    "none",
  );
  assert.equal(
    getProviderDefinition("volcengine-agent-plan").embeddingAdapter,
    "none",
  );
  assert.equal(supportsRoleForProvider("volcengine-code-plan", "task"), true);
  assert.equal(
    supportsRoleForProvider("volcengine-agent-plan", "agentTask"),
    true,
  );
  assert.equal(
    supportsRoleForProvider("volcengine-code-plan", "embedding"),
    false,
  );
});
