import { useMemo, useState } from "react";
import {
  Check,
  ChevronRight,
  FileCode2,
  FileSpreadsheet,
  FileText,
  File,
  Folder,
  FolderOpen,
  MoreHorizontal,
  Search,
  X,
} from "lucide-react";
import { Badge, Button, Card, IconButton, Result } from "@/shared/ui";
import { ModalShell } from "@/shared/ui/Modal";
import SettingsPageLayout from "../../components/SettingsPageLayout";

type Skill = {
  id: string;
  name: string;
  source: string;
  category: string;
  description: string;
  icon: "spreadsheet" | "pdf" | "word" | "code";
  installed?: boolean;
  content: string;
  files: string[];
};

const categories = ["已添加", "精选技能", "办公效率", "商业金融", "内容创作", "学术研究", "营销增长", "工程研发"];

const skills: Skill[] = [
  {
    id: "excel",
    name: "Excel 处理",
    source: "Kimi",
    category: "办公效率",
    description: "电子表格高级处理工具，额外支持三表模型、DCF 估值和可比公司分析等财务建模工作流。",
    icon: "spreadsheet",
    installed: true,
    content: "用于创建、分析和校验复杂电子表格，支持公式部署、格式处理、数据可视化与财务模型分析。",
    files: ["SKILL.md", "reference/3_statement_model.md", "reference/DCF_SKILL.md", "scripts/Xlsx"],
  },
  {
    id: "pdf",
    name: "PDF 文档处理",
    source: "Kimi",
    category: "办公效率",
    description: "专业 PDF 方案：指定创建论文与报告，用 Python 处理现有 PDF，支持公式、图表和引用。",
    icon: "pdf",
    content: "帮助整理、提取和生成 PDF 文档，适用于报告撰写、内容审阅以及资料归档。",
    files: ["SKILL.md", "scripts/extract_text.py", "reference/report-template.md"],
  },
  {
    id: "word",
    name: "Word 文档处理",
    source: "Kimi",
    category: "办公效率",
    description: "创建和编辑 Word 文档，支持批注、修订追踪、脚注、目录和 Markdown 转换。",
    icon: "word",
    content: "用于创建和编辑结构化文档，支持格式整理、批注修订和 Markdown 转换。",
    files: ["SKILL.md", "reference/document-style.md"],
  },
  {
    id: "research",
    name: "研究资料整理",
    source: "Mira 社区",
    category: "学术研究",
    description: "把零散研究资料整理成结构化摘要，快速提炼论点、证据和待验证问题。",
    icon: "code",
    content: "将访谈、论文和网页资料转换成清晰的研究笔记与行动清单。",
    files: ["SKILL.md", "templates/research-note.md"],
  },
];

const iconConfig = {
  spreadsheet: { Icon: FileSpreadsheet, className: "bg-emerald-50 text-emerald-500" },
  pdf: { Icon: FileText, className: "bg-red-50 text-red-400" },
  word: { Icon: FileText, className: "bg-blue-50 text-blue-500" },
  code: { Icon: FileCode2, className: "bg-violet-50 text-violet-500" },
};

export default function SkillsSettings() {
  const [activeCategory, setActiveCategory] = useState("已添加");
  const [query, setQuery] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const [selectedSkill, setSelectedSkill] = useState<Skill | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const visibleSkills = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return skills.filter((skill) => {
      const matchesCategory = activeCategory === "已添加"
        ? skill.installed
        : activeCategory === "精选技能" || skill.category === activeCategory;
      const matchesQuery = !normalizedQuery || `${skill.name} ${skill.description}`.toLowerCase().includes(normalizedQuery);
      return matchesCategory && matchesQuery;
    });
  }, [activeCategory, query]);

  const showNotice = (message: string) => {
    setNotice(message);
    window.setTimeout(() => setNotice(null), 2200);
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
              {visibleSkills.map((skill) => <SkillCard key={skill.id} skill={skill} onOpen={() => setSelectedSkill(skill)} />)}
            </div>
          ) : (
            <Result size="sm" icon={<Search className="h-4 w-4" />} title="没有匹配的技能" description="试试其他分类或搜索关键词" />
          )}
        </div>
      </SettingsPageLayout>

      {notice ? <div role="status" className="fixed bottom-6 left-1/2 z-50 -translate-x-1/2 rounded-[10px] bg-ink px-4 py-2 text-xs text-white shadow-shadow-md">{notice}</div> : null}
      {selectedSkill ? <SkillDetail skill={selectedSkill} onClose={() => setSelectedSkill(null)} onUse={() => showNotice(`已使用「${selectedSkill.name}」`)} onAction={showNotice} /> : null}
    </>
  );
}

