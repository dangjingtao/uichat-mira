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
          "#fffefd",
          "#fbfaf7",
          "#f7f5f1",
          "#f4f3ee",
          "#ebe8e1",
          "#dcd8d0",
          "#c6c1b8",
          "#a49f97",
          "#7f7b74",
        ],
        surface: {
          primary: "#fffefd",
          secondary: "#faf9f5",
          tertiary: "#efebe3",
          elevated: "#fcfaf6",
        },
        border: "#e0dad1",
        text: {
          primary: "#211d19",
          secondary: "#605951",
          tertiary: "#847c73",
          inverted: "#fafafa",
        },
        icon: {
          primary: "#211d19",
          secondary: "#605951",
          tertiary: "#9a9187",
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
          "#2a2723",
          "#36332e",
          "#44403a",
          "#545049",
          "#6c675f",
          "#88827a",
          "#a8a197",
          "#cdc7bd",
          "#f4f3ee",
        ],
        surface: {
          primary: "#1c1a18",
          secondary: "#23211f",
          tertiary: "#2f2c29",
          elevated: "#201e1c",
        },
        border: "#544f49",
        text: {
          primary: "#f4f3ee",
          secondary: "#c4bfb6",
          tertiary: "#9c958d",
          inverted: "#18181b",
        },
        icon: {
          primary: "#f4f3ee",
          secondary: "#c4bfb6",
          tertiary: "#9c958d",
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
    "#6E5E7D",
    {
      light: {
        cloudy: [
          "#f9f9fb",
          "#efeff3",
          "#e1e2e8",
          "#cbccd6",
          "#aaabb5",
          "#888993",
          "#696a75",
          "#4d4e58",
          "#363741",
        ],
        pampas: [
          "#fffefe",
          "#fbfbfc",
          "#f5f5f8",
          "#efeff3",
          "#e3e4ea",
          "#d0d2db",
          "#b5b7c2",
          "#9799a6",
          "#747581",
        ],
        surface: {
          primary: "#fffefe",
          secondary: "#f8f8fb",
          tertiary: "#eeeef2",
          elevated: "#fcfbfe",
        },
        border: "#dadbe4",
        text: {
          primary: "#24262f",
          secondary: "#5f6171",
          tertiary: "#838695",
          inverted: "#faf9fd",
        },
        icon: {
          primary: "#24262f",
          secondary: "#5f6171",
          tertiary: "#9193a3",
          inverted: "#faf9fd",
        },
        secondary: "#707284",
        status: sharedStatusTokens.light,
      },
      dark: {
        cloudy: [
          "#26222a",
          "#2f2b35",
          "#3b3642",
          "#4d4758",
          "#655f70",
          "#827b8f",
          "#a49dae",
          "#cac4d2",
          "#ede9f1",
        ],
        pampas: [
          "#1f1b22",
          "#262129",
          "#302b34",
          "#3c3641",
          "#524b59",
          "#6c6474",
          "#8d8697",
          "#b5afbd",
          "#ddd9e3",
        ],
        surface: {
          primary: "#19161d",
          secondary: "#211d26",
          tertiary: "#2b2631",
          elevated: "#1d1921",
        },
        border: "#4d4557",
        text: {
          primary: "#f1edf4",
          secondary: "#c2bcc9",
          tertiary: "#978fa1",
          inverted: "#141117",
        },
        icon: {
          primary: "#f1edf4",
          secondary: "#c2bcc9",
          tertiary: "#978fa1",
          inverted: "#141117",
        },
        secondary: "#9b92a8",
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
          "#f6f8f5",
          "#eef2ed",
          "#dde4dc",
          "#c5d0c4",
          "#a7b5a6",
          "#879886",
          "#697868",
          "#4d5b4d",
          "#353f35",
        ],
        pampas: [
          "#fefefc",
          "#f8faf6",
          "#f1f5ee",
          "#ebf0e6",
          "#dde5d7",
          "#cdd8c6",
          "#b2c0ae",
          "#8f9f8d",
          "#6d7d6c",
        ],
        surface: {
          primary: "#fefefc",
          secondary: "#f5f8f2",
          tertiary: "#ebf0e6",
          elevated: "#fbfdf9",
        },
        border: "#d7e0d1",
        text: {
          primary: "#20271f",
          secondary: "#586657",
          tertiary: "#7a8979",
          inverted: "#f9fcf8",
        },
        icon: {
          primary: "#20271f",
          secondary: "#586657",
          tertiary: "#8c9b8a",
          inverted: "#f9fcf8",
        },
        secondary: "#6d7d6c",
        status: sharedStatusTokens.light,
      },
      dark: {
        cloudy: [
          "#212520",
          "#273028",
          "#313c33",
          "#435045",
          "#59695b",
          "#758577",
          "#95a696",
          "#bbc9bc",
          "#e3ece3",
        ],
        pampas: [
          "#1d211c",
          "#232923",
          "#2d352d",
          "#39433a",
          "#4d5a4f",
          "#667567",
          "#879787",
          "#b0bfb0",
          "#dae6da",
        ],
        surface: {
          primary: "#171b16",
          secondary: "#1d231d",
          tertiary: "#273028",
          elevated: "#1b201b",
        },
        border: "#404c41",
        text: {
          primary: "#edf3ed",
          secondary: "#b5c3b6",
          tertiary: "#8d9b8e",
          inverted: "#121612",
        },
        icon: {
          primary: "#edf3ed",
          secondary: "#b5c3b6",
          tertiary: "#8d9b8e",
          inverted: "#121612",
        },
        secondary: "#8fa290",
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
          "#f7f9fa",
          "#edf2f4",
          "#dce4e8",
          "#c1ccd2",
          "#9daab2",
          "#7d8b94",
          "#61707a",
          "#47545f",
          "#313b44",
        ],
        pampas: [
          "#feffff",
          "#f6fafb",
          "#eef5f7",
          "#e7f0f3",
          "#d8e3e8",
          "#c7d4db",
          "#acbcc5",
          "#899ba7",
          "#677b88",
        ],
        surface: {
          primary: "#fcfeff",
          secondary: "#f3f7f9",
          tertiary: "#e8eff3",
          elevated: "#f9fcfd",
        },
        border: "#d4dfe5",
        text: {
          primary: "#1e252b",
          secondary: "#56656e",
          tertiary: "#7b8a94",
          inverted: "#f8fbfc",
        },
        icon: {
          primary: "#1e252b",
          secondary: "#56656e",
          tertiary: "#8e9ca5",
          inverted: "#f8fbfc",
        },
        secondary: "#6f848f",
        status: sharedStatusTokens.light,
      },
      dark: {
        cloudy: [
          "#212426",
          "#273035",
          "#324046",
          "#44545d",
          "#5a6b74",
          "#74878f",
          "#97aab3",
          "#beced5",
          "#e5eff2",
        ],
        pampas: [
          "#1c2023",
          "#232a2e",
          "#2c363b",
          "#39464d",
          "#4d5d66",
          "#657883",
          "#869aa6",
          "#b0c1ca",
          "#d9e6ea",
        ],
        surface: {
          primary: "#171b1d",
          secondary: "#1d2428",
          tertiary: "#273136",
          elevated: "#1a1f22",
        },
        border: "#3e4d55",
        text: {
          primary: "#edf4f6",
          secondary: "#b7c4c9",
          tertiary: "#8e9da4",
          inverted: "#13171a",
        },
        icon: {
          primary: "#edf4f6",
          secondary: "#b7c4c9",
          tertiary: "#8e9da4",
          inverted: "#13171a",
        },
        secondary: "#8ea1ab",
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
