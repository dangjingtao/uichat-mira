/**
 * MiraWebBrige - Background Service Worker
 * 职责：右键菜单注册、跨域请求兜底
 */

const CAPTURE_MENU_ID = 'mira-clipper-capture';
const WEBBRIDGE_PROTOCOL_VERSION = 1;
const WEBBRIDGE_PATH = '/webbridge';
const WEBBRIDGE_REQUEST_TIMEOUT_MS = 30000;
const WEBBRIDGE_KEEPALIVE_INTERVAL_MS = 20000;

const WEBBRIDGE_TOOL_DEFINITIONS = [
  {
    name: 'look',
    description: '观察当前网页、交互元素或截图。先观察再使用 ref 操作。',
    inputSchema: {
      type: 'object',
      properties: {
        mode: { type: 'string', enum: ['page', 'snapshot', 'element', 'screenshot', 'tabs'], default: 'page' },
        ref: { type: 'string' },
        include: { type: 'array', items: { type: 'string', enum: ['text', 'interactive', 'snapshot'] } },
      },
      required: [],
    },
  },
  {
    name: 'browse',
    description: '在当前网页中打开、返回、前进、刷新、滚动、翻页或等待。',
    inputSchema: {
      type: 'object',
      properties: {
        mode: { type: 'string', enum: ['open', 'new', 'switch', 'close', 'back', 'forward', 'reload', 'scroll', 'scrollTo', 'paginate', 'wait'] },
        url: { type: 'string' },
        ref: { type: 'string' },
        tabId: { type: 'integer' },
        amount: { type: 'number' },
        after: { $ref: '#/$defs/after' },
      },
      required: ['mode'],
      $defs: { after: { type: 'object' } },
    },
  },
  {
    name: 'act',
    description: '点击、悬停、拖拽、填写、选择或发送键盘操作。',
    inputSchema: {
      type: 'object',
      properties: {
        mode: { type: 'string', enum: ['click', 'hover', 'drag', 'fill', 'select', 'press', 'dialog'] },
        ref: { type: 'string' },
        fromRef: { type: 'string' },
        toRef: { type: 'string' },
        value: {},
        fields: { type: 'array', items: { type: 'object', required: ['ref', 'value'] } },
        key: { type: 'string' },
        submit: { type: 'string' },
        doubleClick: { type: 'boolean' },
        after: { $ref: '#/$defs/after' },
      },
      required: ['mode'],
      $defs: { after: { type: 'object' } },
    },
  },
  {
    name: 'transfer',
    description: '向当前页面上传文件，或触发网页文件下载。',
    inputSchema: {
      type: 'object',
      properties: {
        mode: { type: 'string', enum: ['upload', 'download'] },
        ref: { type: 'string' },
        url: { type: 'string' },
        filename: { type: 'string' },
        saveAs: { type: 'boolean' },
        file: { type: 'object', properties: { name: { type: 'string' }, mimeType: { type: 'string' }, dataUrl: { type: 'string' }, base64: { type: 'string' } } },
        after: { $ref: '#/$defs/after' },
      },
      required: ['mode'],
      $defs: { after: { type: 'object' } },
    },
  },
];

const webBridge = {
  socket: null,
  ready: false,
  reconnectTimer: null,
  reconnectAttempts: 0,
  activeTabId: null,
  authRequired: false,
  connecting: null,
  reconnectRequested: false,
  handshakeTimer: null,
  keepAliveTimer: null,
  transport: null,
};

const visibleControl = {
  groupByWindow: new Map(),
  badgeTimer: null,
};

const loadedManifest = chrome.runtime.getManifest?.() || {};
const EXTENSION_VERSION = loadedManifest.version || 'unknown';
const extensionAssetPrefix = loadedManifest.background?.service_worker?.startsWith('extension/')
  ? 'extension/'
  : '';

function getAuthorizationPageUrl() {
  return chrome.runtime.getURL(`${extensionAssetPrefix}auth/authorize.html`);
}

async function openAuthorizationPageIfNeeded() {
  try {
    const { accessToken } = await chrome.storage.local.get(['accessToken']);
    if (typeof accessToken === 'string' && accessToken.trim()) return;

    await openAuthorizationPage();
  } catch (error) {
    console.warn('无法打开见行授权页', error);
  }
}

async function openAuthorizationPage() {
  const url = getAuthorizationPageUrl();
  const tabs = await chrome.tabs.query({});
  const existingTab = tabs.find((tab) => tab.url === url && Number.isInteger(tab.id));
  if (existingTab?.id !== undefined) {
    await chrome.tabs.update(existingTab.id, { active: true });
    return { ok: true, url, tabId: existingTab.id };
  }

  const createdTab = await chrome.tabs.create({ url, active: true });
  return { ok: true, url, tabId: createdTab.id };
}

async function ensureContextMenus() {
  await chrome.contextMenus.removeAll();
  chrome.contextMenus.create({
    id: CAPTURE_MENU_ID,
    title: '采集到 Mira',
    contexts: ['page', 'selection', 'image']
  });
}

