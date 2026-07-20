// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from "vitest";
import { getSession, notifyAuthRequired } from "@/shared/lib/sessionStorage";
import { WebBridgeClient } from "../webbridge";

vi.mock("@/shared/platform/desktopRuntime", () => ({
  getDesktopRuntime: vi.fn(() => ({
    hostKind: "electron",
    backendUrl: "http://127.0.0.1:3000",
  })),
}));

vi.mock("@/shared/lib/sessionStorage", () => ({
  getSession: vi.fn(),
  notifyAuthRequired: vi.fn(),
}));

class FakeWebSocket {
  static readonly CONNECTING = 0;
  static readonly OPEN = 1;
  static readonly CLOSED = 3;
  static instances: FakeWebSocket[] = [];

  readyState = FakeWebSocket.CONNECTING;
  onopen: (() => void) | null = null;
  onmessage: ((event: { data: string }) => void) | null = null;
  onerror: (() => void) | null = null;
  onclose: (() => void) | null = null;
  send = vi.fn();

  constructor(readonly url: string) {
    FakeWebSocket.instances.push(this);
  }

  open() {
    this.readyState = FakeWebSocket.OPEN;
    this.onopen?.();
  }

  receive(message: unknown) {
    this.onmessage?.({ data: JSON.stringify(message) });
  }

  close() {
    this.readyState = FakeWebSocket.CLOSED;
    this.onclose?.();
  }
}

describe("WebBridgeClient", () => {
  beforeEach(() => {
    FakeWebSocket.instances = [];
    vi.mocked(getSession).mockReturnValue({
      token: "expired-token",
      user: { id: 1, username: "alice", role: "admin" },
    });
    vi.mocked(notifyAuthRequired).mockClear();
    vi.stubGlobal("WebSocket", FakeWebSocket);
    window.location.hash = "#/chat";
  });

  it("connects automatically when the UI subscribes to bridge status", () => {
    const client = new WebBridgeClient();

    client.onStatus(() => {});

    expect(FakeWebSocket.instances).toHaveLength(1);
    expect(FakeWebSocket.instances[0].url).toBe("ws://127.0.0.1:3000/webbridge");
    client.close();
  });

  it("delegates AUTH_REQUIRED to the auth owner without navigating directly", async () => {
    const client = new WebBridgeClient();
    const statuses: unknown[] = [];
    client.onStatus((status) => statuses.push(status));

    const connecting = client.connect();
    const socket = FakeWebSocket.instances[0];
    socket.open();
    socket.receive({
      type: "response",
      error: { code: "AUTH_REQUIRED", message: "token expired" },
    });

    await expect(connecting).rejects.toThrow("触界授权已失效，请重新登录");
    expect(notifyAuthRequired).toHaveBeenCalledTimes(1);
    expect(notifyAuthRequired).toHaveBeenCalledWith("token expired");
    expect(window.location.hash).toBe("#/chat");
    expect(socket.readyState).toBe(FakeWebSocket.CLOSED);
    expect(statuses).toContainEqual({
      status: "error",
      code: "AUTH_REQUIRED",
      message: "token expired",
    });

    await expect(client.connect()).rejects.toThrow(
      "触界授权已失效，请重新登录后再连接",
    );
    expect(FakeWebSocket.instances).toHaveLength(1);
  });
});
