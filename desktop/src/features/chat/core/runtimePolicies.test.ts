import { describe, expect, it } from "vitest";
import { isValidWorkspaceRootPath } from "./runtimePolicies";

describe("isValidWorkspaceRootPath", () => {
  it("accepts Windows absolute paths in browser preview mode", () => {
    expect(isValidWorkspaceRootPath("D:\\testData", "browser")).toBe(true);
  });

  it("accepts Windows drive roots in browser preview mode", () => {
    expect(isValidWorkspaceRootPath("D:\\", "browser")).toBe(true);
  });

  it("accepts Unix absolute paths in browser preview mode", () => {
    expect(isValidWorkspaceRootPath("/workspace/rag-demo", "browser")).toBe(true);
  });

  it("accepts Unix root in browser preview mode", () => {
    expect(isValidWorkspaceRootPath("/", "browser")).toBe(true);
  });

  it("rejects relative paths in browser preview mode", () => {
    expect(isValidWorkspaceRootPath("testData", "browser")).toBe(false);
  });

  it("accepts UNC paths on Windows", () => {
    expect(isValidWorkspaceRootPath("\\\\server\\share", "win32")).toBe(true);
  });
});