chrome.runtime.onInstalled.addListener(() => {
  ensureContextMenus();
  connectWebBridge();
});

chrome.runtime.onStartup.addListener(() => {
  ensureContextMenus();
  connectWebBridge();
});

// 扩展更新或后台脚本重新加载时，也确保已有安装实例能看到菜单。
ensureContextMenus();
connectWebBridge();

chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  if (info.menuItemId !== CAPTURE_MENU_ID) return;

  const imageUrl = (info.srcUrl || '').trim();
  const selectedText = (info.selectionText || '').trim();
  await chrome.storage.session.set({
    pendingCapture: imageUrl
      ? {
        captureMode: 'image',
        imageUrl,
        title: tab?.title || '',
        url: tab?.url || '',
        favicon: tab?.favIconUrl || '',
      }
      : {
        captureMode: 'selection',
        selectedText,
        title: tab?.title || '',
        url: tab?.url || '',
        favicon: tab?.favIconUrl || '',
      },
  });
  chrome.action.openPopup();
});

function toWebSocketUrl(backendUrl) {
  const value = String(backendUrl || '').trim();
  if (!value) return '';

  const url = new URL(value);
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new Error('Mira 后端地址必须使用 HTTP 或 HTTPS');
  }

  url.protocol = url.protocol === 'https:' ? 'wss:' : 'ws:';
  url.pathname = `${url.pathname.replace(/\/$/, '')}${WEBBRIDGE_PATH}`;
  url.search = '';
  url.hash = '';
  return url.toString();
}

async function getWebBridgeConfig() {
  const [syncStore, localStore] = await Promise.all([
    chrome.storage.sync.get(['backendUrl']),
    chrome.storage.local.get(['accessToken']),
  ]);
  return {
    url: toWebSocketUrl(syncStore.backendUrl),
    transport: 'native',
    accessToken: typeof localStore.accessToken === 'string' ? localStore.accessToken : '',
    backendUrl: typeof syncStore.backendUrl === 'string' ? syncStore.backendUrl : '',
  };
}

function publishWebBridgeStatus(status, detail = {}) {
  chrome.runtime.sendMessage({
    type: 'WEBBRIDGE_STATUS',
    status,
    ...detail,
  }).catch(() => {});
}

function publishWebBridgeEvent(event, detail = {}) {
  const socket = webBridge.socket;
  if (!webBridge.ready || socket?.readyState !== WebSocket.OPEN) return;
  socket.send(JSON.stringify({ version: WEBBRIDGE_PROTOCOL_VERSION, type: 'status', status: 'operation', event, ...detail }));
}

function stopWebSocketKeepAlive() {
  if (!webBridge.keepAliveTimer) return;
  clearInterval(webBridge.keepAliveTimer);
  webBridge.keepAliveTimer = null;
}

function startWebSocketKeepAlive(socket) {
  stopWebSocketKeepAlive();
  webBridge.keepAliveTimer = setInterval(() => {
    if (webBridge.socket !== socket || webBridge.transport !== 'websocket' || socket.readyState !== WebSocket.OPEN) {
      stopWebSocketKeepAlive();
      return;
    }
    socket.send(JSON.stringify({ version: WEBBRIDGE_PROTOCOL_VERSION, type: 'keepalive' }));
  }, WEBBRIDGE_KEEPALIVE_INTERVAL_MS);
}

function closeTransport() {
  const socket = webBridge.socket;
  webBridge.socket = null;
  webBridge.ready = false;
  stopWebSocketKeepAlive();
  if (webBridge.handshakeTimer) {
    clearTimeout(webBridge.handshakeTimer);
    webBridge.handshakeTimer = null;
  }
  if (socket && typeof socket.close === 'function') socket.close();
}

function startWebBridgeHandshakeTimer(socket) {
  if (webBridge.handshakeTimer) clearTimeout(webBridge.handshakeTimer);
  webBridge.handshakeTimer = setTimeout(() => {
    webBridge.handshakeTimer = null;
    if (webBridge.socket !== socket || webBridge.ready) return;
    webBridge.socket = null;
    webBridge.ready = false;
    stopWebSocketKeepAlive();
    publishWebBridgeStatus('error', {
      code: 'BRIDGE_HANDSHAKE_TIMEOUT',
      message: '见行扩展握手超时，正在重新连接',
    });
    socket.close();
    scheduleWebBridgeReconnect();
  }, 5000);
}

function startNativeHostReadyTimer(socket) {
  if (webBridge.handshakeTimer) clearTimeout(webBridge.handshakeTimer);
  webBridge.handshakeTimer = setTimeout(() => {
    webBridge.handshakeTimer = null;
    if (webBridge.socket !== socket) return;
    webBridge.socket = null;
    webBridge.ready = false;
    publishWebBridgeStatus('error', {
      code: 'NATIVE_HOST_READY_TIMEOUT',
      message: 'Native Messaging Host 未响应，正在重新连接',
    });
    socket.close();
    scheduleWebBridgeReconnect();
  }, 5000);
}

