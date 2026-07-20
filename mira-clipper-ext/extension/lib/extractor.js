/**
 * 触界 - 浏览器端正文提取 + Markdown 转换
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
      const src = imageSourceUrl(node);
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

  function collectImageUrls(doc, root, imagePolicy) {
    const urls = [];
    const seen = new Set();
    const imageRoot = root || doc;
    const minWidth = Number.isFinite(imagePolicy?.minWidth) ? imagePolicy.minWidth : 100;
    const minHeight = Number.isFinite(imagePolicy?.minHeight) ? imagePolicy.minHeight : 100;
    const maxCount = Number.isFinite(imagePolicy?.maxCount) ? imagePolicy.maxCount : 50;

    const addImage = (candidate, element) => {
      if (!candidate) return;
      const url = resolveUrl(candidate);
      if (!/^https?:\/\//i.test(url) || /\.svg(?:[?#]|$)/i.test(url) || seen.has(url)) return;

      const rect = element?.getBoundingClientRect?.();
      const width = element?.naturalWidth || rect?.width || 0;
      const height = element?.naturalHeight || rect?.height || 0;
      if (width > 0 && height > 0 && (width < minWidth || height < minHeight)) return;

      seen.add(url);
      urls.push(url);
    };

    for (const image of imageRoot.querySelectorAll('img')) {
      addImage(imageSourceUrl(image), image);
      if (urls.length >= maxCount) break;
    }

    if (urls.length < maxCount) {
      for (const source of imageRoot.querySelectorAll('source[srcset], img[srcset]')) {
        const candidate = largestSrcsetUrl(source.getAttribute('srcset'));
        addImage(candidate, source);
        if (urls.length >= maxCount) break;
      }
    }

    if (urls.length < maxCount) {
      for (const element of imageRoot.querySelectorAll('[style*="background-image"]')) {
        const style = window.getComputedStyle(element);
        const candidates = extractCssUrls(style.backgroundImage || element.getAttribute('style') || '');
        for (const candidate of candidates) {
          addImage(candidate, element);
          if (urls.length >= maxCount) break;
        }
        if (urls.length >= maxCount) break;
      }
    }

    if (urls.length < maxCount) {
      for (const link of imageRoot.querySelectorAll('a[href]')) {
        const href = link.getAttribute('href');
        if (/\.(?:avif|bmp|gif|jpe?g|png|webp)(?:[?#]|$)/i.test(href || '')) {
          addImage(href, link);
        }
        if (urls.length >= maxCount) break;
      }
    }

    const coverImage = !root && doc.querySelector('meta[property="og:image"]')?.content;
    if (coverImage) {
      const url = resolveUrl(coverImage);
      if (/^https?:\/\//i.test(url) && !seen.has(url)) urls.unshift(url);
    }

    return urls.slice(0, maxCount);
  }

  function largestSrcsetUrl(srcset) {
    if (!srcset) return '';
    return srcset.split(',')
      .map((item) => item.trim().split(/\s+/))
      .filter(([url]) => url)
      .sort((left, right) => parseFloat(right[1]) - parseFloat(left[1]))[0]?.[0] || '';
  }

  function extractCssUrls(value) {
    return Array.from(String(value).matchAll(/url\((?:"([^"]+)"|'([^']+)'|([^)]*))\)/gi))
      .map((match) => match[1] || match[2] || match[3])
      .map((value) => value.trim())
      .filter(Boolean);
  }

  function imageOnlyMarkdown(title, imageUrls) {
    if (!imageUrls.length) return '';
    const heading = title ? `# ${title}\n\n` : '';
    return heading + imageUrls
      .map((url, index) => `![${title || '网页图片'} ${index + 1}](${url})`)
      .join('\n\n');
  }

  // ===== 5. 主入口 =====

  function getRuleRoot(doc, rule) {
    if (!rule) return { root: null, status: 'not_configured' };
    if (rule.enabled === false) return { root: null, status: 'disabled' };
    if (!rule.includeSelector) return { root: extractContent(doc), status: 'applied' };

    try {
      const root = doc.querySelector(rule.includeSelector);
      return root ? { root, status: 'applied' } : { root: null, status: 'rule_not_matched' };
    } catch (_) {
      return { root: null, status: 'rule_invalid' };
    }
  }

  function removeExcludedNodes(root, selectors) {
    if (!root || !Array.isArray(selectors)) return;
    for (const selector of selectors) {
      try {
        root.querySelectorAll(selector).forEach((node) => node.remove());
      } catch (_) {
        // One invalid exclusion must not invalidate the remaining rule.
      }
    }
  }

  function imageSourceUrl(image) {
    const candidate = image.currentSrc || [
      'src', 'data-src', 'data-original', 'data-lazy-src', 'data-url',
    ].map((attribute) => image.getAttribute(attribute)).find(Boolean);
    return candidate ? resolveUrl(candidate) : largestSrcsetUrl(image.getAttribute('srcset'));
  }

  function applyImagePolicy(sourceRoot, clonedRoot, imagePolicy, excludeSelectors) {
    if (!sourceRoot || !clonedRoot || !imagePolicy) return;
    const minWidth = Number.isFinite(imagePolicy.minWidth) ? imagePolicy.minWidth : 100;
    const minHeight = Number.isFinite(imagePolicy.minHeight) ? imagePolicy.minHeight : 100;
    const maxCount = Number.isFinite(imagePolicy.maxCount) ? imagePolicy.maxCount : 20;
    const excludedNodes = [];
    for (const selector of excludeSelectors || []) {
      try {
        excludedNodes.push(...sourceRoot.querySelectorAll(selector));
      } catch (_) {}
    }
    const allowedUrls = new Set();
    const sourceImages = Array.from(sourceRoot.querySelectorAll('img'));
    let kept = 0;
    for (const image of sourceImages) {
      if (excludedNodes.some((node) => node === image || node.contains(image))) continue;
      const rect = image.getBoundingClientRect?.();
      const width = image.naturalWidth || rect?.width || 0;
      const height = image.naturalHeight || rect?.height || 0;
      if ((width > 0 && width < minWidth) || (height > 0 && height < minHeight)) continue;
      const url = imageSourceUrl(image);
      if (!url || allowedUrls.has(url) || kept >= maxCount) continue;
      allowedUrls.add(url);
      kept += 1;
    }

    for (const image of clonedRoot.querySelectorAll('img')) {
      if (!allowedUrls.has(imageSourceUrl(image))) image.remove();
    }
  }

  function extractPage(doc, rule) {
    const meta = extractMeta(doc);
    const ruleResult = getRuleRoot(doc, rule);
    const ruleApplied = ruleResult.status === 'applied';
    let contentEl = ruleApplied ? ruleResult.root : extractContent(doc);

    if (ruleApplied && contentEl) {
      contentEl = contentEl.cloneNode(true);
      removeExcludedNodes(contentEl, rule.excludeSelectors);
      applyImagePolicy(ruleResult.root, contentEl, rule.imagePolicy, rule.excludeSelectors);
    }

    if (!contentEl) {
      const imageUrls = ruleApplied
        ? collectImageUrls(doc, null, rule?.imagePolicy)
        : collectImageUrls(doc);
      const imageMarkdown = imageOnlyMarkdown(meta.title, imageUrls);
      return {
        ...meta,
        contentMarkdown: imageMarkdown,
        contentPlainText: imageUrls.length ? meta.title : (doc.body?.innerText || '').trim(),
        imageUrls,
        wordCount: 0,
        extractionStatus: imageUrls.length ? 'image_only' : 'empty',
        ruleStatus: ruleResult.status,
      };
    }

    const imageUrls = collectImageUrls(doc, contentEl, rule?.imagePolicy);
    const cleaned = cleanNode(contentEl);
    const markdown = toMarkdown(cleaned, 0)
      .replace(/\n{3,}/g, '\n\n')
      .trim();
    const markdownWithImages = imageUrls.reduce((value, url, index) =>
      value.includes(`](${url})`) ? value : `${value}\n\n![网页图片 ${index + 1}](${url})`, markdown);

    // 从 Markdown 提取纯文本（去掉格式符号）
    const plainText = markdownWithImages
      .replace(/!\[.*?\]\(.*?\)/g, '')
      .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
      .replace(/[#*`>\-]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();

    const extractionStatus = plainText.length >= MIN_CONTENT_LENGTH ? 'ok' : 'low_content';

    return {
      ...meta,
      contentMarkdown: markdownWithImages,
      contentPlainText: plainText,
      imageUrls,
      wordCount: plainText.split(/\s+/).length,
      extractionStatus,
      ruleStatus: ruleResult.status,
    };
  }

  // 暴露到全局
  global.MiraExtractor = { extractPage };
})(this);
