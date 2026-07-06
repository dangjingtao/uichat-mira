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
  assert.equal(getProviderDefinition("ollama").imageAdapter, "none");

  const openAiCapabilities = getProviderCapabilities("openai");
  assert.ok(openAiCapabilities.supportsRoles.includes("imageGeneration"));
  assert.equal(supportsRoleForProvider("openai", "imageGeneration"), true);
  assert.equal(supportsRoleForProvider("cloudflare", "imageGeneration"), false);
});
