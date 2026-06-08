/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  darkMode: "class",
  theme: {
    extend: {
      fontFamily: {
        sans: [
          "Inter",
          "ui-sans-serif",
          "system-ui",
          "-apple-system",
          "BlinkMacSystemFont",
          '"Segoe UI"',
          "sans-serif",
        ],
      },
      colors: {
        primary: "rgb(var(--color-primary) / <alpha-value>)",
        "primary-hover": "rgb(var(--color-primary-hover) / <alpha-value>)",
        secondary: "rgb(var(--color-secondary) / <alpha-value>)",
        success: "rgb(var(--color-success) / <alpha-value>)",
        warning: "rgb(var(--color-warning) / <alpha-value>)",
        danger: "rgb(var(--color-danger) / <alpha-value>)",
        info: "rgb(var(--color-info) / <alpha-value>)",
        surface: {
          primary: "rgb(var(--color-surface-primary) / <alpha-value>)",
          secondary: "rgb(var(--color-surface-secondary) / <alpha-value>)",
          tertiary: "rgb(var(--color-surface-tertiary) / <alpha-value>)",
          elevated: "rgb(var(--color-surface-elevated) / <alpha-value>)",
        },
        border: "rgb(var(--color-border) / <alpha-value>)",
        text: {
          primary: "rgb(var(--color-text-primary) / <alpha-value>)",
          secondary: "rgb(var(--color-text-secondary) / <alpha-value>)",
          tertiary: "rgb(var(--color-text-tertiary) / <alpha-value>)",
          inverted: "rgb(var(--color-text-inverted) / <alpha-value>)",
        },
        icon: {
          primary: "rgb(var(--color-icon-primary) / <alpha-value>)",
          secondary: "rgb(var(--color-icon-secondary) / <alpha-value>)",
          tertiary: "rgb(var(--color-icon-tertiary) / <alpha-value>)",
          inverted: "rgb(var(--color-icon-inverted) / <alpha-value>)",
        },
      },
      spacing: {
        "space-1": "4px",
        "space-2": "8px",
        "space-3": "12px",
        "space-4": "16px",
        "space-5": "20px",
        "space-6": "24px",
        "space-8": "32px",
        "space-10": "40px",
      },
      borderRadius: {
        "radius-sm": "8px",
        "radius-md": "10px",
        "radius-lg": "14px",
        "radius-xl": "18px",
        pill: "9999px",
      },
      boxShadow: {
        "shadow-sm":
          "0 1px 2px rgba(15, 23, 42, 0.05), 0 1px 1px rgba(15, 23, 42, 0.03)",
        "shadow-md": "0 8px 24px rgba(15, 23, 42, 0.08)",
        "shadow-lg": "0 16px 40px rgba(15, 23, 42, 0.14)",
        "shadow-xl": "0 24px 60px rgba(15, 23, 42, 0.18)",
      },
      typography: {
        display: {
          fontSize: "28px",
          fontWeight: 600,
          lineHeight: "1.2",
        },
        "heading-1": {
          fontSize: "20px",
          fontWeight: 600,
          lineHeight: "1.3",
        },
        "heading-2": {
          fontSize: "16px",
          fontWeight: 600,
          lineHeight: "1.4",
        },
        body: {
          fontSize: "14px",
          fontWeight: 400,
          lineHeight: "1.6",
        },
        "body-small": {
          fontSize: "13px",
          fontWeight: 400,
          lineHeight: "1.5",
        },
        caption: {
          fontSize: "12px",
          fontWeight: 500,
          lineHeight: "1.4",
        },
      },
      transitionDuration: {
        "duration-150": "150ms",
        "duration-200": "200ms",
      },
    },
  },
  plugins: [],
};
