/**
 * 触界 - Options Page Logic
 */

(function () {
  'use strict';

  const els = {
    backendUrl: document.getElementById('backendUrl'),
    testBtn: document.getElementById('testBtn'),
    testResult: document.getElementById('testResult'),
    saveBtn: document.getElementById('saveBtn'),
    saveResult: document.getElementById('saveResult'),
    openSidePanel: document.getElementById('openSidePanel'),
  };

  const loadedManifest = chrome.runtime.getManifest?.() || {};
  async function load() {
    try {
      const stored = await chrome.storage.sync.get(['backendUrl']);
      els.backendUrl.value = stored.backendUrl || '';
    } catch (_) {
      els.backendUrl.value = '';
    }
  }

  async function save() {
    const url = els.backendUrl.value.trim();
    try {
      await chrome.storage.sync.set({
        backendUrl: url,
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
  els.openSidePanel.addEventListener('click', () => {
    chrome.runtime.sendMessage({ type: 'WEBBRIDGE_OPEN_SIDE_PANEL' })
      .then((result) => {
        if (!result?.ok) showSaveResult(result?.message || '无法打开触界侧栏', true);
      })
      .catch((error) => showSaveResult(error?.message || '无法打开触界侧栏', true));
  });

  load();
})();
