import { marked } from "marked";
import { useEffect, useMemo, useState } from "react";
import {
  Link,
  Navigate,
  NavLink,
  Route,
  Routes,
  useLocation,
  useParams,
} from "react-router-dom";
import docsIndex from "./generated/docs-index.json";
import type { GeneratedDocsIndex, NavigationItem } from "./types";

const data = docsIndex as GeneratedDocsIndex;
const appBase = import.meta.env.BASE_URL.replace(/\/$/, "");

const counts = {
  total: data.documents.length,
  root: data.documents.filter((doc) => doc.section === "root").length,
  maps: data.documents.filter((doc) => doc.section === "maps").length,
  concepts: data.documents.filter((doc) => doc.section === "concepts").length,
  knowledgeSystem: data.documents.filter((doc) => doc.section === "knowledge-system").length,
  implementation: data.documents.filter((doc) =>
    ["architecture", "platform", "role"].includes(doc.section),
  ).length,
  promptRules: data.documents.filter((doc) => doc.section === "prompt-manager-rules").length,
  rawSource: data.stats?.byLayer.rawSource ?? 0,
  wiki: data.stats?.byLayer.wiki ?? 0,
  schema: data.stats?.byLayer.schema ?? 0,
};

const coreEntryPaths = [
  "README",
  "VAULT_HOME",
  "WIKI_SYSTEM_SCHEMA",
  "knowledge-system/KNOWLEDGE_SYSTEM_INDEX",
  "knowledge-system/DOCUMENTATION_STANDARDS",
  "knowledge-system/DIRECTORY_AND_CLASSIFICATION_RULES",
  "knowledge-system/IMPLEMENTATION_ROADMAP",
  "maps/AREA_MAP_RUNTIME",
  "maps/AREA_MAP_KNOWLEDGE_BASE",
  "architecture/README",
  "architecture/ipc-and-preload",
  "platform/tauri",
  "uchat",
];

const labelMap: Record<string, string> = {
  "raw-source": "Raw Source",
  wiki: "Wiki",
  schema: "Schema",
  "current-contract": "Current Contract",
  reference: "Reference",
  overview: "Overview",
  design: "Design",
  plan: "Plan",
  checklist: "Checklist",
  draft: "Draft",
  "implementation-notes": "Implementation Notes",
  historical: "Historical",
  "how-to": "How-To",
};

const sectionTitleMap: Record<string, string> = {
  root: "专题文档",
  maps: "区域地图",
  concepts: "概念索引",
  "knowledge-system": "知识系统",
  architecture: "架构",
  platform: "平台",
  role: "角色系统",
  "prompt-manager-rules": "Prompt Rules",
};

const moduleLabelMap: Record<string, string> = {
  "docs-system": "Docs System",
  "knowledge-base": "Knowledge Base",
  "knowledge-system": "Knowledge System",
  architecture: "Architecture",
  platform: "Platform",
  role: "Role",
  uchat: "UChat",
  evaluation: "Evaluation",
  maps: "Maps",
  concepts: "Concepts",
};

const withBase = (value: string) => {
  if (!appBase) {
    return value;
  }

  if (value === "/") {
    return `${appBase}/`;
  }

  return `${appBase}${value}`;
};

marked.setOptions({
  breaks: true,
  gfm: true,
});

const findDocument = (docId: string) =>
  data.documents.find(
    (document) => document.id.toLowerCase() === docId.toLowerCase(),
  ) ?? null;

const formatMetaValue = (value: string | null) => {
  if (!value) {
    return null;
  }

  return labelMap[value] ?? value;
};

const getLayerLabel = (layer: string | null) => (layer ? formatMetaValue(layer) ?? layer : "未标注");
const getModuleLabel = (moduleName: string | null) =>
  moduleName ? moduleLabelMap[moduleName] ?? moduleName : "未标注";
const getDocTypeLabel = (docType: string | null) => (docType ? formatMetaValue(docType) ?? docType : "未标注");

