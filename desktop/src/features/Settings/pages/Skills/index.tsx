import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { parse as parseYaml, stringify as stringifyYaml } from "yaml";
import {
  Check,
  ChevronRight,
  File,
  FileSpreadsheet,
  FileText,
  Folder,
  FolderOpen,
  LoaderCircle,
  MoreHorizontal,
  Presentation,
  Search,
  Upload,
  X,
} from "lucide-react";
import { Button, Card, IconButton, MarkdownText, Result, Skeleton, TextInput } from "@/shared/ui";
import { ModalShell } from "@/shared/ui/Modal";
import {
  getWenshuSkillCatalog,
  importMarkdownSkill,
  installWenshuCapabilityPack,
  type WenshuSkillCatalog,
} from "@/shared/api/officeSuiteSkills";
import SettingsPageLayout from "../../components/SettingsPageLayout";
import { skillPresentations, type SkillPresentation } from "./catalog";

const categories = ["已添加", "精选技能", "办公效率", "商业金融", "内容创作", "学术研究", "营销增长", "工程研发"];
const OFFICE_SKILL_IDS = new Set(["docx", "xlsx", "pdf", "pptx"]);

const iconConfig = {
  spreadsheet: { Icon: FileSpreadsheet, className: "bg-emerald-50 text-emerald-500" },
  pdf: { Icon: FileText, className: "bg-red-50 text-red-400" },
  word: { Icon: FileText, className: "bg-blue-50 text-blue-500" },
  presentation: { Icon: Presentation, className: "bg-violet-50 text-violet-500" },
  markdown: { Icon: FileText, className: "bg-surface-secondary text-text-tertiary" },
};

const parseMarkdownDocument = (content: string) => {
  const lines = content.replace(/\r\n/g, "\n").split("\n");
  if (lines[0]?.trim() !== "---") return { body: content, metadata: [] as Array<[string, unknown]> };

  const closingIndex = lines.findIndex((line, index) => index > 0 && line.trim() === "---");
  if (closingIndex === -1) return { body: content, metadata: [] as Array<[string, unknown]> };

  try {
    const parsed = parseYaml(lines.slice(1, closingIndex).join("\n")) as unknown;
    const metadata = parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? Object.entries(parsed as Record<string, unknown>)
      : [];

    return {
      body: lines.slice(closingIndex + 1).join("\n").trimStart(),
      metadata,
    };
  } catch {
    return { body: content, metadata: [] as Array<[string, unknown]> };
  }
};

const formatMetadataValue = (value: unknown) => {
  if (value === null || value === undefined) return "-";
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  return stringifyYaml(value).trim();
};

