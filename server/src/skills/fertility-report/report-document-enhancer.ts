import { JSDOM } from "jsdom";

const REPORT_ENHANCEMENT_CSS = `
.report-toc {
  background: linear-gradient(180deg, #fff 0%, var(--soft) 100%);
}
.report-toc .section-head {
  margin-bottom: 18px;
}
.toc-major-list,
.toc-dimension-list {
  list-style: none;
  margin: 0;
  padding: 0;
}
.toc-major-list {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 8px 28px;
  padding-bottom: 18px;
  border-bottom: 1px solid var(--line);
}
.toc-columns {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 28px;
  margin-top: 20px;
}
.toc-column h3 {
  margin: 0 0 9px;
  color: var(--primary);
  font-size: 14px;
}
.toc-link {
  display: flex;
  align-items: baseline;
  gap: 8px;
  min-width: 0;
  padding: 4px 0;
  color: var(--ink);
  text-decoration: none;
}
.toc-link:hover {
  color: var(--primary);
}
.toc-link .toc-label {
  min-width: 0;
}
.toc-major-list .toc-link {
  font-weight: 700;
}
.toc-dimension-list .toc-link {
  color: #5f5363;
  font-size: 12px;
}
.toc-screen-hint {
  margin-left: auto;
  color: var(--muted);
  font-size: 10px;
}
.dimension-card {
  border-top: 1px solid #d9cde0 !important;
  padding-top: 24px !important;
}
.dimension-title-row {
  border-left: 3px solid var(--secondary);
  padding-left: 12px;
}
.dimension-intro {
  break-inside: avoid-page;
  page-break-inside: avoid;
}
.dimension-card.no-evidence .score-pill {
  border-color: #a99fad !important;
  color: #766b79 !important;
}
.dimension-card.no-evidence .score-band {
  color: #766b79;
}
.dimension-card.no-evidence .completeness span {
  width: 0 !important;
}
.clinical-boundary-note {
  margin: 8px 0 0;
  color: var(--muted);
  font-size: 10px;
}
@media (max-width: 760px) {
  .toc-major-list,
  .toc-columns {
    grid-template-columns: 1fr;
  }
}
@media print {
  .report-toc {
    break-after: page;
    page-break-after: always;
  }
  .toc-screen-hint {
    display: none;
  }
  .toc-link::after {
    content: leader(dotted) target-counter(attr(href url), page);
    margin-left: auto;
    color: var(--muted);
    font-variant-numeric: tabular-nums;
  }
  .dimension-intro {
    break-inside: avoid-page !important;
    page-break-inside: avoid !important;
  }
  .dimension-title-row h3 {
    bookmark-level: 2;
  }
  .section-head h2 {
    bookmark-level: 1;
  }
}
`;

type TocEntry = {
  href: string;
  label: string;
};

const assignId = (element: Element | null, id: string) => {
  if (!element) return null;
  element.id = id;
  return element;
};

const createTocLink = (
  document: Document,
  entry: TocEntry,
  className = "toc-link",
) => {
  const item = document.createElement("li");
  const anchor = document.createElement("a");
  anchor.className = className;
  anchor.href = entry.href;
  const label = document.createElement("span");
  label.className = "toc-label";
  label.textContent = entry.label;
  const hint = document.createElement("span");
  hint.className = "toc-screen-hint";
  hint.textContent = "查看";
  anchor.append(label, hint);
  item.append(anchor);
  return item;
};

const wrapDimensionIntro = (document: Document, card: Element) => {
  if (card.querySelector(":scope > .dimension-intro")) return;
  const intro = document.createElement("div");
  intro.className = "dimension-intro";
  const selectors = [
    ":scope > .dimension-title-row",
    ":scope > .dimension-meta",
    ":scope > .completeness",
    ":scope > .core-judgement",
  ];
  const nodes = selectors
    .map((selector) => card.querySelector(selector))
    .filter((node): node is Element => Boolean(node));
  const first = nodes[0];
  if (!first) return;
  card.insertBefore(intro, first);
  for (const node of nodes) intro.append(node);
};