const groupedCoreEntries = coreEntryPaths
  .map((path) => findDocument(path))
  .filter((doc): doc is NonNullable<typeof doc> => Boolean(doc));

const moduleNames = Array.from(
  new Set(data.documents.map((doc) => doc.metadata.module).filter((moduleName): moduleName is string => Boolean(moduleName))),
).sort((left, right) => left.localeCompare(right, "zh-CN"));

const docsByModule = moduleNames.map((moduleName) => ({
  label: getModuleLabel(moduleName),
  value: moduleName,
  items: data.documents
    .filter((doc) => doc.metadata.module === moduleName)
    .sort((left, right) => left.title.localeCompare(right.title, "zh-CN")),
}));

const docsByLayer = ["raw-source", "wiki", "schema"].map((layer) => ({
  label: getLayerLabel(layer),
  value: layer,
  items: data.documents.filter((doc) => doc.metadata.layer === layer),
}));

const renderNavigation = (items: NavigationItem[]) => (
  <ul className="nav-list">
    {items.map((item) => (
      <li key={`${item.title}-${item.path ?? "group"}`}>
        {item.path ? (
          <NavLink
            to={`/doc/${item.path}`}
            className={({ isActive }) => (isActive ? "nav-link nav-link-active" : "nav-link")}
          >
            {item.title}
          </NavLink>
        ) : (
          <span className="nav-group">{item.title}</span>
        )}
        {item.children?.length ? renderNavigation(item.children) : null}
      </li>
    ))}
  </ul>
);

const SearchIndex = () => {
  const location = useLocation();
  const query =
    new URLSearchParams(location.search).get("q")?.trim().toLowerCase() ?? "";
  const results = useMemo(() => {
    if (!query) {
      return [];
    }

    return data.documents
      .filter((document) => {
        const haystack =
          `${document.title}\n${document.excerpt}\n${document.content}`.toLowerCase();
        return haystack.includes(query);
      })
      .slice(0, 20);
  }, [query]);

  return (
    <section className="content-surface">
      <header className="page-header">
        <div>
          <p className="eyebrow">Search</p>
          <h1>搜索文档</h1>
        </div>
        <p>按标题、摘要和正文内容全文匹配当前知识库。</p>
      </header>
      {query ? (
        <div className="search-results">
          {results.map((document) => (
            <article key={document.id} className="search-result-item">
              <div className="meta-row">
                {document.metadata.layer ? (
                  <span>{formatMetaValue(document.metadata.layer)}</span>
                ) : null}
                {document.metadata.module ? <span>{document.metadata.module}</span> : null}
                {document.metadata.docType ? (
                  <span>{formatMetaValue(document.metadata.docType)}</span>
                ) : null}
              </div>
              <Link to={`/doc/${document.id}`} className="search-title">
                {document.title}
              </Link>
              <p>{document.excerpt || "无摘要"}</p>
              <small>{document.path}</small>
            </article>
          ))}
          {results.length === 0 ? <p className="empty-state">没有匹配结果。</p> : null}
        </div>
      ) : (
        <p className="empty-state">请输入关键词。</p>
      )}
    </section>
  );
};

