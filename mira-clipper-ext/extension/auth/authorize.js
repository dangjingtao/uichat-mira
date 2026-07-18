(function () {
  'use strict';

  const els = {
    code: document.getElementById('authorizationCode'),
    exchange: document.getElementById('exchangeCodeBtn'),
    status: document.getElementById('authStatus'),
  };

  function setStatus(message, kind) {
    els.status.textContent = message;
    els.status.className = `status ${kind || ''}`;
  }

  async function exchange() {
    const encodedCode = els.code.value.trim();
    if (!encodedCode) {
      setStatus('请先粘贴 Mira 授权码', 'error');
      return;
    }

    els.exchange.disabled = true;
    setStatus('正在验证授权码…', 'info');
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

      await chrome.storage.sync.set({ backendUrl: parsed.backendUrl });
      await chrome.storage.local.set({ accessToken: result.accessToken });
      chrome.runtime.sendMessage({ type: 'WEBBRIDGE_RECONNECT' }).catch(() => {});
      els.code.value = '';
      setStatus('授权成功，见行正在连接 Chrome。现在可以回到 Mira 点击“连接”。', 'success');
    } catch (error) {
      setStatus(error?.message || '授权失败，请从 Mira 重新生成授权码', 'error');
    } finally {
      els.exchange.disabled = false;
    }
  }

  chrome.runtime.onMessage.addListener((message) => {
    if (message?.type !== 'WEBBRIDGE_STATUS') return;
    if (message.status === 'connected') setStatus('授权成功，见行扩展已连接。', 'success');
    if (message.status === 'auth_required') setStatus('授权已失效，请重新输入 Mira 授权码。', 'error');
    if (message.status === 'error') setStatus(message.message || '见行连接失败，请检查 Native Messaging。', 'error');
  });

  els.exchange.addEventListener('click', () => void exchange());
  els.code.addEventListener('keydown', (event) => {
    if ((event.ctrlKey || event.metaKey) && event.key === 'Enter') void exchange();
  });
})();