async function ensureVisibleControl(tabId, operation) {
  const tab = await chrome.tabs.get(tabId);
  if (typeof tab.windowId !== 'number') return;
  await chrome.windows.update(tab.windowId, { focused: true });
  await chrome.tabs.update(tabId, { active: true });
  let groupId = visibleControl.groupByWindow.get(tab.windowId);
  if (!Number.isInteger(groupId)) {
    groupId = await chrome.tabs.group({ tabIds: [tabId] });
    visibleControl.groupByWindow.set(tab.windowId, groupId);
  } else {
    try { await chrome.tabs.group({ groupId, tabIds: [tabId] }); }
    catch (_) { groupId = await chrome.tabs.group({ tabIds: [tabId] }); visibleControl.groupByWindow.set(tab.windowId, groupId); }
  }
  await chrome.tabGroups.update(groupId, { title: '见行 · AI 操作中', color: 'blue', collapsed: false });
  await chrome.action.setBadgeText({ tabId, text: 'AI' });
  await chrome.action.setBadgeBackgroundColor({ tabId, color: '#2563eb' });
  await sendPageMessage(tabId, { type: 'WEBBRIDGE_STATUS', status: 'running', operation });
  publishWebBridgeEvent('started', { tabId, operation });
}

async function finishVisibleControl(tabId, operation, ok, error) {
  try {
    await sendPageMessage(tabId, { type: 'WEBBRIDGE_STATUS', status: ok ? 'completed' : 'failed', operation, error });
    await chrome.action.setBadgeText({ tabId, text: ok ? '✓' : '!' });
    await chrome.action.setBadgeBackgroundColor({ tabId, color: ok ? '#16a34a' : '#dc2626' });
  } catch (_) {}
  publishWebBridgeEvent('finished', { tabId, operation, ok, ...(error ? { error } : {}) });
  setTimeout(() => chrome.action.setBadgeText({ tabId, text: '' }).catch(() => {}), 3000);
}

function describeOperation(tool, params) {
  const mode = typeof params?.mode === 'string' ? params.mode : '';
  const labels = { look: '观察页面', browse: '浏览页面', act: '操作页面', transfer: '传输文件' };
  return `${labels[tool] || '操作浏览器'}${mode ? ` · ${mode}` : ''}`;
}

function scheduleWebBridgeReconnect() {
  if (webBridge.authRequired || webBridge.reconnectTimer) {
    return;
  }

  const delay = Math.min(1000 * (2 ** Math.min(webBridge.reconnectAttempts, 5)), 30000);
  webBridge.reconnectAttempts += 1;
  webBridge.reconnectTimer = setTimeout(() => {
    webBridge.reconnectTimer = null;
    connectWebBridge();
  }, delay);
}

function requestWebBridgeReconnect() {
  closeTransport();
  webBridge.authRequired = false;
  webBridge.reconnectAttempts = 0;
  webBridge.reconnectRequested = true;
  if (webBridge.reconnectTimer) {
    clearTimeout(webBridge.reconnectTimer);
    webBridge.reconnectTimer = null;
  }
  void connectWebBridge();
}

