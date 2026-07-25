import fs from "node:fs";
import path from "node:path";
import { chromium } from "playwright-core";
import { writeStructuredLog } from "@/logger";

const FERTILITY_PRINT_STYLE = `
  @media print {
    .rose-print {
      margin: 0 0 8mm !important;
      padding: 0 !important;
      break-inside: avoid-page !important;
      page-break-inside: avoid !important;
    }

    .rose-print figcaption {
      display: flex;
      justify-content: space-between;
      gap: 8mm;
      padding-bottom: 3mm;
      border-bottom: 1px solid #d9d1c9;
      break-after: avoid-page;
      page-break-after: avoid;
    }

    .rose-print figcaption span {
      color: #756e67;
      font-size: 10px;
    }

    .rose-print svg {
      display: block;
      width: 100%;
      height: auto;
      max-height: 155mm;
    }

    .rose-ring {
      fill: none;
      stroke: #ddd6cf;
      stroke-width: 1;
    }

    .rose-sector {
      stroke-width: 1.5;
    }

    .rose-sector.scored {
      fill: #d79acb;
      fill-opacity: .72;
      stroke: #5b2a86;
    }

    .rose-sector.missing {
      fill: #f4f1ed;
      fill-opacity: .35;
      stroke: #aaa29a;
      stroke-dasharray: 5 4;
    }

    .rose-label {
      fill: #4b4540;
      font-size: 11px;
    }

    .rose-value {
      fill: #8b8178;
      font-size: 10px;
    }
  }
`;

const FERTILITY_ROSE_CHART_SCRIPT = String.raw`
(() => {
  const femalePairs = [
    ["female_endometrium", "子宫内膜"],
    ["female_hormonal_balance", "激素排卵"],
    ["female_oocyte_context", "卵子潜力"],
    ["female_ovarian_reserve", "卵巢储备"],
    ["female_metabolic_health", "代谢健康"],
    ["female_immune_context", "免疫凝血"],
    ["female_pelvic_environment", "盆腔输卵管"],
    ["female_nutrition", "营养储备"],
    ["female_lifestyle", "生活方式"],
    ["female_sleep_stress", "情绪睡眠"],
  ];
  const malePairs = [
    ["male_dna_integrity", "DNA完整性"],
    ["male_morphology", "精子形态"],
    ["male_motility", "精子活力"],
    ["male_concentration", "精子浓度"],
    ["male_semen_volume", "精液量"],
    ["male_hormonal_balance", "激素生精"],
    ["male_inflammation", "炎症背景"],
    ["male_nutrition", "营养支持"],
    ["male_lifestyle", "生活方式"],
    ["male_sleep_stress", "情绪睡眠"],
  ];
  const SVG_NS = "http://www.w3.org/2000/svg";

  const polarPoint = (cx, cy, radius, degrees) => {
    const angle = ((degrees - 90) * Math.PI) / 180;
    return {
      x: cx + radius * Math.cos(angle),
      y: cy + radius * Math.sin(angle),
    };
  };

  const parseSectionScores = (section) => {
    const byId = new Map();
    section.querySelectorAll(".dimension-card").forEach((card) => {
      const id = card.querySelector(".eyebrow")?.textContent?.trim();
      const scoreText = card.querySelector(".score-pill")?.textContent || "";
      const match = scoreText.match(/(\d+(?:\.\d+)?)/);
      if (id) byId.set(id, match ? Number(match[1]) : null);
    });
    return byId;
  };

  const createSvgNode = (name, attrs = {}) => {
    const node = document.createElementNS(SVG_NS, name);
    Object.entries(attrs).forEach(([key, value]) => node.setAttribute(key, String(value)));
    return node;
  };

  const findSection = (titles) => {
    const heading = Array.from(document.querySelectorAll(".section-head h2"))
      .find((item) => titles.includes(item.textContent?.trim()));
    return heading?.closest(".section");
  };

  const insertChart = (titles, chartTitle, pairs) => {
    const section = findSection(titles);
    if (!section || section.querySelector(".rose-print")) return;

    const scores = parseSectionScores(section);
    const figure = document.createElement("figure");
    figure.className = "rose-print";
    const caption = document.createElement("figcaption");
    caption.innerHTML = `<strong>${chartTitle}</strong><span>实色表示已有状态分；虚线表示低置信度或资料不足</span>`;
    figure.appendChild(caption);

    const svg = createSvgNode("svg", {
      viewBox: "0 0 640 440",
      role: "img",
      "aria-label": chartTitle,
    });
    const cx = 320;
    const cy = 220;
    const maxRadius = 145;
    const labelRadius = 188;
    const step = 360 / pairs.length;

    [0.25, 0.5, 0.75, 1].forEach((ratio) => {
      svg.appendChild(createSvgNode("circle", {
        cx,
        cy,
        r: (maxRadius * ratio).toFixed(2),
        class: "rose-ring",
      }));
    });

    pairs.forEach(([id, label], index) => {
      const rawScore = scores.get(id);
      const hasScore = Number.isFinite(rawScore);
      const score = hasScore ? Math.max(0, Math.min(10, rawScore)) : null;
      const radius = score === null ? 42 : Math.max(18, (score / 10) * maxRadius);
      const start = index * step + 2;
      const end = (index + 1) * step - 2;
      const startPoint = polarPoint(cx, cy, radius, start);
      const endPoint = polarPoint(cx, cy, radius, end);
      svg.appendChild(createSvgNode("path", {
        d: `M ${cx} ${cy} L ${startPoint.x.toFixed(2)} ${startPoint.y.toFixed(2)} A ${radius.toFixed(2)} ${radius.toFixed(2)} 0 0 1 ${endPoint.x.toFixed(2)} ${endPoint.y.toFixed(2)} Z`,
        class: `rose-sector ${score === null ? "missing" : "scored"}`,
      }));

      const labelPoint = polarPoint(cx, cy, labelRadius, index * step + step / 2);
      const anchor = labelPoint.x < cx - 12 ? "end" : labelPoint.x > cx + 12 ? "start" : "middle";
      const labelNode = createSvgNode("text", {
        x: labelPoint.x.toFixed(2),
        y: labelPoint.y.toFixed(2),
        "text-anchor": anchor,
        class: "rose-label",
      });
      labelNode.textContent = label;
      svg.appendChild(labelNode);

      const valueNode = createSvgNode("text", {
        x: labelPoint.x.toFixed(2),
        y: (labelPoint.y + 14).toFixed(2),
        "text-anchor": anchor,
        class: "rose-value",
      });
      valueNode.textContent = score === null ? "低置信" : score.toFixed(1);
      svg.appendChild(valueNode);
    });

    svg.appendChild(createSvgNode("circle", { cx, cy, r: 4, fill: "#5b2a86" }));
    figure.appendChild(svg);
    const dimensions = section.querySelector(".dimensions");
    section.insertBefore(figure, dimensions || null);
  };

  insertChart(["女性生育力综合画像", "女方十维画像"], "女性生育力十维画像", femalePairs);
  insertChart(["男性生育力综合画像", "男方十维画像"], "男性生育力十维画像", malePairs);
})();
`;

