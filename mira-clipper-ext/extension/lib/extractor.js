/**
 * Mira Clipper - 浏览器端正文提取 + Markdown 转换
 * 零依赖，纯原生 JS，在 Content Script 中运行。
 * 核心逻辑：文本密度启发式 → 提取正文区 → 清洗 HTML → 转 Markdown
 */

(function (global) {
  'use strict';

  const BLOCK_TAGS = new Set([
    'P', 'DIV', 'SECTION', 'ARTICLE', 'MAIN', 'HEADER', 'FOOTER',
    'H1', 'H2', 'H3', 'H4', 'H5', 'H6',
    'UL', 'OL', 'LI', 'BLOCKQUOTE', 'PRE', 'TABLE', 'TR', 'TD', 'TH'
  ]);

  const UNWANTED_TAGS = new Set([
    'SCRIPT', 'STYLE', 'NOSCRIPT', 'IFRAME', 'CANVAS', 'SVG',
    'NAV', 'ASIDE', 'FORM', 'INPUT', 'BUTTON', 'TEXTAREA', 'SELECT'
  ]);

  const MIN_TEXT_LENGTH = 100;
  const MIN_CONTENT_LENGTH = 80;

  // ===== 1. 正文提取（文本密度法） =====

  function extractContent(doc) {
    // 语义容器也进入统一评分，避免把站点壳层直接当正文。
    const candidates = [];
    if (!doc.body) return null;

    const walker = doc.createTreeWalker(doc.body, NodeFilter.SHOW_ELEMENT);

    while (walker.nextNode()) {
      const el = walker.currentNode;
      if (isUnwanted(el)) continue;

      const text = (el.innerText || '').trim();
      const textLen = text.length;
      if (textLen < MIN_TEXT_LENGTH) continue;

      const linkText = Array.from(el.querySelectorAll('a'))
        .reduce((sum, a) => sum + (a.innerText || '').length, 0);
      const linkDensity = textLen > 0 ? linkText / textLen : 0;
      if (linkDensity > 0.45) continue; // 链接密度太高，疑似导航/列表页

      const tagName = el.tagName;
      let score = textLen * (1 - Math.min(linkDensity, 0.4));
      const blockCount = el.querySelectorAll('p, h1, h2, h3, h4, h5, h6, li, pre, blockquote').length;
      if (blockCount > 0) score += Math.min(blockCount * 20, 500);

      // 语义标签加分
      if (tagName === 'ARTICLE') score *= 5;
      else if (tagName === 'MAIN') score *= 3;
      else if (tagName === 'SECTION') score *= 2;

      // 类名/id 关键词加分
      const identifier = (el.className + ' ' + el.id).toLowerCase();
      if (/\bcontent\b|\barticle\b|\bpost\b|\bentry\b|\bbody\b/.test(identifier)) {
        score *= 2;
      }
      if (/\bcomment\b|\badvertisement\b|\bsidebar\b|\bfooter\b|\bheader\b/.test(identifier)) {
        score *= 0.3;
      }

      candidates.push({ el, score, textLen });
    }

    if (candidates.length === 0) return null;

    candidates.sort((a, b) => b.score - a.score);
    const best = candidates[0];
    if (!best || best.textLen < MIN_CONTENT_LENGTH) return null;
    return best.el;
  }

  function isUnwanted(el) {
    const tag = el.tagName;
    if (UNWANTED_TAGS.has(tag)) return true;

    // 隐藏元素
    const style = window.getComputedStyle(el);
    if (style.display === 'none' || style.visibility === 'hidden') return true;

    return false;
  }

  // ===== 2. 清洗 DOM =====

  function cleanNode(node) {
    if (node.nodeType === Node.TEXT_NODE) {
      const text = node.nodeValue.replace(/\s+/g, ' ');
      return text.length > 0 ? document.createTextNode(text) : null;
    }

    if (node.nodeType !== Node.ELEMENT_NODE) return null;

    const tag = node.tagName;
    if (UNWANTED_TAGS.has(tag)) return null;

    const clone = document.createElement(tag);

    // 保留有用属性
    if (tag === 'A') {
      const href = node.getAttribute('href');
      if (href) clone.setAttribute('href', href);
    }
    if (tag === 'IMG') {
      const src = node.getAttribute('src');
      const alt = node.getAttribute('alt') || '';
      if (src) {
        clone.setAttribute('src', resolveUrl(src));
        clone.setAttribute('alt', alt);
      }
    }
    if (/^H[1-6]$/.test(tag)) {
      const id = node.getAttribute('id');
      if (id) clone.setAttribute('id', id);
    }

    // 递归处理子节点
    for (const child of node.childNodes) {
      const cleaned = cleanNode(child);
      if (cleaned) clone.appendChild(cleaned);
    }

    // 空容器丢弃
    if (clone.childNodes.length === 0 && !BLOCK_TAGS.has(tag)) {
      return null;
    }

    return clone;
  }

  function resolveUrl(url) {
    try {
      return new URL(url, location.href).href;
    } catch {
      return url;
    }
  }

  // ===== 3. HTML → Markdown =====

  function toMarkdown(node, depth) {
    if (!node) return '';

    if (node.nodeType === Node.TEXT_NODE) {
      return escapeMd(node.nodeValue);
    }

    if (node.nodeType !== Node.ELEMENT_NODE) return '';

    const tag = node.tagName;
    const children = Array.from(node.childNodes)
      .map(c => toMarkdown(c, depth + 1))
      .join('');

    switch (tag) {
      case 'H1': return `\n\n# ${children.trim()}\n\n`;
      case 'H2': return `\n\n## ${children.trim()}\n\n`;
      case 'H3': return `\n\n### ${children.trim()}\n\n`;
      case 'H4': return `\n\n#### ${children.trim()}\n\n`;
      case 'H5': return `\n\n##### ${children.trim()}\n\n`;
      case 'H6': return `\n\n###### ${children.trim()}\n\n`;
      case 'P':  return `\n\n${children.trim()}\n\n`;
      case 'BR': return '\n';
      case 'STRONG':
      case 'B':  return `**${children}**`;
      case 'EM':
      case 'I':  return `*${children}*`;
      case 'CODE': return `\`${children}\``;
      case 'A': {
        const href = node.getAttribute('href');
        return href ? `[${children.trim()}](${href})` : children;
      }
      case 'IMG': {
        const src = node.getAttribute('src');
        const alt = node.getAttribute('alt') || '';
        return src ? `\n\n![${alt}](${src})\n\n` : '';
      }
      case 'UL': return `\n\n${children.trim()}\n\n`;
      case 'OL': return `\n\n${children.trim()}\n\n`;
      case 'LI': return `- ${children.trim().replace(/^-\s*/, '')}\n`;
      case 'BLOCKQUOTE': return `\n\n> ${children.trim().replace(/\n/g, '\n> ')}\n\n`;
      case 'PRE': {
        const code = children.trim();
        return `\n\n\`\`\`\n${code}\n\`\`\`\n\n`;
      }
      case 'DIV':
      case 'SECTION':
      case 'ARTICLE':
      case 'MAIN':
      case 'SPAN':
        return children;
      default:
        return children;
    }
  }

  function escapeMd(text) {
    return text
      .replace(/\\/g, '\\\\')
      .replace(/\*/g, '\\*')
      .replace(/_/g, '\\_')
      .replace(/\[/g, '\\[')
      .replace(/\]/g, '\\]');
  }

  // ===== 4. 提取元数据 =====

  function extractMeta(doc) {
    const getMeta = (prop) =>
      doc.querySelector(`meta[property="${prop}"], meta[name="${prop}"]`)?.content || null;

    const canonical = doc.querySelector('link[rel="canonical"]')?.href || null;
    const favicon =
      doc.querySelector('link[rel="icon"]')?.href ||
      doc.querySelector('link[rel="shortcut icon"]')?.href || null;

    return {
      title: doc.title || '',
      canonicalUrl: canonical,
      excerpt: getMeta('description') || getMeta('og:description') || '',
      author: getMeta('author') || getMeta('article:author') || '',
      siteName: getMeta('og:site_name') || '',
      coverImageUrl: getMeta('og:image') || null,
      faviconUrl: favicon ? resolveUrl(favicon) : null,
    };
  }

  // ===== 5. 主入口 =====

  function extractPage(doc) {
    const meta = extractMeta(doc);
    const contentEl = extractContent(doc);

    if (!contentEl) {
      return {
        ...meta,
        contentMarkdown: '',
        contentPlainText: (doc.body?.innerText || '').trim(),
        imageUrls: [],
        wordCount: 0,
        extractionStatus: 'empty',
      };
    }

    const cleaned = cleanNode(contentEl);
    const imageUrls = Array.from(cleaned.querySelectorAll('img'))
      .map((image) => image.getAttribute('src'))
      .filter(Boolean)
      .filter((url, index, urls) => urls.indexOf(url) === index);
    const markdown = toMarkdown(cleaned, 0)
      .replace(/\n{3,}/g, '\n\n')
      .trim();

    // 从 Markdown 提取纯文本（去掉格式符号）
    const plainText = markdown
      .replace(/!\[.*?\]\(.*?\)/g, '')
      .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
      .replace(/[#*`>\-]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();

    const extractionStatus = plainText.length >= MIN_CONTENT_LENGTH ? 'ok' : 'low_content';

    return {
      ...meta,
      contentMarkdown: markdown,
      contentPlainText: plainText,
      imageUrls,
      wordCount: plainText.split(/\s+/).length,
      extractionStatus,
    };
  }

  // 暴露到全局
  global.MiraExtractor = { extractPage };
})(this);