async function connectWebBridge() {
  if (webBridge.authRequired || webBridge.socket?.readyState === WebSocket.OPEN || webBridge.socket?.readyState === WebSocket.CONNECTING) {
    return;
  }

  if (webBridge.connecting) {
    webBridge.reconnectRequested = true;
    return webBridge.connecting;
  }
  webBridge.reconnectRequested = false;
  const connection = (async () => {
  let config;
  try {
    config = await getWebBridgeConfig();
  } catch (error) {
    publishWebBridgeStatus('error', { code: 'INVALID_BRIDGE_CONFIG', message: error.message });
    return;
  }

  if (!config.accessToken) {
    webBridge.authRequired = true;
    publishWebBridgeStatus('auth_required', {
      code: 'AUTH_REQUIRED',
      message: '见行授权已失效，请打开授权页重新授权',
    });
    await openAuthorizationPageIfNeeded();
    return;
  }

  if (!config.url) {
    publishWebBridgeStatus('disconnected', { code: 'BACKEND_NOT_CONFIGURED' });
    return;
  }

  publishWebBridgeStatus('connecting');
  webBridge.transport = config.transport;
  if (config.transport === 'native') {
    try {
      const port = chrome.runtime.connectNative('com.tomz.uichat.webbridge');
      const nativeSocket = {
        readyState: WebSocket.OPEN,
        send(payload) { port.postMessage(JSON.parse(payload)); },
        close() { port.disconnect(); },
      };
      webBridge.socket = nativeSocket;
      webBridge.ready = false;
      // Native readiness and backend readiness are two separate states. Only tear down
      // this port when the Native Host itself fails to acknowledge within the timeout.
      startNativeHostReadyTimer(nativeSocket);
      port.onMessage.addListener((message) => handleWebBridgeMessage(nativeSocket, JSON.stringify(message)).catch((error) => publishWebBridgeStatus('error', { code: 'MESSAGE_HANDLER_ERROR', message: error.message })));
      port.onDisconnect.addListener(() => {
        if (webBridge.socket !== nativeSocket) return;
        webBridge.socket = null;
        webBridge.ready = false;
        if (webBridge.handshakeTimer) {
          clearTimeout(webBridge.handshakeTimer);
          webBridge.handshakeTimer = null;
        }
        publishWebBridgeStatus('disconnected', { code: chrome.runtime.lastError?.message || 'BRIDGE_DISCONNECTED' });
        scheduleWebBridgeReconnect();
      });
      nativeSocket.send(JSON.stringify({ version: 1, protocolVersion: WEBBRIDGE_PROTOCOL_VERSION, type: 'hello', client: 'mira-webbridge-extension', extensionName: '见行', extensionVersion: EXTENSION_VERSION, backendUrl: config.backendUrl, accessToken: config.accessToken, transport: config.transport, capabilities: ['look', 'browse', 'act', 'transfer'], tools: WEBBRIDGE_TOOL_DEFINITIONS }));
      return;
    } catch (error) {
      publishWebBridgeStatus('error', { code: 'NATIVE_HOST_UNAVAILABLE', message: error.message || 'Native Messaging Host 未安装' });
      scheduleWebBridgeReconnect();
      return;
    }
  }
  const socket = new WebSocket(config.url);
  webBridge.socket = socket;
  webBridge.ready = false;
  startWebBridgeHandshakeTimer(socket);

  socket.addEventListener('open', () => {
    startWebSocketKeepAlive(socket);
    socket.send(JSON.stringify({
      version: WEBBRIDGE_PROTOCOL_VERSION,
      protocolVersion: WEBBRIDGE_PROTOCOL_VERSION,
      type: 'hello',
      client: 'mira-webbridge-extension',
      extensionName: '见行',
      extensionVersion: EXTENSION_VERSION,
      accessToken: config.accessToken || undefined,
      transport: config.transport,
      capabilities: ['look', 'browse', 'act', 'transfer'],
      tools: WEBBRIDGE_TOOL_DEFINITIONS,
    }));
    publishWebBridgeStatus('connecting', { message: '正在完成见行握手' });
  });

  socket.addEventListener('message', (event) => {
    handleWebBridgeMessage(socket, event.data).catch((error) => {
      publishWebBridgeStatus('error', { code: 'MESSAGE_HANDLER_ERROR', message: error.message });
    });
  });

  socket.addEventListener('error', () => {
    publishWebBridgeStatus('error', { code: 'BRIDGE_CONNECTION_ERROR' });
  });

  socket.addEventListener('close', () => {
    if (webBridge.socket !== socket) return;
    webBridge.socket = null;
    webBridge.ready = false;
    stopWebSocketKeepAlive();
    if (webBridge.handshakeTimer) {
      clearTimeout(webBridge.handshakeTimer);
      webBridge.handshakeTimer = null;
    }
    publishWebBridgeStatus('disconnected', { code: 'BRIDGE_DISCONNECTED' });
    scheduleWebBridgeReconnect();
  });
  })();
  webBridge.connecting = connection;
  try {
    await connection;
  } finally {
    if (webBridge.connecting === connection) webBridge.connecting = null;
    if (webBridge.reconnectRequested) {
      webBridge.reconnectRequested = false;
      webBridge.authRequired = false;
      void connectWebBridge();
    }
  }
}

function sendWebBridgeResponse(socket, id, body) {
  if (socket.readyState !== WebSocket.OPEN) return;
  socket.send(JSON.stringify({
    version: WEBBRIDGE_PROTOCOL_VERSION,
    type: 'response',
    id,
    ...body,
  }));
}

function bridgeError(code, message, suggestedAction, retryable = false) {
  return {
    ok: false,
    error: { code, message, suggestedAction, retryable },
  };
}

function withTimeout(promise, timeoutMs, code) {
  let timer;
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => {
      const error = new Error('浏览器操作超时');
      error.bridgeError = bridgeError(code, '浏览器操作超时，请重新观察当前页面', 'look', true);
      reject(error);
    }, timeoutMs);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}

