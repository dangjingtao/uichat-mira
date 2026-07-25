import { collectTaskModelText } from "@/services/task-model.service.js";
import type {
  SkillConversationFlowRuntime,
  SkillDirective,
  SkillFlowRuntimeInput,
  SkillFlowRuntimeResult,
  SkillRequirement,
  StoredSkillFlowSession,
} from "../flow/types.js";
import { toSkillFlowStateRef } from "../flow/state-store.js";
import {
  getFertilityScopeFlags,
  hasExplicitFertilityServiceProfile,
  resolveFertilityServiceProfile,
  type FertilityServiceProfile,
} from "./service-profile.js";

const SERVICE_PROFILE_REQUIREMENT: SkillRequirement = {
  id: "fertility-service-profile",
  kind: "user_input",
  description:
    "建立专属服务档案所需的称呼、评估对象和当前生育目标。",
  requiredFor: "确定报告抬头、评估对象和后续女性/男性维度范围",
  acceptedFormats: ["natural_language", "service_conversation"],
  userPrompt:
    "您好，我会先为您建立一份简洁的专属档案。怎么称呼您？这次想评估女方、男方，还是夫妻双方？目前主要是自然备孕、辅助生殖，还是想复盘之前的经历？一句话告诉我就可以。",
};

const INITIAL_REQUIREMENT = SERVICE_PROFILE_REQUIREMENT;

const FINAL_CONFIRMATION_REQUIREMENT: SkillRequirement = {
  id: "fertility-final-confirmation",
  kind: "user_input",
  description: "信息收集收束后的唯一一次最终确认。",
  requiredFor: "结束信息收集并进入报告生成",
  acceptedFormats: [
    "natural_language",
    "explicit_no_more_information",
    "service_conversation",
  ],
  userPrompt:
    "谢谢您，现有信息已经可以整理成一份初步的专属报告了。还有一项您觉得重要、希望服务团队知道的内容吗？没有的话，回复“确认生成报告”就好。",
};

const FALLBACK_REQUIREMENT: SkillRequirement = {
  id: "fertility-additional-context",
  kind: "user_input",
  description: "当前最希望服务团队优先理解的一项生育背景。",
  requiredFor: "继续完善评估并判断是否可以进入最终确认",
  acceptedFormats: ["natural_language", "service_conversation"],
  userPrompt:
    "谢谢您前面提供的信息，我已经记下来了。为了让报告更贴近您的实际情况，我还想了解一个最关键的背景：目前最希望我们优先帮您看清什么？记得多少说多少，不方便回答也没关系。",
};

export const FERTILITY_DIMENSION_IDS = [
  "female_endometrium",
  "female_hormonal_balance",
  "female_oocyte_context",
  "female_ovarian_reserve",
  "female_metabolic_health",
  "female_immune_context",
  "female_pelvic_environment",
  "female_nutrition",
  "female_lifestyle",
  "female_sleep_stress",
  "male_dna_integrity",
  "male_morphology",
  "male_motility",
  "male_concentration",
  "male_semen_volume",
  "male_hormonal_balance",
  "male_inflammation",
  "male_nutrition",
  "male_lifestyle",
  "male_sleep_stress",
] as const;

const ALLOWED_DIMENSION_IDS = new Set<string>(FERTILITY_DIMENSION_IDS);
const UNSAFE_OBJECT_KEYS = new Set(["__proto__", "prototype", "constructor"]);
const EVIDENCE_SOURCES = new Set<FertilityCaseEvidence["source"]>([
  "user_reported",
  "document",
  "clinical_record",
  "inferred",
]);

const isRecord = (value: unknown): value is Record<string, unknown> =>
  Boolean(value) && typeof value === "object" && !Array.isArray(value);

const unwrapJsonFence = (value: string) => {
  const match = /^\s*```(?:json)?\s*([\s\S]*?)\s*```\s*$/i.exec(value);
  return match?.[1] ?? value;
};

const parseJsonObject = (value: string): Record<string, unknown> => {
  const parsed = JSON.parse(unwrapJsonFence(value).trim()) as unknown;
  if (!isRecord(parsed)) throw new Error("TaskModel did not return a JSON object");
  return parsed;
};

