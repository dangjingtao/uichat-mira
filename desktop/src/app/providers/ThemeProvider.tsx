import React, {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import {
  defaultThemePresetId,
  getThemeVariables,
  themePresetMap,
  themePresets,
  type ThemePreset,
  type ThemePresetId,
} from "@/shared/theme/colorThemes";

const COLOR_THEME_STORAGE_KEY = "uichat-color-theme";
const THEME_MODE_STORAGE_KEY = "uichat-theme-mode";

type ThemeMode = "light" | "dark";

interface ThemeContextValue {
  colorTheme: ThemePresetId;
  setColorTheme: (themeId: ThemePresetId) => void;
  themeMode: ThemeMode;
  setThemeMode: (mode: ThemeMode) => void;
  themePresets: ThemePreset[];
}

const ThemeContext = createContext<ThemeContextValue | undefined>(undefined);

const readStoredColorTheme = (): ThemePresetId => {
  const rawValue = globalThis.localStorage.getItem(COLOR_THEME_STORAGE_KEY);

  if (!rawValue || !(rawValue in themePresetMap)) {
    return defaultThemePresetId;
  }

  return rawValue as ThemePresetId;
};

const readStoredThemeMode = (): ThemeMode => {
  const rawValue = globalThis.localStorage.getItem(THEME_MODE_STORAGE_KEY);

  if (rawValue === "dark" || rawValue === "light") {
    return rawValue;
  }

  return "light";
};

const applyThemeToDocument = (themeId: ThemePresetId, mode: ThemeMode) => {
  const root = document.documentElement;
  root.classList.toggle("dark", mode === "dark");
  const variables = getThemeVariables(themeId, mode);

  Object.entries(variables).forEach(([name, value]) => {
    root.style.setProperty(name, value);
  });

  root.setAttribute("data-color-theme", themeId);
  root.setAttribute("data-theme-mode", mode);
};

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [colorTheme, setColorThemeState] = useState<ThemePresetId>(() =>
    readStoredColorTheme(),
  );
  const [themeMode, setThemeModeState] = useState<ThemeMode>(() =>
    readStoredThemeMode(),
  );

  useEffect(() => {
    applyThemeToDocument(colorTheme, themeMode);
    globalThis.localStorage.setItem(COLOR_THEME_STORAGE_KEY, colorTheme);
    globalThis.localStorage.setItem(THEME_MODE_STORAGE_KEY, themeMode);
  }, [colorTheme, themeMode]);

  const value = useMemo<ThemeContextValue>(
    () => ({
      colorTheme,
      setColorTheme: setColorThemeState,
      themeMode,
      setThemeMode: setThemeModeState,
      themePresets,
    }),
    [colorTheme, themeMode],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
};

export const useThemePreferences = () => {
  const context = useContext(ThemeContext);

  if (!context) {
    throw new Error("useThemePreferences must be used within a ThemeProvider");
  }

  return context;
};
