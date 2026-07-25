import { describe, expect, it } from "vitest";
import { prepareHtmlForVivliostyle } from "./html-to-pdf.js";

describe("prepareHtmlForVivliostyle", () => {
  it("uses named pages and margin boxes without retaining fixed header elements", () => {
    const html = `<!doctype html>
<html lang="zh-CN">
<head><meta charset="utf-8"><title>林女士 · 生育力综合评估报告</title></head>
<body>
  <div class="print-header"><span>圆姐聊女性全周期服务</span><span>林女士 · 专属评估报告</span></div>
  <div class="print-footer"><span>本报告用于健康教育与就诊准备。</span><span>Mira 服务团队</span></div>
  <main class="report">
    <header class="cover"><h1>林女士 · 生育力综合评估报告</h1></header>
    <section class="section"><h2>服务团队先看结论</h2><p>保留正文内容。</p></section>
  </main>
</body>
</html>`;

    const result = prepareHtmlForVivliostyle(html);

    expect(result).toContain('id="mira-vivliostyle-print"');
    expect(result).toContain("@page mira-cover");
    expect(result).toContain("@page mira-report");
    expect(result).toContain('content: "圆姐聊女性全周期服务"');
    expect(result).toContain('content: "林女士 · 专属评估报告"');
    expect(result).toContain('content: "本报告用于健康教育与就诊准备。"');
    expect(result).toContain('content: "第 " counter(page) " 页"');
    expect(result).toContain("page: mira-cover");
    expect(result).toContain("page: mira-report");
    expect(result).not.toContain('class="print-header"');
    expect(result).not.toContain('class="print-footer"');
    expect(result).toContain("保留正文内容。");
  });
});
