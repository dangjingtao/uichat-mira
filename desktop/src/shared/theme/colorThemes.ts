import { generate } from "@ant-design/colors";

export type ThemePresetId =
  | "warm-neutral"
  | "knowledge-blue"
  | "archive-green"
  | "slate-ocean";

type ThemeMode = "light" | "dark";

type StatusSemanticScale = {
  solid: string;
  soft: string;
  border: string;
  text: string;
};

type SemanticThemeValues = {
  cloudy: [
    string,
    string,
    string,
    string,
    string,
    string,
    string,
    string,
    string,
  ];
  pampas: [
    string,
    string,
    string,
    string,
    string,
    string,
    string,
    string,
    string,
  ];
  surface: {
    primary: string;
    auth: string;
    secondary: string;
    tertiary: string;
    elevated: string;
  };
  border: string;
  text: {
    primary: string;
    secondary: string;
    tertiary: string;
    inverted: string;
  };
  icon: {
    primary: string;
    secondary: string;
    tertiary: string;
    inverted: string;
  };
  secondary: string;
  status: {
    success: StatusSemanticScale;
    warning: StatusSemanticScale;
    danger: StatusSemanticScale;
    info: StatusSemanticScale;
  };
};

export interface ThemePreset {
  id: ThemePresetId;
  label: string;
  description: string;
  seed: string;
  lightPalette: string[];
  darkPalette: string[];
  semantic: Record<ThemeMode, SemanticThemeValues>;
}

const DARK_BACKGROUND = "#1c1a18";

const hexToRgbTriplet = (hex: string) => {
  const normalized = hex.replace("#", "");
  const fullHex =
    normalized.length === 3
      ? normalized
          .split("")
          .map((char) => `${char}${char}`)
          .join("")
      : normalized;

  const numericValue = parseInt(fullHex, 16);
  const red = (numericValue >> 16) & 255;
  const green = (numericValue >> 8) & 255;
  const blue = numericValue & 255;

  return `${red} ${green} ${blue}`;
};

const buildPrimaryVariables = (
  palette: string[],
  mode: ThemeMode,
): Record<string, string> => {
  const activeIndex = mode === "dark" ? 6 : 5;
  const hoverIndex = mode === "dark" ? 5 : 6;

  return {
    "--color-primary": hexToRgbTriplet(palette[activeIndex]),
    "--color-primary-hover": hexToRgbTriplet(palette[hoverIndex]),
    "--color-primary-1": hexToRgbTriplet(palette[0]),
    "--color-primary-2": hexToRgbTriplet(palette[1]),
    "--color-primary-3": hexToRgbTriplet(palette[2]),
    "--color-primary-4": hexToRgbTriplet(palette[3]),
    "--color-primary-5": hexToRgbTriplet(palette[4]),
    "--color-primary-6": hexToRgbTriplet(palette[5]),
    "--color-primary-7": hexToRgbTriplet(palette[6]),
    "--color-primary-8": hexToRgbTriplet(palette[7]),
    "--color-primary-9": hexToRgbTriplet(palette[8]),
  };
};

