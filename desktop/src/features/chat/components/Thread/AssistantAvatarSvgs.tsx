import type { SVGProps } from "react";

type AvatarSvgProps = SVGProps<SVGSVGElement>;

const color = {
  paper: "rgb(var(--color-surface-primary))",
  mist: "rgb(var(--color-surface-elevated))",
  line: "rgb(var(--color-text-primary))",
  softLine: "rgb(var(--color-text-secondary))",
  accent: "rgb(var(--color-primary))",
  accentSoft: "rgb(var(--color-primary-3))",
  accentWarm: "rgb(var(--color-primary-4))",
  border: "rgb(var(--color-border))",
};

export function AssistantAvatarSvgA(props: AvatarSvgProps) {
  return (
    <svg viewBox="0 0 64 64" fill="none" aria-hidden="true" {...props}>
      <rect x="5" y="5" width="54" height="54" rx="18" fill={color.paper} />
      <rect
        x="5.5"
        y="5.5"
        width="53"
        height="53"
        rx="17.5"
        stroke={color.border}
        opacity="0.7"
      />
      <path
        d="M20 25.5C20 17.9 25.7 13 32.8 13C40.9 13 46 18.3 46 25.8C46 29.8 44.8 33.4 42.2 36.3C39.7 39 36.6 40.7 33.2 42.9C30.8 44.4 29.1 46 28.1 48.7"
        stroke={color.accent}
        strokeWidth="3"
        strokeLinecap="round"
      />
      <path
        d="M18 28.3C20.8 24.1 25.2 21.4 30.4 21.4C36.9 21.4 41.9 25.6 43.8 31.7"
        stroke={color.line}
        strokeWidth="2.8"
        strokeLinecap="round"
        opacity="0.9"
      />
      <path
        d="M25.2 30.9C26.9 28.6 29.5 27.1 32.6 27.1C36 27.1 38.7 28.8 40.2 31.5"
        stroke={color.softLine}
        strokeWidth="2.4"
        strokeLinecap="round"
      />
      <circle cx="28.3" cy="34.6" r="2.2" fill={color.line} />
      <circle cx="37.1" cy="34.6" r="2.2" fill={color.line} />
      <path
        d="M28 42.5C29.6 44.1 31.2 44.9 33.2 44.9C35.3 44.9 37.1 44.1 38.9 42.4"
        stroke={color.line}
        strokeWidth="2.6"
        strokeLinecap="round"
      />
      <path
        d="M14 49.5C18.3 45.9 23.6 44 29.8 44H35.2C41.1 44 46.1 45.8 50 49.2"
        stroke={color.accentSoft}
        strokeWidth="3"
        strokeLinecap="round"
        opacity="0.95"
      />
    </svg>
  );
}

export function AssistantAvatarSvgB(props: AvatarSvgProps) {
  return (
    <svg viewBox="0 0 64 64" fill="none" aria-hidden="true" {...props}>
      <rect x="5" y="5" width="54" height="54" rx="18" fill={color.paper} />
      <rect
        x="5.5"
        y="5.5"
        width="53"
        height="53"
        rx="17.5"
        stroke={color.border}
        opacity="0.72"
      />
      <path
        d="M20 23.5C23.4 16.8 30 13.8 37.3 13.8C41.4 13.8 45.2 14.9 48.2 17.2"
        stroke={color.accent}
        strokeWidth="3"
        strokeLinecap="round"
      />
      <path
        d="M41.8 17.8C45.4 21.1 47.3 25.5 47.3 30.7C47.3 37.7 43.3 43.6 36.8 46.8L40.7 50.9"
        stroke={color.line}
        strokeWidth="2.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M35.9 23.7C34.4 21.8 31.8 20.7 29.1 20.7C24.2 20.7 20.5 24 20.5 28.7C20.5 33.3 24 36.7 28.8 36.7H35.8"
        stroke={color.softLine}
        strokeWidth="2.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M25.9 28.6H37.4"
        stroke={color.line}
        strokeWidth="2.8"
        strokeLinecap="round"
      />
      <path
        d="M24 43.5H31"
        stroke={color.accentWarm}
        strokeWidth="2.8"
        strokeLinecap="round"
      />
      <circle cx="22.4" cy="43.5" r="1.8" fill={color.accent} />
      <path
        d="M17 49.5C19.2 47.2 21.8 45.5 24.8 44.5"
        stroke={color.border}
        strokeWidth="2.4"
        strokeLinecap="round"
      />
    </svg>
  );
}

export function AssistantAvatarSvgC(props: AvatarSvgProps) {
  return (
    <svg viewBox="0 0 64 64" fill="none" aria-hidden="true" {...props}>
      <rect x="5" y="5" width="54" height="54" rx="18" fill={color.paper} />
      <rect
        x="5.5"
        y="5.5"
        width="53"
        height="53"
        rx="17.5"
        stroke={color.border}
        opacity="0.72"
      />
      <circle cx="32" cy="31.5" r="14.5" fill={color.mist} opacity="0.9" />
      <path
        d="M20.5 28.5C22.7 22.3 27.4 18.5 33.4 18.5C37.2 18.5 40.4 19.9 43 22.1"
        stroke={color.line}
        strokeWidth="2.8"
        strokeLinecap="round"
      />
      <path
        d="M24.3 31.7C24.3 26.5 27.7 23.2 32.1 23.2C36.6 23.2 40 26.5 40 31.7V34C40 38.9 36.5 42.2 32.1 42.2C27.7 42.2 24.3 38.9 24.3 34V31.7Z"
        stroke={color.softLine}
        strokeWidth="2.5"
      />
      <circle cx="28.7" cy="32.9" r="1.9" fill={color.line} />
      <circle cx="35.7" cy="32.9" r="1.9" fill={color.line} />
      <path
        d="M28.9 38.1C30 39 31 39.5 32.2 39.5C33.5 39.5 34.7 39 35.9 38"
        stroke={color.accent}
        strokeWidth="2.6"
        strokeLinecap="round"
      />
      <path
        d="M18.5 49C21.4 45.7 25.5 43.9 30.7 43.6"
        stroke={color.accentWarm}
        strokeWidth="2.8"
        strokeLinecap="round"
      />
      <path
        d="M38.1 17L41.1 14L43 17.2L46.5 17.8L44.2 20.4L44.6 24L41.1 22.4L37.9 24L38.3 20.5L36.1 18Z"
        fill={color.accentSoft}
        opacity="0.95"
      />
    </svg>
  );
}

export const assistantAvatarVariants = {
  a: AssistantAvatarSvgA,
  b: AssistantAvatarSvgB,
  c: AssistantAvatarSvgC,
} as const;

export type AssistantAvatarVariant = keyof typeof assistantAvatarVariants;
