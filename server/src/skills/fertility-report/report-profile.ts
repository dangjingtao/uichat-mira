import type { FertilityReportProfile } from "./source-config.js";

const DEFAULT_TOKENS = {
  brandName: "圆姐聊女性全周期服务",
  teamName: "Mira 生育健康评估服务团队",
  serviceLine: "备孕从了解自己开始，陪伴你一起接好孕。",
  footerText:
    "本报告用于健康教育、信息整理和就诊准备，不构成诊断、处方或替代生殖专科医生的医疗决策。",
  deliveryLabel: "专属服务团队交付",
  theme: {
    primaryColor: "#5B2A86",
    secondaryColor: "#D79ACB",
    accentColor: "#8FB5E8",
    softBackground: "#F7F2FA",
    textColor: "#2C2530",
    mutedTextColor: "#766B79",
  },
} as const;

const escapeHtml = (value: string) =>
  value.replace(/[&<>"']/g, (char) => {
    switch (char) {
      case "&":
        return "&amp;";
      case "<":
        return "&lt;";
      case ">":
        return "&gt;";
      case '"':
        return "&quot;";
      case "'":
        return "&#39;";
      default:
        return char;
    }
  });

const replaceAllLiteral = (value: string, from: string, to: string) =>
  from ? value.split(from).join(to) : value;

export const applyFertilityReportProfile = (input: {
  html: string;
  markdown: string;
  profile: FertilityReportProfile;
}) => {
  const replacements: Array<[string, string]> = [
    [DEFAULT_TOKENS.brandName, input.profile.brandName],
    [DEFAULT_TOKENS.teamName, input.profile.teamName],
    [DEFAULT_TOKENS.serviceLine, input.profile.serviceLine],
    [DEFAULT_TOKENS.footerText, input.profile.footerText],
    [DEFAULT_TOKENS.deliveryLabel, input.profile.deliveryLabel],
    [DEFAULT_TOKENS.theme.primaryColor, input.profile.theme.primaryColor],
    [DEFAULT_TOKENS.theme.secondaryColor, input.profile.theme.secondaryColor],
    [DEFAULT_TOKENS.theme.accentColor, input.profile.theme.accentColor],
    [DEFAULT_TOKENS.theme.softBackground, input.profile.theme.softBackground],
    [DEFAULT_TOKENS.theme.textColor, input.profile.theme.textColor],
    [DEFAULT_TOKENS.theme.mutedTextColor, input.profile.theme.mutedTextColor],
  ];

  let html = input.html;
  let markdown = input.markdown;
  for (const [from, to] of replacements) {
    html = replaceAllLiteral(html, escapeHtml(from), escapeHtml(to));
    html = replaceAllLiteral(html, from, to);
    markdown = replaceAllLiteral(markdown, from, to);
  }

  html = html.replace(
    '<main class="report"',
    `<main class="report" data-report-profile-id="${escapeHtml(input.profile.id)}"`,
  );

  return { html, markdown };
};
