import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const packageRoot = path.resolve(scriptDir, "..");
const repoRoot = path.resolve(packageRoot, "../..");
const docsRoot = path.join(repoRoot, "docs");
const outputDir = path.join(packageRoot, "src", "generated");
const outputPath = path.join(outputDir, "docs-index.json");
const DAY_MS = 86_400_000;

const walkMarkdown = (directory) => {
  const files = [];
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    if ([".obsidian", "node_modules"].includes(entry.name)) continue;
    const absolutePath = path.join(directory, entry.name);
    if (entry.isDirectory()) files.push(...walkMarkdown(absolutePath));
    else if (entry.isFile() && entry.name.toLowerCase().endsWith(".md")) files.push(absolutePath);
  }
  return files;
};

const toPosix = (value) => value.split(path.sep).join("/");
const token = (value) => (value ?? "").trim().toLowerCase().replace(/[\s_]+/g, "-");
const metadataKey = (value) => value.trim().toLowerCase().replace(/[\s_-]+/g, "");
const stripScalar = (value) => {
  const trimmed = value.trim();
  const quoted =
    (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
    (trimmed.startsWith("'") && trimmed.endsWith("'"));
  return quoted ? trimmed.slice(1, -1).trim() : trimmed;
};
const parseBoolean = (value) => {
  const normalized = value.trim().toLowerCase();
  if (["true", "yes", "1"].includes(normalized)) return true;
  if (["false", "no", "0"].includes(normalized)) return false;
  return null;
};

const slugify = (value) =>
  value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9\u4e00-\u9fa5\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-");

const parseHeadings = (content) => {
  const headings = [];
  const anchorCounts = new Map();
  for (const line of content.split(/\r?\n/)) {
    const match = /^(#{1,6})\s+(.+?)\s*$/.exec(line);
    if (!match) continue;
    const baseAnchor = slugify(match[2]) || "section";
    const count = (anchorCounts.get(baseAnchor) ?? 0) + 1;
    anchorCounts.set(baseAnchor, count);
    headings.push({
      level: match[1].length,
      text: match[2].trim(),
      anchor: count === 1 ? baseAnchor : `${baseAnchor}-${count}`,
    });
  }
  return headings;
};

const parseMetadata = (content) => {
  const metadata = {
    status: null,
    owner: null,
    lastVerified: null,
    layer: null,
    module: null,
    feature: null,
    docType: null,
    canonical: false,
  };
  const fields = {
    status: "status",
    owner: "owner",
    lastverified: "lastVerified",
    layer: "layer",
    module: "module",
    feature: "feature",
    doctype: "docType",
    canonical: "canonical",
  };
  const lines = content.split(/\r?\n/);
  const yaml = lines[0]?.trim() === "---";

  for (let index = 0; index < Math.min(lines.length, 80); index += 1) {
    const trimmed = lines[index].trim();
    if (yaml && index > 0 && trimmed === "---") break;
    if (!yaml && /^#{2,6}\s+/.test(trimmed)) break;

    const match = /^([A-Za-z][A-Za-z\s_-]*):\s*(.*?)\s*$/.exec(trimmed);
    if (!match) continue;
    const target = fields[metadataKey(match[1])];
    if (!target) continue;
    if (target === "canonical") {
      metadata.canonical = parseBoolean(match[2]) ?? metadata.canonical;
      continue;
    }
    const value = stripScalar(match[2]);
    if (value) metadata[target] = value;
  }
  return metadata;
};

const stripFrontmatter = (content) =>
  content.startsWith("---")
    ? content.replace(/^---\r?\n[\s\S]*?\r?\n---\r?\n?/, "")
    : content;

const findTitle = (content, fallback) => /^#\s+(.+?)\s*$/m.exec(content)?.[1]?.trim() ?? fallback;

const findExcerpt = (content) =>
  stripFrontmatter(content)
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .filter((line) => !line.startsWith("#"))
    .filter(
      (line) =>
        !/^(status|owner|last verified|layer|module|feature|doc type|canonical|related):/i.test(
          line,
        ),
    )
    .filter((line) => !line.startsWith("- ") && !line.startsWith("|") && !line.startsWith("```"))[0]
    ?.replace(/^>\s*/, "") ?? "";

const sections = new Set([
  "maps",
  "concepts",
  "knowledge-system",
  "architecture",
  "build",
  "chat",
  "provider",
  "knowledge-base",
  "evaluation",
  "skill",
  "harness",
  "tooling-runtime",
  "microapp",
  "integrations",
  "role",
  "platform",
  "developments",
  "development",
  "project-control",
  "archive",
  "prompt-manager-rules",
  "assets",
]);
const classifySection = (relativePath) => {
  const first = relativePath.split("/")[0];
  return sections.has(first) ? first : "root";
};

const historicalStatuses = new Set([
  "historical", "history", "archived", "archive", "superseded", "deprecated",
  "retired", "obsolete", "closed", "completed", "cancelled", "canceled",
]);
const currentStatuses = new Set(["current", "stable", "verified", "production"]);
const activeStatuses = new Set(["active", "in-progress", "implementing", "working"]);
const planningStatuses = new Set([
  "planned", "planning", "draft", "proposal", "research", "experimental", "experiment", "poc",
]);
const historicalDocTypes = new Set(["historical", "retrospective", "archive"]);
const currentDocTypes = new Set([
  "current-contract", "current-snapshot", "overview", "reference", "how-to", "runbook", "schema",
]);
const activeDocTypes = new Set([
  "checklist", "implementation-notes", "workboard", "ledger", "status", "acceptance",
]);
const planningDocTypes = new Set(["plan", "draft", "design", "proposal", "research", "poc", "roadmap"]);

const inferLifecycle = (relativePath, metadata) => {
  const normalizedPath = relativePath.toLowerCase();
  const status = token(metadata.status);
  const docType = token(metadata.docType);
  const fileName = path.posix.basename(normalizedPath, ".md");

  if (
    normalizedPath === "archive/readme.md" &&
    currentStatuses.has(status) &&
    currentDocTypes.has(docType)
  ) return "current";

  if (
    normalizedPath.startsWith("archive/") ||
    normalizedPath.includes("/archive/") ||
    historicalStatuses.has(status) ||
    historicalDocTypes.has(docType)
  ) return "historical";
  if (currentStatuses.has(status)) return "current";
  if (activeStatuses.has(status)) return "active";
  if (planningStatuses.has(status)) return "planning";
  if (currentDocTypes.has(docType)) return "current";
  if (activeDocTypes.has(docType)) return "active";
  if (planningDocTypes.has(docType)) return "planning";
  if (/retrospective|legacy|deprecated|superseded|archive/.test(fileName)) return "historical";
  if (/poc|research|roadmap|proposal|draft|design|plan/.test(fileName)) return "planning";
  if (/checklist|workboard|ledger|status|acceptance|task/.test(fileName)) return "active";
  if (normalizedPath.startsWith("project-control/tasks/")) return "active";
  return "unverified";
};

const verificationState = (metadata, lifecycle, now) => {
  if (lifecycle !== "current") return "not-required";
  if (!metadata.lastVerified) return "missing";
  const verifiedAt = new Date(`${metadata.lastVerified}T00:00:00Z`);
  if (Number.isNaN(verifiedAt.getTime())) return "invalid";
  return Math.floor((now.getTime() - verifiedAt.getTime()) / DAY_MS) > 90 ? "stale" : "fresh";
};

const isPrimary = (metadata, lifecycle) =>
  lifecycle === "current" &&
  (metadata.canonical ||
    ["current-contract", "current-snapshot", "overview", "reference", "how-to"].includes(
      token(metadata.docType),
    ));

const lifecycleWeight = { current: 0, active: 1, planning: 2, historical: 3, unverified: 4 };
const sortDocuments = (documents) =>
  [...documents].sort((left, right) => {
    const lifecycleDelta = lifecycleWeight[left.lifecycle] - lifecycleWeight[right.lifecycle];
    if (lifecycleDelta) return lifecycleDelta;
    if (left.isPrimary !== right.isPrimary) return left.isPrimary ? -1 : 1;
    if (left.metadata.canonical !== right.metadata.canonical) {
      return left.metadata.canonical ? -1 : 1;
    }
    return left.title.localeCompare(right.title, "zh-CN");
  });

const normalizeWikiLinks = (content, knownPaths) =>
  content.replace(/\[\[([^\]]+)\]\]/g, (_match, rawTarget) => {
    const [rawPath, rawLabel] = rawTarget.split("|");
    const target = rawPath.trim();
    const label = rawLabel?.trim() || target;
    const normalized = target.endsWith(".md") ? target : `${target}.md`;
    const lower = normalized.toLowerCase();
    const resolved =
      knownPaths.find((item) => item === normalized) ??
      knownPaths.find((item) => item.toLowerCase() === lower) ??
      knownPaths.find((item) => item.endsWith(`/${normalized}`)) ??
      knownPaths.find((item) => item.toLowerCase().endsWith(`/${lower}`));
    return resolved ? `[${label}](DOC_ROUTE:/doc/${resolved.replace(/\.md$/i, "")})` : label;
  });

const groupCount = (documents, selector) =>
  documents.reduce((counts, document) => {
    const value = selector(document);
    if (value) counts[value] = (counts[value] ?? 0) + 1;
    return counts;
  }, {});

export const writeDocsIndex = () => {
  const files = walkMarkdown(docsRoot);
  const knownPaths = files.map((file) => toPosix(path.relative(docsRoot, file)));
  const generatedAt = new Date();

  const documents = sortDocuments(
    files.map((absolutePath) => {
      const relativePath = toPosix(path.relative(docsRoot, absolutePath));
      const content = normalizeWikiLinks(fs.readFileSync(absolutePath, "utf8"), knownPaths);
      const metadata = parseMetadata(content);
      const lifecycle = inferLifecycle(relativePath, metadata);
      return {
        id: relativePath.replace(/\.md$/i, ""),
        path: relativePath,
        title: findTitle(content, path.basename(relativePath, ".md")),
        section: classifySection(relativePath),
        metadata,
        lifecycle,
        verification: verificationState(metadata, lifecycle, generatedAt),
        isPrimary: isPrimary(metadata, lifecycle),
        excerpt: findExcerpt(content),
        headings: parseHeadings(content),
        content,
      };
    }),
  );

  const byLifecycle = (value) => documents.filter((document) => document.lifecycle === value);
  const nav = (items) => items.map((document) => ({ title: document.title, path: document.id }));
  const navigation = [
    { title: "首页", path: "README" },
    { title: "当前产品真相", path: "CURRENT_PRODUCT_TRUTH" },
    { title: "工程共同记忆", path: "ENGINEERING_MEMORY" },
    { title: "当前真相", children: nav(byLifecycle("current").filter((doc) => doc.isPrimary)) },
    { title: "施工与验证", children: nav(byLifecycle("active")) },
    { title: "方案与实验", children: nav(byLifecycle("planning")) },
    { title: "历史归档", children: nav(byLifecycle("historical")) },
    { title: "待核验", children: nav(byLifecycle("unverified")) },
  ];

  const output = {
    generatedAt: generatedAt.toISOString(),
    documents,
    navigation,
    stats: {
      total: documents.length,
      byLifecycle: {
        current: byLifecycle("current").length,
        active: byLifecycle("active").length,
        planning: byLifecycle("planning").length,
        historical: byLifecycle("historical").length,
        unverified: byLifecycle("unverified").length,
      },
      byVerification: {
        fresh: documents.filter((doc) => doc.verification === "fresh").length,
        stale: documents.filter((doc) => doc.verification === "stale").length,
        missing: documents.filter((doc) => doc.verification === "missing").length,
        invalid: documents.filter((doc) => doc.verification === "invalid").length,
      },
      byLayer: {
        rawSource: documents.filter((doc) => doc.metadata.layer === "raw-source").length,
        wiki: documents.filter((doc) => doc.metadata.layer === "wiki").length,
        schema: documents.filter((doc) => doc.metadata.layer === "schema").length,
      },
      byModule: groupCount(documents, (doc) => doc.metadata.module),
      byFeature: groupCount(documents, (doc) => doc.metadata.feature),
      byDocType: groupCount(documents, (doc) => doc.metadata.docType),
    },
  };

  fs.mkdirSync(outputDir, { recursive: true });
  fs.writeFileSync(outputPath, JSON.stringify(output, null, 2));
  return output;
};

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  writeDocsIndex();
}
