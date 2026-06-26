import { marked } from "marked";
import { useEffect, useMemo, useState } from "react";
import {
  Link,
  Navigate,
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

const formatMetaValue = (value: string | null) => {
  if (!value) {
    return null;
  }

  return labelMap[value] ?? value;
};

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
    <section className="page-shell">
      <header className="page-header">
        <h1>搜索</h1>
        <p>在当前文档站里按标题、摘要和正文全文匹配。</p>
      </header>
      {query ? (
        <div className="search-results">
          {results.map((document) => (
            <article key={document.id} className="search-card">
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
          {results.length === 0 ? <p>没有匹配结果。</p> : null}
        </div>
      ) : (
        <p>请输入关键词。</p>
      )}
    </section>
  );
};

const DocumentPage = () => {
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
    <section className="page-shell">
      <div className="content-grid">
        <article className="markdown-body">
          <div className="doc-meta">
            <span className="doc-path">{document.path}</span>
          </div>
          <div className="meta-row">
            {document.metadata.layer ? <span>{formatMetaValue(document.metadata.layer)}</span> : null}
            {document.metadata.module ? <span>{document.metadata.module}</span> : null}
            {document.metadata.docType ? (
              <span>{formatMetaValue(document.metadata.docType)}</span>
            ) : null}
            {document.metadata.status ? <span>{document.metadata.status}</span> : null}
            {document.metadata.owner ? <span>{document.metadata.owner}</span> : null}
          </div>
          <div dangerouslySetInnerHTML={{ __html: withHeadingIds }} />
        </article>
        <aside className="toc-panel">
          <h2>本页导航</h2>
          <ul>
            {document.headings.map((heading) => (
              <li
                key={`${heading.anchor}-${heading.text}`}
                className={`toc-level-${heading.level}`}
              >
                <a href={`#${heading.anchor}`}>{heading.text}</a>
              </li>
            ))}
          </ul>
        </aside>
      </div>
    </section>
  );
};

const renderNavigation = (items: NavigationItem[]) => (
  <ul className="nav-list">
    {items.map((item) => (
      <li key={`${item.title}-${item.path ?? "group"}`}>
        {item.path ? (
          <Link to={`/doc/${item.path}`}>{item.title}</Link>
        ) : (
          <span className="nav-group">{item.title}</span>
        )}
        {item.children?.length ? renderNavigation(item.children) : null}
      </li>
    ))}
  </ul>
);

const HomeCard = ({
  title,
  path,
  description,
}: {
  title: string;
  path: string;
  description: string;
}) => {
  const document = findDocument(path);
  return (
    <Link to={`/doc/${path}`} className="home-card">
      <strong>{title}</strong>
      <p>{description}</p>
      <small>{document?.path}</small>
    </Link>
  );
};

const HomeSectionList = ({
  title,
  description,
  items,
}: {
  title: string;
  description: string;
  items: Array<{ title: string; path: string; description: string }>;
}) => (
  <section className="toc-section">
    <header className="toc-section-header">
      <h2>{title}</h2>
      <p>{description}</p>
    </header>
    <ol className="toc-entry-list">
      {items.map((item) => {
        const document = findDocument(item.path);
        return (
          <li key={`${item.title}-${item.path}`} className="toc-entry">
            <Link to={`/doc/${item.path}`} className="toc-entry-link">
              <span className="toc-entry-title">{item.title}</span>
              <span className="toc-entry-meta">{document?.path}</span>
            </Link>
            <p>{item.description}</p>
          </li>
        );
      })}
    </ol>
  </section>
);

const useEmbeddedSidebarState = () => {
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [isEmbeddedDesktopShell, setIsEmbeddedDesktopShell] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const isEmbedded = window.self !== window.top;
    const isDesktopShell =
      typeof navigator !== "undefined" &&
      /electron|tauri/i.test(navigator.userAgent);

    if (isEmbedded && isDesktopShell) {
      setIsEmbeddedDesktopShell(true);
      setIsSidebarCollapsed(true);
    }

    // 小屏幕自动折叠
    const mediaQuery = window.matchMedia("(max-width: 900px)");
    if (mediaQuery.matches) {
      setIsSidebarCollapsed(true);
    }

    const handleMediaChange = (e: MediaQueryListEvent) => {
      if (e.matches) {
        setIsSidebarCollapsed(true);
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
    isEmbeddedDesktopShell,
  };
};

const HomePage = () => (
  <section className="page-shell">
    <article className="markdown-body home-markdown-body">
      <div className="doc-meta">
        <span className="doc-path">docs/README.md</span>
      </div>
      <header className="catalog-header">
        <p className="catalog-kicker">UIChat Mira Docs</p>
        <h1>项目文档目录</h1>
        <p className="catalog-intro">
          这套站点直接读取当前仓库里的 <code>docs/</code>。阅读时建议先抓入口页，
          再看区域图和概念页，最后再进入具体实现文档。
        </p>
        <dl className="catalog-meta">
          <div>
            <dt>文档数</dt>
            <dd>{counts.total}</dd>
          </div>
          <div>
            <dt>生成时间</dt>
            <dd>{new Date(data.generatedAt).toLocaleDateString("zh-CN")}</dd>
          </div>
          <div>
            <dt>推荐顺序</dt>
            <dd>入口页 → 专题页 → 区域图 → 概念页</dd>
          </div>
        </dl>
      </header>
      <div className="catalog-layout">
        <div className="catalog-main">
          <HomeSectionList
            title="起步阅读"
            description="如果你第一次进这套文档，先走这条最省脑子的阅读线。"
            items={[
              {
                title: "Vault 首页",
                path: "VAULT_HOME",
                description: "从 Obsidian 风格入口页进入整套阅读路径。",
              },
              {
                title: "运行时区域图",
                path: "maps/AREA_MAP_RUNTIME",
                description: "先抓运行时边界、请求契约和主链路。",
              },
              {
                title: "概念索引",
                path: "concepts/CONCEPTS_INDEX",
                description: "从概念入口跳到 Runtime、MCP、UChat 等主概念。",
              },
              {
                title: "知识系统索引",
                path: "knowledge-system/KNOWLEDGE_SYSTEM_INDEX",
                description: "查看文档体系、AI 接入、索引和可视化方案。",
              },
            ]}
          />
          <HomeSectionList
            title="按层阅读"
            description="这套文档不是只按目录看，而是按 Raw sources / Wiki / Schema 三层来理解。"
            items={[
              {
                title: "Schema 层",
                path: "WIKI_SYSTEM_SCHEMA",
                description: "定义三层结构、元数据和 LLM 维护纪律。",
              },
              {
                title: "Wiki 层",
                path: "VAULT_HOME",
                description: "从入口页、概念页和区域图进入整理后的知识层。",
              },
              {
                title: "Raw sources 层",
                path: "architecture/README",
                description: "查看当前运行时、平台和业务模块的原始事实页。",
              },
            ]}
          />
          <HomeSectionList
            title="专题入口"
            description="根目录专题页更像一册文档的正文篇章，适合按主题连续读。"
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
          <HomeSectionList
            title="专题规则与草案"
            description="这里放还在持续演进但已经值得参考的规则页与设计页。"
            items={[
              {
                title: "Prompt Rules",
                path: "prompt-manager-rules/README",
                description: "Prompt manager 规则入口和相关子页。",
              },
              {
                title: "Markdown 工作空间",
                path: "markdown-workspace-mode",
                description: "工作空间能力评估、边界和 MVP 判断。",
              },
              {
                title: "产品路线优先级",
                path: "product-roadmap-priorities",
                description: "当前产品主线、优先级和实现难度评估。",
              },
            ]}
          />
        </div>
        <aside className="catalog-side">
          <section className="catalog-note">
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
            </ul>
          </section>
          <section className="catalog-note">
            <h2>阅读提示</h2>
            <ul>
              <li>先看入口，再看区域图。</li>
              <li>想抓边界时优先读概念页。</li>
              <li>想落代码时再进实现文档。</li>
            </ul>
          </section>
        </aside>
      </div>
    </article>
  </section>
);

export const App = () => {
  const { isSidebarCollapsed, setIsSidebarCollapsed, isEmbeddedDesktopShell } =
    useEmbeddedSidebarState();

  return (
    <div
      className={`app-shell${isSidebarCollapsed ? " app-shell-collapsed" : ""}`}
    >
      {!isEmbeddedDesktopShell ? (
        <button
          type="button"
          className="sidebar-toggle-btn"
          onClick={() => setIsSidebarCollapsed((current) => !current)}
          aria-label={isSidebarCollapsed ? "展开目录" : "收起目录"}
        >
          <span>{isSidebarCollapsed ? "▶" : "◀"}</span>
        </button>
      ) : null}
      <aside className="sidebar">
        <div className="brand-row">
          <Link to="/" className="brand">
            <span className="brand-logo brand-logo-fallback" aria-hidden="true">
              UM
            </span>
            <div className="brand-text">
              <span>UIChat Mira</span>
              <span className="brand-slogan">从聊天开始</span>
            </div>
          </Link>
        </div>
        <form action={withBase("/search")} className="search-form">
          <input name="q" type="search" placeholder="搜索文档..." />
        </form>
        <nav>{renderNavigation(data.navigation)}</nav>
      </aside>
      <main className="main-panel">
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/search" element={<SearchIndex />} />
          <Route path="/doc/*" element={<DocumentPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>
    </div>
  );
};
