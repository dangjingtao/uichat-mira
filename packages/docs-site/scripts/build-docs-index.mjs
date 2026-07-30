import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const packageRoot = path.resolve(scriptDir, "..");
const repoRoot = path.resolve(packageRoot, "../..");
const docsRoot = path.join(repoRoot, "docs");
const outputDir = path.join(packageRoot, "src", "generated");
const outputPath = path.join(outputDir, "docs-index.json");

const isMarkdownFile = (filePath) => filePath.toLowerCase().endsWith(".md");

const walk = (dirPath) => {
  const entries = fs.readdirSync(dirPath, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    if ([".obsidian", "node_modules"].includes(entry.name)) {
      continue;
    }

    const absolutePath = path.join(dirPath, entry.name);
    if (entry.isDirectory()) {
      files.push(...walk(absolutePath));
      continue;
    }

    if (entry.isFile() && isMarkdownFile(absolutePath)) {
      files.push(absolutePath);
    }
  }

  return files;
};

const pathToPosix = (value) => value.split(path.sep).join("/");

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
    if (!match) {
      continue;
    }

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

const normalizeMetadataKey = (value) =>
  value
    .trim()
    .toLowerCase()
    .replace(/[\s_-]+/g, "");

const stripScalar = (value) => {
  const trimmed = value.trim();
  if (
    (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
    (trimmed.startsWith("'") && trimmed.endsWith("'"))
  ) {
    return trimmed.slice(1, -1).trim();
  }
  return trimmed;
};

const parseBoolean = (value) => {
  const normalized = value.trim().toLowerCase();
  if (["true", "yes", "1"].includes(normalized)) {
    return true;
  }
  if (["false", "no", "0"].includes(normalized)) {
    return false;
  }
  return null;
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

  const keyMap = {
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
  const startsWithFrontmatter = lines[0]?.trim() === "---";
  let frontmatterClosed = !startsWithFrontmatter;

  for (let index = 0; index < Math.min(lines.length, 80); index += 1) {
    const line = lines[index];
    const trimmed = line.trim();

    if (startsWithFrontmatter && index > 0 && trimmed === "---") {
      frontmatterClosed = true;
      continue;
    }

    if (frontmatterClosed && /^#{2,6}\s+/.test(trimmed)) {
      break;
    }

    const match = /^([A-Za-z][A-Za-z\s_-]*):\s*(.*?)\s*$/.exec(trimmed);
    if (!match) {
      continue;
    }

    const targetKey = keyMap[normalizeMetadataKey(match[1])];
    if (!targetKey) {
      continue;
    }

    if (targetKey === "canonical") {
      metadata.canonical = parseBoolean(match[2]) ?? metadata.canonical;
      continue;
    }

    const value = stripScalar(match[2]);
    if (value) {
      metadata[targetKey] = value;
    }
  }

  return metadata;
};

const findTitle = (content, fallback) => {
  const match = /^#\s+(.+?)\s*$/m.exec(content);
  return match?.[1]?.trim() ?? fallback;
};

const findExcerpt = (content) => {
  const bodyContent = content.startsWith("---")
    ? content.replace(/^---\r?\n[\s\S]*?\r?\n---\r?\n?/, "")
    : content;
  const lines = bodyContent
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
    .filter((line) => !line.startsWith("- "))
    .filter((line) => !line.startsWith("|"))
    .filter((line) => !line.startsWith("```"));

  return lines[0]?.replace(/^>\s*/, "") ?? "";
};

const topLevelSections = new Set([
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

const classifyTopLevel = (relativePath) => {
  const top = relativePath.split("/")[0];
  return topLevelSections.has(top) ? top : "root";
};

const normalizeToken = (value) =>
  (value ?? "")
    .trim()
    .toLowerCase()
    .replace(/[\s_]+/g, "-");

const historicalStatuses = new Set([
  "historical",
  "history",
  "archived",
  "archive",
  "superseded",
  "deprecated",
  "retired",
  "obsolete",
  "closed",
  "completed",
  "cancelled",
  "canceled",
]);
const currentStatuses = new Set(["current", "stable", "verified", "production"]);
const activeStatuses = new Set(["active", "in-progress", "implementing", "working"]);
const planningStatuses = new Set([
  "planned",
  "planning",
  "draft",
  "proposal",
  "research",
  "experimental",
  "experiment",
  "poc",
]);

const historicalDocTypes = new Set(["historical", "retrospective", "archive"]);
const currentDocTypes = new Set([
  "current-contract",
  "current-snapshot",
  "overview",
  "reference",
  "how-to",
  "runbook",
  "schema",
]);
const activeDocTypes = new Set([
  "checklist",
  "implementation-notes",
  "workboard",
  "ledger",
  "status",
  "acceptance",
]);
const planningDocTypes = new Set([
  "plan",
  "draft",
  "design",
  "proposal",
  "research",
  "poc",
  "roadmap",
]);

const inferLifecycle = ({ relativePath, metadata }) => {
  const normalizedPath = relativePath.toLowerCase();
  const status = normalizeToken(metadata.status);
  const docType = normalizeToken(metadata.docType);
  const fileName = path.posix.basename(normalizedPath, ".md");

  if (
    normalizedPath === "archive/readme.md" &&
    currentStatuses.has(status) &&
    currentDocTypes.has(docType)
  ) {
    return "current";
  }

  if (
    normalizedPath.startsWith("archive/") ||
    normalizedPath.includes("/archive/") ||
    historicalStatuses.has(status) ||
    historicalDocTypes.has(docType)
  ) {
    return "historical";
  }

  if (currentStatuses.has(status)) {
    return "current";
  }

  if (activeStatuses.has(status)) {
    return "active";
  }

  if (planningStatuses.has(status)) {
    return "planning";
  }

  if (currentDocTypes.has(docType)) {
    return "current";
  }

  if (activeDocTypes.has(docType)) {
    return "active";
  }

  if (planningDocTypes.has(docType)) {
    return "planning";
  }

  if (/retrospective|legacy|deprecated|superseded|archive/.test(fileName)) {
    return "historical";
  }

  if (/poc|research|roadmap|proposal|draft|design|plan/.test(fileName)) {
    return "planning";
  }

  if (/checklist|workboard|ledger|status|acceptance|task/.test(fileName)) {
    return "active";
  }

  if (normalizedPath.startsWith("project-control/tasks/")) {
    return "active";
  }

  return "unverified";
};

const getVerificationState = (metadata, lifecycle, now = new Date()) => {
  if (lifecycle !== "current") {
    return "not-required";
  }

  if (!metadata.lastVerified) {
    return "missing";
  }

  const verifiedAt = new Date(`${metadata.lastVerified}T00:00:00Z`);
  if (Number.isNaN(verifiedAt.getTime())) {
    return "invalid";
  }

  const ageInDays = Math.floor((now.getTime() - verifiedAt.getTime()) / 86_400_000);
  return ageInDays > 90 ? "stale" : "fresh";
};

const isPrimaryDocument = (metadata, lifecycle) =>
  lifecycle === "current" &&
  (metadata.canonical ||
    ["current-contract", "current-snapshot", "overview", "reference", "how-to"].includes(
      normalizeToken(metadata.docType),
    ));

const sortByTruthPriority = (items) => {
  const lifecycleWeight = {
    current: 0,
    active: 1,
    planning: 2,
    historical: 3,
    unverified: 4,
  };

  return [...items].sort((left, right) => {
    const lifecycleDelta =
      (lifecycleWeight[left.lifecycle] ?? 99) - (lifecycleWeight[right.lifecycle] ?? 99);
    if (lifecycleDelta !== 0) {
      return lifecycleDelta;
    }

    if (left.isPrimary !== right.isPrimary) {
      return left.isPrimary ? -1 : 1;
    }

    if (left.metadata.canonical !== right.metadata.canonical) {
      return left.metadata.canonical ? -1 : 1;
    }

    return left.title.localeCompare(right.title, "zh-CN");
  });
};

const toNavChildren = (items) =>
  sortByTruthPriority(items).map((doc) => ({ title: doc.title, path: doc.id }));

const countBy = (documents, field, value) =>
  documents.filter((doc) => doc.metadata?.[field] === value).length;

const groupCountBy = (documents, field) =>
  documents.reduce((accumulator, document) => {
    const value = document.metadata?.[field];
    if (!value) {
      return accumulator;
    }

    accumulator[value] = (accumulator[value] ?? 0) + 1;
    return accumulator;
  }, {});

const normalizeWikiLinks = (content, knownPaths) =>
  content.replace(/\[\[([^\]]+)\]\]/g, (_match, rawTarget) => {
    const [rawPath, rawLabel] = rawTarget.split("|");
    const target = rawPath.trim();
    const label = rawLabel?.trim() || target;
    const normalized = target.endsWith(".md") ? target : `${target}.md`;
    const resolved =
      knownPaths.find((item) => item === normalized) ??
      knownPaths.find((item) => item.toLowerCase() === normalized.toLowerCase()) ??
      knownPaths.find((item) => item.endsWith(`/${normalized}`)) ??
      knownPaths.find((item) => item.toLowerCase().endsWith(`/${normalized.toLowerCase()}`));

    if (!resolved) {
      return label;
    }

    return `[${label}](DOC_ROUTE:/doc/${resolved.replace(/\.md$/i, "")})`;
  });

export const writeDocsIndex = () => {
  const markdownFiles = walk(docsRoot);
  const knownPaths = markdownFiles.map((filePath) =>
    pathToPosix(path.relative(docsRoot, filePath)),
  );
  const generatedAt = new Date();

  const documents = markdownFiles.map((absolutePath) => {
    const relativePath = pathToPosix(path.relative(docsRoot, absolutePath));
    const rawContent = fs.readFileSync(absolutePath, "utf8");
    const content = normalizeWikiLinks(rawContent, knownPaths);
    const metadata = parseMetadata(content);
    const lifecycle = inferLifecycle({ relativePath, metadata });

    return {
      id: relativePath.replace(/\.md$/i, ""),
      path: relativePath,
      title: findTitle(content, path.basename(relativePath, ".md")),
      section: classifyTopLevel(relativePath),
      metadata,
      lifecycle,
      verification: getVerificationState(metadata, lifecycle, generatedAt),
      isPrimary: isPrimaryDocument(metadata, lifecycle),
      excerpt: findExcerpt(content),
      headings: parseHeadings(content),
      content,
    };
  });

  const sortedDocuments = sortByTruthPriority(documents);
  const documentsByLifecycle = (lifecycle) =>
    sortedDocuments.filter((document) => document.lifecycle === lifecycle);

  const navigation = [
    { title: "首页", path: "README" },
    { title: "当前产品真相", path: "CURRENT_PRODUCT_TRUTH" },
    { title: "工程共同记忆", path: "ENGINEERING_MEMORY" },
    {
      title: "当前真相",
      children: toNavChildren(documentsByLifecycle("current").filter((doc) => doc.isPrimary)),
    },
    {
      title: "施工与验证",
      children: toNavChildren(documentsByLifecycle("active")),
    },
    {
      title: "方案与实验",
      children: toNavChildren(documentsByLifecycle("planning")),
    },
    {
      title: "历史归档",
      children: toNavChildren(documentsByLifecycle("historical")),
    },
    {
      title: "待核验",
      children: toNavChildren(documentsByLifecycle("unverified")),
    },
  ];

  fs.mkdirSync(outputDir, { recursive: true });
  fs.writeFileSync(
    outputPath,
    JSON.stringify(
      {
        generatedAt: generatedAt.toISOString(),
        documents: sortedDocuments,
        navigation,
        stats: {
          total: sortedDocuments.length,
          byLifecycle: {
            current: documentsByLifecycle("current").length,
            active: documentsByLifecycle("active").length,
            planning: documentsByLifecycle("planning").length,
            historical: documentsByLifecycle("historical").length,
            unverified: documentsByLifecycle("unverified").length,
          },
          byVerification: {
            fresh: sortedDocuments.filter((doc) => doc.verification === "fresh").length,
            stale: sortedDocuments.filter((doc) => doc.verification === "stale").length,
            missing: sortedDocuments.filter((doc) => doc.verification === "missing").length,
            invalid: sortedDocuments.filter((doc) => doc.verification === "invalid").length,
          },
          byLayer: {
            rawSource: countBy(sortedDocuments, "layer", "raw-source"),
            wiki: countBy(sortedDocuments, "layer", "wiki"),
            schema: countBy(sortedDocuments, "layer", "schema"),
          },
          byModule: groupCountBy(sortedDocuments, "module"),
          byFeature: groupCountBy(sortedDocuments, "feature"),
          byDocType: groupCountBy(sortedDocuments, "docType"),
        },
      },
      null,
      2,
    ),
  );
};

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  writeDocsIndex();
}