async function handleWebBridgeMessage(socket, rawMessage) {
  let request;
  try {
    request = JSON.parse(rawMessage);
  } catch (_) {
    sendWebBridgeResponse(socket, null, bridgeError('INVALID_MESSAGE', 'WebSocket 消息不是合法 JSON', null));
    return;
  }

  if (!request) return;

  if (request.type === 'control' && request.command === 'set_transport') {
    if (request.transport !== 'websocket' && request.transport !== 'native') return;
    await chrome.storage.sync.set({ transport: request.transport });
    closeTransport();
    webBridge.authRequired = false;
    webBridge.reconnectAttempts = 0;
    connectWebBridge();
    return;
  }

  if (request.type === 'status' && request.status === 'native_ready') {
    if (webBridge.socket !== socket) return;
    if (webBridge.handshakeTimer) {
      clearTimeout(webBridge.handshakeTimer);
      webBridge.handshakeTimer = null;
    }
    webBridge.reconnectAttempts = 0;
    publishWebBridgeStatus('connecting', {
      code: request.code || 'NATIVE_HOST_READY',
      message: 'Native Host 已连接，正在等待 Mira 后端',
    });
    return;
  }

  if (request.type === 'status' && request.status === 'backend_connecting') {
    if (webBridge.socket !== socket) return;
    publishWebBridgeStatus('connecting', {
      code: request.code || 'BACKEND_CONNECTING',
      message: 'Native Host 已连接，正在连接 Mira 后端',
    });
    return;
  }

  if (request.type === 'status' && request.status === 'auth_required') {
    webBridge.authRequired = true;
    await chrome.storage.local.remove(['accessToken']);
    publishWebBridgeStatus('auth_required', {
      code: 'AUTH_REQUIRED',
      message: '见行授权已失效，请打开授权页重新授权',
    });
    await openAuthorizationPageIfNeeded();
    if (webBridge.socket === socket) socket.close();
    return;
  }

  if (request.type === 'hello_ack') {
    if (webBridge.socket !== socket) return;
    webBridge.ready = true;
    if (webBridge.handshakeTimer) {
      clearTimeout(webBridge.handshakeTimer);
      webBridge.handshakeTimer = null;
    }
    webBridge.reconnectAttempts = 0;
    publishWebBridgeStatus('connected', { tools: request.tools || [] });
    return;
  }

  if (request.type === 'response' && request.error?.code === 'AUTH_REQUIRED') {
    webBridge.authRequired = true;
    await chrome.storage.local.remove(['accessToken']);
    publishWebBridgeStatus('auth_required', {
      code: 'AUTH_REQUIRED',
      message: '见行授权已失效，请打开授权页重新授权',
    });
    await openAuthorizationPageIfNeeded();
    if (webBridge.socket === socket) socket.close();
    return;
  }

  if (request.type !== 'request' || typeof request.id !== 'string') return;

  try {
    const operation = describeOperation(request.tool, request.params || {});
    const tabId = await getAuthorizedTabId();
    await ensureVisibleControl(tabId, operation);
    const result = await withTimeout(
      executeWebBridgeTool(request.tool, request.params || {}),
      WEBBRIDGE_REQUEST_TIMEOUT_MS,
      'ACTION_TIMEOUT',
    );
    await finishVisibleControl(tabId, operation, true);
    sendWebBridgeResponse(socket, request.id, { ok: true, result });
  } catch (error) {
    const operation = describeOperation(request.tool, request.params || {});
    if (Number.isInteger(webBridge.activeTabId)) await finishVisibleControl(webBridge.activeTabId, operation, false, error.message || '浏览器操作失败');
    const normalized = error?.bridgeError || bridgeError('ACTION_FAILED', error.message || '浏览器操作失败', null, false);
    sendWebBridgeResponse(socket, request.id, normalized);
  }
}

async function getAuthorizedTabId() {
  if (webBridge.activeTabId !== null) {
    try {
      const tab = await chrome.tabs.get(webBridge.activeTabId);
      if (tab) return tab.id;
    } catch (_) {
      webBridge.activeTabId = null;
    }
  }

  const tabs = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
  const tab = tabs[0];
  if (!tab?.id) {
    throw Object.assign(new Error('没有可操作的当前标签页'), {
      bridgeError: bridgeError('NO_ACTIVE_TAB', '没有可操作的当前标签页', 'look', true),
    });
  }
  return tab.id;
}

async function ensurePageBridge(tabId) {
  try {
    await chrome.tabs.sendMessage(tabId, { type: 'WEBBRIDGE_PING' });
    return;
  } catch (_) {
    // Navigation and reload destroy the content script. Reinstall it before retrying.
  }

  try {
    await chrome.scripting.executeScript({
      target: { tabId },
      files: [`${extensionAssetPrefix}lib/extractor.js`],
    });
    await chrome.scripting.executeScript({
      target: { tabId },
      files: [`${extensionAssetPrefix}content/content.js`],
    });
  } catch (error) {
    throw Object.assign(new Error(`无法注入页面桥接：${error.message || '当前页面不允许操作'}`), {
      bridgeError: bridgeError('PAGE_BRIDGE_UNAVAILABLE', `无法注入页面桥接：${error.message || '当前页面不允许操作'}`, 'open_extension', true),
    });
  }
}