const enhanceDimensionCards = (document: Document) => {
  document.querySelectorAll(".dimension-card").forEach((card, index) => {
    const heading = card.querySelector(".dimension-title-row h3");
    const fallbackId = `dimension-${index + 1}`;
    const currentId = card.id || fallbackId;
    card.id = currentId;
    wrapDimensionIntro(document, card);

    const meta = card.querySelector(".dimension-meta")?.textContent ?? "";
    if (meta.includes("资料完整度：0%")) {
      card.classList.add("no-evidence");
      const band = card.querySelector(".score-band");
      if (band) band.textContent = "参考基准 · 暂不可充分评价";
    }

    const clinicianSection = Array.from(card.querySelectorAll(".detail-grid section")).find(
      (section) => section.querySelector("h4")?.textContent?.trim() === "建议与医生讨论",
    );
    if (clinicianSection) {
      const title = clinicianSection.querySelector("h4");
      if (title) title.textContent = "就诊时可问";
    }
    const testSection = Array.from(card.querySelectorAll(".detail-grid section")).find(
      (section) => section.querySelector("h4")?.textContent?.trim() === "可讨论的检查",
    );
    if (testSection) {
      const title = testSection.querySelector("h4");
      if (title) title.textContent = "可与医生确认的检查";
    }

    const judgement = card.querySelector(".core-judgement");
    if (judgement && !judgement.querySelector(".clinical-boundary-note")) {
      const note = document.createElement("p");
      note.className = "clinical-boundary-note";
      note.textContent = "以下方向用于信息整理和就诊讨论，不代表具体治疗方案。";
      judgement.append(note);
    }

    if (heading && !heading.textContent?.trim()) heading.textContent = currentId;
  });
};

const buildToc = (document: Document) => {
  const report = document.querySelector("main.report");
  const cover = report?.querySelector(":scope > .cover");
  if (!report || !cover || report.querySelector(":scope > .report-toc")) return;

  const directSections = Array.from(report.querySelectorAll(":scope > .section"));
  const summary = assignId(directSections[0] ?? null, "section-summary");
  const overview = assignId(report.querySelector(".visual-overview"), "section-overview");
  const female = Array.from(report.querySelectorAll(".dimension-section")).find(
    (section) => section.querySelector(".section-head h2")?.textContent?.includes("女性"),
  );
  const male = Array.from(report.querySelectorAll(".dimension-section")).find(
    (section) => section.querySelector(".section-head h2")?.textContent?.includes("男性"),
  );
  assignId(female ?? null, "section-female");
  assignId(male ?? null, "section-male");
  const gaps = Array.from(directSections).find((section) =>
    section.querySelector(".section-head h2")?.textContent?.includes("资料缺口"),
  );
  assignId(gaps ?? null, "section-gaps");
  const closing = assignId(report.querySelector(".closing-section"), "section-closing");

  const majorEntries: TocEntry[] = [
    summary ? { href: "#section-summary", label: "服务团队先看结论" } : null,
    overview ? { href: "#section-overview", label: "十维量化画像" } : null,
    female ? { href: "#section-female", label: "女性生育力综合画像" } : null,
    male ? { href: "#section-male", label: "男性生育力综合画像" } : null,
    gaps ? { href: "#section-gaps", label: "资料缺口与不确定项" } : null,
    closing ? { href: "#section-closing", label: "写在最后" } : null,
  ].filter((entry): entry is TocEntry => Boolean(entry));

  const nav = document.createElement("nav");
  nav.className = "section report-toc";
  nav.id = "report-toc";
  nav.setAttribute("aria-label", "报告目录");
  nav.innerHTML = `<div class="section-head"><h2>报告目录</h2><p>点击章节可在行内报告中快速定位；PDF 页码自动生成</p></div>`;

  const majorList = document.createElement("ul");
  majorList.className = "toc-major-list";
  for (const entry of majorEntries) majorList.append(createTocLink(document, entry));
  nav.append(majorList);

  const dimensionColumns = document.createElement("div");
  dimensionColumns.className = "toc-columns";
  const sections = [
    { element: female, title: "女方十维" },
    { element: male, title: "男方十维" },
  ].filter((item): item is { element: Element; title: string } => Boolean(item.element));

  for (const section of sections) {
    const column = document.createElement("section");
    column.className = "toc-column";
    const heading = document.createElement("h3");
    heading.textContent = section.title;
    const list = document.createElement("ul");
    list.className = "toc-dimension-list";
    section.element.querySelectorAll(".dimension-card").forEach((card) => {
      const label = card.querySelector(".dimension-title-row h3")?.textContent?.trim();
      if (!label || !card.id) return;
      list.append(createTocLink(document, { href: `#${card.id}`, label }));
    });
    column.append(heading, list);
    dimensionColumns.append(column);
  }
  if (sections.length > 0) nav.append(dimensionColumns);

  cover.insertAdjacentElement("afterend", nav);
};

export const enhanceFertilityReportHtml = (html: string) => {
  const dom = new JSDOM(html);
  const { document } = dom.window;
  const style = document.createElement("style");
  style.id = "mira-fertility-report-enhancements";
  style.textContent = REPORT_ENHANCEMENT_CSS;
  document.head.append(style);

  enhanceDimensionCards(document);
  buildToc(document);
  return dom.serialize();
};
