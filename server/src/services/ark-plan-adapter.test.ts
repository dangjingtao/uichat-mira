import assert from "node:assert/strict";
import { test } from "vitest";
import {
  createArkPlanAdapter,
  resolveArkPlanModelsUrl,
  resolveArkPlanBaseUrl,
} from "./ark-plan-adapter.js";

const createJsonResponse = (body: unknown, init: ResponseInit = {}) =>
  new Response(JSON.stringify(body), {
    status: 200,
    headers: { "Content-Type": "application/json" },
    ...init,
  });

test("resolves code-plan and agent-plan to independent Ark endpoints", () => {
  const input = "https://ark.cn-beijing.volces.com/api/plan/v3";

  assert.equal(
    resolveArkPlanBaseUrl("code-plan", input),
    "https://ark.cn-beijing.volces.com/api/coding/v3",
  );
  assert.equal(
    resolveArkPlanBaseUrl("agent-plan", input),
    "https://ark.cn-beijing.volces.com/api/plan/v3",
  );
});

test("keeps explicit Ark service paths and removes trailing slashes", () => {
  assert.equal(
    resolveArkPlanBaseUrl(
      "code-plan",
      "https://ark.example.com/api/coding/v3/?region=cn",
    ),
    "https://ark.example.com/api/coding/v3",
  );
});

test("resolves the official Ark model catalog through the coding endpoint", () => {
  assert.equal(
    resolveArkPlanModelsUrl(
      "https://ark.cn-beijing.volces.com/api/plan/v3",
    ),
    "https://ark.cn-beijing.volces.com/api/coding/v3/models",
  );
  assert.equal(
    resolveArkPlanModelsUrl("https://proxy.example.com/api/plan/v3"),
    null,
  );
});

test("lists models through the selected service endpoint", async () => {
  const requests: Array<{ url: string; init?: RequestInit }> = [];
  const adapter = createArkPlanAdapter({
    service: "code-plan",
    baseUrl: "https://ark.cn-beijing.volces.com/api/plan/v3",
    apiKey: "  secret-key  ",
    fetch: async (input, init) => {
      requests.push({ url: String(input), init });
      return createJsonResponse({
        data: [
          { id: "code-model", name: "Code Model" },
          { id: "agent-model" },
          { name: "invalid-without-id" },
        ],
      });
    },
  });

  const models = await adapter.listModels();

  assert.deepEqual(models.map((model) => [model.id, model.name]), [
    ["code-model", "Code Model"],
    ["agent-model", "agent-model"],
  ]);
  assert.equal(requests[0]?.url, "https://ark.cn-beijing.volces.com/api/coding/v3/models");
  assert.deepEqual(requests[0]?.init?.headers, {
    Authorization: "Bearer secret-key",
  });
});

test("keeps Agent Plan model discovery on the verified coding catalog endpoint", async () => {
  let requestedUrl = "";
  const adapter = createArkPlanAdapter({
    service: "agent-plan",
    baseUrl: "https://ark.cn-beijing.volces.com/api/plan/v3",
    apiKey: "secret-key",
    fetch: async (input) => {
      requestedUrl = String(input);
      return createJsonResponse({ data: [] });
    },
  });

  await adapter.listModels();

  assert.equal(
    adapter.modelsUrl,
    "https://ark.cn-beijing.volces.com/api/coding/v3/models",
  );
  assert.equal(requestedUrl, adapter.modelsUrl);
});

test("posts OpenAI-compatible chat requests without changing the request body", async () => {
  let captured: { url: string; init?: RequestInit } | undefined;
  const adapter = createArkPlanAdapter({
    service: "agent-plan",
    baseUrl: "https://ark.cn-beijing.volces.com/api/plan/v3",
    apiKey: "secret-key",
    fetch: async (input, init) => {
      captured = { url: String(input), init };
      return createJsonResponse({ id: "chatcmpl-test" });
    },
  });

  const request = {
    model: "agent-model",
    messages: [{ role: "user" as const, content: "hello" }],
    stream: true,
    response_format: { type: "json_schema" },
  };
  const response = await adapter.createChatCompletion(request);

  assert.equal(response.ok, true);
  assert.equal(captured?.url, "https://ark.cn-beijing.volces.com/api/plan/v3/chat/completions");
  assert.deepEqual(captured?.init?.headers, {
    Authorization: "Bearer secret-key",
    "Content-Type": "application/json",
  });
  assert.deepEqual(JSON.parse(String(captured?.init?.body)), request);
});

test("rejects invalid base URLs before creating requests", () => {
  assert.throws(
    () =>
      createArkPlanAdapter({
        service: "code-plan",
        baseUrl: "not-a-url",
        apiKey: "secret-key",
      }),
    /base URL is invalid/,
  );
});