const mergeRecord = (
  base: Record<string, unknown>,
  patch: Record<string, unknown>,
): Record<string, unknown> => {
  const next: Record<string, unknown> = { ...base };
  for (const [key, value] of Object.entries(patch)) {
    if (UNSAFE_OBJECT_KEYS.has(key)) continue;
    if (isRecord(value) && isRecord(next[key])) {
      next[key] = mergeRecord(next[key] as Record<string, unknown>, value);
    } else {
      next[key] = value;
    }
  }
  return next;
};

const uniqueStrings = (values: unknown, limit = 40) =>
  Array.isArray(values)
    ? [
        ...new Set(
          values
            .filter((item): item is string => typeof item === "string")
            .map((item) => item.trim())
            .filter(Boolean),
        ),
      ].slice(0, limit)
    : [];

const normalizeUserInputRequirement = (
  value: unknown,
  fallback: SkillRequirement,
): SkillRequirement => {
  if (!isRecord(value)) return fallback;

  const id =
    typeof value.id === "string" && value.id.trim()
      ? value.id.trim().slice(0, 120)
      : fallback.id;
  const description =
    typeof value.description === "string" && value.description.trim()
      ? value.description.trim()
      : fallback.description;
  const requiredFor =
    typeof value.requiredFor === "string" && value.requiredFor.trim()
      ? value.requiredFor.trim()
      : fallback.requiredFor;
  const acceptedFormats = uniqueStrings(value.acceptedFormats, 8);
  const alternatives = uniqueStrings(value.alternatives, 8);
  const userPrompt =
    typeof value.userPrompt === "string" && value.userPrompt.trim()
      ? value.userPrompt.trim().slice(0, 900)
      : fallback.userPrompt;

  return {
    id,
    kind: "user_input",
    description,
    requiredFor,
    ...(acceptedFormats.length > 0
      ? { acceptedFormats }
      : fallback.acceptedFormats
        ? { acceptedFormats: [...fallback.acceptedFormats] }
        : {}),
    ...(alternatives.length > 0 ? { alternatives } : {}),
    ...(userPrompt ? { userPrompt } : {}),
  };
};

export type FertilityDimension = {
  id: string;
  score: number | null;
  confidence: "low" | "medium" | "high";
  dataCompleteness: number;
  evidence: unknown[];
  strengths: string[];
  concerns: string[];
  missingEvidence: string[];
  interpretation: string;
  actions: {
    selfCare: string[];
    discussWithClinician: string[];
    testsToConsider: string[];
  };
};

export type FertilityCaseEvidence = {
  id: string;
  fieldId: string;
  statement: string;
  value?: string | number | boolean | null;
  unit?: string;
  source: "user_reported" | "document" | "clinical_record" | "inferred";
  round: number;
  relatedDimensionIds: string[];
};

export type FertilityCaseRecord = {
  evidenceLedger: Record<string, FertilityCaseEvidence>;
  askedRequirementIds: string[];
  declinedRequirementIds: string[];
  answerLog: Array<{ round: number; text: string }>;
};

export type FertilityAssessmentState = {
  facts: Record<string, unknown>;
  caseRecord: FertilityCaseRecord;
  missingCriticalFields: string[];
  uncertainties: string[];
  contradictions: string[];
  dimensions: Record<string, FertilityDimension>;
  summary?: {
    strengths: string[];
    priorities: string[];
    visitPrep: string[];
    lifestyleFocus: string[];
  };
  closingMessage?: string;
  report?: {
    markdown: string;
    html: string;
    generatedAt: string;
  };
};

export const normalizeFertilityDimension = (
  value: unknown,
): FertilityDimension | null => {
  if (!isRecord(value) || typeof value.id !== "string") return null;
  const id = value.id.trim();
  if (!ALLOWED_DIMENSION_IDS.has(id)) return null;

  const score =
    typeof value.score === "number" && Number.isFinite(value.score)
      ? Math.max(0, Math.min(10, value.score))
      : null;
  const confidenceRaw = String(value.confidence);
  const confidence: FertilityDimension["confidence"] =
    confidenceRaw === "medium" || confidenceRaw === "high"
      ? confidenceRaw
      : "low";
  const dataCompleteness =
    typeof value.dataCompleteness === "number" && Number.isFinite(value.dataCompleteness)
      ? Math.max(0, Math.min(1, value.dataCompleteness))
      : 0;
  const actions = isRecord(value.actions) ? value.actions : {};

  return {
    id,
    score,
    confidence,
    dataCompleteness,
    evidence: Array.isArray(value.evidence) ? value.evidence.slice(0, 10) : [],
    strengths: uniqueStrings(value.strengths, 8),
    concerns: uniqueStrings(value.concerns, 8),
    missingEvidence: uniqueStrings(value.missingEvidence, 8),
    interpretation:
      typeof value.interpretation === "string" ? value.interpretation.trim() : "",
    actions: {
      selfCare: uniqueStrings(actions.selfCare, 8),
      discussWithClinician: uniqueStrings(actions.discussWithClinician, 8),
      testsToConsider: uniqueStrings(actions.testsToConsider, 8),
    },
  };
};

