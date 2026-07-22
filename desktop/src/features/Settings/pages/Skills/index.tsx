import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Check,
  ChevronRight,
  File,
  FileCode2,
  FileSpreadsheet,
  FileText,
  Folder,
  FolderOpen,
  LoaderCircle,
  MoreHorizontal,
  Presentation,
  Search,
  X,
} from "lucide-react";
import { Badge, Button, Card, IconButton, Result } from "@/shared/ui";
import { ModalShell } from "@/shared/ui/Modal";
import {
  getWenshuSkillCatalog,
  installWenshuCapabilityPack,
  type WenshuSkillCatalog,
} from "@/shared/api/officeSuiteSkills";
import SettingsPageLayout from "../../components/SettingsPageLayout";
import { skillPresentations, type SkillPresentation } from "./catalog";

const categories = ["已添加", "精选技能", "办公效率", "商业金融", "内容创作", "学术研究", "营销增长", "工程研发"];

const iconConfig = {
  spreadsheet: { Icon: FileSpreadsheet, className: "bg-emerald-50 text-emerald-500" },
  pdf: { Icon: FileText, className: "bg-red-50 text-red-400" },
  word: { Icon: FileText, className: "bg-blue-50 text-blue-500" },
  presentation: { Icon: Presentation, className: "bg-violet-50 text-violet-500" },
  code: { Icon: FileCode2, className: "bg-violet-50 text-violet-500" },
};

