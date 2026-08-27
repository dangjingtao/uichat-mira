import "qweather-icons/font/qweather-icons.css";

export const SUPPORTED_WMO_WEATHER_CODES = [
  0, 1, 2, 3, 45, 48, 51, 53, 55, 56, 57, 61, 63, 65, 66, 67, 71, 73, 75, 77, 80, 81, 82, 85, 86, 95, 96, 99,
] as const;

type WmoWeatherCode = (typeof SUPPORTED_WMO_WEATHER_CODES)[number];
type DayNightIcon = Readonly<{ day: string; night: string }>;

const sameIcon = (code: string): DayNightIcon => ({ day: code, night: code });

/** Open-Meteo WMO weather codes mapped explicitly to QWeather's outlined icon codes. */
const QWEATHER_ICON_BY_WMO_CODE: Record<WmoWeatherCode, DayNightIcon> = {
  0: { day: "100", night: "150" },
  1: { day: "102", night: "152" },
  2: { day: "103", night: "153" },
  3: sameIcon("104"),
  45: sameIcon("501"),
  48: sameIcon("509"),
  51: sameIcon("309"),
  53: sameIcon("305"),
  55: sameIcon("306"),
  56: sameIcon("313"),
  57: sameIcon("313"),
  61: sameIcon("305"),
  63: sameIcon("306"),
  65: sameIcon("307"),
  66: sameIcon("313"),
  67: sameIcon("313"),
  71: sameIcon("400"),
  73: sameIcon("401"),
  75: sameIcon("402"),
  77: sameIcon("499"),
  80: { day: "300", night: "350" },
  81: { day: "300", night: "350" },
  82: { day: "301", night: "351" },
  85: { day: "407", night: "457" },
  86: { day: "407", night: "457" },
  95: sameIcon("302"),
  96: sameIcon("304"),
  99: sameIcon("304"),
};

function isSupportedWmoWeatherCode(weatherCode: number): weatherCode is WmoWeatherCode {
  return Object.prototype.hasOwnProperty.call(QWEATHER_ICON_BY_WMO_CODE, weatherCode);
}

export function resolveQWeatherIconCode(weatherCode: number | null, isDay: boolean | null): string {
  if (weatherCode === null || !isSupportedWmoWeatherCode(weatherCode)) return "999";

  return QWEATHER_ICON_BY_WMO_CODE[weatherCode][isDay === false ? "night" : "day"];
}

export function WeatherIcon({ weatherCode, isDay }: { weatherCode: number | null; isDay: boolean | null }) {
  const iconCode = resolveQWeatherIconCode(weatherCode, isDay);

  return (
    <span className="flex h-16 w-16 shrink-0 items-center justify-center text-primary" aria-hidden="true">
      <i className={`qi-${iconCode} text-[3.5rem] leading-none`} />
    </span>
  );
}