const normalizeCaseEvidence = (
  value: unknown,
  fallbackId: string,
): FertilityCaseEvidence | null => {
  if (!isRecord(value)) return null;
  const fieldId =
    typeof value.fieldId === "string" ? value.fieldId.trim().slice(0, 160) : "";
  const statement =
    typeof value.statement === "string" ? value.statement.trim().slice(0, 1200) : "";
  if (!fieldId || !statement) return null;
  const sourceRaw = String(value.source);
  const source = EVIDENCE_SOURCES.has(sourceRaw as FertilityCaseEvidence["source"])
    ? (sourceRaw as FertilityCaseEvidence["source"])
    : "user_reported";
  const primitiveValue =
    value.value === null ||
    typeof value.value === "string" ||
    typeof value.value === "number" ||
    typeof value.value === "boolean"
      ? value.value
      : undefined;
  return {
    id:
      typeof value.id === "string" && value.id.trim()
        ? value.id.trim().slice(0, 40)
        : fallbackId,
    fieldId,
    statement,
    ...(primitiveValue !== undefined ? { value: primitiveValue } : {}),
    ...(typeof value.unit === "string" && value.unit.trim()
      ? { unit: value.unit.trim().slice(0, 80) }
      : {}),
    source,
    round:
      typeof value.round === "number" && Number.isFinite(value.round)
        ? Math.max(0, Math.trunc(value.round))
        : 0,
    relatedDimensionIds: uniqueStrings(value.relatedDimensionIds, 12).filter((id) =>
      ALLOWED_DIMENSION_IDS.has(id),
    ),
  };
};

const createEmptyCaseRecord = (): FertilityCaseRecord => ({
  evidenceLedger: {},
  askedRequirementIds: [],
  declinedRequirementIds: [],
  answerLog: [],
});

const normalizeCaseRecord = (value: unknown): FertilityCaseRecord => {
  if (!isRecord(value)) return createEmptyCaseRecord();
  const evidenceLedger: Record<string, FertilityCaseEvidence> = {};
  if (isRecord(value.evidenceLedger)) {
    let index = 0;
    for (const candidate of Object.values(value.evidenceLedger)) {
      index += 1;
      const normalized = normalizeCaseEvidence(
        candidate,
        `E${String(index).padStart(3, "0")}`,
      );
      if (normalized) evidenceLedger[normalized.id] = normalized;
    }
  }
  const answerLog = Array.isArray(value.answerLog)
    ? value.answerLog
        .map((candidate) => {
          if (!isRecord(candidate) || typeof candidate.text !== "string") return null;
          const text = candidate.text.trim().slice(0, 5000);
          if (!text) return null;
          return {
            round:
              typeof candidate.round === "number" && Number.isFinite(candidate.round)
                ? Math.max(0, Math.trunc(candidate.round))
                : 0,
            text,
          };
        })
        .filter((item): item is { round: number; text: string } => Boolean(item))
        .slice(-20)
    : [];
  return {
    evidenceLedger,
    askedRequirementIds: uniqueStrings(value.askedRequirementIds, 40),
    declinedRequirementIds: uniqueStrings(value.declinedRequirementIds, 40),
    answerLog,
  };
};

