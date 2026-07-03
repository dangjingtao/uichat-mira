import { describe, expect, it } from "vitest";
import {
  fetchMcpMarketplaceServers,
  normalizeMarketplaceServersPayload,
} from "./marketplace.js";

describe("mcp marketplace", () => {
  it("normalizes official registry servers into app-owned DTOs", () => {
    const result = normalizeMarketplaceServersPayload(
      {
        servers: [
          {
            server: {
              name: "example.com/search",
              title: "Example Search",
              description: "Search remote data",
              version: "1.0.0",
              websiteUrl: "https://docs.example.com/mcp",
              repository: {
                url: "https://github.com/example/search-mcp",
                source: "github",
              },
              remotes: [
                {
                  type: "streamable-http",
                  url: "https://example.com/mcp",
                },
              ],
              packages: [
                {
                  registry_type: "npm",
                  identifier: "@example/mcp-server",
                  version: "1.0.0",
                  transport: {
                    type: "stdio",
                  },
                },
              ],
            },
            _meta: {
              "io.modelcontextprotocol.registry/official": {
                status: "active",
                isLatest: true,
                publishedAt: "2026-04-13T17:32:20.852269Z",
                updatedAt: "2026-04-14T17:32:20.852269Z",
              },
            },
          },
        ],
        metadata: {
          nextCursor: "example.com/search:1.0.0",
          count: 1,
        },
      },
      "https://registry.modelcontextprotocol.io/v0/servers",
    );

    expect(result).toEqual({
      servers: [
        {
          id: "example.com/search",
          name: "example.com/search",
          title: "Example Search",
          description: "Search remote data",
          version: "1.0.0",
          status: "active",
          isLatest: true,
          publishedAt: "2026-04-13T17:32:20.852269Z",
          updatedAt: "2026-04-14T17:32:20.852269Z",
          websiteUrl: "https://docs.example.com/mcp",
          repositoryUrl: "https://github.com/example/search-mcp",
          transports: [
            {
              kind: "streamable-http",
              packageType: "remote",
              installable: true,
              label: "Remote HTTP",
              url: "https://example.com/mcp",
            },
            {
              kind: "stdio",
              packageType: "npm",
              installable: true,
              label: "npm package",
              command: "npx",
              args: ["-y", "@example/mcp-server"],
              packageIdentifier: "@example/mcp-server",
            },
          ],
        },
      ],
      metadata: {
        cache: {
          hit: false,
          stale: false,
          cachedAt: null,
        },
        count: 1,
        nextCursor: "example.com/search:1.0.0",
        sourceUrl: "https://registry.modelcontextprotocol.io/v0/servers",
      },
    });
  });

  it("accepts registryType from the official registry package shape", () => {
    const result = normalizeMarketplaceServersPayload(
      {
        servers: [
          {
            server: {
              name: "io.github.Dave-London/npm",
              title: "Pare npm",
              packages: [
                {
                  registryType: "npm",
                  identifier: "@paretools/npm",
                  version: "0.8.0",
                  transport: {
                    type: "stdio",
                  },
                },
              ],
            },
          },
        ],
      },
      "https://registry.modelcontextprotocol.io/v0.1/servers",
    );

    expect(result.servers[0]?.transports).toEqual([
      {
        kind: "stdio",
        packageType: "npm",
        installable: true,
        label: "npm package",
        command: "npx",
        args: ["-y", "@paretools/npm"],
        packageIdentifier: "@paretools/npm",
      },
    ]);
  });

  it("filters normalized results by query without trusting unknown entries", () => {
    const result = normalizeMarketplaceServersPayload(
      {
        servers: [
          { server: { name: "alpha", title: "Alpha", description: "Files" } },
          { server: { name: "beta", title: "Beta", description: "Calendar" } },
          { server: { title: "Missing name" } },
        ],
      },
      "https://registry.example/servers",
      "calendar",
    );

    expect(result.servers.map((server) => server.id)).toEqual(["beta"]);
  });

  it("fetches registry pages with limit and cursor", async () => {
    const seenUrls: string[] = [];
    const result = await fetchMcpMarketplaceServers({
      sourceUrl: "https://registry.example/servers",
      limit: 5,
      cursor: "cursor-1",
      fetchImpl: async (url) => {
        seenUrls.push(String(url));
        return new Response(
          JSON.stringify({
            servers: [{ server: { name: "alpha", title: "Alpha" } }],
            metadata: { count: 1 },
          }),
          { status: 200 },
        );
      },
    });

    expect(seenUrls).toEqual(["https://registry.example/servers?limit=5&cursor=cursor-1"]);
    expect(result.servers[0]?.id).toBe("alpha");
    expect(result.metadata.cache).toEqual({
      hit: false,
      stale: false,
      cachedAt: null,
    });
  });

  it("returns cached marketplace results when the upstream registry times out", async () => {
    const sourceUrl = "https://registry.example/servers";
    const query = "docs";

    const first = await fetchMcpMarketplaceServers({
      sourceUrl,
      query,
      fetchImpl: async () =>
        new Response(
          JSON.stringify({
            servers: [{ server: { name: "alpha-docs", title: "Alpha Docs" } }],
            metadata: { count: 1 },
          }),
          { status: 200 },
        ),
    });

    const second = await fetchMcpMarketplaceServers({
      sourceUrl,
      query,
      fetchImpl: async () => {
        const timeout = new Error("timed out");
        timeout.name = "TimeoutError";
        throw timeout;
      },
    });

    expect(first.servers[0]?.id).toBe("alpha-docs");
    expect(second.servers[0]?.id).toBe("alpha-docs");
    expect(second.metadata.cache.hit).toBe(true);
    expect(second.metadata.cache.stale).toBe(true);
    expect(typeof second.metadata.cache.cachedAt).toBe("string");
  });
});
