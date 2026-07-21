/**
 * 触界 - Side Panel Logic
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
  let activePanel = 'clip';
  let pageLoadSequence = 0;
  let refreshTimer = null;
  const tags = [];

  // 支持从项目根目录或 extension/ 子目录加载解压扩展。
  const loadedManifest = chrome.runtime.getManifest?.() || {};
  const extensionAssetPrefix = loadedManifest.side_panel?.default_path?.startsWith('extension/')
    ? 'extension/'
    : '';

  // ===== DOM refs =====
  const els = {
    authGate: document.getElementById('authGate'),
    workspaceView: document.getElementById('workspaceView'),
    jianxingView: document.getElementById('jianxingView'),
    captureView: document.getElementById('captureView'),
    jianxingTab: document.getElementById('jianxingTab'),
    clipTab: document.getElementById('clipTab'),
    connectionBadge: document.getElementById('connectionBadge'),
    bridgeState: document.getElementById('bridgeState'),
    operationState: document.getElementById('operationState'),
    operationDetail: document.getElementById('operationDetail'),
    currentPageTitle: document.getElementById('currentPageTitle'),
    currentPageUrl: document.getElementById('currentPageUrl'),
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
    authorizationCode: document.getElementById('authorizationCode'),
    exchangeCodeBtn: document.getElementById('exchangeCodeBtn'),
    ruleStatus: document.getElementById('ruleStatus'),
  };

  function isAccessTokenExpired(value) {
    if (typeof value !== 'string') return false;
    const payloadPart = value.split('.')[1];
    if (!payloadPart) return false;
    try {
      const base64 = payloadPart.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(payloadPart.length / 4) * 4, '=');
      const payload = JSON.parse(atob(base64));
      return typeof payload.exp === 'number' && payload.exp * 1000 <= Date.now();
    } catch (_) {
      return false;
    }
  }

  function isAccessTokenInvalid(value) {
    if (typeof value !== 'string' || !value.trim()) return true;
    const parts = value.split('.');
    if (parts.length !== 3 || parts.some((part) => !part)) return true;
    const payloadPart = parts[1];
    try {
      const base64 = payloadPart.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(payloadPart.length / 4) * 4, '=');
      const payload = JSON.parse(atob(base64));
      return typeof payload.exp !== 'number' || payload.exp * 1000 <= Date.now();
    } catch (_) {
      return true;
    }
  }

  // ===== Init =====
  async function init() {
    setState('LOADING');

    try {
      const stored = await chrome.storage.sync.get(['backendUrl']);
      if (stored.backendUrl) backendUrl = stored.backendUrl;
      const tokenStore = await chrome.storage.local.get(['accessToken']);
      if (tokenStore.accessToken) accessToken = tokenStore.accessToken;
      if (chrome.storage.session) {
        const sessionStore = await chrome.storage.session.get(['pendingCapture', 'sidePanelSection']);
        pendingCapture = sessionStore.pendingCapture || null;
        if (sessionStore.sidePanelSection === 'jianxing' || sessionStore.sidePanelSection === 'clip') {
          activePanel = sessionStore.sidePanelSection;
        }
      }
    } catch (_) {}

    if (pendingCapture) activePanel = 'clip';

    if (isAccessTokenInvalid(accessToken)) {
      const expired = Boolean(accessToken) && isAccessTokenExpired(accessToken);
      accessToken = '';
      if (expired) await chrome.storage.local.remove(['accessToken']);
      showAuthGate();
      setState('LOCKED');
      if (expired) showAuthStatus('授权已过期，请重新输入 Mira 授权码', true);
      return;
    }

    showWorkspace();
    selectPanel(activePanel, false);
    await syncConnectionState();
    await loadActiveTabInfo();
  }

  chrome.runtime.onMessage.addListener((message) => {
    if (message?.type === 'WEBBRIDGE_OPERATION') {
      renderOperation(message);
      if (message.event === 'started') selectPanel('jianxing');
      return;
    }
    if (message?.type !== 'WEBBRIDGE_STATUS') return;
    if (message.status === 'auth_required') {
      accessToken = '';
      showAuthGate();
      connectionState = 'disconnected';
      renderConnectionState('auth_required', message.message);
      setState('LOCKED');
      showAuthStatus('授权已失效，请重新输入 Mira 授权码', true);
      return;
    }
    connectionState = message.status;
    renderConnectionState(message.status, message.message || message.code);
  });

  async function syncConnectionState() {
    try {
      const status = await chrome.runtime.sendMessage({ type: 'WEBBRIDGE_GET_STATUS' });
      if (status?.ok) {
        connectionState = status.status;
        renderConnectionState(status.status, status.message);
        return status.connected === true;
      }
    } catch (_) {}
    const isConnected = await checkBackendHealth();
    connectionState = isConnected ? 'authorized' : 'disconnected';
    renderConnectionState(connectionState);
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
    const sequence = ++pageLoadSequence;
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab) {
      renderCurrentPage(null);
      setState('ERROR', '无法获取当前页面');
      return;
    }
    renderCurrentPage(tab);
    currentTabId = tab.id;
    chrome.runtime.sendMessage({ type: 'WEBBRIDGE_ACTIVATE_TAB', tabId: currentTabId }).catch(() => {});

    // 每次活动页面变化都重新注入页面桥接，避免扩展重载后继续使用旧脚本。
    let info;
    try {
      await chrome.scripting.executeScript({
        target: { tabId: currentTabId },
        files: [`${extensionAssetPrefix}lib/clip-rules.js`],
      });
      await chrome.scripting.executeScript({
        target: { tabId: currentTabId },
        files: [`${extensionAssetPrefix}lib/extractor.js`],
      });
      await chrome.scripting.executeScript({
        target: { tabId: currentTabId },
        files: [`${extensionAssetPrefix}content/content.js`],
      });
      info = await sendMessageToTab(currentTabId, {
        type: 'GET_PAGE_INFO',
        captureMode: pendingCapture?.captureMode || 'auto',
        imageUrl: pendingCapture?.imageUrl || '',
      });
    } catch (e) {
      if (sequence !== pageLoadSequence) return;
      setState('ERROR', '无法读取页面信息：' + e.message);
      return;
    }

    if (sequence !== pageLoadSequence) return;

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
    els.workspaceView.classList.add('hidden');
    renderConnectionState('auth_required');
  }

  function showWorkspace() {
    els.authGate.classList.add('hidden');
    els.workspaceView.classList.remove('hidden');
  }

  function selectPanel(panel, persist = true) {
    activePanel = panel === 'jianxing' ? 'jianxing' : 'clip';
    const showJianxing = activePanel === 'jianxing';
    els.jianxingTab.setAttribute('aria-selected', String(showJianxing));
    els.clipTab.setAttribute('aria-selected', String(!showJianxing));
    els.jianxingView.classList.toggle('hidden', !showJianxing);
    els.captureView.classList.toggle('hidden', showJianxing);
    if (persist && chrome.storage.session) {
      chrome.storage.session.set({ sidePanelSection: activePanel }).catch(() => {});
    }
  }

  function renderConnectionState(status, detail = '') {
    const states = {
      connected: { label: '已连接', className: 'connected', detail: '触界已连接 Mira' },
      connecting: { label: '连接中', className: 'connecting', detail: '正在连接 Mira' },
      authorized: { label: '已授权', className: 'connecting', detail: '等待 Native Messaging 连接' },
      auth_required: { label: '待授权', className: 'disconnected', detail: '需要 Mira 授权码' },
      error: { label: '连接异常', className: 'error', detail: '连接发生异常' },
      disconnected: { label: '未连接', className: 'disconnected', detail: 'Mira 尚未连接' },
    };
    const state = states[status] || states.disconnected;
    els.connectionBadge.textContent = state.label;
    els.connectionBadge.className = `connection-badge ${state.className}`;
    els.bridgeState.textContent = detail || state.detail;
  }

  function renderOperation(message) {
    const isStarted = message.event === 'started';
    const failed = message.event === 'finished' && message.ok === false;
    const completed = message.event === 'finished' && message.ok !== false;
    els.operationState.textContent = isStarted ? '执行中' : failed ? '失败' : completed ? '已完成' : '空闲';
    els.operationState.className = `operation-state ${isStarted ? 'running' : failed ? 'failed' : completed ? 'completed' : 'idle'}`;
    const operation = typeof message.operation === 'string' && message.operation ? message.operation : '浏览器操作';
    els.operationDetail.textContent = failed && message.error
      ? `${operation}：${message.error}`
      : isStarted
        ? `正在执行：${operation}`
        : completed
          ? `已完成：${operation}`
          : '暂无浏览器操作';
    els.operationDetail.className = `operation-detail ${isStarted ? 'running' : failed ? 'failed' : ''}`;
  }

  function renderCurrentPage(tab) {
    els.currentPageTitle.textContent = tab?.title || '无法读取当前页面';
    els.currentPageUrl.textContent = tab?.url || '';
  }

  async function exchangeAuthorizationCode() {
    const encodedCode = els.authorizationCode.value.trim();
    if (!encodedCode) {
      showAuthStatus('请先粘贴 Mira 授权码', true);
      return;
    }

    els.exchangeCodeBtn.disabled = true;
    els.authStatus.textContent = '正在验证授权码…';
    els.authStatus.className = 'status';
    try {
      const parsed = window.MiraAuthorizationCode.unwrap(encodedCode);
      const response = await fetch(`${parsed.backendUrl}/oauth/token`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          grant_type: 'authorization_code',
          client_id: 'mira-clipper',
          code: parsed.code,
        }),
      });
      const result = await response.json();
      if (!response.ok || !result.accessToken) {
        throw new Error(result.message || `授权失败（${response.status}）`);
      }

      backendUrl = parsed.backendUrl;
      accessToken = result.accessToken;
      await chrome.storage.sync.set({ backendUrl });
      await chrome.storage.local.set({ accessToken });
      chrome.runtime.sendMessage({ type: 'WEBBRIDGE_RECONNECT' }).catch(() => {});
      els.authorizationCode.value = '';
      showAuthStatus('授权成功，正在连接 Mira', false);
      showWorkspace();
      selectPanel('jianxing');
      renderConnectionState('connecting');
      await syncConnectionState();
      await loadActiveTabInfo();
    } catch (error) {
      showAuthStatus(error?.message || '授权失败，请从 Mira 重新生成授权码', true);
    } finally {
      els.exchangeCodeBtn.disabled = false;
    }
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
    renderCurrentPage({ title: info.title, url: info.url });
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
          image.alt = `图片 ${index + 1} 预览不可用，保存时会从当前页面读取`;
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
    els.saveBtn.dataset.captureMode = info.captureMode === 'selection' || info.captureMode === 'image' ? info.captureMode : 'page';
    els.saveBtn.dataset.ruleApplied = info.ruleApplied === true ? 'true' : 'false';
    els.saveBtn.dataset.ruleHasIncludeRegion = info.ruleHasIncludeRegion === true ? 'true' : 'false';
    renderRuleStatus(info.ruleStatus, info.captureMode, info.ruleApplied, info.ruleHasIncludeRegion, info.matchedRuleAlias);
    extractionStatus = info.extractionStatus || 'empty';
    if (extractionStatus !== 'ok' && !selected && !imageUrls.length) {
      setState('ERROR', '未提取到可用正文，请先选中页面中的文字后重试');
      return false;
    }
    return true;
  }

  function renderRuleStatus(ruleStatus, captureMode, ruleApplied, ruleHasIncludeRegion, ruleAlias) {
    if (captureMode === 'selection' || captureMode === 'image') {
      els.ruleStatus.classList.add('hidden');
      return;
    }
    const ruleName = typeof ruleAlias === 'string' && ruleAlias.trim() ? `「${ruleAlias.trim()}」` : '';
    const messages = {
      applied: ruleHasIncludeRegion ? `已应用剪藏规则${ruleName}（已限定正文区域）` : `已应用剪藏规则${ruleName}（正文区域未限定，使用默认正文判断）`,
      not_configured: '当前网站未配置规则，使用默认提取',
      disabled: `当前匹配规则${ruleName}已停用，使用默认提取`,
      rule_not_matched: `当前匹配规则${ruleName}未找到正文区域，已回退默认提取`,
      rule_invalid: `当前匹配规则${ruleName}无效，已回退默认提取`,
    };
    els.ruleStatus.textContent = messages[ruleStatus] || messages.not_configured;
    els.ruleStatus.className = `rule-status ${ruleApplied && ruleStatus === 'applied' ? 'applied' : 'fallback'}`;
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
  function escapeRegExp(value) {
    return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  function removeRemoteImageMarkdown(content, imageUrls) {
    return imageUrls.reduce((value, imageUrl) => value.replace(
      new RegExp(`!\\[[^\\]]*\\]\\(${escapeRegExp(imageUrl)}\\)`, 'g'),
      '',
    ), content).replace(/\n{3,}/g, '\n\n').trim();
  }

  function buildLocalizedCaptureContent(textContent, title, imageUrls, attachments) {
    const textWithoutRemoteImages = removeRemoteImageMarkdown(textContent, imageUrls);
    const localizedImages = attachments
      .filter((attachment) => typeof attachment.sourceUrl === 'string')
      .map((attachment, index) => `![${title} ${index + 1}](${attachment.sourceUrl})`);
    return [textWithoutRemoteImages, ...localizedImages].filter(Boolean).join('\n\n');
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

      if (isAccessTokenInvalid(accessToken)) {
        const expired = Boolean(accessToken) && isAccessTokenExpired(accessToken);
        accessToken = '';
        if (expired) await chrome.storage.local.remove(['accessToken']);
        showAuthGate();
        connectionState = 'disconnected';
        setState('LOCKED');
        showAuthStatus(expired ? '授权已过期，请重新输入 Mira 授权码' : '请先输入 Mira 授权码', true);
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
    const ruleApplied = els.saveBtn.dataset.ruleApplied === 'true';
    const ruleHasIncludeRegion = els.saveBtn.dataset.ruleHasIncludeRegion === 'true';
    const textContent = selectedText || preExtracted.contentMarkdown || preExtracted.contentPlainText;
    if (!textContent.trim() && !imageUrls.length) {
      setState('ERROR', '没有可保存的正文内容');
      return;
    }
    const payload = {
      sourceUrl: els.url.dataset.rawUrl,
      title,
      favicon: els.saveBtn.dataset.favicon || undefined,
      contentType,
      rawContent: '',
      captureMode: els.saveBtn.dataset.captureMode || 'page',
      rawHtml: els.saveBtn.dataset.captureMode === 'page' && !ruleHasIncludeRegion ? currentPageHtml || undefined : undefined,
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
        ruleApplied,
        ruleHasIncludeRegion,
      },
      attachments: [],
    };

    try {
      setState('SAVING', imageUrls.length ? `正在本地化 ${imageUrls.length} 张图片…` : '正在保存…');
      const imageCapture = await sendMessageToTab(currentTabId, {
        type: 'MIRA_CAPTURE_IMAGES',
        imageUrls,
        backendUrl,
        accessToken,
      });
      if (!imageCapture?.ok) {
        const error = new Error(imageCapture?.error?.message || '图片采集失败');
        error.code = imageCapture?.error?.code;
        throw error;
      }
      payload.attachments = Array.isArray(imageCapture.attachments) ? imageCapture.attachments : [];
      payload.rawContent = buildLocalizedCaptureContent(textContent, title, imageUrls, payload.attachments);
      if (!payload.rawContent.trim()) throw new Error('没有可保存的正文内容');
      payload.metadata.imageCapture = {
        requestedCount: imageUrls.length,
        uploadedCount: payload.attachments.length,
        failures: Array.isArray(imageCapture.failures) ? imageCapture.failures : [],
      };
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
        renderConnectionState('connected');
        const failureCount = payload.metadata.imageCapture.failures.length;
        const imageStatus = imageUrls.length
          ? `已本地化 ${payload.attachments.length}/${imageUrls.length} 张图片${failureCount ? `，${failureCount} 张未保存` : ''}`
          : '';
        setState('SUCCESS', ['已保存到 Mira！', imageStatus].filter(Boolean).join(' '));
        return;
      }

      let msg = `保存失败（${res.status}）`;
      if (res.status === 401) {
        accessToken = '';
        await chrome.storage.local.remove(['accessToken']);
        showAuthGate();
        connectionState = 'disconnected';
        setState('LOCKED');
        showAuthStatus('授权已失效，请重新输入 Mira 授权码', true);
        return;
      }
      try {
        const body = await res.json();
        if (body.message) msg = body.message;
      } catch (_) {}
      setState('ERROR', msg);
    } catch (e) {
      const text = e.message || '';
      if (e.code === 'AUTH_REQUIRED') {
        accessToken = '';
        await chrome.storage.local.remove(['accessToken']);
        showAuthGate();
        connectionState = 'disconnected';
        setState('LOCKED');
        showAuthStatus('授权已失效，请重新输入 Mira 授权码', true);
        return;
      }
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
  function scheduleActiveTabRefresh() {
    if (refreshTimer !== null) window.clearTimeout(refreshTimer);
    refreshTimer = window.setTimeout(() => {
      refreshTimer = null;
      if (accessToken) void loadActiveTabInfo();
    }, 120);
  }

  els.jianxingTab.addEventListener('click', () => selectPanel('jianxing'));
  els.clipTab.addEventListener('click', () => selectPanel('clip'));
  els.exchangeCodeBtn.addEventListener('click', () => void exchangeAuthorizationCode());
  els.authorizationCode.addEventListener('keydown', (event) => {
    if ((event.ctrlKey || event.metaKey) && event.key === 'Enter') void exchangeAuthorizationCode();
  });
  chrome.tabs.onActivated?.addListener(() => scheduleActiveTabRefresh());
  chrome.tabs.onUpdated?.addListener((tabId, changeInfo) => {
    if (tabId !== currentTabId) return;
    if (changeInfo.status === 'complete' || changeInfo.url || changeInfo.title) scheduleActiveTabRefresh();
  });
  chrome.windows?.onFocusChanged?.addListener(() => scheduleActiveTabRefresh());
  init();
})();