const DocumentPage = ({
  isTocOpen,
  onCloseToc,
}: {
  isTocOpen: boolean;
  onCloseToc: () => void;
}) => {
  const params = useParams<{ "*": string }>();
  const docId = params["*"] ?? "README";
  const document = findDocument(docId);

  if (!document) {
    return <Navigate to="/doc/README" replace />;
  }

  const html = (marked.parse(document.content) as string).replace(
    /href="DOC_ROUTE:([^"]+)"/g,
    (_match, route: string) => `href="${withBase(route)}"`,
  );
  const withHeadingIds = html.replace(
    /<h([1-6])>(.*?)<\/h\1>/g,
    (_match, level: string, inner: string) => {
      const text = inner.replace(/<[^>]+>/g, "").trim();
      const heading =
        document.headings.find((item) => item.text === text) ??
        document.headings.find(
          (item) => item.text.includes(text) || text.includes(item.text),
        );

      if (!heading) {
        return `<h${level}>${inner}</h${level}>`;
      }

      return `<h${level} id="${heading.anchor}">${inner}</h${level}>`;
    },
  );

  return (
    <section className="content-surface docs-surface">
      <div className="docs-page">
        <div className="docs-content">
          <article className="doc-article">
            <header className="doc-header">
              <div className="doc-breadcrumb">
                <span>{sectionTitleMap[document.section] ?? "文档"}</span>
                <span className="doc-path">{document.path}</span>
              </div>
              <h1>{document.title}</h1>
              <div className="meta-row">
                {document.metadata.layer ? <span>{formatMetaValue(document.metadata.layer)}</span> : null}
                {document.metadata.module ? <span>{document.metadata.module}</span> : null}
                {document.metadata.docType ? (
                  <span>{formatMetaValue(document.metadata.docType)}</span>
                ) : null}
                {document.metadata.status ? <span>{document.metadata.status}</span> : null}
                {document.metadata.owner ? <span>{document.metadata.owner}</span> : null}
              </div>
            </header>
            <div className="markdown-body" dangerouslySetInnerHTML={{ __html: withHeadingIds }} />
          </article>
        </div>
        <aside className={`toc-rail${isTocOpen ? " toc-rail-open" : ""}`}>
          <div className="toc-panel">
            <div className="toc-panel-header">
              <h2>本页导航</h2>
              <button type="button" className="toc-close-btn" onClick={onCloseToc}>
                关闭
              </button>
            </div>
            <ul>
              {document.headings.map((heading) => (
                <li
                  key={`${heading.anchor}-${heading.text}`}
                  className={`toc-level-${heading.level}`}
                >
                  <a href={`#${heading.anchor}`} onClick={onCloseToc}>
                    {heading.text}
                  </a>
                </li>
              ))}
            </ul>
          </div>
        </aside>
      </div>
    </section>
  );
};

const HomeSectionList = ({
  title,
  description,
  items,
  dense = false,
}: {
  title: string;
  description: string;
  items: Array<{ title: string; path: string; description: string }>;
  dense?: boolean;
}) => (
  <section className="index-section">
    <header className="index-section-header">
      <div>
        <h2>{title}</h2>
        <p>{description}</p>
      </div>
    </header>
    <ol className={`index-list${dense ? " index-list-dense" : ""}`}>
      {items.map((item) => {
        const document = findDocument(item.path);
        return (
          <li key={`${item.title}-${item.path}`} className="index-item">
            <Link to={`/doc/${item.path}`} className="index-item-link">
              <span className="index-item-title">{item.title}</span>
              <span className="index-item-path">{document?.path}</span>
            </Link>
            <p>{item.description}</p>
          </li>
        );
      })}
    </ol>
  </section>
);

