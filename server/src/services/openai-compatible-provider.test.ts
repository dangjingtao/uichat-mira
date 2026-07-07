import assert from "node:assert/strict";
import { test } from "vitest";
import {
  buildSocks5ProxyUrl,
  createOpenAICompatibleModelsUrl,
  normalizeOpenAICompatibleBaseUrl,
} from "./openai-compatible-provider.js";

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

test("normalizeOpenAICompatibleBaseUrl keeps volcengine agent plan v3 endpoint unchanged", () => {
  assert.equal(
    normalizeOpenAICompatibleBaseUrl(
      "https://ark.cn-beijing.volces.com/api/plan/v3",
    ),
    "https://ark.cn-beijing.volces.com/api/plan/v3",
  );
});

test("createOpenAICompatibleModelsUrl routes volcengine agent plan model listing through coding endpoint", () => {
  assert.equal(
    createOpenAICompatibleModelsUrl(
      "https://ark.cn-beijing.volces.com/api/plan/v3",
    ),
    "https://ark.cn-beijing.volces.com/api/coding/v3/models",
  );
});

test("buildSocks5ProxyUrl returns null when host or port is missing", () => {
  assert.equal(
    buildSocks5ProxyUrl({
      socks5Host: "",
      socks5Port: 1080,
      socks5Username: "",
      socks5Password: "",
    }),
    null,
  );
  assert.equal(
    buildSocks5ProxyUrl({
      socks5Host: "127.0.0.1",
      socks5Port: 0,
      socks5Username: "",
      socks5Password: "",
    }),
    null,
  );
});

test("buildSocks5ProxyUrl includes credentials when configured", () => {
  assert.equal(
    buildSocks5ProxyUrl({
      socks5Host: "127.0.0.1",
      socks5Port: 1080,
      socks5Username: "demo",
      socks5Password: "secret",
    }),
    "socks5://demo:secret@127.0.0.1:1080",
  );
});