export const toFertilityAssessmentState = (
  value: Record<string, unknown>,
): FertilityAssessmentState => {
  const dimensions: Record<string, FertilityDimension> = {};
  if (isRecord(value.dimensions)) {
    for (const candidate of Object.values(value.dimensions)) {
      const normalized = normalizeFertilityDimension(candidate);
      if (normalized) dimensions[normalized.id] = normalized;
    }
  }

  return {
    facts: isRecord(value.facts) ? value.facts : {},
    caseRecord: normalizeCaseRecord(value.caseRecord),
    missingCriticalFields: uniqueStrings(value.missingCriticalFields),
    uncertainties: uniqueStrings(value.uncertainties),
    contradictions: uniqueStrings(value.contradictions),
    dimensions,
    ...(isRecord(value.summary)
      ? {
          summary: {
            strengths: uniqueStrings(value.summary.strengths, 8),
            priorities: uniqueStrings(value.summary.priorities, 8),
            visitPrep: uniqueStrings(value.summary.visitPrep, 8),
            lifestyleFocus: uniqueStrings(value.summary.lifestyleFocus, 8),
          },
        }
      : {}),
    ...(typeof value.closingMessage === "string" && value.closingMessage.trim()
      ? { closingMessage: value.closingMessage.trim() }
      : {}),
    ...(isRecord(value.report)
      ? {
          report: {
            markdown:
              typeof value.report.markdown === "string" ? value.report.markdown : "",
            html: typeof value.report.html === "string" ? value.report.html : "",
            generatedAt:
              typeof value.report.generatedAt === "string"
                ? value.report.generatedAt
                : "",
          },
        }
      : {}),
  };
};

const isLikelyActivationOnly = (query: string) => {
  const normalized = query.trim();
  if (normalized.length > 120) return false;
  if (/\d/.test(normalized)) return false;
  return /(?:开始|做|生成|想要|帮我).{0,12}(?:备孕|生育力|生育).{0,12}(?:评估|报告|分析)/i.test(
    normalized,
  );
};

type FertilityCollectionDisposition =
  | "continue"
  | "ready_for_final_confirmation"
  | "user_declined_more"
  | "user_confirmed_report";

const normalizeCollectionDisposition = (
  value: unknown,
  legacyReadyForFinalConfirmation: unknown,
): FertilityCollectionDisposition => {
  switch (value) {
    case "ready_for_final_confirmation":
    case "user_declined_more":
    case "user_confirmed_report":
      return value;
    case "continue":
      return "continue";
    default:
      return legacyReadyForFinalConfirmation === true
        ? "ready_for_final_confirmation"
        : "continue";
  }
};

const analysisSystemPrompt = `你是 Mira 专属生育健康服务团队中的访谈记录 TaskModel。你的核心职责是维护一份可追溯的临时病例 JSON：把本轮新增事实写入 factsPatch 和 evidenceItems，判断用户是否愿意继续，并从尚未询问、尚未拒绝的缺口中选择一个最值得了解的主题。

硬规则：
1. 只返回 JSON，不要 Markdown。
2. factsPatch 只写本轮明确得到或可安全归一化的事实；不确定内容放 uncertainties。不要删除已经存在的事实。
3. 首先维护 factsPatch.serviceProfile：displayName（报告称呼）、assessmentScope（female|male|couple）、subjectGender（female|male|couple）、currentGoal（natural_conception|assisted_reproduction|failure_review|general），夫妻评估可附 femaleName / maleName。
4. evidenceItems 为本轮新增证据。每项必须有稳定 fieldId、忠实 statement、source 和相关维度；用户口述检查值一律 source=user_reported，不假装已核验。
5. 已在 evidenceLedger、facts 或 answerLog 中明确出现的信息，绝不能再次追问，也不能在后续写成“未提供”。
6. askedRequirementIds 中的主题已经问过；declinedRequirementIds 中的主题用户已表示不知道、不便或不愿继续。不得再次返回相同 nextRequirement.id。
7. 每轮最多选择一个 nextRequirement 主题。不要把年龄、病史、检查、生活方式拼成材料清单。
8. nextRequirement.description 是内部业务描述；userPrompt 是给用户看的服务话术。
9. userPrompt 必须：先自然接住用户刚说的一点；用一句话说明为什么还想了解；只问一个主题；允许用户不知道或不方便回答。禁止使用“请补充以下信息”“按你方便的方式说就好”“不确定或不知道的部分可以直接说明”等机械模板；禁止像窗口办事一样罗列参数。
10. 只更新与 assessmentScope 匹配的维度；范围未确认时不推断维度。
11. AMH/AFC 主要反映卵巢储备/促排反应背景，不能单独等同卵子质量或自然受孕概率；单一精液参数不能诊断男性不育。
12. 不诊断、不处方、不输出个体化药物或补充剂剂量；不把免疫、凝血、DFI 等当成所有人的常规必查项。
13. collectionDisposition 独立于资料完整度，只能取：
   - continue：用户在提供资料且愿意继续；
   - ready_for_final_confirmation：继续追问的边际价值已经较低；
   - user_declined_more：用户明确不愿、不便、不知道或不再继续补充；
   - user_confirmed_report：用户明确要求立即生成报告或确认生成。
14. 用户拒绝继续时不得因为仍有缺口而返回 continue；用户要求生成报告时不得返回追问。
15. 不依赖固定关键词或语言，根据完整语义判断。

输出结构：
{
  "factsPatch": {},
  "evidenceItems": [
    {
      "fieldId": "稳定字段标识",
      "statement": "忠实记录用户本轮提供的事实",
      "value": "可选的原始值",
      "unit": "可选",
      "source": "user_reported|document|clinical_record|inferred",
      "relatedDimensionIds": ["允许的维度id"]
    }
  ],
  "missingCriticalFields": [],
  "uncertainties": [],
  "contradictions": [],
  "declinedRequirementIds": [],
  "dimensionUpdates": [],
  "collectionDisposition": "continue|ready_for_final_confirmation|user_declined_more|user_confirmed_report",
  "nextRequirement": {
    "id": "稳定且未问过的主题标识",
    "description": "内部业务缺口描述",
    "requiredFor": "为什么值得了解",
    "acceptedFormats": ["natural_language", "service_conversation"],
    "userPrompt": "温和、单主题、像专属顾问的下一句话"
  }
}`;

