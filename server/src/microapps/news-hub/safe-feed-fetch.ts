import dns from "node:dns/promises";
import http from "node:http";
import https from "node:https";
import { BlockList, isIP, type LookupFunction } from "node:net";
import { DEFAULT_FETCH_TIMEOUT_MS } from "@/utils/http.js";

const MAX_FEED_BYTES = 2 * 1024 * 1024;
const MAX_REDIRECTS = 3;
const blockedAddresses = new BlockList();

for (const [network, prefix] of [
  ["0.0.0.0", 8], ["10.0.0.0", 8], ["100.64.0.0", 10], ["127.0.0.0", 8],
  ["169.254.0.0", 16], ["172.16.0.0", 12], ["192.0.0.0", 24], ["192.0.2.0", 24],
  ["192.168.0.0", 16], ["198.18.0.0", 15], ["198.51.100.0", 24], ["203.0.113.0", 24],
  ["224.0.0.0", 4], ["240.0.0.0", 4],
] as const) blockedAddresses.addSubnet(network, prefix, "ipv4");

for (const [network, prefix] of [
  ["::", 128], ["::1", 128], ["fc00::", 7], ["fe80::", 10], ["ff00::", 8],
  ["2001:db8::", 32],
] as const) blockedAddresses.addSubnet(network, prefix, "ipv6");

const isBlockedAddress = (address: string) => {
  const family = isIP(address);
  if (family === 4) return blockedAddresses.check(address, "ipv4");
  if (family === 6) {
    const mapped = address.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/i)?.[1];
    return mapped ? blockedAddresses.check(mapped, "ipv4") : blockedAddresses.check(address, "ipv6");
  }
  return true;
};

export type FeedDnsLookup = typeof dns.lookup;

export async function resolveSafeFeedTarget(rawUrl: string, lookup: FeedDnsLookup = dns.lookup) {
  let url: URL;
  try {
    url = new URL(rawUrl.trim());
  } catch {
    throw new Error("请输入有效的网站或 RSS/Atom 地址");
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new Error("订阅地址只支持 HTTP 或 HTTPS");
  }
  if (url.username || url.password) {
    throw new Error("订阅地址不能包含用户名或密码");
  }
  const hostname = url.hostname.toLowerCase();
  if (hostname === "localhost" || hostname.endsWith(".localhost") || hostname.endsWith(".local")) {
    throw new Error("订阅地址不能访问本机或内网");
  }

  const literalFamily = isIP(hostname);
  const addresses = literalFamily
    ? [{ address: hostname, family: literalFamily }]
    : await lookup(hostname, { all: true, verbatim: true });
  if (addresses.length === 0 || addresses.some((entry) => isBlockedAddress(entry.address))) {
    throw new Error("订阅地址不能访问本机、内网或保留网络");
  }
  return {
    url,
    addresses: addresses.map((entry) => ({
      address: entry.address,
      family: entry.family as 4 | 6,
    })),
    address: addresses[0]!.address,
    family: addresses[0]!.family,
  };
}

export type SafeFeedResponse = {
  finalUrl: string;
  contentType: string;
  text: string;
};

export const createPinnedLookup = (
  addresses: Array<{ address: string; family: 4 | 6 }>,
): LookupFunction =>
  (_hostname, options, callback) => {
    const first = addresses[0];
    if (!first) {
      callback(new Error("没有可用的已验证地址"), "", 0);
      return;
    }
    if (options.all) {
      callback(null, addresses);
      return;
    }
    callback(null, first.address, first.family);
  };

export async function fetchSafeFeedText(rawUrl: string, redirectCount = 0): Promise<SafeFeedResponse> {
  const target = await resolveSafeFeedTarget(rawUrl);
  const transport = target.url.protocol === "https:" ? https : http;

  return await new Promise<SafeFeedResponse>((resolve, reject) => {
    const request = transport.request(target.url, {
      headers: {
        accept: "application/atom+xml, application/rss+xml, application/xml, text/xml, text/html;q=0.8",
        "accept-encoding": "identity",
        "user-agent": "UIChat-Mira-Guanlan/1.0",
      },
      lookup: createPinnedLookup(target.addresses),
      ...(target.url.protocol === "https:" ? { servername: target.url.hostname } : {}),
    }, (response) => {
      const status = response.statusCode ?? 0;
      const location = response.headers.location;
      if (status >= 300 && status < 400 && location) {
        response.resume();
        if (redirectCount >= MAX_REDIRECTS) {
          reject(new Error("订阅地址重定向次数过多"));
          return;
        }
        const nextUrl = new URL(location, target.url).toString();
        void fetchSafeFeedText(nextUrl, redirectCount + 1).then(resolve, reject);
        return;
      }
      if (status < 200 || status >= 300) {
        response.resume();
        reject(new Error(`订阅地址请求失败（HTTP ${status}）`));
        return;
      }
      const declaredSize = Number(response.headers["content-length"] ?? 0);
      if (declaredSize > MAX_FEED_BYTES) {
        response.destroy();
        reject(new Error("订阅响应超过 2 MB 限制"));
        return;
      }

      const chunks: Buffer[] = [];
      let size = 0;
      response.on("data", (chunk: Buffer) => {
        size += chunk.length;
        if (size > MAX_FEED_BYTES) {
          response.destroy(new Error("订阅响应超过 2 MB 限制"));
          return;
        }
        chunks.push(chunk);
      });
      response.on("end", () => resolve({
        finalUrl: target.url.toString(),
        contentType: String(response.headers["content-type"] ?? "").toLowerCase(),
        text: Buffer.concat(chunks).toString("utf8"),
      }));
      response.on("error", reject);
    });
    request.setTimeout(DEFAULT_FETCH_TIMEOUT_MS, () => request.destroy(new Error("订阅地址请求超时")));
    request.on("error", (error) => reject(error.message.includes("订阅") ? error : new Error("订阅地址暂时无法访问")));
    request.end();
  });
}
