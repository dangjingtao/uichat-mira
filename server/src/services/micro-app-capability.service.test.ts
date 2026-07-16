import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { initializeModelConfigDatabase } from "@/db/model-config.db";
import { resetDatabaseClients } from "@/db/index.js";
import { createTimestampedTestArtifactPath } from "@/test-support/artifacts.js";
import { microAppCapabilityService } from "./micro-app-capability.service.js";

const databasePath = createTimestampedTestArtifactPath(
  "db",
  "micro-app-capability",
  ".sqlite",
);

describe("microAppCapabilityService", () => {
  beforeAll(() => {
    process.env.DATABASE_URL = `file:${databasePath}`;
    resetDatabaseClients();
    initializeModelConfigDatabase();
  });

  afterAll(() => {
    resetDatabaseClients();
    delete process.env.DATABASE_URL;
  });

  it("saves an image capability binding to a micro-app provider", () => {
    const binding = microAppCapabilityService.save({
      capabilityCode: "imageGeneration",
      providerId: "comfyui_local",
    });

    expect(binding).toMatchObject({
      capabilityCode: "imageGeneration",
      providerId: "comfyui_local",
    });
  });

  it("rejects a provider that does not belong to the micro-app", () => {
    expect(() =>
      microAppCapabilityService.save({
        capabilityCode: "tts",
        providerId: "comfyui_local",
      }),
    ).toThrow("不支持能力");
  });
});