const buildSemanticVariables = (values: SemanticThemeValues) => ({
  "--color-cloudy": hexToRgbTriplet(values.cloudy[4]),
  "--color-cloudy-1": hexToRgbTriplet(values.cloudy[0]),
  "--color-cloudy-2": hexToRgbTriplet(values.cloudy[1]),
  "--color-cloudy-3": hexToRgbTriplet(values.cloudy[2]),
  "--color-cloudy-4": hexToRgbTriplet(values.cloudy[3]),
  "--color-cloudy-5": hexToRgbTriplet(values.cloudy[4]),
  "--color-cloudy-6": hexToRgbTriplet(values.cloudy[5]),
  "--color-cloudy-7": hexToRgbTriplet(values.cloudy[6]),
  "--color-cloudy-8": hexToRgbTriplet(values.cloudy[7]),
  "--color-cloudy-9": hexToRgbTriplet(values.cloudy[8]),
  "--color-pampas": hexToRgbTriplet(values.pampas[3]),
  "--color-pampas-1": hexToRgbTriplet(values.pampas[0]),
  "--color-pampas-2": hexToRgbTriplet(values.pampas[1]),
  "--color-pampas-3": hexToRgbTriplet(values.pampas[2]),
  "--color-pampas-4": hexToRgbTriplet(values.pampas[3]),
  "--color-pampas-5": hexToRgbTriplet(values.pampas[4]),
  "--color-pampas-6": hexToRgbTriplet(values.pampas[5]),
  "--color-pampas-7": hexToRgbTriplet(values.pampas[6]),
  "--color-pampas-8": hexToRgbTriplet(values.pampas[7]),
  "--color-pampas-9": hexToRgbTriplet(values.pampas[8]),
  "--color-secondary": hexToRgbTriplet(values.secondary),
  "--color-surface-primary": hexToRgbTriplet(values.surface.primary),
  "--color-surface-auth": hexToRgbTriplet(values.surface.auth),
  "--color-surface-secondary": hexToRgbTriplet(values.surface.secondary),
  "--color-surface-tertiary": hexToRgbTriplet(values.surface.tertiary),
  "--color-surface-elevated": hexToRgbTriplet(values.surface.elevated),
  "--color-border": hexToRgbTriplet(values.border),
  "--color-text-primary": hexToRgbTriplet(values.text.primary),
  "--color-text-secondary": hexToRgbTriplet(values.text.secondary),
  "--color-text-tertiary": hexToRgbTriplet(values.text.tertiary),
  "--color-text-inverted": hexToRgbTriplet(values.text.inverted),
  "--color-icon-primary": hexToRgbTriplet(values.icon.primary),
  "--color-icon-secondary": hexToRgbTriplet(values.icon.secondary),
  "--color-icon-tertiary": hexToRgbTriplet(values.icon.tertiary),
  "--color-icon-inverted": hexToRgbTriplet(values.icon.inverted),
  "--color-success": hexToRgbTriplet(values.status.success.solid),
  "--color-success-soft": hexToRgbTriplet(values.status.success.soft),
  "--color-success-border": hexToRgbTriplet(values.status.success.border),
  "--color-success-text": hexToRgbTriplet(values.status.success.text),
  "--color-warning": hexToRgbTriplet(values.status.warning.solid),
  "--color-warning-soft": hexToRgbTriplet(values.status.warning.soft),
  "--color-warning-border": hexToRgbTriplet(values.status.warning.border),
  "--color-warning-text": hexToRgbTriplet(values.status.warning.text),
  "--color-danger": hexToRgbTriplet(values.status.danger.solid),
  "--color-danger-soft": hexToRgbTriplet(values.status.danger.soft),
  "--color-danger-border": hexToRgbTriplet(values.status.danger.border),
  "--color-danger-text": hexToRgbTriplet(values.status.danger.text),
  "--color-info": hexToRgbTriplet(values.status.info.solid),
  "--color-info-soft": hexToRgbTriplet(values.status.info.soft),
  "--color-info-border": hexToRgbTriplet(values.status.info.border),
  "--color-info-text": hexToRgbTriplet(values.status.info.text),
});

const sharedStatusTokens: Record<
  ThemeMode,
  SemanticThemeValues["status"]
