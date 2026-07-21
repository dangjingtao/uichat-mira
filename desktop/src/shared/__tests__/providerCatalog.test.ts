import { describe, expect, it } from "vitest";
import {
  PROVIDER_CODES,
  DEFAULT_PROVIDER_CODE,
  PROVIDER_LABELS,
  getProviderLabel,
} from "../providerCatalog";

describe("providerCatalog", () => {
  it("PROVIDER_CODES 包含预期提供商", () => {
    expect(PROVIDER_CODES).toEqual([
      "ollama",
      "lmstudio",
      "openai",
      "google",
      "cloudflare",
      "volcengine",
    ]);
  });

  it("DEFAULT_PROVIDER_CODE 为 ollama", () => {
    expect(DEFAULT_PROVIDER_CODE).toBe("ollama");
  });

  it("PROVIDER_LABELS 映射正确", () => {
    expect(PROVIDER_LABELS.ollama).toBe("Ollama");
    expect(PROVIDER_LABELS.openai).toBe("OpenAI");
    expect(PROVIDER_LABELS.volcengine).toBe("火山引擎");
  });

  it("getProviderLabel 返回对应标签", () => {
    expect(getProviderLabel("lmstudio")).toBe("LM Studio");
    expect(getProviderLabel("cloudflare")).toBe("Cloudflare");
    expect(getProviderLabel("google")).toBe("Google Gemini");
  });
});