const HomePage = () => (
  <section className="content-surface">
    <header className="home-hero">
      <div className="home-hero-copy">
        <p className="eyebrow">Documentation</p>
        <h1>项目文档</h1>
        <p className="home-hero-intro">
          这套站点直接读取仓库里的 <code>docs/</code>。它不是单纯的文件树，而是把核心目录、三层分类和模块入口并排给人看。
        </p>
      </div>
      <div className="home-hero-note">
        <span>文档数 {counts.total}</span>
        <span>Raw sources {counts.rawSource}</span>
        <span>Wiki {counts.wiki}</span>
        <span>Schema {counts.schema}</span>
      </div>
    </header>
    <div className="home-grid">
      <div className="home-main">
        <HomeSectionList
          title="核心目录层"
          description="先读这些总入口，最接近一本书的目录页。"
          items={groupedCoreEntries.map((document) => ({
            title: document.title,
            path: document.id,
            description:
              document.excerpt ||
              `${getLayerLabel(document.metadata.layer)} / ${getModuleLabel(document.metadata.module)} / ${getDocTypeLabel(document.metadata.docType)}`,
          }))}
          dense
        />
        <HomeSectionList
          title="总入口"
          description="先看全局阅读起点。"
          items={[
            {
              title: "Vault 首页",
              path: "VAULT_HOME",
              description: "整套知识库的总入口。",
            },
            {
              title: "文档总入口",
              path: "README",
              description: "查看当前 docs/ 的推荐阅读顺序。",
            },
            {
              title: "知识系统索引",
              path: "knowledge-system/KNOWLEDGE_SYSTEM_INDEX",
              description: "理解三层架构、索引和 AI 接入。",
            },
          ]}
          dense
        />
        <HomeSectionList
          title="按层阅读"
          description="按信息属性进来，看这套文档是怎么分层的。"
          items={docsByLayer.map((group) => ({
            title: group.label,
            path: group.items[0]?.id ?? "README",
            description:
              group.value === "raw-source"
                ? "偏实现事实和边界。"
                : group.value === "wiki"
                  ? "偏整理后的知识层。"
                  : "偏 schema、规则和约束。",
          }))}
        />
        <HomeSectionList
          title="按模块阅读"
          description="如果你从业务边界进来，就按模块看。"
          items={docsByModule.slice(0, 8).map((group) => ({
            title: group.label,
            path: group.items[0]?.id ?? "README",
            description: `${group.items.length} 篇，点开后顺着模块内往下读。`,
          }))}
        />
        <HomeSectionList
          title="专题入口"
          description="根目录专题页更像正文篇章，适合按主题连续阅读。"
          items={[
            {
              title: "UChat",
              path: "uchat",
              description: "当前聊天运行时总纲和边界说明。",
            },
            {
              title: "评测工作台",
              path: "evaluation-workbench",
              description: "评测工作台、评测中心与评测包协议。",
            },
            {
              title: "知识库 API",
              path: "knowledge-base-api",
              description: "知识库接口、Swagger 分组和 UI 边界规则。",
            },
            {
              title: "对话系统实践",
              path: "chat-system-practices",
              description: "线程、消息、RAG 历史恢复和调试顺序。",
            },
          ]}
        />
      </div>
      <aside className="home-aside">
        <section className="aside-section">
          <h2>当前收录</h2>
          <ul>
            <li>Raw sources {counts.rawSource} 篇</li>
            <li>Wiki {counts.wiki} 篇</li>
            <li>Schema {counts.schema} 篇</li>
            <li>专题文档 {counts.root} 篇</li>
            <li>区域导航 {counts.maps} 篇</li>
            <li>概念页 {counts.concepts} 篇</li>
            <li>知识系统 {counts.knowledgeSystem} 篇</li>
            <li>实现文档 {counts.implementation} 篇</li>
            <li>Prompt Rules {counts.promptRules} 篇</li>
            <li>生成于 {new Date(data.generatedAt).toLocaleDateString("zh-CN")}</li>
          </ul>
        </section>
        <section className="aside-section">
          <h2>阅读提示</h2>
          <ul>
            <li>先目录层，再分类层。</li>
            <li>先 current-contract，再 plan。</li>
            <li>归档默认不看。</li>
          </ul>
        </section>
      </aside>
    </div>
  </section>
);

const useEmbeddedSidebarState = () => {
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(() => {
    if (typeof window === "undefined") {
      return false;
    }

    return window.matchMedia("(max-width: 960px)").matches;
  });
  const [isMobileLayout, setIsMobileLayout] = useState(() => {
    if (typeof window === "undefined") {
      return false;
    }

    return window.matchMedia("(max-width: 960px)").matches;
  });

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const mediaQuery = window.matchMedia("(max-width: 960px)");
    setIsMobileLayout(mediaQuery.matches);

    if (mediaQuery.matches) {
      setIsSidebarCollapsed(true);
    } else {
      setIsSidebarCollapsed(false);
    }

    const handleMediaChange = (event: MediaQueryListEvent) => {
      setIsMobileLayout(event.matches);
      if (event.matches) {
        setIsSidebarCollapsed(true);
      } else {
        setIsSidebarCollapsed(false);
      }
    };

    mediaQuery.addEventListener("change", handleMediaChange);
    return () => mediaQuery.removeEventListener("change", handleMediaChange);
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const handleMessage = (event: MessageEvent) => {
      if (!event.data || typeof event.data !== "object") {
        return;
      }

      if (event.data.type === "docs-site:set-sidebar-collapsed") {
        setIsSidebarCollapsed(Boolean(event.data.value));
      }
    };

    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, []);

  return {
    isSidebarCollapsed,
    setIsSidebarCollapsed,
    isMobileLayout,
  };
};