export default function SkillsSettings() {
  const navigate = useNavigate();
  const [activeCategory, setActiveCategory] = useState("已添加");
  const [query, setQuery] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const [selectedSkill, setSelectedSkill] = useState<SkillPresentation | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [catalog, setCatalog] = useState<WenshuSkillCatalog | null>(null);
  const [installingSkillId, setInstallingSkillId] = useState<string | null>(null);

  useEffect(() => {
    void getWenshuSkillCatalog()
      .then(setCatalog)
      .catch(() => {
        // Keep the catalog page usable if the local backend is still starting.
      });
  }, []);

  const skills = useMemo(
    () => skillPresentations.map((presentation) => {
      const definition = catalog?.skills.find((candidate) => candidate.id === presentation.id);
      if (!definition) return presentation;
      return {
        ...presentation,
        name: definition.name,
        source: definition.source,
        category: definition.category,
        description: definition.description,
        files: definition.packageFiles,
      };
    }),
    [catalog],
  );

  const isInstalled = (skill: SkillPresentation) =>
    Boolean(skill.bundled) ||
    (skill.runtimePack === "wenshu-office" && Boolean(catalog?.pack.installed));

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

  const useSkill = async (skill: SkillPresentation) => {
    if (skill.runtimePack === "wenshu-office" && !catalog?.pack.installed) {
      setInstallingSkillId(skill.id);
      showNotice("正在下载并安装文枢增强能力包…");
      try {
        const pack = await installWenshuCapabilityPack();
        setCatalog((current) => current ? { ...current, pack } : current);
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
    showNotice(`「${skill.name}」暂未配置使用入口`);
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

            {searchOpen ? <input autoFocus aria-label="搜索技能" placeholder="搜索技能" value={query} onChange={(event) => setQuery(event.target.value)} className="h-9 w-40 rounded-ui-control border border-border bg-surface-primary px-3 text-xs text-text-primary outline-none focus:border-text-tertiary" /> : <IconButton ariaLabel="搜索技能" size="sm" styleType="filled" onClick={() => setSearchOpen(true)}><Search size={17} /></IconButton>}
          </div>

          {visibleSkills.length ? (
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
          onAction={showNotice}
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
              {installed ? <Badge variant="success">已添加</Badge> : null}
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
  onAction,
}: {
  skill: SkillPresentation;
  installed: boolean;
  installing: boolean;
  packMissing: string[];
  onClose: () => void;
  onUse: () => void;
  onAction: (message: string) => void;
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
    : skill.fileContents[selectedFile] ?? `# ${selectedFile}\n\n该文件属于「${skill.name}」技能包，当前展示区只公开其包结构与运行时归属。`;

  return (
    <ModalShell
      open
      onClose={onClose}
      width={1080}
      height="calc(100vh - 32px)"
      showCloseButton={false}
      footer={null}
      bodyClassName="p-0"
      title={<div className="flex items-center gap-3"><span>{skill.name}</span>{installed ? <Badge variant="success">已添加</Badge> : null}<div className="ml-auto flex items-center gap-1"><Button size="xs" variant="secondary" onClick={onUse} disabled={installing}>{installing ? <LoaderCircle size={14} className="animate-spin" /> : <Check size={14} />}{installing ? "安装中…" : "去使用"}</Button><IconButton ariaLabel="关闭" size="sm" onClick={onClose}><X size={18} /></IconButton></div></div>}
    >
      <div className="grid min-h-0 flex-1 grid-cols-[220px_minmax(0,1fr)]">
        <aside className="stable-scrollbar overflow-y-auto border-r border-border p-4">
          <p className="px-2 text-[11px] font-semibold uppercase tracking-[0.1em] text-text-tertiary">关于</p>
          <p className="mt-3 px-2 text-xs leading-6 text-text-secondary">{skill.description}</p>
          <p className="mt-5 border-t border-border px-2 pt-4 text-xs text-text-secondary">来自 {skill.source}</p>
          {skill.runtimePack ? <div className="mt-4 rounded-ui-control bg-surface-secondary/50 px-3 py-2 text-[11px] leading-5 text-text-secondary">{installed ? "文枢增强能力包已安装。" : "首次使用会下载文枢增强能力包。"}{packMissing.length ? ` 当前缺少：${packMissing.join(", ")}` : ""}</div> : null}
          <div className="mt-5 border-t border-border pt-4">
            <p className="px-2 text-[11px] font-semibold uppercase tracking-[0.1em] text-text-tertiary">文件</p>
            <div className="mt-2 space-y-0.5">
              {rootFiles.map((file) => <FileTreeRow key={file} label={file} selected={selectedFile === file} onClick={() => setSelectedFile(file)} />)}
              {folderEntries.map(({ folder, files }) => <div key={folder}><Button type="button" size="xs" variant="ghost" onClick={() => toggleFolder(folder)} className="w-full justify-start gap-1.5">{expandedFolders.has(folder) ? <FolderOpen size={14} className="text-text-tertiary" /> : <Folder size={14} className="text-text-tertiary" />}<span className="truncate">{folder}</span><ChevronRight size={13} className={`ml-auto transition-transform ${expandedFolders.has(folder) ? "rotate-90" : ""}`} /></Button>{expandedFolders.has(folder) ? <div className="ml-3 border-l border-border pl-2">{files.map((file) => { const fullPath = `${folder}/${file}`; return <FileTreeRow key={fullPath} label={file} selected={selectedFile === fullPath} onClick={() => setSelectedFile(fullPath)} />; })}</div> : null}</div>)}
            </div>
          </div>
        </aside>
        <main className="stable-scrollbar overflow-y-auto p-6">
          <div className="mb-4 flex items-center justify-between"><h3 className="text-lg font-semibold text-text-primary">{selectedFile}</h3><IconButton ariaLabel="复制内容" size="sm" onClick={() => void navigator.clipboard.writeText(selectedContent).then(() => onAction("已复制内容"))}><FileText size={16} /></IconButton></div>
          <Card variant="subtle" padding="lg">
            <p className="whitespace-pre-wrap text-sm leading-7 text-text-secondary">{selectedContent}</p>
            <h4 className="mt-8 text-lg font-semibold text-text-primary">使用说明</h4>
            <p className="mt-3 text-sm leading-7 text-text-secondary">{skill.runtimePack ? "选择“去使用”时，如果文枢增强能力包尚未安装，会先下载到 Mira 自己的受管 Runtime Pack 目录。安装只启用本地执行依赖；正式 SkillInstance / state reducer / stage tool constraints 完成前，不自动接入 Agent / Harness。" : "选择“去使用”后进入该技能对应的产品入口。"}</p>
          </Card>
        </main>
      </div>
    </ModalShell>
  );
}

function FileTreeRow({ label, selected, onClick }: { label: string; selected: boolean; onClick: () => void }) {
  return <Button type="button" size="xs" variant={selected ? "secondary" : "ghost"} onClick={onClick} className="w-full justify-start"><File size={14} className="shrink-0 text-text-tertiary" /><span className="truncate">{label}</span></Button>;
}
