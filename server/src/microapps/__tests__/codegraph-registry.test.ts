import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { getSqlite, resetDatabaseClients } from "@/db/index.js";
import {
  codeGraphBindingSchema,
  microAppsRepository,
} from "@/db/repositories/micro-apps.repository.js";
import { createTimestampedTestArtifactPath } from "@/test-support/artifacts.js";
import { microAppRuntime } from "../runtime.js";

describe("codegraph shared registry", () => {
  beforeEach(() => {
    process.env.DATABASE_URL = `file:${createTimestampedTestArtifactPath("db", "tmp-codegraph-registry", ".sqlite")}`;
    resetDatabaseClients();
    getSqlite();
    microAppsRepository.initialize();
  });

  afterEach(() => {
    resetDatabaseClients();
    delete process.env.DATABASE_URL;
  });

  it("seeds codegraph and keeps planner exposure disabled by default", () => {
    const seeded = microAppsRepository.getByType("codegraph");

    expect(seeded).toMatchObject({
      type: "codegraph",
      runtimeKey: "codegraph",
      supportedAccessPoints: ["desktop.codegraph_studio"],
      enabled: true,
    });
    expect(seeded?.bindingSchema.fields).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ key: "command", required: true }),
        expect.objectContaining({ key: "appDataRoot", required: false }),
      ]),
    );

    const definition = microAppRuntime.getDefinition("codegraph");
    expect(definition).toMatchObject({
      type: "codegraph",
      runtimeKey: "codegraph",
      supportedAccessPoints: ["desktop.codegraph_studio"],
    });
    expect(process.env.UI_CHAT_CODEGRAPH_PLANNER_ENABLED).not.toBe("1");
    expect(seeded?.bindingSchema).toEqual(codeGraphBindingSchema);
    expect(definition?.bindingSchema).toEqual(codeGraphBindingSchema);
  });
});