export const App = () => {
  const { isSidebarCollapsed, setIsSidebarCollapsed, isMobileLayout } = useEmbeddedSidebarState();
  const location = useLocation();
  const query = new URLSearchParams(location.search).get("q") ?? "";
  const [isTocOpen, setIsTocOpen] = useState(false);

  useEffect(() => {
    setIsTocOpen(false);
    if (typeof window !== "undefined" && window.innerWidth <= 960) {
      setIsSidebarCollapsed(true);
    }
  }, [location.pathname, location.search, setIsSidebarCollapsed]);

  useEffect(() => {
    if (!isMobileLayout) {
      setIsSidebarCollapsed(false);
    }
  }, [isMobileLayout, setIsSidebarCollapsed]);

  const closeAllPanels = () => {
    setIsSidebarCollapsed(true);
    setIsTocOpen(false);
  };

  return (
    <div className={`app-shell${isSidebarCollapsed ? " app-shell-collapsed" : ""}`}>
      {isMobileLayout && (!isSidebarCollapsed || isTocOpen) ? (
        <button
          type="button"
          className="mobile-overlay"
          aria-label="关闭面板"
          onClick={closeAllPanels}
        />
      ) : null}
      <aside className="sidebar">
        <div className="sidebar-inner">
          <div className="sidebar-brand-block">
            <div className="sidebar-brand-row">
              {isMobileLayout ? (
                <button
                  type="button"
                  className="sidebar-toggle-btn"
                  onClick={() => setIsSidebarCollapsed((current) => !current)}
                  aria-label={isSidebarCollapsed ? "展开目录" : "收起目录"}
                >
                  <span className="sidebar-toggle-icon" aria-hidden="true">
                    {isSidebarCollapsed ? ">" : "<"}
                  </span>
                </button>
              ) : null}
              <Link to="/" className="brand">
                <span className="brand-logo brand-logo-fallback" aria-hidden="true">
                  UM
                </span>
                <div className="brand-text">
                  <span>UIChat Mira</span>
                  <span className="brand-slogan">Documentation</span>
                </div>
              </Link>
            </div>
            <form action={withBase("/search")} className="sidebar-search">
              <input name="q" type="search" defaultValue={query} placeholder="搜索文档..." />
            </form>
          </div>
          <div className="sidebar-heading">
            <span>导航</span>
            <small>{counts.total} 篇</small>
          </div>
          <nav>{renderNavigation(data.navigation)}</nav>
        </div>
      </aside>
      <main className="main-panel">
        <div className="mobile-doc-toolbar">
          <button
            type="button"
            className="mobile-doc-toolbar-btn"
            onClick={() => {
              setIsTocOpen(false);
              setIsSidebarCollapsed(false);
            }}
          >
            <span className="mobile-doc-toolbar-icon" aria-hidden="true">
              ≡
            </span>
            <span>Menu</span>
          </button>
          <button
            type="button"
            className="mobile-doc-toolbar-btn"
            onClick={() => {
              setIsSidebarCollapsed(true);
              setIsTocOpen((current) => !current);
            }}
          >
            <span>On this page</span>
            <span className="mobile-doc-toolbar-icon" aria-hidden="true">
              ›
            </span>
          </button>
        </div>
        <div className="page-shell">
          <Routes>
            <Route path="/" element={<HomePage />} />
            <Route path="/search" element={<SearchIndex />} />
            <Route
              path="/doc/*"
              element={<DocumentPage isTocOpen={isTocOpen} onCloseToc={() => setIsTocOpen(false)} />}
            />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </div>
      </main>
    </div>
  );
};