function SkillCard({ skill, onOpen }: { skill: Skill; onOpen: () => void }) {
  const { Icon, className } = iconConfig[skill.icon];
  return (
    <Card interactive padding="none" className="min-h-[132px] overflow-hidden">
      <button type="button" onClick={onOpen} className="group block h-full w-full p-4 text-left">
      <div className="flex items-start gap-3">
        <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-[11px] ${className}`}><Icon size={22} /></div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h4 className="truncate text-sm font-semibold text-text-primary">{skill.name}</h4>
            {skill.installed ? <Badge variant="success">已添加</Badge> : null}
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

function SkillDetail({ skill, onClose, onUse, onAction }: { skill: Skill; onClose: () => void; onUse: () => void; onAction: (message: string) => void }) {
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set(["reference", "scripts", "templates"]));
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

  return (
    <ModalShell
      open
      onClose={onClose}
      width={1080}
      height="calc(100vh - 32px)"
      showCloseButton={false}
      footer={null}
      bodyClassName="p-0"
      title={<div className="flex items-center gap-3"><span>{skill.name}</span><div className="ml-auto flex items-center gap-1"><Button size="xs" variant="secondary" onClick={onUse}><Check size={14} />去使用</Button><IconButton ariaLabel="关闭" size="sm" onClick={onClose}><X size={18} /></IconButton></div></div>}
    >
        <div className="grid min-h-0 flex-1 grid-cols-[220px_minmax(0,1fr)]">
          <aside className="stable-scrollbar overflow-y-auto border-r border-border p-4"><p className="px-2 text-[11px] font-semibold uppercase tracking-[0.1em] text-text-tertiary">关于</p><p className="mt-3 px-2 text-xs leading-6 text-text-secondary">{skill.description}</p><p className="mt-5 border-t border-border px-2 pt-4 text-xs text-text-secondary">来自 {skill.source}</p><div className="mt-5 border-t border-border pt-4"><p className="px-2 text-[11px] font-semibold uppercase tracking-[0.1em] text-text-tertiary">文件</p><div className="mt-2 space-y-0.5">{rootFiles.map((file) => <FileTreeRow key={file} label={file} selected={selectedFile === file} onClick={() => setSelectedFile(file)} />)}{folderEntries.map(({ folder, files }) => <div key={folder}><Button type="button" size="xs" variant="ghost" onClick={() => toggleFolder(folder)} className="w-full justify-start gap-1.5">{expandedFolders.has(folder) ? <FolderOpen size={14} className="text-text-tertiary" /> : <Folder size={14} className="text-text-tertiary" />}<span className="truncate">{folder}</span><ChevronRight size={13} className={`ml-auto transition-transform ${expandedFolders.has(folder) ? "rotate-90" : ""}`} /></Button>{expandedFolders.has(folder) ? <div className="ml-3 border-l border-border pl-2">{files.map((file) => { const fullPath = `${folder}/${file}`; return <FileTreeRow key={fullPath} label={file} selected={selectedFile === fullPath} onClick={() => setSelectedFile(fullPath)} />; })}</div> : null}</div>)}</div></div></aside>
          <main className="stable-scrollbar overflow-y-auto p-6"><div className="mb-4 flex items-center justify-between"><h3 className="text-lg font-semibold text-text-primary">{selectedFile}</h3><IconButton ariaLabel="复制内容" size="sm" onClick={() => onAction("复制入口为演示状态")}><FileText size={16} /></IconButton></div><Card variant="subtle" padding="lg"><p className="whitespace-pre-line text-sm leading-7 text-text-secondary">{selectedFile === "SKILL.md" ? skill.content : `# ${selectedFile.split("/").pop()}\n\n这是「${skill.name}」技能包中的演示文件内容。\n\n该文件用于补充技能的执行规则、示例和工作流程。`}</p><h4 className="mt-8 text-lg font-semibold text-text-primary">使用说明</h4><p className="mt-3 text-sm leading-7 text-text-secondary">选择“去使用”后，技能会作为当前任务的工作方法参考。当前页面仅展示演示数据。</p></Card></main>
        </div>
    </ModalShell>
  );
}

function FileTreeRow({ label, selected, onClick }: { label: string; selected: boolean; onClick: () => void }) {
  return <Button type="button" size="xs" variant={selected ? "secondary" : "ghost"} onClick={onClick} className="w-full justify-start"><File size={14} className="shrink-0 text-text-tertiary" /><span className="truncate">{label}</span></Button>;
}