const existingPath = (value: string | undefined) => {
  const candidate = value?.trim();
  return candidate && fs.existsSync(candidate) ? candidate : undefined;
};

const resolveChromiumExecutable = () => {
  const configured =
    existingPath(process.env.MIRA_CHROMIUM_EXECUTABLE_PATH) ??
    existingPath(process.env.CHROME_PATH) ??
    existingPath(process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH);
  if (configured) return configured;

  const candidates =
    process.platform === "win32"
      ? [
          process.env.LOCALAPPDATA
            ? path.join(
                process.env.LOCALAPPDATA,
                "Google",
                "Chrome",
                "Application",
                "chrome.exe",
              )
            : "",
          process.env.PROGRAMFILES
            ? path.join(
                process.env.PROGRAMFILES,
                "Google",
                "Chrome",
                "Application",
                "chrome.exe",
              )
            : "",
          process.env["PROGRAMFILES(X86)"]
            ? path.join(
                process.env["PROGRAMFILES(X86)"]!,
                "Google",
                "Chrome",
                "Application",
                "chrome.exe",
              )
            : "",
          process.env.PROGRAMFILES
            ? path.join(
                process.env.PROGRAMFILES,
                "Microsoft",
                "Edge",
                "Application",
                "msedge.exe",
              )
            : "",
          process.env["PROGRAMFILES(X86)"]
            ? path.join(
                process.env["PROGRAMFILES(X86)"]!,
                "Microsoft",
                "Edge",
                "Application",
                "msedge.exe",
              )
            : "",
        ]
      : process.platform === "darwin"
        ? [
            "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
            "/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge",
            "/Applications/Chromium.app/Contents/MacOS/Chromium",
          ]
        : [
            "/usr/bin/google-chrome",
            "/usr/bin/google-chrome-stable",
            "/usr/bin/chromium",
            "/usr/bin/chromium-browser",
            "/usr/bin/microsoft-edge",
          ];

  return candidates.find((candidate) => candidate && fs.existsSync(candidate));
};

export const renderHtmlReportToPdf = async (input: {
  html: string;
  outputPath: string;
}) => {
  const executablePath = resolveChromiumExecutable();
  if (!executablePath) {
    throw new Error(
      "No local Chromium-compatible browser found. Install Chrome/Edge or set MIRA_CHROMIUM_EXECUTABLE_PATH.",
    );
  }

  fs.mkdirSync(path.dirname(input.outputPath), { recursive: true });
  const startedAt = Date.now();
  const browser = await chromium.launch({
    executablePath,
    headless: true,
    args: ["--disable-gpu"],
  });

  try {
    const page = await browser.newPage({
      viewport: { width: 1280, height: 900 },
      deviceScaleFactor: 1,
    });
    await page.setContent(input.html, { waitUntil: "load" });

    const isFertilityReport = await page.evaluate(
      () => Boolean(document.querySelector("[data-fertility-scope]")),
    );
    if (isFertilityReport) {
      await page.addStyleTag({ content: FERTILITY_PRINT_STYLE });
      await page.evaluate(FERTILITY_ROSE_CHART_SCRIPT);
    }

    await page.evaluate("document.fonts ? document.fonts.ready : Promise.resolve()");
    await page.emulateMedia({ media: "print" });
    await page.pdf({
      path: input.outputPath,
      format: "A4",
      printBackground: true,
      preferCSSPageSize: true,
      margin: {
        top: "10mm",
        right: "10mm",
        bottom: "12mm",
        left: "10mm",
      },
    });

    writeStructuredLog("info", {
      scope: "skill-report-pdf",
      event: "html-to-pdf-completed",
      executablePath,
      outputPath: input.outputPath,
      durationMs: Date.now() - startedAt,
    });
    return input.outputPath;
  } finally {
    await browser.close();
  }
};