const normalizeEvidenceItems = (value: unknown, round: number) => {
  if (!Array.isArray(value)) return [];
  return value
    .map((candidate, index) =>
      normalizeCaseEvidence(candidate, `T${round}-${index + 1}`),
    )
    .filter((item): item is FertilityCaseEvidence => Boolean(item))
    .map((item) => ({ ...item, id: "", round }))
    .slice(0, 24);
};

const recentConversation = (messages: SkillFlowRuntimeInput["messages"]) =>
  messages
    .filter(
      (message) =>
        (message.role === "user" || message.role === "assistant") &&
        typeof message.content === "string" &&
        message.content.trim(),
    )
    .slice(-12)
    .map((message) => ({
      role: message.role,
      content: message.content.trim().slice(0, 2400),
    }));

const analyzeTurn = async (input: {
  state: FertilityAssessmentState;
  query: string;
  round: number;
  messages: SkillFlowRuntimeInput["messages"];
}) => {
  const parsed = parseJsonObject(
    await collectTaskModelText(
      [
        { role: "system", content: analysisSystemPrompt, parts: [] },
        {
          role: "user",
          content: JSON.stringify(
            {
              round: input.round,
              currentAssessment: {
                facts: input.state.facts,
                caseRecord: input.state.caseRecord,
                knownFieldIds: Object.values(input.state.caseRecord.evidenceLedger).map(
                  (item) => item.fieldId,
                ),
                missingCriticalFields: input.state.missingCriticalFields,
                uncertainties: input.state.uncertainties,
                contradictions: input.state.contradictions,
                completedDimensionIds: Object.keys(input.state.dimensions),
              },
              recentConversation: recentConversation(input.messages),
              userAnswer: input.query,
            },
            null,
            2,
          ),
          parts: [],
        },
      ],
      {
        maxTokens: 1800,
        temperature: 0,
        purpose: "fertility-assessment-update-case-record",
      },
    ),
  );

  return {
    factsPatch: isRecord(parsed.factsPatch) ? parsed.factsPatch : {},
    evidenceItems: normalizeEvidenceItems(parsed.evidenceItems, input.round),
    missingCriticalFields: uniqueStrings(parsed.missingCriticalFields),
    uncertainties: uniqueStrings(parsed.uncertainties),
    contradictions: uniqueStrings(parsed.contradictions),
    declinedRequirementIds: uniqueStrings(parsed.declinedRequirementIds, 20),
    dimensionUpdates: Array.isArray(parsed.dimensionUpdates)
      ? parsed.dimensionUpdates
          .map(normalizeFertilityDimension)
          .filter((item): item is FertilityDimension => Boolean(item))
          .slice(0, 2)
      : [],
    collectionDisposition: normalizeCollectionDisposition(
      parsed.collectionDisposition,
      parsed.readyForFinalConfirmation,
    ),
    nextRequirement: normalizeUserInputRequirement(
      parsed.nextRequirement,
      FALLBACK_REQUIREMENT,
    ),
  };
};

