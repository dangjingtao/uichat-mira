import { describe, expect, it } from "vitest";
import { resolveQWeatherIconCode, SUPPORTED_WMO_WEATHER_CODES } from "./WeatherIcon";

describe("resolveQWeatherIconCode", () => {
  it("distinguishes weather conditions that have day and night artwork", () => {
    expect(resolveQWeatherIconCode(0, true)).toBe("100");
    expect(resolveQWeatherIconCode(0, false)).toBe("150");
    expect(resolveQWeatherIconCode(2, false)).toBe("153");
    expect(resolveQWeatherIconCode(80, false)).toBe("350");
    expect(resolveQWeatherIconCode(85, false)).toBe("457");
  });

  it("maps every WMO code returned by Open-Meteo", () => {
    expect(SUPPORTED_WMO_WEATHER_CODES).toHaveLength(28);

    for (const weatherCode of SUPPORTED_WMO_WEATHER_CODES) {
      expect(resolveQWeatherIconCode(weatherCode, true), `day icon for WMO ${weatherCode}`).not.toBe("999");
      expect(resolveQWeatherIconCode(weatherCode, false), `night icon for WMO ${weatherCode}`).not.toBe("999");
    }
  });

  it("uses QWeather's unknown icon for missing or unsupported codes", () => {
    expect(resolveQWeatherIconCode(null, null)).toBe("999");
    expect(resolveQWeatherIconCode(500, true)).toBe("999");
  });
});
