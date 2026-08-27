import { describe, expect, it } from "vitest";
import { discoverFeedUrls, parseFeedDocument } from "./feed-parser.js";

describe("NewsHub feed parser", () => {
  it("parses RSS items and removes markup from summaries", () => {
    const feed = parseFeedDocument(`<?xml version="1.0"?>
      <rss version="2.0"><channel><title>Example RSS</title><link>https://example.com/</link>
      <item><guid>post-1</guid><title>First post</title><link>/posts/1</link>
      <description><![CDATA[<p>Hello <strong>RSS</strong></p>]]></description>
      <pubDate>Thu, 30 Jul 2026 08:00:00 GMT</pubDate></item>
      </channel></rss>`, "https://example.com/feed.xml");

    expect(feed.format).toBe("rss");
    expect(feed.title).toBe("Example RSS");
    expect(feed.items[0]).toMatchObject({
      externalId: "post-1",
      title: "First post",
      url: "https://example.com/posts/1",
      summary: "Hello RSS",
    });
  });

  it("parses Atom entries and their alternate links", () => {
    const feed = parseFeedDocument(`<?xml version="1.0"?>
      <feed xmlns="http://www.w3.org/2005/Atom"><title>Example Atom</title>
      <link rel="alternate" href="https://example.com/blog"/>
      <entry><id>tag:example.com,2026:1</id><title>Atom post</title>
      <link rel="alternate" href="https://example.com/blog/1"/><summary>Summary</summary>
      <author><name>Mira</name></author><updated>2026-07-30T08:00:00Z</updated></entry></feed>`,
      "https://example.com/atom.xml");

    expect(feed.format).toBe("atom");
    expect(feed.siteUrl).toBe("https://example.com/blog");
    expect(feed.items[0]).toMatchObject({ title: "Atom post", author: "Mira" });
  });

  it("discovers declared RSS and Atom feeds from a homepage", () => {
    const urls = discoverFeedUrls(`<html><head>
      <link href="/rss.xml" type="application/rss+xml" rel="alternate" title="RSS">
      <link rel="alternate" type="application/atom+xml" href="https://feeds.example.net/atom.xml">
      </head></html>`, "https://example.com/blog/");

    expect(urls).toEqual([
      "https://example.com/rss.xml",
      "https://feeds.example.net/atom.xml",
    ]);
  });

  it("discovers and prioritizes an explicitly linked same-site feed", () => {
    const urls = discoverFeedUrls(`<html><head>
      <link rel="alternate" type="application/rss+xml" href="https://feeds.example.net/blog">
      </head><body><a href="/blog/atom.xml">Atom</a></body></html>`, "https://example.com/blog/");

    expect(urls).toEqual([
      "https://example.com/blog/atom.xml",
      "https://feeds.example.net/blog",
    ]);
  });
});
