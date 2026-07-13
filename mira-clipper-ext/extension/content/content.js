/**
 * Mira Clipper - Content Script
 * 职责：读取当前页面元数据 + 提取清洗后的正文，通过 Message 回传
 * 注入方式：popup.js 动态执行 chrome.scripting.executeScript
 */

(function () {
  'use strict';

  // 避免重复注册（若被多次注入）
  if (window.__miraClipperReady) return;
  window.__miraClipperReady = true;

  function waitForPageToSettle() {
    return new Promise((resolve) => {
      let timer = null;
      let hardStop = null;
      const finish = () => {
        if (timer) clearTimeout(timer);
        if (hardStop) clearTimeout(hardStop);
        observer?.disconnect();
        resolve();
      };
      const observer = new MutationObserver(() => {
        if (timer) clearTimeout(timer);
        timer = setTimeout(finish, 300);
      });
      observer.observe(document.documentElement || document, {
        subtree: true,
        childList: true,
        characterData: true,
      });
      timer = setTimeout(finish, 300);
      hardStop = setTimeout(finish, 1800);
    });
  }

  async function getPageInfo() {
    await waitForPageToSettle();
    // 使用 extractor 提取清洗后的内容
    const extracted = window.MiraExtractor
      ? window.MiraExtractor.extractPage(document)
      : { contentMarkdown: '', contentPlainText: '', wordCount: 0 };

    const selectedText = window.getSelection().toString().trim();

    const imageDataUrls = [];
    for (const imageUrl of (extracted.imageUrls || []).slice(0, 10)) {
      try {
        const response = await fetch(imageUrl, { credentials: 'include' });
        if (!response.ok) continue;
        const blob = await response.blob();
        if (!blob.type.startsWith('image/') || blob.size > 8 * 1024 * 1024) continue;
        const dataUrl = await new Promise((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result);
          reader.onerror = reject;
          reader.readAsDataURL(blob);
        });
        if (typeof dataUrl === 'string') imageDataUrls.push({ dataUrl, mimeType: blob.type });
      } catch (_) {
        // Some cross-origin images cannot be read by the page context.
      }
    }

    return {
      url: location.href,
      canonicalUrl: extracted.canonicalUrl,
      title: extracted.title || document.title || '',
      selectedText: selectedText,
      favicon: extracted.faviconUrl,
      // 清洗后的内容
      contentMarkdown: extracted.contentMarkdown || '',
      contentPlainText: extracted.contentPlainText || '',
      imageUrls: extracted.imageUrls || [],
      imageDataUrls,
      excerpt: extracted.excerpt || '',
      author: extracted.author || '',
      siteName: extracted.siteName || '',
      coverImageUrl: extracted.coverImageUrl || null,
      wordCount: extracted.wordCount || 0,
      extractionStatus: extracted.extractionStatus || 'empty',
    };
  }

  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request && request.type === 'GET_PAGE_INFO') {
      getPageInfo().then(sendResponse);
    }
    return true; // 保持通道开放（异步）
  });
})();
