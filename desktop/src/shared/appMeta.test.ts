import { describe, expect, it } from "vitest";
import { appPackageMeta } from "./appMeta";
import packageJson from "../../../package.json";

describe("appPackageMeta", () => {
  it("uses core values from package.json", () => {
    expect(appPackageMeta.name).toBe(packageJson.name);
    expect(appPackageMeta.version).toBe(packageJson.version);
    expect(appPackageMeta.description).toBe(packageJson.description);
    expect(appPackageMeta.author).toBe(packageJson.author);
    expect(appPackageMeta.homepageUrl).toBe(packageJson.homepage);
  });

  it("prefers appMeta.displayName over displayName", () => {
    const expected =
      packageJson.appMeta?.displayName ??
      packageJson.displayName ??
      "UIChat Mira";
    expect(appPackageMeta.displayName).toBe(expected);
  });

  it("normalizes repository URL", () => {
    if (typeof packageJson.repository === "string") {
      expect(appPackageMeta.repositoryUrl).toBe(packageJson.repository);
    } else {
      expect(appPackageMeta.repositoryUrl).toBe(packageJson.repository?.url);
    }
  });
});
