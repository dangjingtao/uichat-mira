import type { createMailCenterService, MailQueryItem } from "@/microapps/mail-center/index.js";
import { collectTaskModelText } from "@/services/task-model.service.js";
import type { NormalizedChatMessage } from "@/services/provider-proxy.message-protocol.js";
import type { MailAttentionItem, MailData } from "./dashboard-types.js";
import {
  priorityFromScore,
  scoreMailPriority,
  type MailPrioritySignals,
} from "./mail-priority.js";

const SHANGHAI_OFFSET_MS = 8 * 60 * 60 * 1000;
const MAIL_ANALYSIS_BATCH_SIZE = 8;
const MAIL_BODY_LIMIT = 4_000;
const MAIL_ANALYSIS_CACHE_TTL_MS = 60 * 60 * 1000;

type MailCenterService = ReturnType<typeof createMailCenterService>;
type ModelMailAnalysis = {
  messageId?: unknown;
  content?: unknown;
  attentionReason?: unknown;
  suggestedNextStep?: unknown;
  signals?: Partial<Record<keyof MailPrioritySignals, unknown>>;
};

type MailAnalysisCacheEntry = { fingerprint: string; data: MailData; expiresAt: number };
const mailAnalysisCache = new Map<string, MailAnalysisCacheEntry>();
const mailAnalysisRequests = new Map<string, Promise<MailData>>();

export function getShanghaiDayRange(now: Date) {
  const shifted = new Date(now.getTime() + SHANGHAI_OFFSET_MS);
  const start = Date.UTC(
    shifted.getUTCFullYear(),
    shifted.getUTCMonth(),
    shifted.getUTCDate(),
  ) - SHANGHAI_OFFSET_MS;
  return {
    dayKey: new Date(start + SHANGHAI_OFFSET_MS).toISOString().slice(0, 10),
    since: new Date(start).toISOString(),
    until: new Date(start + 24 * 60 * 60 * 1000).toISOString(),
  };
}

const parseModelOutput = (output: string): ModelMailAnalysis[] => {
  const withoutReasoning = output.trim().replace(/^<think>[\s\S]*?<\/think>\s*/i, "");
  const candidate = withoutReasoning.match(/```(?:json)?\s*([\s\S]*?)\s*```/i)?.[1] ?? withoutReasoning;
  const start = candidate.indexOf("{");
  const end = candidate.lastIndexOf("}");
  if (start < 0 || end < start) throw new Error("Mail analysis did not return JSON");
  const parsed = JSON.parse(candidate.slice(start, end + 1)) as { items?: unknown };
  return Array.isArray(parsed.items) ? parsed.items as ModelMailAnalysis[] : [];
};

const readText = (value: unknown) => typeof value === "string" ? value.trim() : "";

const readSignals = (value: ModelMailAnalysis["signals"]): MailPrioritySignals => ({
  deadlineWithin24Hours: value?.deadlineWithin24Hours === true,
  explicitActionRequired: value?.explicitActionRequired === true,
  blocksWork: value?.blocksWork === true,
  securityOrLegalRisk: value?.securityOrLegalRisk === true,
  financialImpact: value?.financialImpact === true,
  directlyAddressed: value?.directlyAddressed === true,
  bulkOrMarketing: value?.bulkOrMarketing === true,
  informationalOnly: value?.informationalOnly === true,
});

const analyzeBatch = async (
  messages: MailQueryItem[],
  language: string,
): Promise<Array<MailAttentionItem & { score: number }>> => {
  const outputLanguage = language.toLowerCase().startsWith("zh") ? "Simplified Chinese" : "English";
  const prompt: NormalizedChatMessage[] = [
    {
      role: "system",
      content: `Analyze every supplied email and return JSON only as {"items":[{"messageId":"...","content":"...","attentionReason":"...","suggestedNextStep":"...","signals":{"deadlineWithin24Hours":false,"explicitActionRequired":false,"blocksWork":false,"securityOrLegalRisk":false,"financialImpact":false,"directlyAddressed":false,"bulkOrMarketing":false,"informationalOnly":false}}]}. Return exactly one item for every input message and preserve messageId. Write content, attentionReason, and suggestedNextStep in ${outputLanguage}. content is a concise factual summary, not a copy. Mark a signal true only when the email supports it; do not invent deadlines, risks, or required actions.`,
      parts: [],
    },
    {
      role: "user",
      content: JSON.stringify({
        items: messages.map((message) => ({
          messageId: message.id,
          sender: message.from,
          subject: message.subject,
          receivedAt: message.receivedAt,
          isRead: message.isRead,
          isFlagged: message.isFlagged,
          hasAttachments: message.hasAttachments,
          body: (message.textContent || message.previewText).slice(0, MAIL_BODY_LIMIT),
        })),
      }),
      parts: [],
    },
  ];
  const output = await collectTaskModelText(prompt, {
    maxTokens: 4_096,
    temperature: 0,
    purpose: "dashboard-mail-analysis",
  });
  const byId = new Map(parseModelOutput(output).map((item) => [readText(item.messageId), item]));

  return messages.flatMap((message) => {
    const analyzed = byId.get(message.id);
    if (!analyzed) return [];
    const content = readText(analyzed.content);
    const attentionReason = readText(analyzed.attentionReason);
    const suggestedNextStep = readText(analyzed.suggestedNextStep);
    if (!content || !attentionReason || !suggestedNextStep) return [];
    const score = scoreMailPriority(readSignals(analyzed.signals), message);
    const priority = priorityFromScore(score);
    if (!priority) return [];
    return [{
      id: message.id,
      sender: message.from.name || message.from.address || "未知发件人",
      subject: message.subject,
      receivedAt: message.receivedAt ?? "",
      content,
      priority,
      attentionReason,
      suggestedNextStep,
      score,
    }];
  });
};

