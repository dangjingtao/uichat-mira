import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const resolveConfig = vi.hoisted(() => vi.fn());
vi.mock("./config.js", () => ({ resolveWecomConfig: resolveConfig }));

import {
  getWecomAppAccessToken,
  getWecomUserByUserId,
  listWecomDepartments,
  sendWecomTextMessageToUser,
} from "./client.js";

describe("WeCom API client", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resolveConfig.mockReturnValue({
      corpId: "corp id",
      appSecret: "secret/value",
      agentId: "1001",
    });
  });

  afterEach(() => vi.restoreAllMocks());

  it("fails before network access when app configuration is incomplete", async () => {
    resolveConfig.mockReturnValue({ corpId: "", appSecret: "", agentId: "" });
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    await expect(getWecomAppAccessToken()).rejects.toThrow("config is incomplete");
    await expect(sendWecomTextMessageToUser({ userId: "u1", content: "hello" }))
      .rejects.toThrow("config is incomplete");
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("encodes credentials, sends the expected payload, and never places content in the URL", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch")
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ errcode: 0, access_token: "token/value" }),
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ errcode: 0, errmsg: "ok" }),
      } as Response);

    await sendWecomTextMessageToUser({ userId: "user/1", content: "private message" });

    expect(String(fetchSpy.mock.calls[0]?.[0])).toContain("corpid=corp%20id");
    expect(String(fetchSpy.mock.calls[0]?.[0])).toContain("corpsecret=secret%2Fvalue");
    expect(String(fetchSpy.mock.calls[1]?.[0])).toContain("access_token=token%2Fvalue");
    expect(String(fetchSpy.mock.calls[1]?.[0])).not.toContain("private");
    expect(JSON.parse(String(fetchSpy.mock.calls[1]?.[1]?.body))).toEqual({
      touser: "user/1",
      msgtype: "text",
      agentid: 1001,
      text: { content: "private message" },
      safe: 0,
    });
  });

  it("maps HTTP and WeCom application errors and validates token presence", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    fetchSpy.mockResolvedValueOnce({ ok: false, status: 502 } as Response);
    await expect(getWecomAppAccessToken()).rejects.toThrow("gettoken failed: 502");

    fetchSpy.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ errcode: 40013, errmsg: "invalid corpid" }),
    } as Response);
    await expect(getWecomAppAccessToken()).rejects.toThrow("40013 invalid corpid");

    fetchSpy.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ errcode: 0 }),
    } as Response);
    await expect(getWecomAppAccessToken()).rejects.toThrow("no access_token");
  });

  it("returns normalized user and department responses", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch")
      .mockResolvedValueOnce({ ok: true, json: async () => ({ errcode: 0, access_token: "t1" }) } as Response)
      .mockResolvedValueOnce({ ok: true, json: async () => ({ errcode: 0, userid: "alice", name: "Alice" }) } as Response)
      .mockResolvedValueOnce({ ok: true, json: async () => ({ errcode: 0, access_token: "t2" }) } as Response)
      .mockResolvedValueOnce({ ok: true, json: async () => ({ errcode: 0, department: [{ id: 1, name: "HQ" }] }) } as Response);

    await expect(getWecomUserByUserId("alice@example.com")).resolves.toMatchObject({ userid: "alice" });
    await expect(listWecomDepartments()).resolves.toEqual([{ id: 1, name: "HQ" }]);
    expect(String(fetchSpy.mock.calls[1]?.[0])).toContain("userid=alice%40example.com");
  });
});
