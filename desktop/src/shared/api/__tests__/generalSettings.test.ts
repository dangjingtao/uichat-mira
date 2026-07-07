import { describe, expect, it, vi } from "vitest";
import { get, put } from "@/shared/lib/request";
import {
  getGeneralSettings,
  updateGeneralSettings,
  type GeneralSettings,
} from "../generalSettings";

vi.mock("@/shared/lib/request", () => ({
  get: vi.fn(),
  put: vi.fn(),
}));

describe("general settings api", () => {
  const sampleSettings: GeneralSettings = {
    socks5Host: "127.0.0.1",
    socks5Port: 1080,
    socks5Username: "demo",
    socks5Password: "secret",
  };

  it("getGeneralSettings loads backend general settings", async () => {
    vi.mocked(get).mockResolvedValueOnce(sampleSettings);

    const result = await getGeneralSettings();

    expect(get).toHaveBeenCalledWith("/general-settings");
    expect(result).toBe(sampleSettings);
  });

  it("updateGeneralSettings saves backend general settings", async () => {
    vi.mocked(put).mockResolvedValueOnce(sampleSettings);

    const result = await updateGeneralSettings(sampleSettings);

    expect(put).toHaveBeenCalledWith("/general-settings", sampleSettings);
    expect(result).toBe(sampleSettings);
  });
});