const mergeEvidenceLedger = (
  current: FertilityCaseRecord["evidenceLedger"],
  incoming: FertilityCaseEvidence[],
) => {
  const next = { ...current };
  const identityToId = new Map(
    Object.values(next).map((item) => [
      `${item.fieldId}\u0000${item.statement}`,
      item.id,
    ]),
  );
  let sequence = Object.keys(next).length;
  for (const item of incoming) {
    const identity = `${item.fieldId}\u0000${item.statement}`;
    const existingId = identityToId.get(identity);
    if (existingId) {
      next[existingId] = { ...next[existingId], ...item, id: existingId };
      continue;
    }
    sequence += 1;
    const id = `E${String(sequence).padStart(3, "0")}`;
    next[id] = { ...item, id };
    identityToId.set(identity, id);
  }
  return next;
};

const appendAnswerLog = (
  answerLog: FertilityCaseRecord["answerLog"],
  round: number,
  query: string,
) => {
  const text = query.trim().slice(0, 5000);
  if (!text) return answerLog;
  return [...answerLog, { round, text }].slice(-20);
};

const withProcessedState = (
  session: StoredSkillFlowSession,
  patch: Partial<StoredSkillFlowSession>,
): StoredSkillFlowSession => ({
  ...session,
  ...patch,
  updatedAt: new Date().toISOString(),
});

const buildDirective = (
  session: StoredSkillFlowSession,
  patch: Omit<SkillDirective, "skillId" | "sessionId" | "stateRef">,
): SkillDirective => ({
  skillId: session.skillId,
  sessionId: session.sessionId,
  stateRef: toSkillFlowStateRef(session),
  ...patch,
});

const buildReadyResult = (input: {
  session: StoredSkillFlowSession;
  nextRound: number;
  nextState: FertilityAssessmentState;
  serviceProfile: FertilityServiceProfile;
}): SkillFlowRuntimeResult => {
  const scopeFlags = getFertilityScopeFlags(input.serviceProfile.assessmentScope);
  const readySession = withProcessedState(input.session, {
    status: "ready",
    round: input.nextRound,
    state: input.nextState as unknown as Record<string, unknown>,
  });
  const directive = buildDirective(readySession, {
    phase: "ready",
    flowCompleted: true,
    round: input.nextRound,
    maxRounds: input.session.maxRounds,
    next: {
      intent: "generate_report",
      targetSkillId: "fertility-report",
      args: {
        assessmentRef: toSkillFlowStateRef(readySession),
        reportType: input.serviceProfile.assessmentScope,
        format: "markdown",
        includeFemale: scopeFlags.includeFemale,
        includeMale: scopeFlags.includeMale,
        displayName: input.serviceProfile.displayName,
        currentGoal: input.serviceProfile.currentGoal,
        htmlAvailable: true,
      },
    },
  });
  return {
    session: { ...readySession, lastDirective: directive },
    directive,
  };
};

