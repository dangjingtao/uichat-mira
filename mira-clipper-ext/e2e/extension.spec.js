/**
 * Mira Clipper - Playwright 端到端测试
 * 运行: npx playwright test e2e/extension.spec.js
 */

import { test, expect } from '@playwright/test';
import { startServer, stopServer } from './server.js';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const EXTENSION_PATH = join(__dirname, '../extension');

let server;
let serverUrl;

test.beforeAll(async () => {
  const s = await startServer(9876);
  server = s.server;
  serverUrl = s.url;
});

test.afterAll(async () => {
  await stopServer();
});

// 加载扩展上下文（Chromium 专属）
test.use({
  browserName: 'chromium',
  launchOptions: {
    args: [
      `--disable-extensions-except=${EXTENSION_PATH}`,
      `--load-extension=${EXTENSION_PATH}`,
    ],
  },
});

// ===== 测试 1：Content Script 读取页面信息 =====
test('content script 应正确读取文章页元数据', async ({ context }) => {
  const page = await context.newPage();
  await page.goto(`${serverUrl}/article`);

  // 注入 extractor + content script 并执行采集
  await page.addScriptTag({ path: join(EXTENSION_PATH, 'lib/extractor.js') });

  const info = await page.evaluate(() => {
    const extracted = window.MiraExtractor.extractPage(document);
    return {
      url: location.href,
      canonicalUrl: extracted.canonicalUrl,
      title: extracted.title || document.title,
      selectedText: window.getSelection().toString().trim(),
      favicon: extracted.faviconUrl,
      contentMarkdown: extracted.contentMarkdown,
      contentPlainText: extracted.contentPlainText,
      excerpt: extracted.excerpt,
      author: extracted.author,
      siteName: extracted.siteName,
      coverImageUrl: extracted.coverImageUrl,
      wordCount: extracted.wordCount,
    };
  });

  expect(info.url).toBe(`${serverUrl}/article`);
  expect(info.title).toBe('深入浅出 React Server Components — 前端技术周刊');
  expect(info.canonicalUrl).toBe('https://example.com/article/rsc-deep-dive');
  expect(info.favicon).toBe('https://example.com/favicon.ico');
  expect(info.selectedText).toBe('');
  expect(info.contentMarkdown).toContain('React Server Components');
  expect(info.contentPlainText).toContain('React Server Components');
  expect(info.wordCount).toBeGreaterThan(0);

  await page.close();
});

test('content script 应读取用户选中文字', async ({ context }) => {
  const page = await context.newPage();
  await page.goto(`${serverUrl}/article`);

  // 模拟用户选中文章正文第一段（不是 author 段落）
  await page.evaluate(() => {
    const paragraphs = document.querySelectorAll('article p');
    const target = Array.from(paragraphs).find(p => p.className !== 'author');
    const range = document.createRange();
    range.selectNodeContents(target);
    const sel = window.getSelection();
    sel.removeAllRanges();
    sel.addRange(range);
  });

  const info = await page.evaluate(() => {
    return {
      selectedText: window.getSelection().toString().trim(),
      title: document.title,
    };
  });

  expect(info.selectedText).toContain('React Server Components');
  expect(info.title).toBe('深入浅出 React Server Components — 前端技术周刊');

  await page.close();
});

// ===== 测试 2：Popup 表单交互 =====
test('popup 未授权时只显示授权码入口', async ({ context }) => {
  const popup = await context.newPage();

  await popup.addInitScript(() => {
    window.chrome = {
      storage: {
        sync: { get: async () => ({}) },
        local: { get: async () => ({}) },
      },
      runtime: {
        lastError: null,
        onMessage: { addListener: () => {} },
        getManifest: () => ({ action: { default_popup: 'popup/popup.html' } }),
      },
    };
  });

  await popup.goto(`file:///${join(EXTENSION_PATH, 'popup/popup.html').replace(/\\/g, '/')}`);

  await expect(popup.locator('#authGate')).toBeVisible();
  await expect(popup.locator('#captureView')).toBeHidden();
  await expect(popup.locator('#authorizationCode')).toBeVisible();
  await popup.close();
});

