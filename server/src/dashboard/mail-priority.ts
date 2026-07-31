import type { MailPriority } from "./dashboard-types.js";

export type MailPrioritySignals = {
  deadlineWithin24Hours: boolean;
  explicitActionRequired: boolean;
  blocksWork: boolean;
  securityOrLegalRisk: boolean;
  financialImpact: boolean;
  directlyAddressed: boolean;
  bulkOrMarketing: boolean;
  informationalOnly: boolean;
};

export const MAIL_PRIORITY_WEIGHTS = {
  deadlineWithin24Hours: 25,
  explicitActionRequired: 20,
  blocksWork: 20,
  securityOrLegalRisk: 20,
  financialImpact: 15,
  directlyAddressed: 10,
  flagged: 10,
  unread: 5,
  bulkOrMarketing: -25,
  informationalOnly: -15,
} as const;

export const MAIL_PRIORITY_THRESHOLDS = {
  attention: 25,
  high: 50,
  urgent: 75,
} as const;

export function scoreMailPriority(
  signals: MailPrioritySignals,
  message: { isRead: boolean; isFlagged: boolean },
): number {
  let score = 0;
  for (const key of [
    "deadlineWithin24Hours",
    "explicitActionRequired",
    "blocksWork",
    "securityOrLegalRisk",
    "financialImpact",
    "directlyAddressed",
    "bulkOrMarketing",
    "informationalOnly",
  ] as const) {
    if (signals[key]) score += MAIL_PRIORITY_WEIGHTS[key];
  }
  if (message.isFlagged) score += MAIL_PRIORITY_WEIGHTS.flagged;
  if (!message.isRead) score += MAIL_PRIORITY_WEIGHTS.unread;
  return Math.max(0, Math.min(100, score));
}

export function priorityFromScore(score: number): MailPriority | null {
  if (score >= MAIL_PRIORITY_THRESHOLDS.urgent) return "urgent";
  if (score >= MAIL_PRIORITY_THRESHOLDS.high) return "high";
  if (score >= MAIL_PRIORITY_THRESHOLDS.attention) return "normal";
  return null;
}
