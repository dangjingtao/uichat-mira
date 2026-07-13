/**
 * 真实网站提取测试
 * 用法: node e2e/real-sites.js
 * 用 Playwright 打开真实网站，注入 extractor.js，测试提取效果
 */

import { chromium } from 'playwright';
import { mkdir, writeFile, readFile } from 'fs/promises';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const EXTENSION_PATH = join(__dirname, '../extension');
const OUTPUT_DIR = join(__dirname, '../output/real-sites');

const SITES = [
  {
    name: '网易新闻',
    url: 'https://news.163.com/24/0711/10/J2L7V2V1000189FH.html',
    fallback: 'https://news.163.com',
  },
  {
    name: 'Google News',
    url: 'https://news.google.com/articles/CBMiK2h0dHBzOi8vd3d3LnJlZWRlci5jb20vYXJ0aWNsZS8zaTVkZ3hnNDZ2d9IBL2h0dHBzOi8vYW1wLnJlZWRlci5jb20vYXJ0aWNsZS8zaTVkZ3hnNDZ2dw?hl=zh-CN&gl=CN&ceid=CN%3Azh-Hans',
    fallback: 'https://news.google.com',
  },
  {
    name: '小红书网页版',
    url: 'https://www.xiaohongshu.com/explore',
    fallback: 'https://www.xiaohongshu.com',
  },
  {
    name: '微信公众号文章',
    url: 'https://mp.weixin.qq.com/s?__biz=MzI4NjEwNjM4MQ==&mid=2651234567&idx=1&sn=abc123',
    fallback: 'https://mp.weixin.qq.com',
  },
  {
    name: '知乎专栏',
    url: 'https://zhuanlan.zhihu.com/p/685332812',
    fallback: 'https://zhuanlan.zhihu.com',
  },
  {
    name: 'V2EX',
    url: 'https://www.v2ex.com/t/1058234',
    fallback: 'https://www.v2ex.com',
  },
];

async function extractFromPage(page, name, url) {
  console.log(`\n▶ ${name}: ${url}`);

  try {
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 15000 });
    // 给 SPA 额外 3s 渲染时间
    await page.waitForTimeout(3000);
  } catch (e) {
    console.log(`  ⚠ 页面加载异常: ${e.message}`);
    // 继续尝试提取，可能部分已加载
  }

  // 直接 evaluate 注入 extractor 代码（绕过 CSP 限制）
  const extractorCode = await readFile(join(EXTENSION_PATH, 'lib/extractor.js'), 'utf-8');
  await page.evaluate((code) => {
    const fn = new Function(code + '; return this.MiraExtractor;');
    const MiraExtractor = fn.call(window);
    window.MiraExtractor = MiraExtractor;
  }, extractorCode);

  // 执行提取
  const result = await page.evaluate(() => {
    if (!window.MiraExtractor) {
      return { error: 'Extractor not loaded' };
    }
    const data = window.MiraExtractor.extractPage(document);
    return {
      ...data,
      // 额外诊断信息
      _diagnosis: {
        hasArticle: !!document.querySelector('article'),
        hasMain: !!document.querySelector('main'),
        bodyTextLength: (document.body?.innerText || '').length,
        title: document.title,
        url: location.href,
      }
    };
  });

  // 截屏诊断
  let screenshotPath = null;
  try {
    screenshotPath = join(OUTPUT_DIR, `${name.replace(/\s+/g, '_')}.png`);
    await page.screenshot({ path: screenshotPath, fullPage: false });
  } catch (_) {}

  return { name, url, ...result, screenshotPath };
}

async function main() {
  await mkdir(OUTPUT_DIR, { recursive: true });

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
    locale: 'zh-CN',
  });

  const results = [];

  for (const site of SITES) {
    const page = await context.newPage();
    try {
      const data = await extractFromPage(page, site.name, site.url);
      results.push(data);

      // 控制台摘要
      const mdLen = (data.contentMarkdown || '').length;
      const textLen = (data.contentPlainText || '').length;
      const status = mdLen > 200 ? '✅ 提取成功' : mdLen > 0 ? '⚠️ 提取较少' : '❌ 未提取到正文';
      console.log(`  ${status} | Markdown: ${mdLen} 字符 | 纯文本: ${textLen} 字符 | 标题: ${data.title?.slice(0, 40) || '无'}`);
    } catch (e) {
      console.log(`  ❌ 错误: ${e.message}`);
      results.push({ name: site.name, url: site.url, error: e.message });
    }
    await page.close();
  }

  await browser.close();

  // 保存报告
  const reportPath = join(OUTPUT_DIR, 'report.json');
  await writeFile(reportPath, JSON.stringify(results, null, 2), 'utf-8');

  // Markdown 报告
  let mdReport = '# 真实网站提取测试报告\n\n';
  mdReport += `生成时间: ${new Date().toISOString()}\n\n`;
  for (const r of results) {
    mdReport += `## ${r.name}\n\n`;
    mdReport += `- URL: ${r.url}\n`;
    if (r.error) {
      mdReport += `- 状态: ❌ 错误 - ${r.error}\n\n`;
      continue;
    }
    const mdLen = (r.contentMarkdown || '').length;
    mdReport += `- 状态: ${mdLen > 200 ? '✅' : mdLen > 0 ? '⚠️' : '❌'}\n`;
    mdReport += `- 标题: ${r.title || '无'}\n`;
    mdReport += `- Markdown 长度: ${mdLen}\n`;
    mdReport += `- 纯文本长度: ${(r.contentPlainText || '').length}\n`;
    mdReport += `- 作者: ${r.author || '无'}\n`;
    mdReport += `- 站点: ${r.siteName || '无'}\n`;
    mdReport += `- 诊断: ${JSON.stringify(r._diagnosis || {})}\n\n`;
    mdReport += '---\n\n';
  }
  await writeFile(join(OUTPUT_DIR, 'report.md'), mdReport, 'utf-8');

  console.log(`\n📄 报告已保存: ${reportPath}`);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
