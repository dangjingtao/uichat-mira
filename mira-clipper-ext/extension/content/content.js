/**
 * MiraWebBrige - page execution bridge
 * Handles user clipping extraction and the local WebBridge action contract.
 */

(function () {
  'use strict';

  if (window.__miraClipperReady) return;
  window.__miraClipperReady = true;

  window.addEventListener('message', (event) => {
    if (event.source !== window || event.origin !== window.location.origin) return;
    if (event.data?.source !== 'mira-webbridge-ui' || event.data?.type !== 'WEBBRIDGE_OPEN_AUTHORIZATION_PAGE') return;

    chrome.runtime.sendMessage({ type: 'WEBBRIDGE_OPEN_AUTHORIZATION_PAGE' })
      .then((result) => {
        window.postMessage({
          source: 'mira-webbridge-extension',
          type: 'WEBBRIDGE_OPEN_AUTHORIZATION_PAGE_RESULT',
          requestId: event.data.requestId,
          ...result,
        }, window.location.origin);
      })
      .catch((error) => {
        window.postMessage({
          source: 'mira-webbridge-extension',
          type: 'WEBBRIDGE_OPEN_AUTHORIZATION_PAGE_RESULT',
          requestId: event.data.requestId,
          ok: false,
          message: error?.message || '无法打开见行授权页',
        }, window.location.origin);
      });
  });

  let statusNode = null;
  function showBridgeStatus(status, operation, error) {
    if (!statusNode) {
      statusNode = document.createElement('div');
      statusNode.id = 'mira-webbridge-status';
      statusNode.style.cssText = 'position:fixed;top:16px;right:16px;z-index:2147483647;max-width:320px;padding:10px 14px;border-radius:10px;background:#111827;color:#fff;font:13px/1.4 system-ui,sans-serif;box-shadow:0 6px 24px rgba(0,0,0,.24);transition:opacity .2s';
      (document.body || document.documentElement).appendChild(statusNode);
    }
    statusNode.textContent = status === 'running' ? `见行 · ${operation || 'AI 正在操作'}` : status === 'completed' ? `见行 · 已完成${operation ? ` · ${operation}` : ''}` : `见行 · 操作失败${error ? `：${error}` : ''}`;
    statusNode.style.opacity = '1';
    if (status !== 'running') setTimeout(() => { if (statusNode) statusNode.style.opacity = '0'; }, 2600);
  }

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
        if (typeof dataUrl === 'string') imageDataUrls.push({ dataUrl, mimeType: blob.type, sourceUrl: imageUrl });
      } catch (_) {
        // Cross-origin images may not be readable from the page context.
      }
    }

    return {
      url: location.href,
      canonicalUrl: extracted.canonicalUrl,
      title: extracted.title || document.title || '',
      selectedText,
      favicon: extracted.faviconUrl,
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
      pageHtml: document.documentElement?.outerHTML || document.body?.outerHTML || '',
    };
  }

  function getElementName(element) {
    const label = element.id ? document.querySelector(`label[for="${CSS.escape(element.id)}"]`) : null;
    return (
      element.getAttribute('aria-label') ||
      label?.innerText?.trim() ||
      element.getAttribute('name') ||
      element.getAttribute('placeholder') ||
      element.innerText?.trim() ||
      element.value ||
      ''
    ).replace(/\s+/g, ' ').trim().slice(0, 160);
  }

  function getElementRole(element) {
    if (element.getAttribute('role')) return element.getAttribute('role');
    if (element.tagName === 'A') return 'link';
    if (element.tagName === 'BUTTON') return 'button';
    if (element.tagName === 'INPUT') return element.type === 'checkbox' ? 'checkbox' : 'textbox';
    if (element.tagName === 'TEXTAREA') return 'textbox';
    if (element.tagName === 'SELECT') return 'combobox';
    return 'generic';
  }

  function buildSnapshot() {
    const selector = [
      'a[href]', 'button', 'input', 'textarea', 'select',
      '[role="button"]', '[role="link"]', '[role="checkbox"]',
      '[role="combobox"]', '[contenteditable="true"]',
    ].join(',');
    const elements = Array.from(document.querySelectorAll(selector))
      .filter((element) => {
        const rect = element.getBoundingClientRect();
        const style = window.getComputedStyle(element);
        return rect.width > 0 && rect.height > 0 && style.visibility !== 'hidden' && style.display !== 'none';
      })
      .slice(0, 200);
    const refs = new Map();
    const serialized = elements.map((element, index) => {
      const ref = `e${index + 1}`;
      refs.set(ref, element);
      return {
        ref,
        role: getElementRole(element),
        name: getElementName(element),
        text: element.innerText?.trim().replace(/\s+/g, ' ').slice(0, 240) || '',
        disabled: Boolean(element.disabled || element.getAttribute('aria-disabled') === 'true'),
        tag: element.tagName.toLowerCase(),
        type: element.getAttribute('type') || undefined,
        href: element instanceof HTMLAnchorElement ? element.href : undefined,
        value: typeof element.value === 'string' ? element.value.slice(0, 240) : undefined,
      };
    });
    window.__miraWebBridgeRefs = refs;
    window.__miraWebBridgeSnapshotVersion = (window.__miraWebBridgeSnapshotVersion || 0) + 1;
    return {
      url: location.href,
      title: document.title,
      text: (document.body?.innerText || '').replace(/\s+/g, ' ').trim().slice(0, 12000),
      version: window.__miraWebBridgeSnapshotVersion,
      elements: serialized,
    };
  }

  function requireElement(ref) {
    const element = window.__miraWebBridgeRefs?.get(ref);
    if (!element || !element.isConnected) {
      const error = new Error('页面元素引用已失效，请重新观察页面');
      error.code = 'STALE_ELEMENT_REF';
      throw error;
    }
    return element;
  }

  function dispatchInput(element, value) {
    if (element.isContentEditable) {
      element.textContent = value;
    } else {
      const prototype = Object.getPrototypeOf(element);
      const descriptor = Object.getOwnPropertyDescriptor(prototype, 'value');
      if (descriptor?.set) descriptor.set.call(element, value);
      else element.value = value;
    }
    element.dispatchEvent(new Event('input', { bubbles: true }));
    element.dispatchEvent(new Event('change', { bubbles: true }));
  }

  function selectValue(element, value) {
    if (!(element instanceof HTMLSelectElement)) {
      dispatchInput(element, value);
      return;
    }
    const option = Array.from(element.options).find((item) => item.value === value || item.textContent?.trim() === value);
    if (!option) throw new Error(`找不到选项：${value}`);
    element.value = option.value;
    element.dispatchEvent(new Event('input', { bubbles: true }));
    element.dispatchEvent(new Event('change', { bubbles: true }));
  }

  function dispatchKey(target, key) {
    const parts = String(key || '').split('+');
    const code = parts.pop() || '';
    const options = {
      key: code,
      bubbles: true,
      cancelable: true,
      ctrlKey: parts.includes('Control') || parts.includes('Ctrl'),
      shiftKey: parts.includes('Shift'),
      altKey: parts.includes('Alt'),
      metaKey: parts.includes('Meta') || parts.includes('Command'),
    };
    target.focus?.();
    target.dispatchEvent(new KeyboardEvent('keydown', options));
    target.dispatchEvent(new KeyboardEvent('keypress', options));
    target.dispatchEvent(new KeyboardEvent('keyup', options));
    if (code === 'Enter' && target.form) target.form.requestSubmit?.();
  }

  function dispatchDrag(from, to) {
    const dataTransfer = new DataTransfer();
    from.dispatchEvent(new DragEvent('dragstart', { bubbles: true, dataTransfer }));
    to.dispatchEvent(new DragEvent('dragenter', { bubbles: true, dataTransfer }));
    to.dispatchEvent(new DragEvent('dragover', { bubbles: true, dataTransfer }));
    to.dispatchEvent(new DragEvent('drop', { bubbles: true, dataTransfer }));
    from.dispatchEvent(new DragEvent('dragend', { bubbles: true, dataTransfer }));
  }

  async function actOnPage(request) {
    const mode = request.mode;
    if (mode === 'click' || mode === 'hover') {
      const element = requireElement(request.ref);
      element.focus?.();
      if (mode === 'hover') {
        element.dispatchEvent(new MouseEvent('mouseover', { bubbles: true, view: window }));
        element.dispatchEvent(new MouseEvent('mouseenter', { bubbles: true, view: window }));
        return { summary: '已悬停目标元素' };
      }
      if (request.doubleClick) {
        element.click?.();
        element.click?.();
        element.dispatchEvent(new MouseEvent('dblclick', { bubbles: true, view: window }));
      } else {
        element.click?.();
      }
      return { summary: request.doubleClick ? '已双击目标元素' : '已点击目标元素' };
    }

    if (mode === 'drag') {
      dispatchDrag(requireElement(request.fromRef), requireElement(request.toRef));
      return { summary: '已拖拽元素' };
    }

    if (mode === 'fill' || mode === 'select') {
      const fields = Array.isArray(request.fields) ? request.fields : [{ ref: request.ref, value: request.value }];
      for (const field of fields) {
        const element = requireElement(field.ref);
        if (element.type === 'checkbox' || element.type === 'radio') {
          element.checked = Boolean(field.value);
          element.dispatchEvent(new Event('change', { bubbles: true }));
        } else if (mode === 'select') {
          selectValue(element, String(field.value ?? ''));
        } else {
          dispatchInput(element, String(field.value ?? ''));
        }
      }
      if (request.submit) dispatchKey(document.activeElement || document.body, request.submit);
      return { summary: mode === 'fill' ? '已填写表单' : '已选择选项' };
    }

    if (mode === 'press') {
      const target = request.ref ? requireElement(request.ref) : document.activeElement || document.body;
      dispatchKey(target, request.key);
      return { summary: `已按键：${request.key}` };
    }

    if (mode === 'dialog') {
      const error = new Error('原生浏览器弹窗需要 chrome.debugger 权限，当前版本未启用');
      error.code = 'CAPABILITY_NOT_ENABLED';
      throw error;
    }

    throw new Error(`页面暂不支持 act 模式：${mode}`);
  }

  async function browseOnPage(request) {
    if (request.mode === 'scroll') {
      window.scrollBy({ top: Number(request.amount || 640), behavior: 'smooth' });
      return { summary: '已滚动页面', scrollY: window.scrollY };
    }
    if (request.mode === 'scrollTo') {
      requireElement(request.ref).scrollIntoView({ behavior: 'smooth', block: 'center' });
      return { summary: '已滚动到目标元素', scrollY: window.scrollY };
    }
    if (request.mode === 'paginate') {
      requireElement(request.ref).click?.();
      return { summary: '已点击翻页目标' };
    }
    if (request.mode === 'back') {
      history.back();
      return { summary: '已后退' };
    }
    if (request.mode === 'forward') {
      history.forward();
      return { summary: '已前进' };
    }
    if (request.mode === 'reload') {
      location.reload();
      return { summary: '已刷新页面' };
    }
    if (request.mode === 'wait') {
      await new Promise((resolve) => setTimeout(resolve, Math.min(Number(request.amount || 500), 5000)));
      return { summary: '等待完成' };
    }
    throw new Error(`页面暂不支持 browse 模式：${request.mode}`);
  }

  async function uploadFile(request) {
    const input = requireElement(request.ref);
    if (!(input instanceof HTMLInputElement) || input.type !== 'file') throw new Error('目标元素不是文件输入框');
    const file = request.file || {};
    const dataUrl = typeof file.dataUrl === 'string'
      ? file.dataUrl
      : `data:${file.mimeType || 'application/octet-stream'};base64,${file.base64}`;
    const response = await fetch(dataUrl);
    const blob = await response.blob();
    const dataTransfer = new DataTransfer();
    dataTransfer.items.add(new File([blob], file.name || 'upload.bin', { type: file.mimeType || blob.type }));
    input.files = dataTransfer.files;
    input.dispatchEvent(new Event('input', { bubbles: true }));
    input.dispatchEvent(new Event('change', { bubbles: true }));
    return { summary: '已上传文件', name: file.name || 'upload.bin', size: blob.size };
  }

  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request?.type === 'WEBBRIDGE_PING') {
      sendResponse({ ok: true });
    } else if (request?.type === 'WEBBRIDGE_STATUS') {
      showBridgeStatus(request.status, request.operation, request.error);
      sendResponse({ ok: true });
    } else if (request?.type === 'GET_PAGE_INFO') {
      getPageInfo().then(sendResponse);
    } else if (request?.type === 'WEBBRIDGE_SNAPSHOT') {
      sendResponse(buildSnapshot());
    } else if (request?.type === 'WEBBRIDGE_GET_HREF') {
      const element = requireElement(request.ref);
      sendResponse({ url: element.href || element.getAttribute('href') || '' });
    } else if (request?.type === 'WEBBRIDGE_TRIGGER_DOWNLOAD') {
      const anchor = document.createElement('a');
      anchor.href = request.url;
      if (request.filename) anchor.download = request.filename;
      anchor.rel = 'noopener';
      anchor.style.display = 'none';
      document.documentElement.appendChild(anchor);
      anchor.click();
      anchor.remove();
      sendResponse({ summary: '已触发下载' });
    } else if (request?.type === 'WEBBRIDGE_UPLOAD') {
      uploadFile(request).then(sendResponse).catch((error) => sendResponse({
        ok: false,
        error: { code: error.code || 'UPLOAD_FAILED', message: error.message },
      }));
    } else if (request?.type === 'WEBBRIDGE_ACT') {
      actOnPage(request).then(sendResponse).catch((error) => sendResponse({
        ok: false,
        error: { code: error.code || 'ACTION_FAILED', message: error.message },
      }));
    } else if (request?.type === 'WEBBRIDGE_BROWSE') {
      browseOnPage(request).then(sendResponse).catch((error) => sendResponse({
        ok: false,
        error: { code: error.code || 'ACTION_FAILED', message: error.message },
      }));
    }
    return true;
  });
})();
