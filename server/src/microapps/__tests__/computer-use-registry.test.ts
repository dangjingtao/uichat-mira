import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { getSqlite, resetDatabaseClients } from "@/db/index.js";
import {
  computerUseBindingSchema,
  microAppsRepository,
} from "@/db/repositories/micro-apps.repository.js";
import { createTimestampedTestArtifactPath } from "@/test-support/artifacts.js";
import { microAppRuntime } from "../runtime.js";

describe("computer_use shared registry", () => {
  beforeEach(() => {
    process.env.DATABASE_URL = `file:${createTimestampedTestArtifactPath("db", "tmp-computer-use-registry", ".sqlite")}`;
    resetDatabaseClients();
    getSqlite();
    microAppsRepository.initialize();
  });

  afterEach(() => {
    resetDatabaseClients();
    delete process.env.DATABASE_URL;
  });

  it("seeds computer_use and exposes a stable runtime definition", () => {
    const seeded = microAppsRepository.getByType("computer_use");

    expect(seeded).toMatchObject({
      type: "computer_use",
      runtimeKey: "computer_use",
      supportedAccessPoints: ["desktop.computer_use_studio"],
      enabled: true,
    });
    expect(seeded?.bindingSchema.fields).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ key: "defaultStartUrl", type: "text" }),
        expect.objectContaining({
          key: "requireApprovalForExternalNavigation",
          required: true,
          type: "switch",
        }),
      ]),
    );

    const definition = microAppRuntime.getDefinition("computer_use");
    expect(definition).toMatchObject({
      type: "computer_use",
      runtimeKey: "computer_use",
      supportedAccessPoints: ["desktop.computer_use_studio"],
    });
    expect(seeded?.bindingSchema).toEqual(computerUseBindingSchema);
    expect(definition?.bindingSchema).toEqual(computerUseBindingSchema);
  });
});
