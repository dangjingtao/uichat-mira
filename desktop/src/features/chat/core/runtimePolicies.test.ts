import { describe, expect, it } from "vitest";
import { isValidWorkspaceRootPath } from "./runtimePolicies";

describe("isValidWorkspaceRootPath", () => {
  it("accepts Windows absolute paths", () => {
    expect(isValidWorkspaceRootPath("D:\\testData")).toBe(true);
  });

  it("accepts Windows drive roots", () => {
    expect(isValidWorkspaceRootPath("D:\\")).toBe(true);
  });

  it("accepts UNC paths", () => {
    expect(isValidWorkspaceRootPath("\\\\server\\share")).toBe(true);
  });

  it("rejects Unix absolute paths", () => {
    expect(isValidWorkspaceRootPath("/workspace/rag-demo")).toBe(false);
  });

  it("rejects Unix root", () => {
    expect(isValidWorkspaceRootPath("/")).toBe(false);
  });

  it("rejects relative paths", () => {
    expect(isValidWorkspaceRootPath("testData")).toBe(false);
  });
});