test('popup 应正确填充和提交剪藏表单', async ({ context }) => {
  const mockUrl = `${serverUrl}/article`;

  const popup = await context.newPage();

  // 在页面加载前注入 chrome API mock
  await popup.addInitScript((mockPageUrl) => {
    const pageInfo = {
      url: mockPageUrl,
      title: '深入浅出 React Server Components — 前端技术周刊',
      canonicalUrl: 'https://example.com/article/rsc-deep-dive',
      selectedText: '',
      favicon: 'https://example.com/favicon.ico',
      contentMarkdown: '# 深入浅出 React Server Components\n\nReact Server Components（RSC）是 React 18 引入的一项重要特性。',
      contentPlainText: '深入浅出 React Server Components React Server Components（RSC）是 React 18 引入的一项重要特性。',
      excerpt: 'React Server Components（RSC）是 React 18 引入的一项重要特性。',
      author: '张三',
      siteName: '前端技术周刊',
      coverImageUrl: 'https://cdn.example.com/cover-rsc.png',
      wordCount: 42,
      extractionStatus: 'ok',
    };
    window.chrome = {
      tabs: {
        query: async () => [{ id: 1, url: mockPageUrl }],
        sendMessage: (tabId, msg, cb) => {
          window.chrome.runtime.lastError = null;
          if (cb) cb(pageInfo);
        },
        captureVisibleTab: async () => 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
      },
      scripting: {
        executeScript: async () => {},
      },
      storage: {
        sync: {
          get: async () => ({}),
        },
        local: {
          get: async () => ({ accessToken: 'test-token' }),
        },
      },
      runtime: {
        lastError: null,
        sendMessage: async () => pageInfo,
        onMessage: { addListener: () => {} },
      },
    };
    window.fetch = async (url, opts) => {
      if (typeof url === 'string' && url.includes('/health')) {
        return { ok: true, status: 200, json: async () => ({ ok: true }) };
      }
      throw new Error(`Unexpected fetch during init: ${url}`);
    };
  }, mockUrl);

  await popup.goto(`file:///${join(EXTENSION_PATH, 'popup/popup.html').replace(/\\/g, '/')}`);

  // 等待加载完成（状态变为 READY）
  await popup.waitForFunction(() => {
    const btn = document.querySelector('#saveBtn');
    return btn && !btn.disabled && btn.querySelector('.label')?.textContent === '保存到 Mira';
  });

  // 验证表单填充
  const title = await popup.locator('#title').inputValue();
  expect(title).toBe('深入浅出 React Server Components — 前端技术周刊');
  await expect(popup.locator('.attachment-chip')).toHaveCount(1);
  await expect(popup.locator('.attachment-chip span')).toHaveCount(0);
  await expect(popup.locator('.capture-view')).toHaveCSS('border-style', 'none');
  await expect(popup.locator('#selectedText')).toHaveAttribute('rows', '3');

  await popup.locator('details.manual-details > summary').click();

  // 添加标签
  await popup.locator('#tagInput').fill('React');
  await popup.locator('#tagInput').press('Enter');
  await popup.locator('#tagInput').fill('前端');
  await popup.locator('#tagInput').press('Enter');

  const chips = await popup.locator('.tag-chip').count();
  expect(chips).toBe(2);

  // 填写备注
  await popup.locator('#note').fill('这篇文章讲得很透彻');
  await expect(popup.locator('#processAi')).not.toBeChecked();
  await popup.locator('#processAi').check();
  await expect(popup.locator('#processAi')).toBeChecked();

  // Mock fetch 并点击保存
  await popup.evaluate(() => {
    window.__savedPayload = null;
    window.originalFetch = window.fetch;
    window.fetch = async (url, opts) => {
      if (typeof url === 'string' && url.includes('/health')) {
        return { ok: true, status: 200, json: async () => ({ ok: true }) };
      }
      if (typeof url === 'string' && url.includes('/microapps/evolving-knowledge/captures')) {
        window.__savedPayload = JSON.parse(opts.body);
        return { status: 200, ok: true, json: async () => ({ success: true, data: { id: 'test-id' } }) };
      }
      return window.originalFetch(url, opts);
    };
  });

  await popup.locator('#saveBtn').click();

  // 等待成功状态
  await popup.waitForFunction(() => {
    const status = document.querySelector('#status');
    return status && status.textContent.includes('已保存');
  });

  // 验证提交的 payload
  const payload = await popup.evaluate(() => window.__savedPayload);
  expect(payload).toBeTruthy();
  expect(payload.sourceUrl).toBe(mockUrl);
  expect(payload.title).toBe('深入浅出 React Server Components — 前端技术周刊');
  expect(payload.contentType).toBe('text');
  expect(payload.rawContent).toContain('React Server Components');
  expect(payload.processAi).toBe(true);
  expect(payload.metadata.userTags).toEqual(['React', '前端']);
  expect(payload.metadata.note).toBe('这篇文章讲得很透彻');

  await popup.close();
});

