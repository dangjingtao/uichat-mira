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

interface ThemeContextValue {
  colorTheme: ThemePresetId;
  setColorTheme: (themeId: ThemePresetId) => void;
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

const applyThemeToDocument = (themeId: ThemePresetId) => {
  const root = document.documentElement;
  const isDark = root.classList.contains("dark");
  const variables = getThemeVariables(themeId, isDark ? "dark" : "light");

  Object.entries(variables).forEach(([name, value]) => {
    root.style.setProperty(name, value);
  });

  root.setAttribute("data-color-theme", themeId);
};

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [colorTheme, setColorThemeState] = useState<ThemePresetId>(() =>
    readStoredColorTheme(),
  );

  useEffect(() => {
    applyThemeToDocument(colorTheme);
    globalThis.localStorage.setItem(COLOR_THEME_STORAGE_KEY, colorTheme);

    const observer = new MutationObserver(() => {
      applyThemeToDocument(colorTheme);
    });

    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["class"],
    });

    return () => {
      observer.disconnect();
    };
  }, [colorTheme]);

  const value = useMemo<ThemeContextValue>(
    () => ({
      colorTheme,
      setColorTheme: setColorThemeState,
      themePresets,
    }),
    [colorTheme],
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
