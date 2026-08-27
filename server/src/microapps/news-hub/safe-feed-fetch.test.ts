import { describe, expect, it } from "vitest";
import { createPinnedLookup, resolveSafeFeedTarget } from "./safe-feed-fetch.js";

describe("NewsHub feed URL safety", () => {
  it.each([
    "file:///etc/passwd",
    "http://localhost/feed.xml",
    "http://127.0.0.1/feed.xml",
    "http://192.168.1.8/feed.xml",
    "http://user:secret@example.com/feed.xml",
  ])("rejects unsafe URL %s", async (url) => {
    await expect(resolveSafeFeedTarget(url)).rejects.toThrow();
  });

  it("rejects a public hostname when any DNS answer is private", async () => {
    const lookup = async () => [
      { address: "93.184.216.34", family: 4 as const },
      { address: "10.0.0.8", family: 4 as const },
    ];
    await expect(resolveSafeFeedTarget("https://example.com/feed.xml", lookup as never)).rejects.toThrow();
  });

  it("returns a pinned public address for a safe URL", async () => {
    const lookup = async () => [{ address: "93.184.216.34", family: 4 as const }];
    const target = await resolveSafeFeedTarget("https://example.com/feed.xml", lookup as never);
    expect(target.address).toBe("93.184.216.34");
    expect(target.url.toString()).toBe("https://example.com/feed.xml");
  });

  it("returns an address array when Node requests lookup with all=true", async () => {
    const lookup = createPinnedLookup([
      { address: "2001:4860:4860::8888", family: 6 },
      { address: "93.184.216.34", family: 4 },
    ]);
    const result = await new Promise<{ address: string; family: number }[]>((resolve, reject) => {
      lookup("example.com", { all: true }, (error, addresses) => {
        if (error) reject(error);
        else resolve(addresses as { address: string; family: number }[]);
      });
    });

    expect(result).toEqual([
      { address: "2001:4860:4860::8888", family: 6 },
      { address: "93.184.216.34", family: 4 },
    ]);
  });
});