// ===== 测试 3：无正文时使用选中文字 =====
test('popup 无正文时应提交选中文字作为 rawContent', async ({ context }) => {
  const mockUrl = `${serverUrl}/article`;

  const popup = await context.newPage();

  // Mock chrome API（包含 captureVisibleTab）
  await popup.addInitScript((mockPageUrl) => {
    const pageInfo = {
      url: mockPageUrl,
      title: 'Screenshot Test',
      canonicalUrl: null,
      selectedText: '用户选中的正文片段',
      favicon: null,
      contentMarkdown: '',
      contentPlainText: '',
      excerpt: '',
      author: '',
      siteName: '',
      coverImageUrl: null,
      wordCount: 0,
      extractionStatus: 'empty',
    };
    window.chrome = {
      tabs: {
        query: async () => [{ id: 1, url: mockPageUrl }],
        sendMessage: (tabId, msg, cb) => {
          window.chrome.runtime.lastError = null;
          if (cb) cb(pageInfo);
        },
      },
      scripting: { executeScript: async () => {} },
      storage: {
        sync: { get: async () => ({}) },
        local: { get: async () => ({ accessToken: 'test-token' }) },
        session: { get: async () => ({}), remove: async () => {} },
      },
      runtime: {
        lastError: null,
        sendMessage: async () => pageInfo,
        onMessage: { addListener: () => {} },
      },
    };
    window.fetch = async (url, opts) => {
      if (typeof url === 'string' && url.includes('/health')) {
        return { ok: true, status: 200, json: async () => ({ ok: true }) };
      }
      return { ok: false, status: 404 };
    };
  }, mockUrl);

  await popup.goto(`file:///${join(EXTENSION_PATH, 'popup/popup.html').replace(/\\/g, '/')}`);

  // 等待 READY
  await popup.waitForFunction(() => {
    const btn = document.querySelector('#saveBtn');
    return btn && !btn.disabled;
  });

  // Mock fetch
  await popup.evaluate(() => {
    window.__savedPayload = null;
    window.fetch = async (url, opts) => {
      if (typeof url === 'string' && url.includes('/health')) {
        return { ok: true, status: 200, json: async () => ({ ok: true }) };
      }
      if (typeof url === 'string' && url.includes('/microapps/evolving-knowledge/captures')) {
        window.__savedPayload = JSON.parse(opts.body);
        return { status: 200, ok: true, json: async () => ({ success: true, data: { id: 'text-id' } }) };
      }
      return { ok: false, status: 404 };
    };
  });

  await popup.locator('#saveBtn').click();

  // 等待成功
  await popup.waitForFunction(() => {
    const status = document.querySelector('#status');
    return status && status.textContent.includes('已保存');
  });

  const payload = await popup.evaluate(() => window.__savedPayload);
  expect(payload.contentType).toBe('text');
  expect(payload.rawContent).toBe('用户选中的正文片段');

  await popup.close();
});

test('popup 有自动提取正文时仍应优先提交用户选中文字', async ({ context }) => {
  const mockUrl = `${serverUrl}/article`;
  const popup = await context.newPage();

  await popup.addInitScript((pageUrl) => {
    const pageInfo = {
      url: pageUrl,
      title: '选区优先测试',
      canonicalUrl: pageUrl,
      selectedText: '用户明确选择的片段',
      favicon: null,
      contentMarkdown: '# 自动提取的整篇正文\n\n不应覆盖用户选区。',
      contentPlainText: '自动提取的整篇正文，不应覆盖用户选区。',
      excerpt: '',
      author: '',
      siteName: '',
      coverImageUrl: null,
      wordCount: 10,
      extractionStatus: 'ok',
    };
    window.chrome = {
      tabs: {
        query: async () => [{ id: 1, url: pageUrl }],
        sendMessage: (tabId, msg, cb) => cb(pageInfo),
      },
      storage: {
        sync: { get: async () => ({}) },
        local: { get: async () => ({ accessToken: 'test-token' }) },
        session: { get: async () => ({}), remove: async () => {} },
      },
      runtime: { lastError: null, onMessage: { addListener: () => {} } },
    };
    window.fetch = async (url, opts) => {
      if (typeof url === 'string' && url.includes('/health')) {
        return { ok: true, status: 200, json: async () => ({ ok: true }) };
      }
      return { ok: false, status: 404 };
    };
  }, mockUrl);

  await popup.goto(`file:///${join(EXTENSION_PATH, 'popup/popup.html').replace(/\\/g, '/')}`);
  await popup.waitForFunction(() => document.querySelector('#saveBtn')?.disabled === false);
  await popup.evaluate(() => {
    window.__savedPayload = null;
    window.fetch = async (url, opts) => {
      if (typeof url === 'string' && url.includes('/health')) {
        return { ok: true, status: 200, json: async () => ({ ok: true }) };
      }
      if (url.includes('/microapps/evolving-knowledge/captures')) {
        window.__savedPayload = JSON.parse(opts.body);
        return { ok: true, status: 200, json: async () => ({ success: true, data: { id: 'selection-id' } }) };
      }
      return { ok: false, status: 404 };
    };
  });

  await popup.locator('#saveBtn').click();
  await popup.waitForFunction(() => document.querySelector('#status')?.textContent.includes('已保存'));
  const payload = await popup.evaluate(() => window.__savedPayload);
  expect(payload.rawContent).toBe('用户明确选择的片段');
  await popup.close();
});