export default function SkillsSettings() {
  const navigate = useNavigate();
  const importInputRef = useRef<HTMLInputElement | null>(null);
  const [activeCategory, setActiveCategory] = useState("已添加");
  const [query, setQuery] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const [selectedSkill, setSelectedSkill] = useState<SkillPresentation | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [catalog, setCatalog] = useState<WenshuSkillCatalog | null>(null);
  const [installingSkillId, setInstallingSkillId] = useState<string | null>(null);
  const [importingSkill, setImportingSkill] = useState(false);
  const [catalogLoading, setCatalogLoading] = useState(true);
  const [catalogError, setCatalogError] = useState<string | null>(null);

  const loadCatalog = useCallback(async () => {
    setCatalogLoading(true);
    setCatalogError(null);
    try {
      setCatalog(await getWenshuSkillCatalog());
    } catch (error) {
      setCatalogError(error instanceof Error ? error.message : "技能目录加载失败");
    } finally {
      setCatalogLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadCatalog();
  }, [loadCatalog]);

  const skills = useMemo(
    () => catalog?.skills.map((definition) => {
      const presentation = skillPresentations.find((candidate) => candidate.id === definition.id);
      if (!presentation) {
        const icon = definition.id === "xlsx"
          ? "spreadsheet"
          : definition.id === "pdf"
            ? "pdf"
            : definition.id === "docx"
              ? "word"
              : definition.id === "pptx"
                ? "presentation"
                : "markdown";
        return {
          id: definition.id,
          name: definition.name,
          source: definition.source,
          category: definition.category,
          description: definition.description,
          icon,
          bundled: definition.bundled,
          runtimePack: definition.runtimePack?.id,
          usePath: OFFICE_SKILL_IDS.has(definition.id) ? "/settings/micro-apps/office-suite" : undefined,
          content: definition.content || `# ${definition.name}\n\n${definition.description}`,
          files: definition.packageFiles,
          fileContents: definition.fileContents || {},
        } satisfies SkillPresentation;
      }
      return {
        ...presentation,
        name: definition.name,
        source: definition.source,
        category: definition.category,
        description: definition.description,
        bundled: definition.bundled,
        runtimePack: definition.runtimePack?.id,
        content: definition.content || presentation.content,
        files: definition.packageFiles,
        fileContents: { ...presentation.fileContents, ...(definition.fileContents || {}) },
      };
    }) ?? [],
    [catalog],
  );

  const isInstalled = (skill: SkillPresentation) =>
    Boolean(skill.bundled) ||
    (skill.runtimePack === "wenshu-office" && Boolean(
      catalog?.pack.installed &&
      catalog.pack.missing.length === 0 &&
      !catalog.pack.error,
    ));

  const visibleSkills = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return skills.filter((skill) => {
      const matchesCategory = activeCategory === "已添加"
        ? isInstalled(skill)
        : activeCategory === "精选技能" || skill.category === activeCategory;
      const matchesQuery = !normalizedQuery || `${skill.name} ${skill.description}`.toLowerCase().includes(normalizedQuery);
      return matchesCategory && matchesQuery;
    });
  }, [activeCategory, catalog?.pack.installed, query, skills]);

  const showNotice = (message: string) => {
    setNotice(message);
    window.setTimeout(() => setNotice(null), 2600);
  };

  const handleImport = async (file: File) => {
    setImportingSkill(true);
    try {
      const imported = await importMarkdownSkill(file);
      await loadCatalog();
      setActiveCategory("已添加");
      setQuery("");
      showNotice(`「${imported.name}」已生成并添加，可在聊天中用 $${imported.id} 触发`);
    } catch (error) {
      showNotice(error instanceof Error ? error.message : "Markdown Skill 导入失败");
    } finally {
      setImportingSkill(false);
      if (importInputRef.current) importInputRef.current.value = "";
    }
  };

  const useSkill = async (skill: SkillPresentation) => {
    if (skill.runtimePack === "wenshu-office" && !isInstalled(skill)) {
      setInstallingSkillId(skill.id);
      showNotice("正在下载并安装文枢增强能力包…");
      try {
        const pack = await installWenshuCapabilityPack();
        setCatalog((current) => current ? { ...current, pack } : current);
        if (!pack.installed || pack.missing.length > 0 || pack.error) {
          showNotice(pack.error || "本地依赖未完整安装");
          return;
        }
        if (!catalog) {
          const refreshed = await getWenshuSkillCatalog();
          setCatalog(refreshed);
        }
        showNotice("文枢增强能力包已安装");
      } catch (error) {
        showNotice(error instanceof Error ? error.message : "文枢增强能力包安装失败");
        return;
      } finally {
        setInstallingSkillId(null);
      }
    }

    if (skill.usePath) {
      setSelectedSkill(null);
      navigate(skill.usePath);
      return;
    }
    showNotice(`已添加。可在聊天中使用 $${skill.id} 显式触发「${skill.name}」`);
  };

  return (
    <>
      <SettingsPageLayout
        miniTitle="SKILLS"
        title="技能"
        description="将经验、方法和文档转化为技能，相似任务轻松复用"
        contentClassName="pt-5"
      >
        <div className="space-y-5">
          <div className="flex min-w-0 items-center gap-3">
            <div className="stable-scrollbar min-w-0 flex-1 overflow-x-auto pb-1">
              <div className="flex gap-1">
                {categories.map((category) => (
                  <Button key={category} size="xs" variant={activeCategory === category ? "secondary" : "ghost"} onClick={() => setActiveCategory(category)} className="shrink-0">
                    {category}
                  </Button>
                ))}
              </div>
            </div>

            <input
              ref={importInputRef}
              type="file"
              accept=".md,text/markdown,text/plain"
              className="hidden"
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (file) void handleImport(file);
              }}
            />
            <Button size="xs" variant="secondary" disabled={importingSkill} onClick={() => importInputRef.current?.click()}>
              {importingSkill ? <LoaderCircle size={14} className="animate-spin" /> : <Upload size={14} />}
              {importingSkill ? "生成中…" : "导入 Markdown"}
            </Button>
            <div
              className={`h-8 shrink-0 overflow-hidden transition-[width] duration-200 ease-out ${searchOpen ? "w-40" : "w-8"}`}
            >
              {searchOpen ? (
                <TextInput autoFocus ariaLabel="搜索技能" compact placeholder="搜索技能" value={query} onChange={setQuery} onBlur={() => setSearchOpen(false)} />
              ) : (
                <IconButton ariaLabel="搜索技能" size="sm" styleType="filled" onClick={() => setSearchOpen(true)}>
                  <Search size={17} />
                </IconButton>
              )}
            </div>
          </div>

          {catalogLoading ? (
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2"><Skeleton.Card showAvatar /><Skeleton.Card showAvatar /><Skeleton.Card showAvatar /></div>
          ) : catalogError ? (
            <Result variant="danger" size="sm" title="技能目录加载失败" description={catalogError} action={<Button size="sm" variant="secondary" onClick={() => void loadCatalog()}>重新加载</Button>} />
          ) : visibleSkills.length ? (
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              {visibleSkills.map((skill) => (
                <SkillCard
                  key={skill.id}
                  skill={skill}
                  installed={isInstalled(skill)}
                  onOpen={() => setSelectedSkill(skill)}
                />
              ))}
            </div>
          ) : (
            <Result size="sm" icon={<Search className="h-4 w-4" />} title="没有匹配的技能" description="试试其他分类或搜索关键词" />
          )}
        </div>
      </SettingsPageLayout>

      {notice ? <div role="status" className="fixed bottom-6 left-1/2 z-50 -translate-x-1/2 rounded-[10px] bg-ink px-4 py-2 text-xs text-white shadow-shadow-md">{notice}</div> : null}
      {selectedSkill ? (
        <SkillDetail
          skill={selectedSkill}
          installed={isInstalled(selectedSkill)}
          installing={installingSkillId === selectedSkill.id}
          packMissing={selectedSkill.runtimePack === "wenshu-office" ? catalog?.pack.missing ?? [] : []}
          onClose={() => setSelectedSkill(null)}
          onUse={() => void useSkill(selectedSkill)}
        />
      ) : null}
    </>
  );
}