async function sendPageMessage(tabId, message) {
  try {
    await ensurePageBridge(tabId);
    const response = await chrome.tabs.sendMessage(tabId, message);
    if (response?.ok === false && response.error) {
      const error = new Error(response.error.message || '页面操作失败');
      error.bridgeError = bridgeError(
        response.error.code || 'ACTION_FAILED',
        response.error.message || '页面操作失败',
        response.error.suggestedAction || 'look',
        response.error.retryable === true,
      );
      throw error;
    }
    return response;
  } catch (error) {
    if (error?.bridgeError) throw error;
    throw Object.assign(new Error('当前页面尚未授权给见行，请先打开一次扩展 Popup'), {
      bridgeError: bridgeError('USER_ACTIVATION_REQUIRED', '当前页面尚未授权给见行，请先打开一次扩展 Popup', 'open_extension', true),
    });
  }
}

async function executeWebBridgeTool(tool, params) {
  if (!['look', 'browse', 'act', 'transfer'].includes(tool)) {
    throw Object.assign(new Error(`不支持的工具：${tool}`), {
      bridgeError: bridgeError('UNSUPPORTED_TOOL', `不支持的工具：${tool}`, null, false),
    });
  }

  const tabId = await getAuthorizedTabId();
  if (tool === 'look') return executeLook(tabId, params);
  if (tool === 'browse') return executeBrowse(tabId, params);
  if (tool === 'act') return executeAct(tabId, params);
  return executeTransfer(tabId, params);
}

async function executeLook(tabId, params) {
  const mode = params.mode || 'page';
  if (mode === 'tabs') {
    const tabs = await chrome.tabs.query({ currentWindow: true });
    return {
      tabs: tabs.map((tab) => ({
        tabId: tab.id,
        windowId: tab.windowId,
        active: tab.active === true,
        title: tab.title || '',
        url: tab.url || '',
      })),
    };
  }
  if (!['page', 'snapshot', 'element', 'screenshot'].includes(mode)) {
    throw Object.assign(new Error(`不支持的 look 模式：${mode}`), {
      bridgeError: bridgeError('INVALID_MODE', `不支持的 look 模式：${mode}`, 'look', false),
    });
  }

  const tab = await chrome.tabs.get(tabId);
  if (mode === 'screenshot') {
    if (typeof tab.windowId !== 'number') {
      throw Object.assign(new Error('无法确定当前浏览器窗口'), {
        bridgeError: bridgeError('NO_ACTIVE_TAB', '无法确定当前浏览器窗口', 'look', true),
      });
    }
    return {
      tabId,
      dataUrl: await chrome.tabs.captureVisibleTab(tab.windowId, { format: 'png' }),
    };
  }

  if (mode === 'page') {
    const result = {
      tabId,
      url: tab.url || '',
      title: tab.title || '',
    };
    const include = Array.isArray(params.include) ? params.include : [];
    if (include.includes('text') || include.includes('interactive') || include.includes('snapshot')) {
      const snapshot = await sendPageMessage(tabId, { type: 'WEBBRIDGE_SNAPSHOT' });
      if (include.includes('text')) result.text = snapshot.text;
      if (include.includes('interactive')) result.elements = snapshot.elements;
      if (include.includes('snapshot')) result.snapshot = snapshot;
    }
    return result;
  }

  if (mode === 'element' && typeof params.ref !== 'string') {
    throw Object.assign(new Error('look.element 需要 ref'), {
      bridgeError: bridgeError('INVALID_PARAMS', 'look.element 需要 ref', 'look', false),
    });
  }

  const snapshot = await sendPageMessage(tabId, { type: 'WEBBRIDGE_SNAPSHOT' });
  if (mode === 'element' && params.ref) {
    return {
      tabId,
      element: snapshot.elements?.find((element) => element.ref === params.ref) || null,
    };
  }
  return { tabId, ...snapshot };
}

