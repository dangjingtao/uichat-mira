import { describe, expect, it, vi } from "vitest";
import {
  getGlobalModelAccessStatus,
  resolveGlobalModelAccessStatus,
} from "./modelAccess";
import * as modelSettings from "../api/modelSettings";
import type { RoleModelConfig } from "../api/modelSettings";

const createConfig = (
  type: RoleModelConfig["type"],
  providerCode: string | null,
  remoteModelId: string | null,
): RoleModelConfig => ({
  id: `${type}-1`,
  type,
  name: type,
  providerCode,
  remoteModelId,
  params: {},
  isDefault: false,
  createdAt: "",
  updatedAt: "",
});

describe("resolveGlobalModelAccessStatus", () => {
  it("returns all disconnected for empty configs", () => {
    expect(resolveGlobalModelAccessStatus([])).toEqual({
      llmConnected: false,
      embeddingConnected: false,
      rerankConnected: false,
    });
  });

  it("detects connected LLM", () => {
    const configs = [createConfig("llm", "openai", "gpt-4")];
    expect(resolveGlobalModelAccessStatus(configs)).toEqual({
      llmConnected: true,
      embeddingConnected: false,
      rerankConnected: false,
    });
  });

  it("detects connected embedding and rerank", () => {
    const configs = [
      createConfig("embedding", "openai", "text-embedding-3"),
      createConfig("rerank", "cohere", "rerank-multilingual"),
    ];
    expect(resolveGlobalModelAccessStatus(configs)).toEqual({
      llmConnected: false,
      embeddingConnected: true,
      rerankConnected: true,
    });
  });

  it("treats missing providerCode or remoteModelId as disconnected", () => {
    const configs = [
      createConfig("llm", null, "gpt-4"),
      createConfig("embedding", "openai", null),
    ];
    expect(resolveGlobalModelAccessStatus(configs)).toEqual({
      llmConnected: false,
      embeddingConnected: false,
      rerankConnected: false,
    });
  });

  it("uses the last config when duplicate types exist", () => {
    const configs = [
      createConfig("llm", "openai", "gpt-4"),
      createConfig("llm", null, "gpt-4-turbo"),
    ];
    expect(resolveGlobalModelAccessStatus(configs)).toEqual({
      llmConnected: false,
      embeddingConnected: false,
      rerankConnected: false,
    });
  });
});

describe("getGlobalModelAccessStatus", () => {
  it("fetches configs and resolves status", async () => {
    const configs = [createConfig("llm", "openai", "gpt-4")];
    vi.spyOn(modelSettings, "getRoleModelConfigs").mockResolvedValue(configs);

    const status = await getGlobalModelAccessStatus();

    expect(status).toEqual({
      llmConnected: true,
      embeddingConnected: false,
      rerankConnected: false,
    });
  });
});
