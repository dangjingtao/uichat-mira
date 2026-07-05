import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { getSqlite, resetDatabaseClients } from "@/db/index.js";
import {
  imageGenerationBindingSchema,
  microAppsRepository,
} from "@/db/repositories/micro-apps.repository.js";
import { createTimestampedTestArtifactPath } from "@/test-support/artifacts.js";
import { microAppRuntime } from "../runtime.js";

describe("image_generation shared registry", () => {
  beforeEach(() => {
    process.env.DATABASE_URL = `file:${createTimestampedTestArtifactPath("db", "tmp-image-generation-registry", ".sqlite")}`;
    resetDatabaseClients();
    getSqlite();
    microAppsRepository.initialize();
  });

  afterEach(() => {
    resetDatabaseClients();
    delete process.env.DATABASE_URL;
  });

  it("seeds image_generation and exposes a stable runtime definition", () => {
    const seeded = microAppsRepository.getByType("image_generation");

    expect(seeded).toMatchObject({
      type: "image_generation",
      runtimeKey: "image_generation",
      supportedAccessPoints: ["desktop.image_generation_studio"],
      enabled: true,
    });
    expect(seeded?.bindingSchema.fields).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ key: "providerId", required: true }),
        expect.objectContaining({ key: "model", required: true }),
      ]),
    );

    const definition = microAppRuntime.getDefinition("image_generation");
    expect(definition).toMatchObject({
      type: "image_generation",
      runtimeKey: "image_generation",
      supportedAccessPoints: ["desktop.image_generation_studio"],
    });
    expect(seeded?.bindingSchema).toEqual(imageGenerationBindingSchema);
    expect(definition?.bindingSchema).toEqual(imageGenerationBindingSchema);
  });
});
