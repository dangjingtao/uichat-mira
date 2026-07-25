import { describe, expect, it } from "vitest";
import { JSDOM } from "jsdom";
import { enhanceFertilityReportHtml } from "./report-document-enhancer.js";

const sampleHtml = `<!doctype html>
<html><head><title>测试报告</title></head><body>
<main class="report">
  <header class="cover"><h1>封面</h1></header>
  <section class="section"><div class="section-head"><h2>服务团队先看结论</h2></div></section>
  <section class="section visual-overview"><div class="section-head"><h2>十维量化画像</h2></div></section>
  <section class="section dimension-section">
    <div class="section-head"><h2>女性生育力综合画像</h2></div>
    <article class="dimension-card" id="dimension-female_ovarian_reserve">
      <div class="dimension-title-row"><h3>卵巢储备与促排反应</h3><div class="score-summary"><div class="score-pill">5.0 / 10</div><div class="score-band">建议优化</div></div></div>
      <div class="dimension-meta"><span>置信度：低</span><span>资料完整度：0%</span></div>
      <div class="completeness"><span style="width:0%"></span></div>
      <section class="core-judgement"><h4>核心判断</h4><p>资料有限。</p></section>
      <div class="detail-grid"><section><h4>建议与医生讨论</h4></section><section><h4>可讨论的检查</h4></section></div>
    </article>
  </section>
  <section class="section"><div class="section-head"><h2>资料缺口与不确定项</h2></div></section>
  <section class="section closing-section"><div class="section-head"><h2>写在最后</h2></div></section>
  <footer class="report-footer">页脚</footer>
</main>
</body></html>`;

describe("fertility report document enhancer", () => {
  it("adds an automatic toc and keeps the dimension opener together", () => {
    const enhanced = enhanceFertilityReportHtml(sampleHtml);
    const document = new JSDOM(enhanced).window.document;

    const toc = document.querySelector(".report-toc");
    expect(toc).not.toBeNull();
    expect(toc?.previousElementSibling?.classList.contains("cover")).toBe(true);
    expect(toc?.querySelector('a[href="#section-summary"]')).not.toBeNull();
    expect(
      toc?.querySelector('a[href="#dimension-female_ovarian_reserve"]')?.textContent,
    ).toContain("卵巢储备与促排反应");

    const card = document.querySelector("#dimension-female_ovarian_reserve");
    expect(card?.querySelector(":scope > .dimension-intro")).not.toBeNull();
    expect(card?.classList.contains("no-evidence")).toBe(true);
    expect(card?.querySelector(".score-band")?.textContent).toContain("暂不可充分评价");
    expect(card?.textContent).toContain("就诊时可问");
    expect(card?.textContent).toContain("可与医生确认的检查");

    const style = document.querySelector("#mira-fertility-report-enhancements")?.textContent;
    expect(style).toContain("target-counter(attr(href url), page)");
    expect(style).toContain("break-inside: avoid-page");
  });
});
