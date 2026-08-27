import { describe, expect, it } from "vitest";
import {
  getRequiredRemoteScope,
  remoteDeviceHasScope,
} from "./remote-device-auth.service.js";
import type { RemoteDeviceRecord } from "@/db/repositories/tailscale-remote-access.repository.js";

const device: RemoteDeviceRecord = {
  id: "device-1",
  userId: 1,
  name: "K70",
  platform: "android",
  publicKey: null,
  tokenHash: "hash",
  permissions: ["threads:read", "messages:write", "agent:approve"],
  createdAt: "2026-08-01T00:00:00.000Z",
  lastSeenAt: null,
};

describe("remote device route gateway", () => {
  it("maps only canonical mobile routes to explicit scopes", () => {
    expect(getRequiredRemoteScope("GET", "/remote/v1/manifest")).toBe(
      "authenticated",
    );
    expect(getRequiredRemoteScope("GET", "/remote/v1/workspaces")).toBe(
      "threads:read",
    );
    expect(getRequiredRemoteScope("GET", "/remote/v1/roles")).toBe(
      "threads:read",
    );
    expect(
      getRequiredRemoteScope(
        "GET",
        "/remote/v1/workspaces/workspace-1/threads?status=active&limit=50",
      ),
    ).toBe("threads:read");
    expect(getRequiredRemoteScope("GET", "/threads?status=active")).toBe(
      "threads:read",
    );
    expect(getRequiredRemoteScope("GET", "/threads/thread-1/messages")).toBe(
      "messages:read",
    );
    expect(getRequiredRemoteScope("POST", "/proxy/chat/default")).toBe(
      "messages:write",
    );
    expect(
      getRequiredRemoteScope("POST", "/agent/runs/run-1/approve"),
    ).toBe("agent:approve");
    expect(
      getRequiredRemoteScope(
        "GET",
        "/threads/thread-1/media/media-1/content",
      ),
    ).toBe("artifacts:read");
  });

  it("rejects nearby but non-canonical routes", () => {
    expect(getRequiredRemoteScope("POST", "/threads")).toBeNull();
    expect(getRequiredRemoteScope("POST", "/threads/thread-1/messages")).toBeNull();
    expect(getRequiredRemoteScope("POST", "/proxy/chat/volcengine")).toBeNull();
    expect(getRequiredRemoteScope("GET", "/general-settings")).toBeNull();
    expect(getRequiredRemoteScope("POST", "/agent/runs/run-1/resume")).toBeNull();
    expect(getRequiredRemoteScope("GET", "/attachments/file-1")).toBeNull();
    expect(getRequiredRemoteScope("GET", "/roles")).toBeNull();
    expect(
      getRequiredRemoteScope(
        "POST",
        "/remote/v1/workspaces/workspace-1/threads",
      ),
    ).toBeNull();
  });

  it("requires the exact granted scope", () => {
    expect(remoteDeviceHasScope(device, "authenticated")).toBe(true);
    expect(remoteDeviceHasScope(device, "threads:read")).toBe(true);
    expect(remoteDeviceHasScope(device, "messages:write")).toBe(true);
    expect(remoteDeviceHasScope(device, "messages:read")).toBe(false);
    expect(remoteDeviceHasScope(device, "agent:control")).toBe(false);
  });
});