async function executeBrowse(tabId, params) {
  const mode = params.mode || 'open';
  if (!['open', 'new', 'switch', 'close', 'back', 'forward', 'reload', 'scroll', 'scrollTo', 'paginate', 'wait'].includes(mode)) {
    throw Object.assign(new Error(`不支持的 browse 模式：${mode}`), {
      bridgeError: bridgeError('INVALID_MODE', `不支持的 browse 模式：${mode}`, 'browse', false),
    });
  }
  if (['scrollTo', 'paginate'].includes(mode) && typeof params.ref !== 'string') {
    throw Object.assign(new Error(`browse.${mode} 需要 ref`), {
      bridgeError: bridgeError('INVALID_PARAMS', `browse.${mode} 需要 ref`, 'look', false),
    });
  }
  if (mode === 'new') {
    if (typeof params.url !== 'string' || !/^https?:\/\//i.test(params.url)) {
      throw Object.assign(new Error('browse.new 需要 HTTP(S) URL'), {
        bridgeError: bridgeError('INVALID_URL', 'browse.new 需要 HTTP(S) URL', 'browse', false),
      });
    }
    const created = await chrome.tabs.create({ url: params.url, active: true });
    if (!created.id) {
      throw Object.assign(new Error('新标签页创建失败'), {
        bridgeError: bridgeError('TAB_CREATE_FAILED', '新标签页创建失败', 'browse', true),
      });
    }
    webBridge.activeTabId = created.id;
    return { tabId: created.id, windowId: created.windowId, url: params.url, ...(await waitForAfter(created.id, params.after)) };
  }
  if (mode === 'switch') {
    const targetTabId = Number.isInteger(params.tabId) ? params.tabId : Number.parseInt(params.ref, 10);
    if (!Number.isInteger(targetTabId)) {
      throw Object.assign(new Error('browse.switch 需要 tabId'), {
        bridgeError: bridgeError('INVALID_PARAMS', 'browse.switch 需要 tabId', 'look', false),
      });
    }
    const target = await chrome.tabs.get(targetTabId);
    await chrome.tabs.update(targetTabId, { active: true });
    webBridge.activeTabId = targetTabId;
    return { tabId: targetTabId, windowId: target.windowId, url: target.url || '', title: target.title || '', summary: '已切换标签页' };
  }
  if (mode === 'close') {
    const targetTabId = Number.isInteger(params.tabId)
      ? params.tabId
      : (Number.isInteger(Number.parseInt(params.ref, 10)) ? Number.parseInt(params.ref, 10) : tabId);
    await chrome.tabs.remove(targetTabId);
    if (webBridge.activeTabId === targetTabId) webBridge.activeTabId = null;
    return { tabId: targetTabId, summary: '已关闭标签页' };
  }
  if (mode === 'open') {
    if (typeof params.url !== 'string' || !/^https?:\/\//i.test(params.url)) {
      throw Object.assign(new Error('browse.open 需要 HTTP(S) URL'), {
        bridgeError: bridgeError('INVALID_URL', 'browse.open 需要 HTTP(S) URL', 'browse', false),
      });
    }
    await chrome.tabs.update(tabId, { url: params.url });
    return { tabId, url: params.url, ...(await waitForAfter(tabId, params.after)) };
  }

  const response = await sendPageMessage(tabId, {
    type: 'WEBBRIDGE_BROWSE',
    mode,
    amount: params.amount,
    ref: params.ref,
  });
  return { tabId, ...response, ...(await waitForAfter(tabId, params.after)) };
}

async function executeAct(tabId, params) {
  const mode = params.mode || 'click';
  const allowedModes = ['click', 'hover', 'drag', 'fill', 'select', 'press', 'dialog'];
  if (!allowedModes.includes(mode)) {
    throw Object.assign(new Error(`不支持的 act 模式：${mode}`), {
      bridgeError: bridgeError('INVALID_MODE', `不支持的 act 模式：${mode}`, 'look', false),
    });
  }

  if (['click', 'hover'].includes(mode) && typeof params.ref !== 'string') {
    throw Object.assign(new Error(`act.${mode} 需要 ref`), {
      bridgeError: bridgeError('INVALID_PARAMS', `act.${mode} 需要 ref`, 'look', false),
    });
  }
  if (mode === 'drag' && (typeof params.fromRef !== 'string' || typeof params.toRef !== 'string')) {
    throw Object.assign(new Error('act.drag 需要 fromRef 和 toRef'), {
      bridgeError: bridgeError('INVALID_PARAMS', 'act.drag 需要 fromRef 和 toRef', 'look', false),
    });
  }
  if (['fill', 'select'].includes(mode) && !Array.isArray(params.fields) && typeof params.ref !== 'string') {
    throw Object.assign(new Error(`act.${mode} 需要 ref 或 fields`), {
      bridgeError: bridgeError('INVALID_PARAMS', `act.${mode} 需要 ref 或 fields`, 'look', false),
    });
  }
  if (mode === 'press' && typeof params.key !== 'string') {
    throw Object.assign(new Error('act.press 需要 key'), {
      bridgeError: bridgeError('INVALID_PARAMS', 'act.press 需要 key', 'look', false),
    });
  }

  const response = await sendPageMessage(tabId, {
    type: 'WEBBRIDGE_ACT',
    mode,
    ref: params.ref,
    fromRef: params.fromRef,
    toRef: params.toRef,
    value: params.value,
    fields: params.fields,
    key: params.key,
    submit: params.submit,
    action: params.action,
    promptText: params.promptText,
    after: params.after,
  });
  return { tabId, ...response, ...(await waitForAfter(tabId, params.after)) };
}