test('popup 采集图片时应显示图片预览并提交 image 类型', async ({ context }) => {
  const mockUrl = `${serverUrl}/image-page`;
  const imageUrl = `${serverUrl}/assets/sample.png`;
  const popup = await context.newPage();

  await popup.addInitScript(({ pageUrl, selectedImageUrl, secondImageUrl, backendUrl }) => {
    const pageInfo = {
      url: pageUrl,
      title: '图片采集测试',
      canonicalUrl: pageUrl,
      selectedText: '',
      favicon: null,
      contentMarkdown: '# 图片页面正文\n\n这段文字和图片一起采集。',
      contentPlainText: '图片页面正文 这段文字和图片一起采集。',
      contentType: 'image',
      imageUrl: selectedImageUrl,
      imageUrls: [selectedImageUrl, secondImageUrl],
      extractionStatus: 'empty',
    };
    window.chrome = {
      tabs: {
        query: async () => [{ id: 1, url: pageUrl }],
        sendMessage: (tabId, msg, cb) => cb(pageInfo),
      },
      storage: {
        sync: { get: async () => ({ backendUrl }), set: async () => {} },
        local: { get: async () => ({ accessToken: 'test-token' }), remove: async () => {} },
        session: { get: async () => ({}), remove: async () => {} },
      },
      runtime: { lastError: null, onMessage: { addListener: () => {} } },
    };
    window.fetch = async (url, opts) => {
      if (typeof url === 'string' && url.includes('/health')) {
        return { ok: true, status: 200, json: async () => ({ ok: true }) };
      }
      if (typeof url === 'string' && url.includes('/microapps/evolving-knowledge/captures')) {
        window.__savedPayload = JSON.parse(opts.body);
        return { ok: true, status: 200, json: async () => ({ success: true }) };
      }
      return { ok: false, status: 404, json: async () => ({}) };
    };
  }, { pageUrl: mockUrl, selectedImageUrl: imageUrl, secondImageUrl: `${serverUrl}/assets/second.png`, backendUrl: serverUrl });

  await popup.goto(`file:///${join(EXTENSION_PATH, 'popup/popup.html').replace(/\\/g, '/')}`);
  await popup.waitForFunction(() => document.querySelector('#saveBtn')?.disabled === false);
  await expect(popup.locator('#selectedText')).toBeVisible();
  await expect(popup.locator('#imagePreview')).toBeVisible();
  await expect(popup.locator('#imagePreview img')).toHaveCount(2);
  await expect(popup.locator('#imagePreview img').first()).toHaveAttribute('src', imageUrl);

  await popup.locator('#saveBtn').click();
  await popup.waitForFunction(() => document.querySelector('#status')?.textContent.includes('已保存'));
  const payload = await popup.evaluate(() => window.__savedPayload);
  expect(payload.contentType).toBe('image');
  expect(payload.rawContent).toContain('图片页面正文');
  expect(payload.rawContent).toContain(`![图片采集测试 1](${imageUrl})`);
  expect(payload.rawContent).toContain(`![图片采集测试 2](${serverUrl}/assets/second.png)`);
  expect(payload.metadata.imageUrl).toBe(imageUrl);
  expect(payload.metadata.imageUrls).toEqual([imageUrl, `${serverUrl}/assets/second.png`]);
  expect(payload.metadata.selectedText).toBeUndefined();
  await popup.close();
});