> = {
  light: {
    success: {
      solid: "#4C8F63",
      soft: "#EEF6F1",
      border: "#C6DDCD",
      text: "#356B49",
    },
    warning: {
      solid: "#B9892F",
      soft: "#FBF5E8",
      border: "#E7D6AE",
      text: "#7D6224",
    },
    danger: {
      solid: "#C46863",
      soft: "#FBEEEE",
      border: "#E4C0BE",
      text: "#8E4542",
    },
    info: {
      solid: "#5A7E9C",
      soft: "#EEF4F8",
      border: "#CBD9E4",
      text: "#3F607C",
    },
  },
  dark: {
    success: {
      solid: "#6FB388",
      soft: "#1E2A22",
      border: "#365240",
      text: "#9AD3AD",
    },
    warning: {
      solid: "#D1A85A",
      soft: "#2B2417",
      border: "#5A4A2A",
      text: "#E4C27E",
    },
    danger: {
      solid: "#D07A75",
      soft: "#2C1E1D",
      border: "#5C3634",
      text: "#E2A19D",
    },
    info: {
      solid: "#7FA5C1",
      soft: "#1D252C",
      border: "#38506A",
      text: "#A9C3D8",
    },
  },
};

const createThemePreset = (
  id: ThemePresetId,
  label: string,
  description: string,
  seed: string,
  semantic: Record<ThemeMode, SemanticThemeValues>,
): ThemePreset => ({
  id,
  label,
  description,
  seed,
  lightPalette: generate(seed).slice(0, 9),
  darkPalette: generate(seed, {
    theme: "dark",
    backgroundColor: DARK_BACKGROUND,
  }).slice(0, 9),
  semantic,
});

