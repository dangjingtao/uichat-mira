import type { NormalizedChatMessage } from "@/services/provider-proxy.message-protocol.js";

export type ActiveSkillContext = {
  id: string;
  name: string;
  description: string;
  primaryToolIds: string[];
  instructions: string[];
  completionCriteria: string[];
};

const DOCX_SKILL: ActiveSkillContext = {
  id: "docx",
  name: "DOCX",
  description:
    "Create and review Word documents through WenShu using high-level document tasks rather than raw OOXML or atomic Office actions.",
  primaryToolIds: [
    "read_locate",
    "read_open",
    "read_extract",
    "office_document",
  ],
  instructions: [
    "Route existing DOCX files whose formatting matters through the WenShu review path; do not rewrite the file as plain text.",
    "When the exact edit anchor is not known, read the document first and identify a stable visible-text anchor before calling office_document.",
    "For a new DOCX, call office_document with operation=create and express content as title, semantic paragraphs, and simple tables.",
    "For review, use office_document with operation=review. Native comments use commentText; suggested replacements use Track Changes via replacementText.",
    "Never use edit_file or arbitrary raw XML surgery on a DOCX binary.",
    "Review must be non-destructive: write a distinct outputPath and preserve the source file.",
    "After create or review, re-open the output through the normal Read capability before declaring the task complete.",
    "If the runtime refuses a complex text run or unsupported structure, do not force a lossy rewrite; report the limitation or ask for a safer target.",
  ],
  completionCriteria: [
    "The requested DOCX artifact exists at the expected workspace path.",
    "The output can be opened through Mira's Read path.",
    "Requested content, comments, or tracked changes are present in the verified output.",
    "The original DOCX remains unchanged for review tasks.",
  ],
};

const strongDocxPattern =
  /(?:\.docx\b|\bdocx\b|microsoft\s+word|word\s*文档|word文档|track\s*changes|修订模式|批注)/i;
const weakDocumentPattern = /(?:文档|合同|报告)/i;
const documentActionPattern = /(?:创建|生成|写一份|编辑|修改|审阅|校对|批改|排版|导出|做成)/i;

const collectRecentSemanticText = (
  question: string,
  messages?: NormalizedChatMessage[],
) => {
  const history = (messages ?? [])
    .filter((message) => message.role === "user" || message.role === "assistant")
    .slice(-6)
    .map((message) => message.content)
    .join("\n");
  return `${history}\n${question}`;
};

export const resolveActiveSkillContext = (input: {
  question: string;
  messages?: NormalizedChatMessage[];
}): ActiveSkillContext | null => {
  const semanticText = collectRecentSemanticText(input.question, input.messages);
  if (strongDocxPattern.test(semanticText)) {
    return DOCX_SKILL;
  }
  if (
    weakDocumentPattern.test(semanticText) &&
    documentActionPattern.test(semanticText)
  ) {
    return DOCX_SKILL;
  }
  return null;
};

export const listBuiltInSkillContexts = (): ActiveSkillContext[] => [DOCX_SKILL];
