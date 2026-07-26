import { describe, expect, it } from "vitest";
import { badRequest } from "@/utils/route-errors.js";
import {
  isRetryableGitHubNetworkError,
  nextGitHubDeviceFlowRetrySeconds,
} from "./github-device-flow-retry.js";

describe("GitHub device flow retry", () => {
  it("backs off in five-second steps and caps at thirty seconds", () => {
    expect(nextGitHubDeviceFlowRetrySeconds(5)).toBe(10);
    expect(nextGitHubDeviceFlowRetrySeconds(10)).toBe(15);
    expect(nextGitHubDeviceFlowRetrySeconds(30)).toBe(30);
    expect(nextGitHubDeviceFlowRetrySeconds(Number.NaN)).toBe(10);
  });

  it("recognizes nested undici connection timeout failures", () => {
    const error = new TypeError("fetch failed", {
      cause: Object.assign(new Error("connect timed out"), {
        name: "ConnectTimeoutError",
        code: "UND_ERR_CONNECT_TIMEOUT",
      }),
    });

    expect(isRetryableGitHubNetworkError(error)).toBe(true);
  });

  it("recognizes common transient socket errors", () => {
    const error = Object.assign(new Error("socket reset"), {
      code: "ECONNRESET",
    });

    expect(isRetryableGitHubNetworkError(error)).toBe(true);
  });

  it("does not retry structured GitHub request errors", () => {
    expect(
      isRetryableGitHubNetworkError(badRequest("GitHub rejected the request")),
    ).toBe(false);
  });
});
