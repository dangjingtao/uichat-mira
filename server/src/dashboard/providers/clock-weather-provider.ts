import { fetchJsonWithTimeout } from "../../utils/http.js";
import type { ClockWeatherData, DashboardProvider } from "../dashboard-types.js";

type IpLocationResponse = {
  success?: boolean;
  city?: string;
  latitude?: number;
  longitude?: number;
};

type OpenMeteoResponse = {
  current?: {
    temperature_2m?: number;
    weather_code?: number;
  };
  daily?: {
    temperature_2m_min?: number[];
    temperature_2m_max?: number[];
  };
};

type WeatherSnapshot = Pick<
  ClockWeatherData,
  "locationLabel" | "weatherAvailable" | "weather" | "temperature" | "forecast"
>;

const WEATHER_CACHE_TTL_MS = 15 * 60 * 1000;

const WEATHER_LABELS: Record<number, string> = {
  0: "晴",
  1: "大致晴",
  2: "局部多云",
  3: "阴",
  45: "雾",
  48: "雾凇",
  51: "小毛毛雨",
  53: "毛毛雨",
  55: "大毛毛雨",
  56: "冻毛毛雨",
  57: "强冻毛毛雨",
  61: "小雨",
  63: "中雨",
  65: "大雨",
  66: "冻雨",
  67: "强冻雨",
  71: "小雪",
  73: "中雪",
  75: "大雪",
  77: "雪粒",
  80: "小阵雨",
  81: "阵雨",
  82: "强阵雨",
  85: "小阵雪",
  86: "强阵雪",
  95: "雷雨",
  96: "雷雨伴冰雹",
  99: "强雷雨伴冰雹",
};

let weatherCache: { snapshot: WeatherSnapshot; expiresAt: number } | null = null;
let weatherRequest: Promise<WeatherSnapshot> | null = null;

const unavailableSnapshot: WeatherSnapshot = {
  locationLabel: "位置不可用",
  weatherAvailable: false,
  weather: "天气不可用",
  temperature: "--",
  forecast: "暂时无法获取天气数据",
};

const createData = (
  now: Date,
  snapshot: WeatherSnapshot,
  status: ClockWeatherData["status"],
): ClockWeatherData => ({
  demo: false,
  sourceLabel: "IP 定位 + Open-Meteo",
  status,
  localTime: now.toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit" }),
  dateLabel: now.toLocaleDateString("zh-CN", {
    year: "numeric",
    month: "long",
    day: "numeric",
    weekday: "long",
  }),
  ...snapshot,
});

export const getClockWeatherLoadingData = (now: Date): ClockWeatherData =>
  createData(now, {
    locationLabel: "正在定位",
    weatherAvailable: false,
    weather: "天气加载中",
    temperature: "--",
    forecast: "正在获取当前位置天气",
  }, "loading");

const fetchWeatherSnapshot = async (): Promise<WeatherSnapshot> => {
  try {
    const location = await fetchJsonWithTimeout<IpLocationResponse>("https://ipwho.is/", undefined, 8_000);
    if (location.success === false || typeof location.latitude !== "number" || typeof location.longitude !== "number") {
      throw new Error("IP location is unavailable");
    }

    const params = new URLSearchParams({
      latitude: String(location.latitude),
      longitude: String(location.longitude),
      current: "temperature_2m,weather_code",
      daily: "temperature_2m_min,temperature_2m_max",
      forecast_days: "1",
      timezone: "auto",
    });
    const weather = await fetchJsonWithTimeout<OpenMeteoResponse>(
      `https://api.open-meteo.com/v1/forecast?${params.toString()}`,
      undefined,
      8_000,
    );
    const currentTemperature = weather.current?.temperature_2m;
    const weatherCode = weather.current?.weather_code;
    const minTemperature = weather.daily?.temperature_2m_min?.[0];
    const maxTemperature = weather.daily?.temperature_2m_max?.[0];
    if (![currentTemperature, weatherCode, minTemperature, maxTemperature].every((value) => typeof value === "number")) {
      throw new Error("Weather data is incomplete");
    }

    return {
      locationLabel: location.city?.trim() || "当前位置",
      weatherAvailable: true,
      weather: WEATHER_LABELS[weatherCode as number] ?? "天气",
      temperature: `${Math.round(currentTemperature as number)}°C`,
      forecast: `今日 ${Math.round(minTemperature as number)}°C - ${Math.round(maxTemperature as number)}°C`,
    };
  } catch {
    return unavailableSnapshot;
  }
};

const getCachedSnapshot = async (now: Date): Promise<WeatherSnapshot> => {
  if (weatherCache && weatherCache.expiresAt > now.getTime()) {
    return weatherCache.snapshot;
  }
  if (!weatherRequest) {
    weatherRequest = fetchWeatherSnapshot();
  }
  try {
    const snapshot = await weatherRequest;
    weatherCache = { snapshot, expiresAt: now.getTime() + WEATHER_CACHE_TTL_MS };
    return snapshot;
  } finally {
    weatherRequest = null;
  }
};

export function resetClockWeatherCache(): void {
  weatherCache = null;
  weatherRequest = null;
}

export const clockWeatherProvider: DashboardProvider<ClockWeatherData> = {
  async getData(now) {
    const snapshot = await getCachedSnapshot(now);
    return createData(now, snapshot, snapshot.weatherAvailable ? "ready" : "unavailable");
  },
};