export const fertilityAssessmentRuntime: SkillConversationFlowRuntime = {
  skillId: "fertility-assessment",
  version: "1.1.0",
  maxRounds: 10,

  createInitialState: () => ({
    facts: {},
    caseRecord: createEmptyCaseRecord(),
    missingCriticalFields: [],
    uncertainties: [],
    contradictions: [],
    dimensions: {},
  }),

  async processTurn(input: SkillFlowRuntimeInput): Promise<SkillFlowRuntimeResult> {
    const currentState = toFertilityAssessmentState(input.session.state);

    if (input.session.round === 0 && isLikelyActivationOnly(input.query)) {
      const initialState: FertilityAssessmentState = {
        ...currentState,
        caseRecord: {
          ...currentState.caseRecord,
          askedRequirementIds: [
            ...new Set([
              ...currentState.caseRecord.askedRequirementIds,
              INITIAL_REQUIREMENT.id,
            ]),
          ],
        },
      };
      const sessionWithState = withProcessedState(input.session, {
        status: "collecting",
        state: initialState as unknown as Record<string, unknown>,
      });
      const directive = buildDirective(sessionWithState, {
        phase: "collecting",
        flowCompleted: false,
        round: 0,
        maxRounds: input.session.maxRounds,
        interruption: {
          reason: "missing_requirement",
          requirements: [INITIAL_REQUIREMENT],
        },
      });
      return {
        session: { ...sessionWithState, lastDirective: directive },
        directive,
      };
    }

    const nextRound = input.session.round + 1;
    let analysis: Awaited<ReturnType<typeof analyzeTurn>>;
    try {
      analysis = await analyzeTurn({
        state: currentState,
        query: input.query,
        round: nextRound,
        messages: input.messages,
      });
    } catch {
      analysis = {
        factsPatch: {},
        evidenceItems: [],
        missingCriticalFields: currentState.missingCriticalFields,
        uncertainties: currentState.uncertainties,
        contradictions: currentState.contradictions,
        declinedRequirementIds: [],
        dimensionUpdates: [],
        collectionDisposition: "continue",
        nextRequirement: FALLBACK_REQUIREMENT,
      };
    }

    const mergedFacts = mergeRecord(currentState.facts, analysis.factsPatch);
    const profileReady = hasExplicitFertilityServiceProfile(mergedFacts);
    const serviceProfile = resolveFertilityServiceProfile(mergedFacts);
    const scopeFlags = getFertilityScopeFlags(serviceProfile.assessmentScope);

    const dimensions = { ...currentState.dimensions };
    if (profileReady) {
      for (const item of analysis.dimensionUpdates) {
        if (
          (item.id.startsWith("female_") && scopeFlags.includeFemale) ||
          (item.id.startsWith("male_") && scopeFlags.includeMale)
        ) {
          dimensions[item.id] = item;
        }
      }
    }

    const declinedRequirementIds = [
      ...new Set([
        ...currentState.caseRecord.declinedRequirementIds,
        ...analysis.declinedRequirementIds,
      ]),
    ];
    const caseRecord: FertilityCaseRecord = {
      evidenceLedger: mergeEvidenceLedger(
        currentState.caseRecord.evidenceLedger,
        analysis.evidenceItems,
      ),
      askedRequirementIds: [...currentState.caseRecord.askedRequirementIds],
      declinedRequirementIds,
      answerLog: appendAnswerLog(
        currentState.caseRecord.answerLog,
        nextRound,
        input.query,
      ),
    };

    const nextState: FertilityAssessmentState = {
      ...currentState,
      facts: mergedFacts,
      caseRecord,
      missingCriticalFields: analysis.missingCriticalFields,
      uncertainties: analysis.uncertainties,
      contradictions: analysis.contradictions,
      dimensions,
    };

    if (
      input.session.status === "final_confirmation" ||
      (profileReady && analysis.collectionDisposition === "user_confirmed_report")
    ) {
      return buildReadyResult({
        session: input.session,
        nextRound,
        nextState,
        serviceProfile,
      });
    }

    const requirementAlreadyHandled =
      caseRecord.askedRequirementIds.includes(analysis.nextRequirement.id) ||
      caseRecord.declinedRequirementIds.includes(analysis.nextRequirement.id);
    const shouldConfirm =
      profileReady &&
      (analysis.collectionDisposition === "ready_for_final_confirmation" ||
        analysis.collectionDisposition === "user_declined_more" ||
        requirementAlreadyHandled ||
        nextRound >= input.session.maxRounds);
    const requirement = shouldConfirm
      ? FINAL_CONFIRMATION_REQUIREMENT
      : profileReady
        ? analysis.nextRequirement
        : SERVICE_PROFILE_REQUIREMENT;
    const nextCaseRecord: FertilityCaseRecord = {
      ...caseRecord,
      askedRequirementIds: [
        ...new Set([...caseRecord.askedRequirementIds, requirement.id]),
      ],
    };
    const stateWithRequirement: FertilityAssessmentState = {
      ...nextState,
      caseRecord: nextCaseRecord,
    };
    const nextSession = withProcessedState(input.session, {
      status: shouldConfirm ? "final_confirmation" : "collecting",
      round: nextRound,
      state: stateWithRequirement as unknown as Record<string, unknown>,
    });
    const directive = buildDirective(nextSession, {
      phase: shouldConfirm ? "final_confirmation" : "collecting",
      flowCompleted: false,
      round: nextRound,
      maxRounds: input.session.maxRounds,
      interruption: {
        reason: "missing_requirement",
        requirements: [requirement],
      },
    });

    return {
      session: { ...nextSession, lastDirective: directive },
      directive,
    };
  },
};
