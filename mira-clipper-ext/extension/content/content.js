/**
 * 触界 - page execution bridge
 * Handles user clipping extraction and the local WebBridge action contract.
 */

(function () {
  'use strict';

  let disposed = false;
  const cleanup = [];
  function dispose() {
    if (disposed) return;
    disposed = true;
    if (activeClipRegionPicker) activeClipRegionPicker.cancel('页面桥接已刷新');
    while (cleanup.length) cleanup.pop()();
    if (statusNode) statusNode.remove();
    if (window.__miraClipperDispose === dispose) delete window.__miraClipperDispose;
  }
  if (typeof window.__miraClipperDispose === 'function') window.__miraClipperDispose();
  window.__miraClipperDispose = dispose;
  window.__miraClipperReady = true;

  function handleWindowMessage(event) {
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
          message: error?.message || '无法打开触界侧栏',
        }, window.location.origin);
      });
  }
  window.addEventListener('message', handleWindowMessage);
  cleanup.push(() => window.removeEventListener('message', handleWindowMessage));

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

  let activeClipRegionPicker = null;

  function selectorMatchesExactly(selector, element) {
    try {
      const matches = document.querySelectorAll(selector);
      return matches.length === 1 && matches[0] === element;
    } catch (_) {
      return false;
    }
  }

  function stableSelectorToken(value) {
    return typeof value === 'string'
      && value.length > 0
      && value.length <= 64
      && !/\d{5,}/.test(value)
      && !/^[a-f\d]{8,}$/i.test(value);
  }

  function selectorSegment(element) {
    const tag = element.tagName.toLowerCase();
    if (stableSelectorToken(element.id)) return `#${CSS.escape(element.id)}`;

    const stableClasses = Array.from(element.classList)
      .filter(stableSelectorToken)
      .slice(0, 2);
    if (stableClasses.length) {
      const classSelector = `${tag}.${stableClasses.map((name) => CSS.escape(name)).join('.')}`;
      if (selectorMatchesExactly(classSelector, element)) return classSelector;
    }

    const parent = element.parentElement;
    if (!parent) return tag;
    const siblings = Array.from(parent.children).filter((child) => child.tagName === element.tagName);
    return siblings.length > 1 ? `${tag}:nth-of-type(${siblings.indexOf(element) + 1})` : tag;
  }

  function buildStableSelector(element) {
    if (stableSelectorToken(element.id)) {
      const selector = `#${CSS.escape(element.id)}`;
      if (selectorMatchesExactly(selector, element)) return selector;
    }

    for (const attribute of ['data-testid', 'data-test', 'data-qa', 'itemprop']) {
      const value = element.getAttribute(attribute);
      if (!stableSelectorToken(value)) continue;
      const selector = `${element.tagName.toLowerCase()}[${attribute}="${CSS.escape(value)}"]`;
      if (selectorMatchesExactly(selector, element)) return selector;
    }

    const segments = [];
    let current = element;
    while (current && current !== document.documentElement && segments.length < 7) {
      segments.unshift(selectorSegment(current));
      const selector = segments.join(' > ');
      if (selectorMatchesExactly(selector, element)) return selector;
      current = current.parentElement;
    }
    return segments.join(' > ');
  }

  function regionCandidate(target) {
    if (!(target instanceof Element)) return null;
    if (target.closest('[data-mira-clip-picker-ui]')) return null;
    const preferred = target.closest('article, main, section, [role="main"], div, p, ul, ol, table, figure');
    return preferred instanceof Element ? preferred : target;
  }

  function describeRegion(element) {
    const text = (element.innerText || element.textContent || '').replace(/\s+/g, ' ').trim();
    return {
      tag: element.tagName.toLowerCase(),
      text: text.slice(0, 120),
      elementCount: element.querySelectorAll('*').length,
      imageCount: element.querySelectorAll('img').length,
    };
  }

  function startClipRegionPicker(request = {}) {
    activeClipRegionPicker?.cancel('新的区域选择已开始');

    return new Promise((resolve, reject) => {
      const overlay = document.createElement('div');
      overlay.dataset.miraClipPickerUi = 'true';
      overlay.style.cssText = 'position:fixed;z-index:2147483645;pointer-events:none;border:2px solid #c15f3c;background:rgba(193,95,60,.12);box-shadow:0 0 0 1px rgba(255,255,255,.8) inset;display:none;transition:top .05s,left .05s,width .05s,height .05s';

      const toolbar = document.createElement('div');
      toolbar.dataset.miraClipPickerUi = 'true';
      toolbar.style.cssText = 'position:fixed;z-index:2147483647;top:16px;left:50%;transform:translateX(-50%);display:flex;align-items:center;gap:10px;max-width:calc(100vw - 32px);padding:9px 12px;border:1px solid rgba(255,255,255,.18);border-radius:8px;background:#20242a;color:#fff;font:13px/1.4 system-ui,sans-serif;box-shadow:0 8px 28px rgba(0,0,0,.28)';
      const label = document.createElement('span');
      label.textContent = request.kind === 'exclude' ? '选择要排除的区域' : '选择正文区域';
      const parentButton = document.createElement('button');
      parentButton.type = 'button';
      parentButton.textContent = '上一级';
      parentButton.title = '扩大到当前区域的上一级容器';
      parentButton.style.cssText = 'padding:3px 7px;border:1px solid rgba(255,255,255,.28);border-radius:5px;background:transparent;color:#fff;font:12px system-ui,sans-serif;cursor:pointer';
      const confirmButton = document.createElement('button');
      confirmButton.type = 'button';
      confirmButton.textContent = '确认';
      confirmButton.title = '确认当前高亮区域';
      confirmButton.style.cssText = 'padding:3px 8px;border:1px solid #d97757;border-radius:5px;background:#c15f3c;color:#fff;font:12px system-ui,sans-serif;cursor:pointer';
      const cancelButton = document.createElement('button');
      cancelButton.type = 'button';
      cancelButton.textContent = '取消';
      cancelButton.title = '取消区域选择（Esc）';
      cancelButton.style.cssText = 'padding:3px 7px;border:1px solid rgba(255,255,255,.28);border-radius:5px;background:transparent;color:#fff;font:12px system-ui,sans-serif;cursor:pointer';
      toolbar.append(label, parentButton, confirmButton, cancelButton);
      (document.body || document.documentElement).append(overlay, toolbar);

      let candidate = null;
      const showCandidate = (next) => {
        if (!next || next === candidate) return;
        candidate = next;
        const rect = candidate.getBoundingClientRect();
        overlay.style.display = rect.width > 0 && rect.height > 0 ? 'block' : 'none';
        overlay.style.left = `${rect.left}px`;
        overlay.style.top = `${rect.top}px`;
        overlay.style.width = `${rect.width}px`;
        overlay.style.height = `${rect.height}px`;
      };
      const updateCandidate = (event) => {
        const next = regionCandidate(event.target);
        showCandidate(next);
      };
      const cleanup = () => {
        document.removeEventListener('mousemove', updateCandidate, true);
        document.removeEventListener('click', selectCandidate, true);
        document.removeEventListener('keydown', onKeyDown, true);
        overlay.remove();
        toolbar.remove();
        if (activeClipRegionPicker?.cancel === cancel) activeClipRegionPicker = null;
      };
      const cancel = (reason = '已取消区域选择') => {
        cleanup();
        const error = new Error(reason);
        error.code = 'CLIP_REGION_PICK_CANCELLED';
        reject(error);
      };
      const confirmCandidate = (selected) => {
        if (!selected) return;
        const selector = buildStableSelector(selected);
        if (!selector || !selectorMatchesExactly(selector, selected)) {
          cancel('无法为该区域生成稳定定位规则，请选择外层区域');
          return;
        }
        const result = {
          host: window.MiraClipRules?.normalizeHostname(location.hostname) || location.hostname,
          url: location.href,
          selector,
          summary: describeRegion(selected),
        };
        cleanup();
        resolve(result);
      };
      const selectCandidate = (event) => {
        if (event.target instanceof Element && event.target.closest('[data-mira-clip-picker-ui]')) return;
        event.preventDefault();
        event.stopImmediatePropagation();
        confirmCandidate(regionCandidate(event.target) || candidate);
      };
      const onKeyDown = (event) => {
        if (event.key !== 'Escape') return;
        event.preventDefault();
        cancel();
      };

      cancelButton.addEventListener('click', () => cancel());
      parentButton.addEventListener('click', () => {
        const parent = candidate?.parentElement;
        if (parent && parent !== document.documentElement && !parent.closest('[data-mira-clip-picker-ui]')) showCandidate(parent);
      });
      confirmButton.addEventListener('click', () => confirmCandidate(candidate));
      document.addEventListener('mousemove', updateCandidate, true);
      document.addEventListener('click', selectCandidate, true);
      document.addEventListener('keydown', onKeyDown, true);
      activeClipRegionPicker = { cancel };
    });
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

  async function getPageInfo(request = {}) {
    await waitForPageToSettle();
    let siteRule = request.ruleOverride || null;
    if (siteRule && window.MiraClipRules) {
      const currentHost = window.MiraClipRules.normalizeHostname(location.hostname);
      const ruleHost = window.MiraClipRules.normalizeHostname(siteRule.host);
      if (!ruleHost || ruleHost !== currentHost || !window.MiraClipRules.matchesUrlPattern(siteRule.urlPattern, location.href, siteRule.urlPatternMode)) siteRule = null;
    }
    if (!siteRule && window.MiraClipRules) {
      try {
        const stored = await chrome.storage.sync.get(['clipRules']);
        siteRule = window.MiraClipRules.getRule(stored.clipRules, location.hostname, location.href);
      } catch (_) {
        siteRule = null;
      }
    }
    const extracted = window.MiraExtractor
      ? window.MiraExtractor.extractPage(document, siteRule)
      : { contentMarkdown: '', contentPlainText: '', wordCount: 0 };
    const selectedText = window.getSelection().toString().trim();
    const imageDataUrls = [];
    const captureMode = request.captureMode === 'image'
      ? 'image'
      : request.captureMode === 'selection' || (request.captureMode !== 'page' && selectedText)
        ? 'selection'
        : 'page';
    const imageUrls = captureMode === 'image' && typeof request.imageUrl === 'string' && request.imageUrl.trim()
      ? [request.imageUrl.trim()]
      : captureMode === 'page' ? (extracted.imageUrls || []) : [];

    for (const imageUrl of imageUrls.slice(0, 10)) {
      try {
        const response = await fetch(imageUrl, { credentials: 'include', mode: 'cors' });
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
        try {
          const result = await chrome.runtime.sendMessage({ type: 'MIRA_FETCH_IMAGE', url: imageUrl });
          if (result?.ok && typeof result.dataUrl === 'string') {
            imageDataUrls.push({ dataUrl: result.dataUrl, mimeType: result.mimeType || 'image/png', sourceUrl: imageUrl });
          }
        } catch (_) {
          // The URL stays in Markdown when both page and extension reads are blocked.
        }
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
      imageUrls,
      imageDataUrls,
      excerpt: extracted.excerpt || '',
      author: extracted.author || '',
      siteName: extracted.siteName || '',
      coverImageUrl: extracted.coverImageUrl || null,
      wordCount: extracted.wordCount || 0,
      extractionStatus: extracted.extractionStatus || 'empty',
      ruleStatus: extracted.ruleStatus || (siteRule ? 'applied' : 'not_configured'),
      ruleApplied: Boolean(siteRule),
      ruleHasIncludeRegion: Boolean(siteRule?.includeSelector),
      pageHtml: document.documentElement?.outerHTML || document.body?.outerHTML || '',
      captureMode,
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

  function handleRuntimeMessage(request, sender, sendResponse) {
    if (request?.type === 'WEBBRIDGE_PING') {
      sendResponse({ ok: true });
    } else if (request?.type === 'WEBBRIDGE_STATUS') {
      showBridgeStatus(request.status, request.operation, request.error);
      sendResponse({ ok: true });
    } else if (request?.type === 'GET_PAGE_INFO') {
      getPageInfo(request).then(sendResponse);
    } else if (request?.type === 'WEBBRIDGE_CLIP_REGION_PICK') {
      startClipRegionPicker(request).then((result) => sendResponse({ ok: true, result })).catch((error) => sendResponse({
        ok: false,
        error: { code: error.code || 'CLIP_REGION_PICK_FAILED', message: error.message || '区域选择失败' },
      }));
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
  }
  chrome.runtime.onMessage.addListener(handleRuntimeMessage);
  cleanup.push(() => chrome.runtime.onMessage.removeListener(handleRuntimeMessage));
})();
