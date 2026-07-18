/**
 * MiraWebBrige - Popup Logic
 * 状态机：LOADING → READY → SAVING → SUCCESS / ERROR
 */

(function () {
  'use strict';

  // ===== State =====
  let currentTabId = null;
  let backendUrl = '';
  let accessToken = '';
  let pendingCapture = null;
  let currentPageHtml = '';
  let extractionStatus = 'empty';
  let connectionState = 'disconnected';
  const tags = [];

  // 支持从项目根目录或 extension/ 子目录加载解压扩展。
  const loadedManifest = chrome.runtime.getManifest?.() || {};
  const extensionAssetPrefix = loadedManifest.action?.default_popup?.startsWith('extension/')
    ? 'extension/'
    : '';

  // ===== DOM refs =====
  const els = {
    authGate: document.getElementById('authGate'),
    captureView: document.getElementById('captureView'),
    favicon: document.getElementById('favicon'),
    title: document.getElementById('title'),
    url: document.getElementById('url'),
    selectedBox: document.getElementById('selectedTextBox'),
    selectedText: document.getElementById('selectedText'),
    imagePreview: document.getElementById('imagePreview'),
    previewLabel: document.getElementById('previewLabel'),
    tagList: document.getElementById('tagList'),
    tagInput: document.getElementById('tagInput'),
    note: document.getElementById('note'),
    processAi: document.getElementById('processAi'),
    rebuildKnowledge: document.getElementById('rebuildKnowledge'),
    saveBtn: document.getElementById('saveBtn'),
    status: document.getElementById('status'),
    spinner: document.querySelector('#saveBtn .spinner'),
    btnLabel: document.querySelector('#saveBtn .label'),
    authStatus: document.getElementById('authStatus'),
    openAuthorizationPage: document.getElementById('openAuthorizationPage'),
  };

  // ===== Init =====
  async function init() {
    setState('LOADING');

    try {
      const stored = await chrome.storage.sync.get(['backendUrl']);
      if (stored.backendUrl) backendUrl = stored.backendUrl;
      const tokenStore = await chrome.storage.local.get(['accessToken']);
      if (tokenStore.accessToken) accessToken = tokenStore.accessToken;
      if (chrome.storage.session) {
        const sessionStore = await chrome.storage.session.get(['pendingCapture']);
        pendingCapture = sessionStore.pendingCapture || null;
      }
    } catch (_) {}

    if (!accessToken) {
      showAuthGate();
      setState('LOCKED');
      return;
    }

    showCaptureView();
    await syncConnectionState();
    await loadActiveTabInfo();
  }

  chrome.runtime.onMessage.addListener((message) => {
    if (message?.type !== 'WEBBRIDGE_STATUS' || message.status !== 'auth_required') return;
    accessToken = '';
    showAuthGate();
    connectionState = 'disconnected';
    setState('LOCKED');
    showAuthStatus('授权已失效，请打开授权页重新授权', true);
  });

  async function syncConnectionState() {
    const isConnected = await checkBackendHealth();
    connectionState = isConnected ? 'connected' : 'authorized';
    return isConnected;
  }

  async function checkBackendHealth() {
    try {
      const response = await fetch(`${backendUrl.replace(/\/$/, '')}/health`, {
        method: 'GET',
        signal: AbortSignal.timeout(2500),
      });
      return response.ok;
    } catch (_) {
      return false;
    }
  }

  async function loadActiveTabInfo() {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab) {
      setState('ERROR', '无法获取当前页面');
      return;
    }
    currentTabId = tab.id;
    chrome.runtime.sendMessage({ type: 'WEBBRIDGE_ACTIVATE_TAB', tabId: currentTabId }).catch(() => {});

    // 获取页面信息（先尝试 sendMessage，失败则注入 extractor + content script）
    let info;
    try {
      info = await sendMessageToTab(currentTabId, {
        type: 'GET_PAGE_INFO',
        captureMode: pendingCapture?.captureMode || 'auto',
        imageUrl: pendingCapture?.imageUrl || '',
      });
    } catch (_) {
      try {
        // 先注入 extractor（content.js 依赖它）
        await chrome.scripting.executeScript({
          target: { tabId: currentTabId },
          files: [`${extensionAssetPrefix}lib/extractor.js`]
        });
        await chrome.scripting.executeScript({
          target: { tabId: currentTabId },
          files: [`${extensionAssetPrefix}content/content.js`]
        });
        info = await sendMessageToTab(currentTabId, {
          type: 'GET_PAGE_INFO',
          captureMode: pendingCapture?.captureMode || 'auto',
          imageUrl: pendingCapture?.imageUrl || '',
        });
      } catch (e) {
        setState('ERROR', '无法读取页面信息：' + e.message);
        return;
      }
    }

    if (pendingCapture?.imageUrl) {
      info = {
        ...info,
        captureMode: 'image',
        title: pendingCapture.title || info.title,
        url: pendingCapture.url || info.url,
        favicon: pendingCapture.favicon || info.favicon,
        contentType: 'webpage',
        contentMarkdown: '',
        contentPlainText: '',
        selectedText: '',
        imageUrls: [pendingCapture.imageUrl],
        imageUrl: pendingCapture.imageUrl,
      };
      if (chrome.storage.session) {
        await chrome.storage.session.remove(['pendingCapture']);
      }
      pendingCapture = null;
    } else if (pendingCapture?.selectedText) {
      info = {
        ...info,
        captureMode: 'selection',
        selectedText: pendingCapture.selectedText,
        title: pendingCapture.title || info.title,
        url: pendingCapture.url || info.url,
        favicon: pendingCapture.favicon || info.favicon,
        contentMarkdown: '',
        contentPlainText: '',
        imageUrls: [],
        imageDataUrls: [],
      };
      if (chrome.storage.session) {
        await chrome.storage.session.remove(['pendingCapture']);
      }
      pendingCapture = null;
    }

    if (fillForm(info)) {
      setState('READY');
    }
  }

  function showAuthStatus(message, isError) {
    els.authStatus.textContent = message;
    els.authStatus.className = `status ${isError ? 'error' : 'success'}`;
  }

  function showAuthGate() {
    els.authGate.classList.remove('hidden');
    els.captureView.classList.add('hidden');
  }

  function showCaptureView() {
    els.authGate.classList.add('hidden');
    els.captureView.classList.remove('hidden');
  }

  function sendMessageToTab(tabId, msg) {
    return new Promise((resolve, reject) => {
      chrome.tabs.sendMessage(tabId, msg, (res) => {
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message));
        } else {
          resolve(res);
        }
      });
    });
  }

  // ===== Form =====
  function fillForm(info) {
    currentPageHtml = typeof info.pageHtml === 'string' ? info.pageHtml : '';
    els.title.value = (info.title || '').trim();
    els.url.textContent = info.url || '';
    els.url.dataset.rawUrl = info.url || '';
    els.saveBtn.dataset.canonicalUrl = info.canonicalUrl || '';
    els.saveBtn.dataset.favicon = info.favicon || '';

    if (info.favicon) {
      els.favicon.src = info.favicon;
      els.favicon.hidden = false;
      els.favicon.onerror = () => {
        els.favicon.hidden = true;
      };
    }

    const selected = (info.selectedText || '').trim();
    const imageUrl = (info.imageUrl || '').trim();
    const imageUrls = Array.from(new Set([
      ...(Array.isArray(info.imageUrls) ? info.imageUrls : []),
      ...(imageUrl ? [imageUrl] : []),
    ].filter(Boolean)));
    const imageDataUrls = Array.isArray(info.imageDataUrls) ? info.imageDataUrls : [];
    const contentType = 'webpage';
    const hasContent = !!(info.contentMarkdown || '').trim();
    const hasTextPreview = !!selected || hasContent;

    els.selectedText.value = '';
    els.selectedText.classList.remove('hidden');
    els.imagePreview.classList.add('hidden');
    els.imagePreview.replaceChildren();
    if (selected) {
      els.previewLabel.textContent = imageUrls.length ? '正文与图片预览' : '选中文字';
      els.selectedText.value = selected;
      els.selectedBox.classList.remove('hidden');
    } else if (hasContent) {
      const preview = info.contentPlainText.slice(0, 300) + (info.contentPlainText.length > 300 ? '…' : '');
      els.previewLabel.textContent = imageUrls.length ? '正文与图片预览' : '提取正文预览';
      els.selectedText.value = preview;
      els.selectedBox.classList.remove('hidden');
    } else if (!imageUrl) {
      els.selectedBox.classList.add('hidden');
    }

    if (imageUrls.length) {
      imageUrls.forEach((url, index) => {
        const image = document.createElement('img');
        image.src = url;
        image.alt = `采集的图片 ${index + 1}`;
        image.onerror = () => {
          image.alt = `图片 ${index + 1} 无法加载，但仍会提交图片地址`;
        };
        els.imagePreview.appendChild(image);
      });
      els.imagePreview.classList.remove('hidden');
      els.selectedBox.classList.remove('hidden');
    }

    if (!hasTextPreview) {
      els.selectedText.classList.add('hidden');
    }

    // 把提取的内容挂在 DOM 上，保存时取用
    els.saveBtn.dataset.contentMarkdown = info.contentMarkdown || '';
    els.saveBtn.dataset.contentPlainText = info.contentPlainText || '';
    els.saveBtn.dataset.excerpt = info.excerpt || '';
    els.saveBtn.dataset.author = info.author || '';
    els.saveBtn.dataset.siteName = info.siteName || '';
    els.saveBtn.dataset.coverImageUrl = info.coverImageUrl || '';
    els.saveBtn.dataset.wordCount = String(info.wordCount || 0);
    els.saveBtn.dataset.selectedText = selected;
    els.saveBtn.dataset.contentType = contentType;
    els.saveBtn.dataset.imageUrl = imageUrl;
    els.saveBtn.dataset.imageUrls = JSON.stringify(imageUrls);
    els.saveBtn.dataset.imageDataUrls = JSON.stringify(imageDataUrls);
    els.saveBtn.dataset.captureMode = info.captureMode === 'selection' || info.captureMode === 'image' ? info.captureMode : 'page';
    extractionStatus = info.extractionStatus || 'empty';
    if (extractionStatus !== 'ok' && !selected && !imageUrls.length) {
      setState('ERROR', '未提取到可用正文，请先选中页面中的文字后重试');
      return false;
    }
    return true;
  }

  // ===== Tags =====
  function renderTags() {
    els.tagList.innerHTML = '';
    tags.forEach((text, idx) => {
      const chip = document.createElement('span');
      chip.className = 'tag-chip';
      chip.innerHTML = `
        <span>${escapeHtml(text)}</span>
        <button type="button" data-idx="${idx}" title="删除">×</button>
      `;
      chip.querySelector('button').addEventListener('click', () => {
        tags.splice(idx, 1);
        renderTags();
      });
      els.tagList.appendChild(chip);
    });
  }

  function addTag(text) {
    const t = text.trim();
    if (!t) return;
    if (t.length > 30) return;
    if (tags.length >= 10) return;
    if (tags.includes(t)) return;
    tags.push(t);
    renderTags();
  }

  els.tagInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      addTag(els.tagInput.value);
      els.tagInput.value = '';
    }
    if (e.key === 'Backspace' && !els.tagInput.value && tags.length) {
      tags.pop();
      renderTags();
    }
  });

  // ===== Save =====
  async function uploadCapturedImages(imageDataUrls) {
    const uploaded = [];
    for (const image of imageDataUrls.slice(0, 10)) {
      if (!image || typeof image.dataUrl !== 'string') continue;
      const blob = await (await fetch(image.dataUrl)).blob();
      const formData = new FormData();
      formData.append('file', blob, `capture-image-${uploaded.length}.png`);
      const response = await fetch(`${backendUrl.replace(/\/$/, '')}/attachments`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${accessToken}` },
        body: formData,
      });
      const body = await response.json();
      if (!response.ok || !body.success || !body.data?.url) {
        throw new Error(`图片保存失败（${response.status}）`);
      }
      uploaded.push({ filePath: body.data.url, mimeType: body.data.contentType || image.mimeType || 'image/png', sourceUrl: image.sourceUrl });
    }
    return uploaded;
  }

  els.saveBtn.addEventListener('click', async () => {
    if (els.saveBtn.disabled) return;

      const title = els.title.value.trim();
    if (!title) {
      setState('ERROR', '标题不能为空');
      els.title.focus();
      return;
    }

      setState('SAVING');

      if (!accessToken) {
        showAuthGate();
        connectionState = 'disconnected';
        setState('LOCKED');
        showAuthStatus('请先打开授权页完成授权', true);
        return;
      }

    // 页面内已完成基础清洗，洞见服务负责 AI 重写、标签和关系发现。
    const preExtracted = {
      contentMarkdown: els.saveBtn.dataset.contentMarkdown || '',
      contentPlainText: els.saveBtn.dataset.contentPlainText || '',
      excerpt: els.saveBtn.dataset.excerpt || '',
      author: els.saveBtn.dataset.author || '',
      siteName: els.saveBtn.dataset.siteName || '',
      coverImageUrl: els.saveBtn.dataset.coverImageUrl || '',
      wordCount: parseInt(els.saveBtn.dataset.wordCount || '0', 10),
    };

    // 用户明确选中的内容优先于自动提取正文，保证“主动选择后抓取”语义成立。
    const selectedText = els.saveBtn.dataset.selectedText || '';
    const contentType = 'webpage';
    const imageUrl = els.saveBtn.dataset.imageUrl || '';
    const imageUrls = JSON.parse(els.saveBtn.dataset.imageUrls || '[]');
    const imageDataUrls = JSON.parse(els.saveBtn.dataset.imageDataUrls || '[]');
    const textContent = selectedText || preExtracted.contentMarkdown || preExtracted.contentPlainText;
    const rawContent = imageUrls.length
      ? [
        textContent,
        ...imageUrls.map((url, index) => `![${title} ${index + 1}](${url})`),
      ].filter(Boolean).join('\n\n')
      : textContent;
    if (!rawContent.trim()) {
      setState('ERROR', '没有可保存的正文内容');
      return;
    }
    const payload = {
      sourceUrl: els.url.dataset.rawUrl,
      title,
      favicon: els.saveBtn.dataset.favicon || undefined,
      contentType,
      rawContent,
      captureMode: els.saveBtn.dataset.captureMode || 'page',
      rawHtml: els.saveBtn.dataset.captureMode === 'page' ? currentPageHtml || undefined : undefined,
      processAi: els.processAi.checked,
      rebuild: els.rebuildKnowledge.checked,
      metadata: {
        canonicalUrl: els.saveBtn.dataset.canonicalUrl || undefined,
        selectedText: selectedText || undefined,
        userTags: [...tags],
        note: els.note.value.trim() || undefined,
        excerpt: preExtracted.excerpt || undefined,
        author: preExtracted.author || undefined,
        siteName: preExtracted.siteName || undefined,
        coverImageUrl: preExtracted.coverImageUrl || undefined,
        imageUrl: imageUrl || undefined,
        imageUrls: imageUrls.length ? imageUrls : undefined,
        wordCount: preExtracted.wordCount,
      },
      attachments: [],
    };

    try {
      payload.attachments = await uploadCapturedImages(imageDataUrls);
      const headers = { 'Content-Type': 'application/json' };
      if (accessToken) headers.Authorization = `Bearer ${accessToken}`;
      const res = await fetch(`${backendUrl.replace(/\/$/, '')}/microapps/evolving-knowledge/captures`, {
        method: 'POST',
        headers,
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        if (els.rebuildKnowledge.checked) {
          const rebuildResponse = await fetch(`${backendUrl.replace(/\/$/, '')}/microapps/evolving-knowledge/rebuild`, {
            method: 'POST',
            headers: { Authorization: `Bearer ${accessToken}` },
          });
          if (!rebuildResponse.ok) {
            throw new Error(`全量重建失败（${rebuildResponse.status}）`);
          }
        }
        connectionState = 'connected';
        setState('SUCCESS', '已保存到 Mira！');
        setTimeout(() => window.close(), 1500);
        return;
      }

      let msg = `保存失败（${res.status}）`;
      if (res.status === 401) {
        accessToken = '';
        await chrome.storage.local.remove(['accessToken']);
        showAuthGate();
        connectionState = 'disconnected';
        setState('LOCKED');
        showAuthStatus('授权已失效，请打开授权页重新授权', true);
        return;
      }
      try {
        const body = await res.json();
        if (body.message) msg = body.message;
      } catch (_) {}
      setState('ERROR', msg);
    } catch (e) {
      const text = e.message || '';
      if (text.includes('Failed to fetch') || text.includes('ECONNREFUSED') || text.includes('fetch')) {
        accessToken = '';
        await chrome.storage.local.remove(['accessToken']);
        showAuthGate();
        connectionState = 'disconnected';
        setState('LOCKED');
        showAuthStatus('无法连接到 Mira 桌面端，请重新授权', true);
      } else {
        setState('ERROR', '网络错误：' + text);
      }
    }
  });

  // ===== State machine =====
  function setState(state, message) {
    document.body.className = state === 'LOADING' ? 'loading' : '';
    els.status.className = 'status';
    els.status.textContent = message || '';

    switch (state) {
      case 'LOADING':
        els.saveBtn.disabled = true;
        els.spinner.classList.remove('hidden');
        els.btnLabel.textContent = '加载中…';
        break;
      case 'READY':
        els.saveBtn.disabled = !accessToken;
        els.spinner.classList.add('hidden');
        els.btnLabel.textContent = '保存到 Mira';
        break;
      case 'DISCONNECTED':
        els.saveBtn.disabled = true;
        els.spinner.classList.add('hidden');
        els.btnLabel.textContent = '等待 Mira 启动';
        els.status.classList.add('error');
        break;
      case 'LOCKED':
        els.saveBtn.disabled = true;
        els.spinner.classList.add('hidden');
        els.btnLabel.textContent = '保存到 Mira';
        els.status.textContent = '';
        break;
      case 'SAVING':
        els.saveBtn.disabled = true;
        els.spinner.classList.remove('hidden');
        els.btnLabel.textContent = '保存中…';
        break;
      case 'SUCCESS':
        els.saveBtn.disabled = true;
        els.spinner.classList.add('hidden');
        els.btnLabel.textContent = '✓ 已保存';
        els.status.classList.add('success');
        break;
      case 'ERROR':
        els.saveBtn.disabled = !accessToken;
        els.spinner.classList.add('hidden');
        els.btnLabel.textContent = '保存到 Mira';
        els.status.classList.add('error');
        break;
    }
  }

  // ===== Utils =====
  function escapeHtml(str) {
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  // ===== Boot =====
  els.openAuthorizationPage.addEventListener('click', () => {
    const prefix = extensionAssetPrefix;
    chrome.tabs.create({ url: chrome.runtime.getURL(`${prefix}auth/authorize.html`) });
  });
  init();
})();