export const themePresets: ThemePreset[] = [
  createThemePreset(
    "warm-neutral",
    "暖陶米色",
    "保留当前产品的纸张感与亲和度，适合长时间阅读、配置和复盘。",
    "#C15F3C",
    {
      light: {
        cloudy: [
          "#faf9f7",
          "#f2f0ec",
          "#e5e1da",
          "#d3cec5",
          "#b1ada1",
          "#949085",
          "#79766c",
          "#5d5a52",
          "#43413a",
        ],
        pampas: [
          "#fffefe",
          "#fcfbf8",
          "#f8f6f1",
          "#f2efe8",
          "#e6e1d8",
          "#d5cfc4",
          "#bbb4a8",
          "#9b9488",
          "#797264",
        ],
        surface: {
          primary: "#fffefd",
          auth: "#faf9f5",
          secondary: "#f8f8f6",
          tertiary: "#f7f7f5",
          elevated: "#fdfbf8",
        },
        border: "#d7d0c5",
        text: {
          primary: "#1f1b18",
          secondary: "#575149",
          tertiary: "#776f66",
          inverted: "#fafafa",
        },
        icon: {
          primary: "#1f1b18",
          secondary: "#575149",
          tertiary: "#8f867c",
          inverted: "#fafafa",
        },
        secondary: "#64748b",
        status: sharedStatusTokens.light,
      },
      dark: {
        cloudy: [
          "#302e2a",
          "#403d38",
          "#524e48",
          "#67635c",
          "#7c786f",
          "#949085",
          "#b1ada1",
          "#cdc9be",
          "#e8e5de",
        ],
        pampas: [
          "#282521",
          "#33302b",
          "#403b35",
          "#4f4942",
          "#655f57",
          "#80796f",
          "#a0978c",
          "#c8c0b4",
          "#f3efe8",
        ],
        surface: {
          primary: "#181614",
          auth: "#201d1a",
          secondary: "#201d1a",
          tertiary: "#2a2724",
          elevated: "#1c1917",
        },
        border: "#605952",
        text: {
          primary: "#f3efe8",
          secondary: "#c7c0b5",
          tertiary: "#a1978c",
          inverted: "#18181b",
        },
        icon: {
          primary: "#f3efe8",
          secondary: "#c7c0b5",
          tertiary: "#a1978c",
          inverted: "#18181b",
        },
        secondary: "#94a3b8",
        status: sharedStatusTokens.dark,
      },
    },
  ),
  createThemePreset(
    "knowledge-blue",
    "铁墨紫灰",
    "以低饱和铁墨紫灰建立专业、安静且有判断力的界面气质，适合检索、引用与长时间阅读。",
    "#686674",
    {
      light: {
        cloudy: [
          "#f7f7fa",
          "#ececf2",
          "#dadae5",
          "#c5c6d3",
          "#a1a2b1",
          "#858694",
          "#6c6d79",
          "#52525d",
          "#3a3a43",
        ],
        pampas: [
          "#fefeff",
          "#f8f8fc",
          "#f1f1f8",
          "#e8e8f2",
          "#d8d9e6",
          "#c4c5d5",
          "#a8a9bb",
          "#88899b",
          "#646579",
        ],
        surface: {
          primary: "#fdfdff",
          auth: "#f5f5fa",
          secondary: "#f6f6f8",
          tertiary: "#f5f5f7",
          elevated: "#f8f8fd",
        },
        border: "#c5c6d7",
        text: {
          primary: "#18181f",
          secondary: "#494a57",
          tertiary: "#666777",
          inverted: "#fbfaf8",
        },
        icon: {
          primary: "#18181f",
          secondary: "#494a57",
          tertiary: "#7c7d8f",
          inverted: "#fbfaf8",
        },
        secondary: "#64668b",
        status: sharedStatusTokens.light,
      },
      dark: {
        cloudy: [
          "#262228",
          "#2f2b33",
          "#3b3740",
          "#4d4854",
          "#66606e",
          "#837b8c",
          "#a59dac",
          "#cbc4cf",
          "#efeaef",
        ],
        pampas: [
          "#1f1b21",
          "#262128",
          "#312c34",
          "#3d3842",
          "#534d59",
          "#6d6676",
          "#8f8898",
          "#b7b0be",
          "#dfdbe2",
        ],
        surface: {
          primary: "#18161b",
          auth: "#201d23",
          secondary: "#201d23",
          tertiary: "#29252d",
          elevated: "#1c191f",
        },
        border: "#4f4857",
        text: {
          primary: "#f2edf2",
          secondary: "#c4bdc9",
          tertiary: "#9a92a3",
          inverted: "#151218",
        },
        icon: {
          primary: "#f2edf2",
          secondary: "#c4bdc9",
          tertiary: "#9a92a3",
          inverted: "#151218",
        },
        secondary: "#9d95a9",
        status: sharedStatusTokens.dark,
      },
    },
  ),
  createThemePreset(
    "archive-green",
    "档案松绿",
    "用柔和鼠尾草与纸张灰绿搭配，更适合文档、索引、知识资产整理场景。",
    "#3E8F6A",
    {
      light: {
        cloudy: [
          "#f7faf7",
          "#ecf2ec",
          "#dae5da",
          "#c5d3c5",
          "#a1b1a1",
          "#859485",
          "#6c796c",
          "#525d52",
          "#3a433a",
        ],
        pampas: [
          "#fefffe",
          "#f8fcf8",
          "#f1f8f1",
          "#e8f2e8",
          "#d8e6d8",
          "#c4d5c4",
          "#a8bba8",
          "#889b88",
          "#647964",
        ],
        surface: {
          primary: "#fdfffd",
          auth: "#f5faf5",
          secondary: "#f6f8f6",
          tertiary: "#f5f7f5",
          elevated: "#f8fdf8",
        },
        border: "#c5d7c5",
        text: {
          primary: "#181f18",
          secondary: "#495749",
          tertiary: "#667766",
          inverted: "#fafcf8",
        },
        icon: {
          primary: "#181f18",
          secondary: "#495749",
          tertiary: "#7c8f7c",
          inverted: "#fafcf8",
        },
        secondary: "#658b64",
        status: sharedStatusTokens.light,
      },
      dark: {
        cloudy: [
          "#21241f",
          "#283028",
          "#333d33",
          "#455145",
          "#5b695b",
          "#768576",
          "#96a595",
          "#bcc9bc",
          "#e4ece4",
        ],
        pampas: [
          "#1d211c",
          "#242923",
          "#2f352e",
          "#3b433a",
          "#4f5a4f",
          "#687568",
          "#899789",
          "#b1bfb1",
          "#dbe6db",
        ],
        surface: {
          primary: "#171b16",
          auth: "#1d231c",
          secondary: "#1d231c",
          tertiary: "#262f26",
          elevated: "#1a201a",
        },
        border: "#414d42",
        text: {
          primary: "#edf3ed",
          secondary: "#b6c3b6",
          tertiary: "#8e9a8f",
          inverted: "#121612",
        },
        icon: {
          primary: "#edf3ed",
          secondary: "#b6c3b6",
          tertiary: "#8e9a8f",
          inverted: "#121612",
        },
        secondary: "#92a291",
        status: sharedStatusTokens.dark,
      },
    },
  ),
  createThemePreset(
    "slate-ocean",
    "海石灰蓝",
    "把页面基底收成更理性的海雾灰蓝，适合工作台、配置面板和企业内部工具。",
    "#3A6E8C",
    {
      light: {
        cloudy: [
          "#f8fafb",
          "#edf2f4",
          "#dee6ea",
          "#c5d0d6",
          "#a7b5be",
          "#8796a1",
          "#697a84",
          "#50606a",
          "#384650",
        ],
        pampas: [
          "#fffefe",
          "#f9fbfc",
          "#f1f5f7",
          "#eaf0f3",
          "#dae4e8",
          "#c8d4d9",
          "#afbcc3",
          "#8e9ca5",
          "#6c7a83",
        ],
        surface: {
          primary: "#fffefd",
          auth: "#f2f6f8",
          secondary: "#f3f7f9",
          tertiary: "#edf2f5",
          elevated: "#f9fbfc",
        },
        border: "#cbd6dc",
        text: {
          primary: "#20262c",
          secondary: "#53646d",
          tertiary: "#758992",
          inverted: "#fafcfc",
        },
        icon: {
          primary: "#20262c",
          secondary: "#53646d",
          tertiary: "#8398a2",
          inverted: "#fafcfc",
        },
        secondary: "#6b838f",
        status: sharedStatusTokens.light,
      },
      dark: {
        cloudy: [
          "#212425",
          "#283034",
          "#344045",
          "#46545c",
          "#5d6a72",
          "#78858d",
          "#99a9b0",
          "#bfcdd2",
          "#e6eef1",
        ],
        pampas: [
          "#1d2022",
          "#242a2d",
          "#2e363a",
          "#3b464b",
          "#505d63",
          "#69787f",
          "#8999a1",
          "#b1c0c6",
          "#dae5e8",
        ],
        surface: {
          primary: "#171a1c",
          auth: "#1d2326",
          secondary: "#1d2326",
          tertiary: "#262f33",
          elevated: "#1a1f21",
        },
        border: "#404d54",
        text: {
          primary: "#eef4f5",
          secondary: "#b8c3c8",
          tertiary: "#909ca2",
          inverted: "#131719",
        },
        icon: {
          primary: "#eef4f5",
          secondary: "#b8c3c8",
          tertiary: "#909ca2",
          inverted: "#131719",
        },
        secondary: "#90a0a8",
        status: sharedStatusTokens.dark,
      },
    },
  ),
];

export const defaultThemePresetId: ThemePresetId = "warm-neutral";

export const themePresetMap = Object.fromEntries(
  themePresets.map((theme) => [theme.id, theme]),
) as Record<ThemePresetId, ThemePreset>;

export const getThemeVariables = (themeId: ThemePresetId, mode: ThemeMode) => {
  const preset =
    themePresetMap[themeId] ?? themePresetMap[defaultThemePresetId];

  return {
    ...buildPrimaryVariables(
      mode === "dark" ? preset.darkPalette : preset.lightPalette,
      mode,
    ),
    ...buildSemanticVariables(preset.semantic[mode]),
  };
};
