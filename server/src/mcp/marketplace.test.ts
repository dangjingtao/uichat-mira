import { describe, expect, it } from "vitest";
import {
  fetchMcpMarketplaceRegistryPage,
  normalizeMarketplaceServersPayload,
} from "./marketplace.js";

describe("mcp marketplace registry adapter", () => {
  it("normalizes official Registry metadata and supported transports", () => {
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
              repository: { url: "https://github.com/example/search-mcp" },
              remotes: [
                {
                  type: "streamable-http",
                  url: "https://example.com/mcp",
                },
              ],
              packages: [
                {
                  registryType: "npm",
                  identifier: "@example/mcp-server",
                  transport: { type: "stdio" },
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
        metadata: { nextCursor: "cursor-2", count: 1 },
      },
      "https://registry.example/servers",
    );

    expect(result).toMatchObject({
      servers: [
        {
          id: "example.com/search",
          title: "Example Search",
          status: "active",
          repositoryUrl: "https://github.com/example/search-mcp",
          transports: [
            {
              kind: "streamable-http",
              url: "https://example.com/mcp",
              installable: true,
            },
            {
              kind: "stdio",
              packageIdentifier: "@example/mcp-server",
              command: "npx",
              args: ["-y", "@example/mcp-server"],
              installable: true,
            },
          ],
        },
      ],
      metadata: { count: 1, nextCursor: "cursor-2" },
    });
  });

  it("rejects invalid payloads and filters normalized results locally", () => {
    expect(() =>
      normalizeMarketplaceServersPayload({}, "https://registry.example/servers"),
    ).toThrow("MCP registry response is missing servers[]");

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

  it("requests a Registry sync page with incremental parameters", async () => {
    const seenUrls: string[] = [];
    const page = await fetchMcpMarketplaceRegistryPage({
      sourceUrl: "https://registry.example/servers",
      limit: 100,
      cursor: "cursor-1",
      version: "latest",
      updatedSince: "2026-07-31T00:00:00.000Z",
      includeDeleted: true,
      fetchImpl: async (url) => {
        seenUrls.push(String(url));
        return new Response(
          JSON.stringify({
            servers: [{ server: { name: "alpha", title: "Alpha" } }],
            metadata: { nextCursor: null },
          }),
          { status: 200 },
        );
      },
    });

    expect(seenUrls).toEqual([
      "https://registry.example/servers?limit=100&cursor=cursor-1&version=latest&updated_since=2026-07-31T00%3A00%3A00.000Z&include_deleted=true",
    ]);
    expect(page.entries[0]?.server.id).toBe("alpha");
  });
});
