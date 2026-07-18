/**
 * MiraWebBrige - Options Page Logic
 */

(function () {
  'use strict';

  const DEFAULT_WEB_APP_URL = '';

  const els = {
    backendUrl: document.getElementById('backendUrl'),
    transport: document.getElementById('transport'),
    webAppUrl: document.getElementById('webAppUrl'),
    authorizeBtn: document.getElementById('authorizeBtn'),
    authorizeResult: document.getElementById('authorizeResult'),
    authorizationCode: document.getElementById('authorizationCode'),
    exchangeCodeBtn: document.getElementById('exchangeCodeBtn'),
    testBtn: document.getElementById('testBtn'),
    testResult: document.getElementById('testResult'),
    saveBtn: document.getElementById('saveBtn'),
    saveResult: document.getElementById('saveResult'),
    openAuthorizationPage: document.getElementById('openAuthorizationPage'),
  };

  const loadedManifest = chrome.runtime.getManifest?.() || {};
  const extensionAssetPrefix = loadedManifest.options_page?.startsWith('extension/') ? 'extension/' : '';

  async function load() {
    try {
      const stored = await chrome.storage.sync.get(['backendUrl', 'transport']);
      els.backendUrl.value = stored.backendUrl || '';
      els.transport.value = stored.transport === 'native' ? 'native' : 'websocket';
      els.webAppUrl.value = stored.webAppUrl || DEFAULT_WEB_APP_URL;
    } catch (_) {
      els.backendUrl.value = '';
      els.webAppUrl.value = DEFAULT_WEB_APP_URL;
    }
  }

  async function save() {
    const url = els.backendUrl.value.trim();
    try {
      await chrome.storage.sync.set({
        backendUrl: url,
        transport: els.transport.value,
        webAppUrl: els.webAppUrl.value.trim() || DEFAULT_WEB_APP_URL,
      });
      showSaveResult('已保存', false);
    } catch (e) {
      showSaveResult('保存失败：' + e.message, true);
    }
  }

  async function testConnection() {
    const url = els.backendUrl.value.trim().replace(/\/$/, '');
    if (!url) {
      showTestResult('请先完成授权或填写后端地址', true);
      return;
    }
    els.testResult.className = 'test-result';
    els.testResult.textContent = '测试中…';

    try {
      const headers = {};
      const tokenStore = await chrome.storage.local.get(['accessToken']);
      if (tokenStore.accessToken) headers.Authorization = `Bearer ${tokenStore.accessToken}`;
      const res = await fetch(`${url.replace(/\/$/, '')}/health`, {
        method: 'GET',
        headers,
        signal: AbortSignal.timeout(5000),
      });
      if (res.ok) {
        showTestResult('连接成功', false);
      } else {
        showTestResult(`连接异常（${res.status}）`, true);
      }
    } catch (e) {
      const text = e.message || '';
      if (text.includes('Failed to fetch') || text.includes('timeout')) {
        showTestResult('无法连接，请确认桌面端已启动', true);
      } else {
        showTestResult('错误：' + text, true);
      }
    }
  }

  function toBase64Url(bytes) {
    let binary = '';
    bytes.forEach((byte) => { binary += String.fromCharCode(byte); });
    return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  }

  async function authorize() {
    const webApp = (els.webAppUrl.value.trim() || DEFAULT_WEB_APP_URL).replace(/\/$/, '');
    if (!webApp) {
      showAuthorizeResult('请先填写 Mira 前端地址，或直接在 popup 使用授权码', true);
      return;
    }
    els.authorizeResult.textContent = '正在打开授权页面…';
    try {
      const verifier = toBase64Url(crypto.getRandomValues(new Uint8Array(32)));
      const challengeBytes = new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier)));
      const challenge = toBase64Url(challengeBytes);
      const state = toBase64Url(crypto.getRandomValues(new Uint8Array(24)));
      const redirectUri = chrome.identity.getRedirectURL('mira-clipper');
      const url = new URL(`${webApp}/#/oauth/authorize`);
      url.searchParams.set('client_id', 'mira-clipper');
      url.searchParams.set('response_type', 'code');
      url.searchParams.set('redirect_uri', redirectUri);
      url.searchParams.set('state', state);
      url.searchParams.set('code_challenge', challenge);
      url.searchParams.set('code_challenge_method', 'S256');
      const callback = await chrome.identity.launchWebAuthFlow({ url: url.toString(), interactive: true });
      const callbackUrl = new URL(callback);
      if (callbackUrl.searchParams.get('state') !== state) throw new Error('授权状态校验失败');
      const code = callbackUrl.searchParams.get('code');
      if (!code) throw new Error('授权未返回授权码');
      const parsed = window.MiraAuthorizationCode.unwrap(code);
      await chrome.storage.sync.set({ backendUrl: parsed.backendUrl });
      const response = await fetch(`${parsed.backendUrl}/oauth/token`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          grant_type: 'authorization_code',
          client_id: 'mira-clipper',
          code: parsed.code,
          redirect_uri: redirectUri,
          code_verifier: verifier,
        }),
      });
      const result = await response.json();
      if (!response.ok || !result.accessToken) throw new Error(result.message || `授权失败（${response.status}）`);
      await chrome.storage.local.set({ accessToken: result.accessToken });
      showAuthorizeResult('授权成功', false);
    } catch (error) {
      showAuthorizeResult(error.message || '授权失败', true);
    }
  }

  async function exchangeAuthorizationCode() {
    const encodedCode = els.authorizationCode.value.trim();
    if (!encodedCode) {
      showAuthorizeResult('请先粘贴授权码', true);
      return;
    }
    els.exchangeCodeBtn.disabled = true;
    showAuthorizeResult('正在验证授权码…', false);
    try {
      const parsed = window.MiraAuthorizationCode.unwrap(encodedCode);
      await chrome.storage.sync.set({ backendUrl: parsed.backendUrl });
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
      if (!response.ok || !result.accessToken) throw new Error(result.message || `授权失败（${response.status}）`);
      await chrome.storage.local.set({ accessToken: result.accessToken });
      els.authorizationCode.value = '';
      showAuthorizeResult('授权成功', false);
    } catch (error) {
      showAuthorizeResult(error.message || '授权失败', true);
    } finally {
      els.exchangeCodeBtn.disabled = false;
    }
  }

  function showAuthorizeResult(msg, isError) {
    els.authorizeResult.textContent = msg;
    els.authorizeResult.className = 'save-result ' + (isError ? 'err' : 'ok');
  }

  function showTestResult(msg, isError) {
    els.testResult.textContent = msg;
    els.testResult.className = 'test-result ' + (isError ? 'err' : 'ok');
  }

  function showSaveResult(msg, isError) {
    els.saveResult.textContent = msg;
    els.saveResult.className = 'save-result ' + (isError ? 'err' : 'ok');
    setTimeout(() => {
      els.saveResult.textContent = '';
    }, 3000);
  }

  els.saveBtn.addEventListener('click', save);
  els.testBtn.addEventListener('click', testConnection);
  els.authorizeBtn.addEventListener('click', authorize);
  els.exchangeCodeBtn.addEventListener('click', exchangeAuthorizationCode);
  els.openAuthorizationPage.addEventListener('click', () => {
    chrome.tabs.create({ url: chrome.runtime.getURL(`${extensionAssetPrefix}auth/authorize.html`) });
  });

  load();
})();
