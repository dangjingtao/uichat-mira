export const INTEGRATION_PROVIDER_VALUES = ["wecom", "lark", "dingtalk"] as const;

export type IntegrationProviderValue =
  (typeof INTEGRATION_PROVIDER_VALUES)[number];

export const INTEGRATION_PROVIDER_LABELS: Record<
  IntegrationProviderValue,
  string
> = {
  wecom: "Enterprise WeCom",
  lark: "Feishu / Lark",
  dingtalk: "DingTalk",
};
