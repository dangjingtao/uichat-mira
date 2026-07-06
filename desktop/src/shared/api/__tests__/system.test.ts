import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/shared/lib/request", () => ({
  get: vi.fn(),
}));

import { get } from "@/shared/lib/request";
import {
  getServiceHealth,
  getAppMeta,
  getDatabaseHealth,
  type AppMetaData,
  type DatabaseHealthData,
  type ServiceHealthData,
} from "../system";

const sampleHealth: ServiceHealthData = { service: "ok" };

const sampleAppMeta: AppMetaData = {
  name: "ui-chat-mira",
  version: "0.7.1",
  displayName: "UIChat Mira",
  author: "team",
  description: "local-first workspace",
  repositoryUrl: "https://example.com/repo",
  homepageUrl: "https://example.com/home",
  links: [{ label: "Docs", value: "docs", href: "https://example.com/docs" }],
};

const sampleDbHealth: DatabaseHealthData = {
  ok: true,
  configured: true,
  mode: "sqlite",
  detail: "healthy",
  vectorStore: {
    ok: true,
    provider: "sqlite-vec",
    detail: "ready",
  },
};

describe("system api", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("getServiceHealth 查询服务健康状态", async () => {
    vi.mocked(get).mockResolvedValueOnce(sampleHealth);

    const result = await getServiceHealth();

    expect(get).toHaveBeenCalledWith("/health");
    expect(result).toBe(sampleHealth);
  });

  it("getAppMeta 查询应用元数据", async () => {
    vi.mocked(get).mockResolvedValueOnce(sampleAppMeta);

    const result = await getAppMeta();

    expect(get).toHaveBeenCalledWith("/app/meta");
    expect(result).toBe(sampleAppMeta);
  });

  it("getDatabaseHealth 查询数据库健康状态", async () => {
    vi.mocked(get).mockResolvedValueOnce(sampleDbHealth);

    const result = await getDatabaseHealth();

    expect(get).toHaveBeenCalledWith("/db/health");
    expect(result).toBe(sampleDbHealth);
  });
});
