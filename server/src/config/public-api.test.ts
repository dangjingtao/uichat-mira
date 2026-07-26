import { describe, expect, it } from "vitest";
import { isAuthExemptPath } from "./public-api.js";

describe("public api auth exemptions", () => {
  it("treats swagger routes as auth exempt on their dedicated prefix", () => {
    expect(isAuthExemptPath("/api-docs")).toBe(true);
    expect(isAuthExemptPath("/api-docs/")).toBe(true);
    expect(isAuthExemptPath("/api-docs/json")).toBe(true);
  });

  it("treats image generation artifact and realtime event routes as auth exempt", () => {
    expect(
      isAuthExemptPath("/artifacts/image-generation/job-1/result.png"),
    ).toBe(true);
    expect(
      isAuthExemptPath(
        "/microapps/image-generation/generations/job-1/events?token=abc",
      ),
    ).toBe(true);
    expect(
      isAuthExemptPath("/microapps/image-generation/generations/job-1"),
    ).toBe(false);
  });

  it("does not exempt unrelated routes", () => {
    expect(isAuthExemptPath("/doc")).toBe(false);
    expect(isAuthExemptPath("/settings/docs")).toBe(false);
  });

  it("exempts the WebBridge handshake path for message-level authentication", () => {
    expect(isAuthExemptPath("/webbridge")).toBe(true);
    expect(isAuthExemptPath("/webbridge/other")).toBe(false);
  });
});
