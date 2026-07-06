import { describe, expect, it } from "vitest";
import {
  themePresets,
  themePresetMap,
  defaultThemePresetId,
  getThemeVariables,
  type ThemePresetId,
} from "../colorThemes";

const EXPECTED_VARIABLES = [
  "--color-primary",
  "--color-primary-hover",
  "--color-cloudy",
  "--color-pampas",
  "--color-surface-primary",
  "--color-text-primary",
  "--color-icon-primary",
  "--color-success",
  "--color-warning",
  "--color-danger",
  "--color-info",
];

describe("colorThemes", () => {
  it("themePresets 包含 4 个预设主题", () => {
    expect(themePresets).toHaveLength(4);
    expect(themePresets.map((t) => t.id)).toEqual([
      "warm-neutral",
      "knowledge-blue",
      "archive-green",
      "slate-ocean",
    ]);
  });

  it("themePresetMap 以 id 为键索引", () => {
    expect(themePresetMap["warm-neutral"].id).toBe("warm-neutral");
    expect(themePresetMap["slate-ocean"].label).toBe("海石灰蓝");
  });

  it("defaultThemePresetId 为 warm-neutral", () => {
    expect(defaultThemePresetId).toBe("warm-neutral");
  });

  it("getThemeVariables 输出预期 CSS 变量", () => {
    const vars = getThemeVariables("warm-neutral", "light");

    EXPECTED_VARIABLES.forEach((key) => {
      expect(vars).toHaveProperty(key);
      expect(typeof vars[key]).toBe("string");
    });
  });

  it("light 与 dark 模式 primary 变量不同", () => {
    const light = getThemeVariables("warm-neutral", "light");
    const dark = getThemeVariables("warm-neutral", "dark");

    expect(light["--color-primary"]).not.toBe(dark["--color-primary"]);
  });

  it("不同主题生成不同 primary 变量", () => {
    const warm = getThemeVariables("warm-neutral", "light");
    const blue = getThemeVariables("knowledge-blue", "light");

    expect(warm["--color-primary"]).not.toBe(blue["--color-primary"]);
  });

  it("无效主题 id 回退到默认主题", () => {
    const vars = getThemeVariables("unknown" as ThemePresetId, "light");
    const defaultVars = getThemeVariables("warm-neutral", "light");

    expect(vars).toEqual(defaultVars);
  });
});