const queryToday = async (
  service: MailCenterService,
  userId: number,
  since: string,
  until: string,
) => {
  const items: MailQueryItem[] = [];
  let cursor: string | undefined;
  let syncStatus: "skipped" | "succeeded" | "failed" = "skipped";
  let total = 0;
  do {
    const result = await service.queryMail({
      userId,
      since,
      until: new Date(Date.parse(until) - 1).toISOString(),
      includeBody: true,
      sync: cursor ? "none" : "force",
      limit: 100,
      cursor,
    });
    syncStatus = result.sync.status;
    total = result.total;
    items.push(...result.items);
    cursor = result.nextCursor ?? undefined;
  } while (cursor);
  return { items, total, syncStatus };
};

async function refreshDashboardMail(
  service: MailCenterService,
  userId: number,
  now: Date,
  language: string,
  range: ReturnType<typeof getShanghaiDayRange>,
  cacheKey: string,
  cached: MailAnalysisCacheEntry | undefined,
): Promise<MailData> {
  try {
    const queried = await queryToday(service, userId, range.since, range.until);
    if (queried.items.length === 0) {
      const data: MailData = {
        demo: false,
        sourceLabel: "邮件中心",
        status: queried.syncStatus === "failed" ? "unavailable" : "empty",
        totalToday: 0,
        attentionCount: 0,
        items: [],
      };
      mailAnalysisCache.set(cacheKey, {
        fingerprint: "empty",
        data,
        expiresAt: now.getTime() + MAIL_ANALYSIS_CACHE_TTL_MS,
      });
      return data;
    }

    const fingerprint = queried.items
      .map((item) => `${item.id}:${item.receivedAt}:${item.isRead}:${item.isFlagged}`)
      .join("|");
    if (cached && cached.fingerprint === fingerprint) {
      cached.expiresAt = now.getTime() + MAIL_ANALYSIS_CACHE_TTL_MS;
      return cached.data;
    }

    const analyzed: Array<MailAttentionItem & { score: number }> = [];
    for (let index = 0; index < queried.items.length; index += MAIL_ANALYSIS_BATCH_SIZE) {
      analyzed.push(...await analyzeBatch(queried.items.slice(index, index + MAIL_ANALYSIS_BATCH_SIZE), language));
    }
    analyzed.sort((left, right) => right.score - left.score || Date.parse(right.receivedAt) - Date.parse(left.receivedAt));
    const items = analyzed.map(({ score: _score, ...item }) => item);
    const data: MailData = {
      demo: false,
      sourceLabel: "邮件中心",
      status: items.length > 0 ? "ready" : "empty",
      totalToday: queried.total,
      attentionCount: items.length,
      items,
    };
    mailAnalysisCache.set(cacheKey, {
      fingerprint,
      data,
      expiresAt: now.getTime() + MAIL_ANALYSIS_CACHE_TTL_MS,
    });
    return data;
  } catch {
    const data: MailData = {
      demo: false,
      sourceLabel: "邮件中心",
      status: "unavailable",
      totalToday: 0,
      attentionCount: 0,
      items: [],
    };
    mailAnalysisCache.set(cacheKey, {
      fingerprint: "unavailable",
      data,
      expiresAt: now.getTime() + MAIL_ANALYSIS_CACHE_TTL_MS,
    });
    return data;
  }
}

export async function getDashboardMail(
  service: MailCenterService,
  userId: number,
  now = new Date(),
  language = "zh-CN",
): Promise<MailData> {
  const range = getShanghaiDayRange(now);
  const cacheKey = `${userId}:${range.dayKey}:${language.toLowerCase()}`;
  const cached = mailAnalysisCache.get(cacheKey);
  if (cached && cached.expiresAt > now.getTime()) return cached.data;

  const pending = mailAnalysisRequests.get(cacheKey);
  if (pending) return pending;

  const request = refreshDashboardMail(
    service,
    userId,
    now,
    language,
    range,
    cacheKey,
    cached,
  ).finally(() => {
    mailAnalysisRequests.delete(cacheKey);
  });
  mailAnalysisRequests.set(cacheKey, request);
  return request;
}

export function resetDashboardMailAnalysisCache() {
  mailAnalysisCache.clear();
  mailAnalysisRequests.clear();
}
