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
    if (entry.name === ".obsidian") {
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
  const lines = content.split(/\r?\n/);

  for (const line of lines) {
    const match = /^(#{1,6})\s+(.+?)\s*$/.exec(line);
    if (!match) {
      continue;
    }

    headings.push({
      level: match[1].length,
      text: match[2].trim(),
      anchor: slugify(match[2]) || "section",
    });
  }

  return headings;
};

const parseMetadata = (content) => {
  const lines = content.split(/\r?\n/);
  const metadata = {
    status: null,
    owner: null,
    lastVerified: null,
    layer: null,
    module: null,
    feature: null,
    docType: null,
  };

  for (const line of lines.slice(0, 16)) {
    if (line.startsWith("Status:")) {
      metadata.status = line.slice("Status:".length).trim();
    } else if (line.startsWith("Owner:")) {
      metadata.owner = line.slice("Owner:".length).trim();
    } else if (line.startsWith("Last verified:")) {
      metadata.lastVerified = line.slice("Last verified:".length).trim();
    } else if (line.startsWith("Layer:")) {
      metadata.layer = line.slice("Layer:".length).trim();
    } else if (line.startsWith("Module:")) {
      metadata.module = line.slice("Module:".length).trim();
    } else if (line.startsWith("Feature:")) {
      metadata.feature = line.slice("Feature:".length).trim();
    } else if (line.startsWith("Doc Type:")) {
      metadata.docType = line.slice("Doc Type:".length).trim();
    }
  }

  return metadata;
};

const findTitle = (content, fallback) => {
  const match = /^#\s+(.+?)\s*$/m.exec(content);
  return match?.[1]?.trim() ?? fallback;
};

const findExcerpt = (content) => {
  const lines = content
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .filter((line) => !line.startsWith("#"))
    .filter(
      (line) =>
        !/^Status:|^Owner:|^Last verified:|^Layer:|^Module:|^Feature:|^Doc Type:/.test(line),
    )
    .filter((line) => !line.startsWith("- "))
    .filter((line) => !line.startsWith("|"));

  return lines[0] ?? "";
};

const classifyTopLevel = (relativePath) => {
  const top = relativePath.split("/")[0];
  if (
    [
      "maps",
      "concepts",
      "knowledge-system",
      "architecture",
      "chat",
      "platform",
      "developments",
      "integrations",
      "role",
      "archive",
      "prompt-manager-rules",
      "assets",
    ].includes(top)
  ) {
    return top;
  }
  return "root";
};

const sortByTitle = (items) =>
  [...items].sort((left, right) => left.title.localeCompare(right.title, "zh-CN"));

const toNavChildren = (items) => sortByTitle(items).map((doc) => ({ title: doc.title, path: doc.id }));

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
    const target = rawTarget.trim();
    const normalized = target.endsWith(".md") ? target : `${target}.md`;
    const resolved =
      knownPaths.find((item) => item === normalized) ??
      knownPaths.find((item) => item.toLowerCase() === normalized.toLowerCase()) ??
      knownPaths.find((item) => item.endsWith(`/${normalized}`)) ??
      knownPaths.find((item) => item.toLowerCase().endsWith(`/${normalized.toLowerCase()}`));

    if (!resolved) {
      return target;
    }

    return `[${target}](DOC_ROUTE:/doc/${resolved.replace(/\.md$/i, "")})`;
  });

export const writeDocsIndex = () => {
  const markdownFiles = walk(docsRoot);
  const knownPaths = markdownFiles.map((filePath) =>
    pathToPosix(path.relative(docsRoot, filePath)),
  );

  const documents = markdownFiles
    .map((absolutePath) => {
      const relativePath = pathToPosix(path.relative(docsRoot, absolutePath));
      const rawContent = fs.readFileSync(absolutePath, "utf8");
      const content = normalizeWikiLinks(rawContent, knownPaths);
      const title = findTitle(content, path.basename(relativePath, ".md"));
      const metadata = parseMetadata(content);

      return {
        id: relativePath.replace(/\.md$/i, ""),
        path: relativePath,
        title,
        section: classifyTopLevel(relativePath),
        metadata,
        excerpt: findExcerpt(content),
        headings: parseHeadings(content),
        content,
      };
    })
    .sort((left, right) => left.path.localeCompare(right.path, "zh-CN"));

  const navigation = [
    { title: "首页", path: "README" },
    { title: "Vault", path: "VAULT_HOME" },
    {
      title: "专题文档",
      children: toNavChildren(
        documents.filter(
          (doc) => doc.section === "root" && !["README", "VAULT_HOME"].includes(doc.id),
        ),
      ),
    },
    {
      title: "区域导航",
      children: toNavChildren(documents.filter((doc) => doc.section === "maps")),
    },
    {
      title: "概念",
      children: toNavChildren(documents.filter((doc) => doc.section === "concepts")),
    },
    {
      title: "知识系统",
      children: toNavChildren(documents.filter((doc) => doc.section === "knowledge-system")),
    },
    {
      title: "集成专题",
      children: toNavChildren(documents.filter((doc) => doc.section === "integrations")),
    },
    {
      title: "实现文档",
      children: toNavChildren(
        documents.filter((doc) =>
          ["architecture", "chat", "platform", "developments", "role"].includes(doc.section),
        ),
      ),
    },
    {
      title: "Prompt Rules",
      children: toNavChildren(
        documents.filter((doc) => doc.section === "prompt-manager-rules"),
      ),
    },
    {
      title: "历史归档",
      children: toNavChildren(documents.filter((doc) => doc.section === "archive")),
    },
    {
      title: "资源说明",
      children: toNavChildren(documents.filter((doc) => doc.section === "assets")),
    },
  ];

  fs.mkdirSync(outputDir, { recursive: true });
  fs.writeFileSync(
    outputPath,
    JSON.stringify(
      {
        generatedAt: new Date().toISOString(),
        documents,
        navigation,
        stats: {
          total: documents.length,
          byLayer: {
            rawSource: countBy(documents, "layer", "raw-source"),
            wiki: countBy(documents, "layer", "wiki"),
            schema: countBy(documents, "layer", "schema"),
          },
          byModule: groupCountBy(documents, "module"),
          byFeature: groupCountBy(documents, "feature"),
          byDocType: {
            currentContract: countBy(documents, "docType", "current-contract"),
            reference: countBy(documents, "docType", "reference"),
            overview: countBy(documents, "docType", "overview"),
            design: countBy(documents, "docType", "design"),
            plan: countBy(documents, "docType", "plan"),
          },
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
