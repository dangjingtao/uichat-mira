import { afterEach, describe, expect, it, vi } from "vitest";
import { clockWeatherProvider, resetClockWeatherCache } from "./clock-weather-provider.js";

describe("clockWeatherProvider", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    resetClockWeatherCache();
  });

  it("combines IP location with Open-Meteo current and daily weather", async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({ ok: true, json: async () => ({ success: true, city: "Shanghai", latitude: 31.23, longitude: 121.47 }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ current: { temperature_2m: 26.4, weather_code: 1 }, daily: { temperature_2m_min: [22.1], temperature_2m_max: [29.8] } }) });
    vi.stubGlobal("fetch", fetchMock);

    const result = await clockWeatherProvider.getData(new Date("2026-07-28T03:12:00.000Z"));

    expect(result).toMatchObject({
      demo: false,
      sourceLabel: "IP 定位 + Open-Meteo",
      locationLabel: "Shanghai",
      weatherAvailable: true,
      weather: "大致晴",
      temperature: "26°C",
      forecast: "今日 22°C - 30°C",
    });
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(String(fetchMock.mock.calls[1]?.[0])).toContain("latitude=31.23");
  });

  it("shows unavailable weather when the network request fails", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("offline")));

    const result = await clockWeatherProvider.getData(new Date("2026-07-28T03:12:00.000Z"));

    expect(result).toMatchObject({
      demo: false,
      weatherAvailable: false,
      locationLabel: "位置不可用",
      weather: "天气不可用",
      temperature: "--",
      forecast: "暂时无法获取天气数据",
    });
  });

  it("reuses the weather result for fifteen minutes", async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({ ok: true, json: async () => ({ success: true, city: "Shanghai", latitude: 31.23, longitude: 121.47 }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ current: { temperature_2m: 26.4, weather_code: 1 }, daily: { temperature_2m_min: [22.1], temperature_2m_max: [29.8] } }) });
    vi.stubGlobal("fetch", fetchMock);
    const firstRequest = new Date("2026-07-28T03:12:00.000Z");

    await clockWeatherProvider.getData(firstRequest);
    await clockWeatherProvider.getData(new Date(firstRequest.getTime() + 14 * 60 * 1000));

    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});
