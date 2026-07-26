import nodeFetch, { Response as NodeFetchResponse } from "node-fetch";
import { describe, expect, it, vi } from "vitest";
import type { GeneralSettingsRecord } from "@/db/repositories/general-settings.repository.js";
import {
  buildGitHubSocks5ProxyUrl,
  createGitHubProxyAwareFetch,
  isGitHubNetworkRequest,
} from "./github-network-fetch.js";

const proxySettings: GeneralSettingsRecord = {
  socks5Host: "127.0.0.1",
  socks5Port: 7891,
  socks5Username: "",
  socks5Password: "",
};

describe("GitHub proxy-aware fetch", () => {
  it("builds an encoded SOCKS5 URL from Mira general settings", () => {
    expect(
      buildGitHubSocks5ProxyUrl({
        ...proxySettings,
        socks5Username: "mira user",
        socks5Password: "p@ss/word",
      }),
    ).toBe("socks5://mira%20user:p%40ss%2Fword@127.0.0.1:7891");
    expect(
      buildGitHubSocks5ProxyUrl({ ...proxySettings, socks5Port: 0 }),
    ).toBeNull();
  });

  it("recognizes only GitHub API and authorization hosts", () => {
    expect(isGitHubNetworkRequest("https://github.com/login/device/code")).toBe(true);
    expect(isGitHubNetworkRequest("https://api.github.com/user")).toBe(true);
    expect(isGitHubNetworkRequest("https://example.com/github.com")).toBe(false);
    expect(isGitHubNetworkRequest("http://127.0.0.1:8788/health")).toBe(false);
  });

  it("routes GitHub requests through the configured SOCKS5 agent", async () => {
    const directFetch = vi.fn(async () => new Response("direct"));
    const proxiedFetchMock = vi.fn(
      async (
        _input: Parameters<typeof nodeFetch>[0],
        _init?: Parameters<typeof nodeFetch>[1],
      ) =>
        new NodeFetchResponse(JSON.stringify({ ok: true }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
    );
    const proxyAwareFetch = createGitHubProxyAwareFetch({
      directFetch,
      readProxySettings: () => proxySettings,
      proxiedFetch: proxiedFetchMock as unknown as typeof nodeFetch,
    });

    const response = await proxyAwareFetch("https://github.com/login/device/code", {
      method: "POST",
    });

    expect(await response.json()).toEqual({ ok: true });
    expect(directFetch).not.toHaveBeenCalled();
    expect(proxiedFetchMock).toHaveBeenCalledTimes(1);
    expect(proxiedFetchMock.mock.calls[0]?.[1]).toMatchObject({
      method: "POST",
      agent: expect.anything(),
    });
  });

  it("keeps non-GitHub traffic on the native direct fetch", async () => {
    const directFetch = vi.fn(async () => new Response("direct"));
    const proxiedFetchMock = vi.fn();
    const proxyAwareFetch = createGitHubProxyAwareFetch({
      directFetch,
      readProxySettings: () => proxySettings,
      proxiedFetch: proxiedFetchMock as unknown as typeof nodeFetch,
    });

    const response = await proxyAwareFetch("https://example.com/resource");

    expect(await response.text()).toBe("direct");
    expect(directFetch).toHaveBeenCalledTimes(1);
    expect(proxiedFetchMock).not.toHaveBeenCalled();
  });
});