function SkillCard({ skill, installed, onOpen }: { skill: SkillPresentation; installed: boolean; onOpen: () => void }) {
  const { Icon, className } = iconConfig[skill.icon];
  return (
    <Card interactive padding="none" className="min-h-[132px] overflow-hidden">
      <button type="button" onClick={onOpen} className="group block h-full w-full p-4 text-left">
        <div className="flex items-start gap-3">
          <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-[11px] ${className}`}><Icon size={22} /></div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <h4 className="truncate text-sm font-semibold text-text-primary">{skill.name}</h4>
              <span className={`text-xs ${installed ? "text-success-text" : "text-text-tertiary"}`}>{installed ? "已添加" : "未添加"}</span>
            </div>
            <p className="mt-1 text-xs text-text-tertiary">来自 {skill.source}</p>
          </div>
          <MoreHorizontal size={17} className="text-text-tertiary opacity-0 transition group-hover:opacity-100" />
        </div>
        <p className="mt-4 line-clamp-2 text-xs leading-5 text-text-secondary">{skill.description}</p>
      </button>
    </Card>
  );
}

function SkillDetail({
  skill,
  installed,
  installing,
  packMissing,
  onClose,
  onUse,
}: {
  skill: SkillPresentation;
  installed: boolean;
  installing: boolean;
  packMissing: string[];
  onClose: () => void;
  onUse: () => void;
}) {
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set(["reference", "runtime", "scripts", "templates"]));
  const [selectedFile, setSelectedFile] = useState("SKILL.md");
  const rootFiles = skill.files.filter((file) => !file.includes("/"));
  const folderEntries = Array.from(new Set(skill.files.filter((file) => file.includes("/")).map((file) => file.split("/")[0]))).map((folder) => ({
    folder,
    files: skill.files.filter((file) => file.startsWith(`${folder}/`)).map((file) => file.slice(folder.length + 1)),
  }));
  const toggleFolder = (folder: string) => setExpandedFolders((current) => {
    const next = new Set(current);
    if (next.has(folder)) next.delete(folder);
    else next.add(folder);
    return next;
  });
  const selectedContent = selectedFile === "SKILL.md"
    ? skill.content
    : skill.fileContents[selectedFile];
  const extension = selectedFile.split(".").pop()?.toLowerCase() ?? "";
  const isMarkdownFile = extension === "md";
  const isSourceCodeFile = ["ts", "tsx", "js", "jsx", "py"].includes(extension);
  const markdownDocument = selectedContent && isMarkdownFile
    ? parseMarkdownDocument(selectedContent)
    : { body: selectedContent ?? "", metadata: [] as Array<[string, unknown]> };
  const previewContent = markdownDocument.body;

  return (
    <ModalShell
      open
      onClose={onClose}
      width={1080}
      height="calc(100vh - 32px)"
      showCloseButton={false}
      footer={null}
      bodyClassName="flex overflow-hidden p-0"
      title={<div className="flex w-full min-w-0 items-center gap-3"><span className="truncate">{skill.name}</span><span className={`text-xs ${installed ? "text-success-text" : "text-text-tertiary"}`}>{installed ? "已添加" : "未添加"}</span><div className="ml-auto flex shrink-0 items-center gap-1"><Button size="xs" variant="secondary" onClick={onUse} disabled={installing}>{installing ? <LoaderCircle size={14} className="animate-spin" /> : <Check size={14} />}{installing ? "安装中…" : "去使用"}</Button><IconButton ariaLabel="关闭" size="sm" onClick={onClose}><X size={18} /></IconButton></div></div>}
    >
      <div className="grid h-full min-h-0 w-full grid-cols-[280px_minmax(0,1fr)]">
        <aside className="stable-scrollbar min-h-0 overflow-y-auto border-r border-border px-5 py-5">
          <p className="px-2 text-[11px] font-semibold uppercase tracking-[0.1em] text-text-tertiary">关于</p>
          <p className="mt-3 px-2 text-xs leading-6 text-text-secondary">{skill.description}</p>
          <p className="mt-5 border-t border-border px-2 pt-4 text-xs text-text-secondary">来自 {skill.source}</p>
          {skill.runtimePack && !installed ? <p className="mt-4 px-2 text-[11px] leading-5 text-text-secondary">本地依赖尚未完整安装，首次使用时会执行安装。{packMissing.length ? ` 当前缺少：${packMissing.join(", ")}` : ""}</p> : null}
          <div className="mt-5 border-t border-border pt-4">
            <p className="px-2 text-[11px] font-semibold uppercase tracking-[0.1em] text-text-tertiary">文件</p>
            <div className="mt-2 space-y-0.5">
              {rootFiles.map((file) => <FileTreeRow key={file} label={file} selected={selectedFile === file} onClick={() => setSelectedFile(file)} />)}
              {folderEntries.map(({ folder, files }) => <div key={folder}><Button type="button" size="xs" variant="ghost" onClick={() => toggleFolder(folder)} className="w-full !justify-start gap-1.5 text-left">{expandedFolders.has(folder) ? <FolderOpen size={14} className="shrink-0 text-text-tertiary" /> : <Folder size={14} className="shrink-0 text-text-tertiary" />}<span className="min-w-0 flex-1 truncate">{folder}</span><ChevronRight size={13} className={`ml-auto shrink-0 transition-transform ${expandedFolders.has(folder) ? "rotate-90" : ""}`} /></Button>{expandedFolders.has(folder) ? <div className="ml-3 border-l border-border pl-2">{files.map((file) => { const fullPath = `${folder}/${file}`; return <FileTreeRow key={fullPath} label={file} selected={selectedFile === fullPath} onClick={() => setSelectedFile(fullPath)} />; })}</div> : null}</div>)}
            </div>
          </div>
        </aside>
        <main className="flex min-h-0 min-w-0 flex-col">
          <div className="flex h-14 shrink-0 items-center border-b border-border px-6"><h3 className="truncate text-lg font-semibold text-text-primary">{selectedFile}</h3></div>
          <div className="stable-scrollbar min-h-0 flex-1 overflow-y-auto">
            <div className="mx-auto w-full max-w-[760px] px-6 py-6">
              {isSourceCodeFile ? (
                <Result size="sm" title="接口未提供文件内容" description="当前技能目录接口只返回文件列表，无法预览该源码文件。" />
              ) : isMarkdownFile && (previewContent || markdownDocument.metadata.length > 0) ? (
                <>
                  {markdownDocument.metadata.length > 0 ? <dl className="mb-6 grid grid-cols-[96px_minmax(0,1fr)] gap-x-4 gap-y-2 border-b border-border pb-5 text-sm">{markdownDocument.metadata.map(([key, value]) => <div key={key} className="contents"><dt className="font-mono text-xs leading-6 text-text-tertiary">{key}</dt><dd className="min-w-0 whitespace-pre-wrap leading-6 text-text-secondary">{formatMetadataValue(value)}</dd></div>)}</dl> : null}
                  {previewContent ? <MarkdownText features="basic" className="[&_h1]:mt-7 [&_h1:first-child]:mt-0 [&_h1]:text-xl [&_h1]:font-semibold [&_h1]:leading-8 [&_h1]:tracking-normal [&_h2]:mt-6 [&_h2]:text-lg [&_h2]:font-semibold [&_h2]:tracking-normal [&_h3]:mt-5 [&_h3]:text-base [&_h3]:font-semibold [&_h3]:tracking-normal">{previewContent}</MarkdownText> : null}
                </>
              ) : previewContent ? (
                <pre className="whitespace-pre-wrap font-mono text-xs leading-6 text-text-primary">{previewContent}</pre>
              ) : (
                <Result size="sm" title="暂无预览内容" description="当前接口未返回该文件的内容。" />
              )}
            </div>
          </div>
        </main>
      </div>
    </ModalShell>
  );
}

function FileTreeRow({ label, selected, onClick }: { label: string; selected: boolean; onClick: () => void }) {
  return <Button type="button" size="xs" variant={selected ? "secondary" : "ghost"} onClick={onClick} className="w-full !justify-start text-left"><File size={14} className="shrink-0 text-text-tertiary" /><span className="min-w-0 flex-1 truncate">{label}</span></Button>;
}
