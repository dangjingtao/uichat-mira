import { XMLParser } from "fast-xml-parser";
import type { NewsFeedFormat } from "@/db/repositories/index.js";
import type { NewsItemUpsertInput } from "@/db/repositories/index.js";

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: "@_",
  processEntities: false,
  trimValues: true,
});

const asArray = <T>(value: T | T[] | undefined | null): T[] => value == null ? [] : Array.isArray(value) ? value : [value];
const asText = (value: unknown): string => {
  if (typeof value === "string" || typeof value === "number") return String(value).trim();
  if (value && typeof value === "object") {
    const record = value as Record<string, unknown>;
    return asText(record["#text"] ?? record.__cdata ?? "");
  }
  return "";
};
const stripHtml = (value: string) => value
  .replace(/<script[\s\S]*?<\/script>/gi, " ")
  .replace(/<style[\s\S]*?<\/style>/gi, " ")
  .replace(/<[^>]+>/g, " ")
  .replace(/&nbsp;/gi, " ")
  .replace(/&amp;/gi, "&")
  .replace(/&lt;/gi, "<")
  .replace(/&gt;/gi, ">")
  .replace(/&quot;/gi, '"')
  .replace(/&#39;/gi, "'")
  .replace(/\s+/g, " ")
  .trim();
const absoluteUrl = (value: string, baseUrl: string) => {
  try { return new URL(value, baseUrl).toString(); } catch { return ""; }
};

export type ParsedFeed = {
  title: string;
  siteUrl: string;
  format: NewsFeedFormat;
  items: Array<Omit<NewsItemUpsertInput, "sourceKey" | "sourceName" | "sourceType" | "lang" | "topic" | "tags">>;
};

export function parseFeedDocument(xml: string, feedUrl: string): ParsedFeed {
  let document: Record<string, any>;
  try { document = parser.parse(xml) as Record<string, any>; } catch { throw new Error("返回内容不是有效的 RSS/Atom 文档"); }

  if (document.rss?.channel || document["rdf:RDF"]) {
    const channel = document.rss?.channel ?? document["rdf:RDF"];
    const entries = asArray(channel.item ?? document["rdf:RDF"]?.item).slice(0, 100);
    if (entries.length === 0) throw new Error("RSS 中没有可读取的文章");
    return {
      title: asText(channel.title) || new URL(feedUrl).hostname,
      siteUrl: absoluteUrl(asText(channel.link), feedUrl),
      format: "rss",
      items: entries.flatMap((entry: Record<string, unknown>) => {
        const title = asText(entry.title);
        const url = absoluteUrl(asText(entry.link), feedUrl);
        const externalId = asText(entry.guid) || url || title;
        if (!title || !url || !externalId) return [];
        const summary = stripHtml(asText(entry.description));
        return [{
          externalId,
          title,
          summary,
          contentText: stripHtml(asText(entry["content:encoded"])) || summary,
          url,
          author: asText(entry["dc:creator"] ?? entry.author) || null,
          publishedAt: asText(entry.pubDate ?? entry["dc:date"]) || null,
          rawPayload: entry,
        }];
      }),
    };
  }

  if (document.feed) {
    const feed = document.feed as Record<string, any>;
    const entries = asArray(feed.entry).slice(0, 100);
    if (entries.length === 0) throw new Error("Atom 中没有可读取的文章");
    const feedLinks = asArray(feed.link as Record<string, unknown> | Record<string, unknown>[]);
    const siteLink = feedLinks.find((link) => asText(link?.["@_rel"]) === "alternate") ?? feedLinks[0];
    return {
      title: asText(feed.title) || new URL(feedUrl).hostname,
      siteUrl: absoluteUrl(asText(siteLink?.["@_href"]), feedUrl),
      format: "atom",
      items: entries.flatMap((entry: Record<string, any>) => {
        const links = asArray(entry.link as Record<string, unknown> | Record<string, unknown>[]);
        const alternate = links.find((link) => !asText(link?.["@_rel"]) || asText(link?.["@_rel"]) === "alternate") ?? links[0];
        const title = asText(entry.title);
        const url = absoluteUrl(asText(alternate?.["@_href"]), feedUrl);
        const externalId = asText(entry.id) || url || title;
        if (!title || !url || !externalId) return [];
        const summary = stripHtml(asText(entry.summary));
        const authors = asArray(entry.author as Record<string, unknown> | Record<string, unknown>[]);
        return [{
          externalId,
          title,
          summary,
          contentText: stripHtml(asText(entry.content)) || summary,
          url,
          author: asText(authors[0]?.name) || null,
          publishedAt: asText(entry.published ?? entry.updated) || null,
          rawPayload: entry,
        }];
      }),
    };
  }

  throw new Error("没有识别到 RSS 或 Atom Feed");
}

const readAttribute = (tag: string, name: string) => tag.match(new RegExp(`${name}\\s*=\\s*["']([^"']+)["']`, "i"))?.[1] ?? "";

export function discoverFeedUrls(html: string, pageUrl: string) {
  const declaredUrls = (html.match(/<link\b[^>]*>/gi) ?? [])
    .filter((tag) => /rel\s*=\s*["'][^"']*alternate/i.test(tag))
    .filter((tag) => /type\s*=\s*["']application\/(?:rss|atom)\+xml/i.test(tag))
    .map((tag) => absoluteUrl(readAttribute(tag, "href"), pageUrl));
  const explicitAnchorUrls = (html.match(/<a\b[^>]*>/gi) ?? [])
    .map((tag) => absoluteUrl(readAttribute(tag, "href"), pageUrl))
    .filter((url) => {
      try {
        return /\/(?:atom|rss|feed)(?:\.[a-z0-9]+)?\/?$/i.test(new URL(url).pathname);
      } catch {
        return false;
      }
    });
  const urls = [...declaredUrls, ...explicitAnchorUrls]
    .filter(Boolean)
    .filter((url, index, values) => values.indexOf(url) === index);
  const pageHostname = new URL(pageUrl).hostname;
  return [
    ...urls.filter((url) => new URL(url).hostname === pageHostname),
    ...urls.filter((url) => new URL(url).hostname !== pageHostname),
  ].slice(0, 5);
}
