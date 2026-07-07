import assert from "node:assert/strict";
import { test } from "vitest";
import { normalizeOpenAICompatibleBaseUrl } from "./openai-compatible-provider.js";

test("normalizeOpenAICompatibleBaseUrl keeps google openai-compatible endpoint unchanged", () => {
  assert.equal(
    normalizeOpenAICompatibleBaseUrl(
      "https://generativelanguage.googleapis.com/v1beta/openai",
    ),
    "https://generativelanguage.googleapis.com/v1beta/openai",
  );
});

test("normalizeOpenAICompatibleBaseUrl upgrades google bare base url to openai-compatible endpoint", () => {
  assert.equal(
    normalizeOpenAICompatibleBaseUrl(
      "https://generativelanguage.googleapis.com",
    ),
    "https://generativelanguage.googleapis.com/v1beta/openai",
  );
});

test("normalizeOpenAICompatibleBaseUrl upgrades google v1beta base url to openai-compatible endpoint", () => {
  assert.equal(
    normalizeOpenAICompatibleBaseUrl(
      "https://generativelanguage.googleapis.com/v1beta",
    ),
    "https://generativelanguage.googleapis.com/v1beta/openai",
  );
});
