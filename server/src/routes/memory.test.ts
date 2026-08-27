import assert from "node:assert/strict";
import { beforeEach, test, vi } from "vitest";
import Fastify from "fastify";
import memoryRoute from "./memory.js";
import { sendRouteError } from "@/utils/route-errors.js";

const service = vi.hoisted(() => ({
  getOverview: vi.fn(),
  setEnabled: vi.fn(),
  createManual: vi.fn(),
  updateManual: vi.fn(),
  deleteManual: vi.fn(),
}));

vi.mock("@/memory/runtime.js", () => ({ memoryService: service }));
vi.mock("@/db/auth.db.js", () => ({
  requireAuth: async (request: { authUser?: { id: number } }) => {
    request.authUser = { id: 7 };
  },
}));

const overview = {
  enabled: true,
  records: [
    {
      id: "mem-1",
      kind: "preference",
      content: "技术讨论先给结论。",
      origin: "manual",
      createdAt: "2026-08-01T00:00:00.000Z",
      updatedAt: "2026-08-01T00:00:00.000Z",
    },
  ],
};

beforeEach(() => {
  vi.clearAllMocks();
  service.getOverview.mockResolvedValue(overview);
  service.setEnabled.mockResolvedValue({ ...overview, enabled: false });
  service.createManual.mockResolvedValue(overview);
  service.updateManual.mockResolvedValue(overview);
  service.deleteManual.mockResolvedValue({ ...overview, records: [] });
});

test("memory routes expose overview, settings and manual CRUD", async () => {
  const app = Fastify();
  app.setErrorHandler(sendRouteError);
  await app.register(memoryRoute);

  const getResponse = await app.inject({ method: "GET", url: "/memory" });
  assert.equal(getResponse.statusCode, 200, getResponse.body);
  assert.equal(getResponse.json().data.records[0].id, "mem-1");
  assert.equal(service.getOverview.mock.calls[0]?.[0], 7);

  const settingsResponse = await app.inject({
    method: "PUT",
    url: "/memory/settings",
    payload: { enabled: false },
  });
  assert.equal(settingsResponse.statusCode, 200, settingsResponse.body);
  assert.deepEqual(service.setEnabled.mock.calls[0], [7, false]);

  const createResponse = await app.inject({
    method: "POST",
    url: "/memory",
    payload: {
      kind: "preference",
      content: "技术讨论先给结论。",
    },
  });
  assert.equal(createResponse.statusCode, 200, createResponse.body);
  assert.deepEqual(service.createManual.mock.calls[0], [
    7,
    { kind: "preference", content: "技术讨论先给结论。" },
  ]);

  const updateResponse = await app.inject({
    method: "PATCH",
    url: "/memory/mem-1",
    payload: {
      kind: "constraint",
      content: "必须先给结论，再展开理由。",
    },
  });
  assert.equal(updateResponse.statusCode, 200, updateResponse.body);
  assert.deepEqual(service.updateManual.mock.calls[0], [
    7,
    "mem-1",
    { kind: "constraint", content: "必须先给结论，再展开理由。" },
  ]);

  const deleteResponse = await app.inject({
    method: "DELETE",
    url: "/memory/mem-1",
  });
  assert.equal(deleteResponse.statusCode, 200, deleteResponse.body);
  assert.deepEqual(service.deleteManual.mock.calls[0], [7, "mem-1"]);

  await app.close();
});

test("memory routes return not found for a missing record", async () => {
  service.updateManual.mockResolvedValueOnce(null);
  const app = Fastify();
  app.setErrorHandler(sendRouteError);
  await app.register(memoryRoute);

  const response = await app.inject({
    method: "PATCH",
    url: "/memory/missing",
    payload: {
      kind: "fact",
      content: "不存在的记忆。",
    },
  });

  assert.equal(response.statusCode, 404, response.body);
  await app.close();
});
