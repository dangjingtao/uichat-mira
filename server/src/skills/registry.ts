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
  primaryToolIds: ["read_discover", "read_open", "office_document"],
  instructions: [
    "Route existing DOCX files whose formatting matters through the WenShu review path; do not rewrite the file as plain text.",
    "When the exact edit anchor is not known, use the public Read surface to discover/open the document and identify a stable visible-text anchor before calling office_document.",
    "For a new DOCX, call office_document with operation=create and express content as title, semantic paragraphs, and simple tables.",
    "For review, use office_document with operation=review. Native comments use commentText; suggested replacements use Track Changes via replacementText.",
    "Never use edit_file or arbitrary raw XML surgery on a DOCX binary.",
    "Review must be non-destructive: write a distinct outputPath and preserve the source file.",
    "After create or review, re-open the output through read_open before declaring the task complete.",
  ],
  completionCriteria: [
    "The requested DOCX artifact exists at the expected workspace path.",
    "The output can be opened through Mira's public Read path.",
    "Requested content, comments, or tracked changes are present in the verified output.",
    "The original DOCX remains unchanged for review tasks.",
  ],
};

const PDF_SKILL: ActiveSkillContext = {
  id: "pdf",
  name: "PDF",
  description:
    "Create and process PDF files through WenShu: structured reports, Markdown conversion, extraction, forms, page operations and metadata.",
  primaryToolIds: ["read_discover", "read_open", "office_pdf"],
  instructions: [
    "Use office_pdf as the task-level PDF execution capability; do not manually mutate PDF bytes or expose page-level library primitives as separate tools.",
    "For new reports/documents prefer structured create; use md2pdf when the real input is an existing Markdown document that should be converted.",
    "Existing PDFs support text/table/image extraction, form inspection/filling, merge, split, rotate, crop, and metadata get/set.",
    "Preserve source PDFs by default. Operations that modify a PDF should write a distinct outputPath or outputDir unless the user explicitly requested a new artifact path.",
    "Use 1-based page selections such as 1,3-5. Crop boxes use PDF point coordinates [x0,y0,x1,y1].",
    "Do not invent factual content or citations when generating a report; content quality remains the Agent's responsibility before invoking the deterministic runtime.",
    "After generating or modifying a PDF, verify the output through accepted Evidence/read path before declaring completion.",
  ],
  completionCriteria: [
    "The requested PDF result or extraction exists and is represented by accepted Evidence.",
    "Generated/modified PDF artifacts exist at the expected workspace path and remain readable.",
    "Source PDFs are preserved for non-destructive transformations.",
    "For multi-output operations, the reported output directory and produced file count are verified.",
  ],
};

const XLSX_SKILL: ActiveSkillContext = {
  id: "xlsx",
  name: "XLSX",
  description:
    "Create, modify, inspect and validate Excel workbooks with formula-linked models, styling, charts, conditional formatting, sources and finance-model semantics.",
  primaryToolIds: ["read_discover", "read_open", "office_spreadsheet"],
  instructions: [
    "Use office_spreadsheet as the task-level workbook capability. Keep derived calculations as Excel formulas instead of calculating them externally and pasting hardcoded results.",
    "The workbook spec supports sheets, rows/cells, styles, formulas, merges, dimensions, freeze panes, comments, hyperlinks, conditional formatting, charts, named ranges and Sources entries.",
    "External data used in a delivered workbook must include source name and source URL in the workbook; do not fabricate citations.",
    "For finance models, true historical/raw inputs and assumptions may be hardcoded, but derived, projected, rolled-forward and valuation outputs must remain formula-linked and auditable.",
    "Create and modify automatically run recalculation preparation plus verification. Treat verification issues as gaps instead of silently declaring completion.",
    "Modification is non-destructive by default and writes a new .xlsx artifact.",
    "For three-statement, DCF or comps work, follow the applicable finance methodology/reference package and include visible model checks before delivery.",
  ],
  completionCriteria: [
    "The requested workbook exists and can be opened through Mira's Read path.",
    "Required formulas, sheets, styles/charts and source citations are present.",
    "Recalculation preparation and verification have completed without unresolved blocking errors.",
    "Finance deliverables include the requested reconciliation/check logic and remain formula-linked.",
  ],
};

const PPTX_SKILL: ActiveSkillContext = {
  id: "pptx",
  name: "PPTX",
  description:
    "Create a normal-length PowerPoint presentation from a structured PPTD-like presentation AST with themes, positioned elements and mandatory layout validation.",
  primaryToolIds: ["read_discover", "read_open", "office_presentation"],
  instructions: [
    "Use office_presentation for presentation creation/validation/inspection. Do not expose add_slide/add_text/add_chart or raw OOXML actions as Agent tools.",
    "Build a structured presentation AST first: size, theme, pages, then positioned text/shape/image/icon/table/chart elements with [x,y,w,h] bounds.",
    "Validate the complete presentation before creation. Blocking out-of-bounds errors must be fixed; overflow/occlusion warnings must be reviewed rather than ignored blindly.",
    "Keep slide content concise and presentation-native. Do not paste document paragraphs into slides without designing hierarchy and layout.",
    "The current WenShu PPT skill creates new presentations and inspects PPTX; it does not promise lossless arbitrary editing of existing PPTX files.",
    "After create, inspect the generated PPTX and require accepted Evidence before declaring completion.",
  ],
  completionCriteria: [
    "The presentation spec passes blocking validation.",
    "The generated PPTX exists at the requested workspace path and can be inspected/read.",
    "Slide count and requested content structure match the user's task.",
    "No unresolved blocking layout errors remain; important warnings have been addressed or explicitly reported.",
  ],
};