async function executeTransfer(tabId, params) {
  const mode = params.mode;
  if (!['upload', 'download'].includes(mode)) {
    throw Object.assign(new Error(`不支持的 transfer 模式：${mode}`), {
      bridgeError: bridgeError('INVALID_MODE', `不支持的 transfer 模式：${mode}`, 'transfer', false),
    });
  }

  if (mode === 'upload') {
    if (!params.ref || !params.file || typeof params.file !== 'object') {
      throw Object.assign(new Error('transfer.upload 需要 ref 和 file'), {
        bridgeError: bridgeError('INVALID_PARAMS', 'transfer.upload 需要 ref 和 file', 'look', false),
      });
    }
    if (typeof params.file.dataUrl !== 'string' && typeof params.file.base64 !== 'string') {
      throw Object.assign(new Error('文件必须以 dataUrl 或 base64 传入'), {
        bridgeError: bridgeError('FILE_ACCESS_DENIED', '扩展不能直接读取桌面路径，请传入文件数据', 'transfer', false),
      });
    }
    const encodedSize = (params.file.dataUrl || params.file.base64 || '').length;
    if (encodedSize > 25 * 1024 * 1024) {
      throw Object.assign(new Error('上传文件不能超过 20 MB'), {
        bridgeError: bridgeError('FILE_TOO_LARGE', '上传文件不能超过 20 MB', 'transfer', false),
      });
    }
    const result = await sendPageMessage(tabId, {
      type: 'WEBBRIDGE_UPLOAD',
      ref: params.ref,
      file: params.file,
    });
    return { tabId, ...result, ...(await waitForAfter(tabId, params.after)) };
  }

  let url = typeof params.url === 'string' ? params.url.trim() : '';
  if (!url && params.ref) {
    const link = await sendPageMessage(tabId, { type: 'WEBBRIDGE_GET_HREF', ref: params.ref });
    url = link?.url || '';
  }
  if (!/^https?:\/\//i.test(url) && !/^blob:/i.test(url) && !/^data:/i.test(url)) {
    throw Object.assign(new Error('transfer.download 需要 HTTP(S)、blob 或 data URL'), {
      bridgeError: bridgeError('INVALID_URL', 'transfer.download 需要有效的下载地址', 'look', false),
    });
  }

  if (/^(blob:|data:)/i.test(url)) {
    const result = await sendPageMessage(tabId, {
      type: 'WEBBRIDGE_TRIGGER_DOWNLOAD',
      url,
      filename: params.filename,
    });
    return { tabId, url, ...result };
  }

  const downloadId = await chrome.downloads.download({
    url,
    ...(typeof params.filename === 'string' && params.filename.trim() ? { filename: params.filename.trim() } : {}),
    saveAs: Boolean(params.saveAs),
  });
  return { tabId, downloadId, url };
}

async function waitForAfter(tabId, after = {}) {
  if (!after || typeof after !== 'object') return {};
  const timeoutMs = Math.min(Math.max(Number(after.timeoutMs || 5000), 100), 30000);
  const startedAt = Date.now();
  const initialTab = await chrome.tabs.get(tabId);

  while (Date.now() - startedAt < timeoutMs) {
    const currentTab = await chrome.tabs.get(tabId);
    const waitKind = after.wait || 'none';
    const urlReady = !after.urlContains || (currentTab.url || '').includes(String(after.urlContains));
    const titleReady = !after.titleContains || (currentTab.title || '').includes(String(after.titleContains));
    const statusReady = waitKind !== 'navigation' || currentTab.status === 'complete';
    let textReady = true;
    if (after.textContains) {
      try {
        const snapshot = await sendPageMessage(tabId, { type: 'WEBBRIDGE_SNAPSHOT' });
        textReady = (snapshot.text || '').includes(String(after.textContains));
      } catch (_) {
        textReady = false;
      }
    }

    const hasCondition = Boolean(
      after.wait || after.urlContains || after.titleContains || after.textContains,
    );
    const networkIdleReady = waitKind !== 'networkIdle' || Date.now() - startedAt >= 300;
    if ((!hasCondition || (urlReady && titleReady && statusReady && textReady && networkIdleReady))) {
      const result = { waitedMs: Date.now() - startedAt, url: currentTab.url || initialTab.url || '' };
      if (after.include?.includes('snapshot')) {
        result.snapshot = await sendPageMessage(tabId, { type: 'WEBBRIDGE_SNAPSHOT' });
      }
      return result;
    }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }

  throw Object.assign(new Error('等待页面状态超时'), {
    bridgeError: bridgeError('ACTION_TIMEOUT', '等待页面状态超时', 'look', true),
  });
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message?.type === 'WEBBRIDGE_OPEN_AUTHORIZATION_PAGE') {
    openAuthorizationPage()
      .then(sendResponse)
      .catch((error) => sendResponse({ ok: false, message: error?.message || '无法打开见行授权页' }));
    return true;
  }

  if (message?.type === 'WEBBRIDGE_ACTIVATE_TAB' && Number.isInteger(message.tabId)) {
    webBridge.activeTabId = message.tabId;
    sendResponse({ ok: true, tabId: message.tabId });
    return false;
  }

  if (message?.type === 'WEBBRIDGE_RECONNECT') {
    requestWebBridgeReconnect();
    sendResponse({ ok: true });
  }
  return false;
});

chrome.storage.onChanged.addListener((changes, areaName) => {
  if (areaName === 'sync' && (changes.backendUrl || changes.transport)) {
    requestWebBridgeReconnect();
  }

  if (areaName === 'local' && changes.accessToken) {
    closeTransport();
    webBridge.authRequired = !changes.accessToken.newValue;
    webBridge.reconnectAttempts = 0;
    if (!webBridge.authRequired) requestWebBridgeReconnect();
  }
});