const PPTX_SWARM_SKILL: ActiveSkillContext = {
  id: "pptx-swarm",
  name: "PPTX Swarm",
  description:
    "Create long (20+ slide) or multiple PowerPoint presentations using the same WenShu structured presentation runtime with batch-first planning, unified validation and delivery.",
  primaryToolIds: ["read_discover", "read_open", "office_presentation"],
  instructions: [
    "Use pptx-swarm semantics only for long presentations (20+ slides) or batch creation of multiple presentations; otherwise use the normal pptx Skill.",
    "The Parent Agent remains the only control loop. Do not create a nested Skill Agent loop merely to imitate another implementation's swarm architecture.",
    "Complete the visual direction, outline and every presentation spec before starting final conversion/delivery.",
    "For multiple presentations, generate all complete specs first, validate the complete batch next, then create and inspect all outputs. Never create/check/deliver presentation 1 before presentation 2's spec exists.",
    "Use office_presentation operation=create_batch when several deck specs are ready together. Each batch item contains outputPath and spec.",
    "For a single long deck, use the same structured AST and create flow after the entire 20+ slide deck has been planned and validated.",
    "Do not expose slide/page primitives as Agent tools and do not claim arbitrary lossless modification of existing PPTX files.",
  ],
  completionCriteria: [
    "All requested deck specs are complete before conversion begins.",
    "Every deck passes blocking validation before any batch delivery is considered complete.",
    "All requested PPTX artifacts exist and can be inspected.",
    "The complete batch/long deck has the requested slide counts/content sections and no unresolved blocking layout errors.",
  ],
};

const patterns: Array<{ skill: ActiveSkillContext; pattern: RegExp }> = [
  {
    skill: PDF_SKILL,
    pattern: /(?:\.pdf\b|application\/pdf|\bpdf\b|pdf文件|PDF文件|合并PDF|拆分PDF|填写PDF|PDF表单)/i,
  },
  {
    skill: XLSX_SKILL,
    pattern: /(?:\.xlsx\b|\.xls\b|\.csv\b|application\/vnd\.openxmlformats-officedocument\.spreadsheetml\.sheet|\bexcel\b|spreadsheet|电子表格|工作簿|工作表|三表模型|三大报表|DCF|comps|可比公司)/i,
  },
  {
    skill: PPTX_SKILL,
    pattern: /(?:\.pptx?\b|application\/vnd\.openxmlformats-officedocument\.presentationml\.presentation|power\s*point|\bppt\b|幻灯片|演示文稿|路演稿)/i,
  },
  {
    skill: DOCX_SKILL,
    pattern: /(?:\.docx\b|\bdocx\b|application\/vnd\.openxmlformats-officedocument\.wordprocessingml\.document|microsoft\s+word|word\s*文档|word文档|track\s*changes|修订模式|批注)/i,
  },
];

const presentationPattern =
  /(?:\.pptx?\b|application\/vnd\.openxmlformats-officedocument\.presentationml\.presentation|power\s*point|\bppt\b|幻灯片|演示文稿|路演稿)/i;
const batchPresentationPattern =
  /(?:多个|多份|批量|一批|batch|multiple)\s*(?:份|个)?\s*(?:ppt|pptx|演示文稿|presentation)?/i;
const longPresentationPattern = /(?:长篇|长deck|long\s+deck|大型演示)/i;

const isSwarmPresentationRequest = (text: string) => {
  if (!presentationPattern.test(text)) return false;
  if (batchPresentationPattern.test(text) || longPresentationPattern.test(text)) return true;
  const counts = [...text.matchAll(/(\d{1,3})\s*(?:页|slides?|张)(?:\s*(?:ppt|pptx|幻灯片))?/gi)];
  return counts.some((match) => Number(match[1]) >= 20);
};

const describeMessageForSkillResolution = (message: NormalizedChatMessage) => {
  const attachmentMetadata = (message.parts ?? [])
    .flatMap((part) => {
      if (part.type === "file") return [part.filename, part.mimeType];
      if (part.type === "image" && part.filename) return [part.filename, part.mediaType ?? ""];
      return [];
    })
    .filter(Boolean)
    .join(" ");
  return [message.content, attachmentMetadata].filter(Boolean).join(" ");
};

const getLatestUserSemanticText = (messages?: NormalizedChatMessage[]) => {
  for (let index = (messages?.length ?? 0) - 1; index >= 0; index -= 1) {
    const message = messages?.[index];
    if (message?.role === "user") return describeMessageForSkillResolution(message);
  }
  return "";
};

const resolveFromText = (text: string) => {
  if (isSwarmPresentationRequest(text)) return PPTX_SWARM_SKILL;
  for (const candidate of patterns) {
    if (candidate.pattern.test(text)) return candidate.skill;
  }
  return null;
};

export const resolveActiveSkillContext = (input: {
  question: string;
  messages?: NormalizedChatMessage[];
}): ActiveSkillContext | null => {
  // Prefer the current user turn and its attachment metadata. This avoids an old
  // document in conversation history hijacking a new explicit task.
  const current = `${input.question}\n${getLatestUserSemanticText(input.messages)}`;
  const currentSkill = resolveFromText(current);
  if (currentSkill) return currentSkill;

  const recent = (input.messages ?? [])
    .filter((message) => message.role === "user" || message.role === "assistant")
    .slice(-4)
    .map(describeMessageForSkillResolution)
    .join("\n");
  return resolveFromText(recent);
};

export const listBuiltInSkillContexts = (): ActiveSkillContext[] => [
  DOCX_SKILL,
  PDF_SKILL,
  XLSX_SKILL,
  PPTX_SKILL,
  PPTX_SWARM_SKILL,
];
