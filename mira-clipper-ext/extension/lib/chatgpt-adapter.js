/* ChatGPT webpage adapter backed by @kudoai/chatgpt.js. */
(function () {
  'use strict';

  const CHATGPT_HOSTS = new Set(['chatgpt.com', 'chat.openai.com']);
  const LIBRARY_TIMEOUT_MS = 15000;
  const SEND_CONFIRM_TIMEOUT_MS = 5000;
  const RESPONSE_TIMEOUT_MS = 110000;
  let libraryPromise = null;

  function error(code, message) {
    return Object.assign(new Error(message), { code });
  }

  function withTimeout(promise, timeoutMs, code, message) {
    let timer = null;
    return Promise.race([
      promise,
      new Promise((_, reject) => {
        timer = setTimeout(() => reject(error(code, message)), timeoutMs);
      }),
    ]).finally(() => {
      if (timer) clearTimeout(timer);
    });
  }

  function isChatGPTPage() {
    return CHATGPT_HOSTS.has(window.location.hostname);
  }

  function getConversationIdFromUrl() {
    const match = window.location.pathname.match(/^\/c\/([^/?#]+)/);
    return match ? decodeURIComponent(match[1]) : '';
  }

  async function getChatGPT() {
    if (!isChatGPTPage()) throw error('CHATGPT_PAGE_UNSUPPORTED', '当前标签页不是 ChatGPT 页面');
    if (window.chatgpt) return window.chatgpt;
    if (!libraryPromise) {
      libraryPromise = import(chrome.runtime.getURL('lib/chatgpt.min.js'))
        .then(() => window.chatgpt)
        .catch((cause) => {
          libraryPromise = null;
          throw error('CHATGPT_LIBRARY_UNAVAILABLE', `ChatGPT.js 加载失败：${cause?.message || '未知错误'}`);
        });
    }
    const chatgpt = await libraryPromise;
    if (!chatgpt) throw error('CHATGPT_LIBRARY_UNAVAILABLE', 'ChatGPT.js 未初始化');
    const loaded = await chatgpt.isLoaded(LIBRARY_TIMEOUT_MS);
    if (loaded === false) throw error('CHATGPT_PAGE_UNAVAILABLE', 'ChatGPT 页面加载超时');
    return chatgpt;
  }

  async function getActiveConversationId(chatgpt) {
    const urlId = getConversationIdFromUrl();
    try {
      const activeId = await chatgpt.getChatData('active', 'id');
      if (typeof activeId === 'string' && activeId) return activeId;
    } catch (_) {
      // URL remains the provider-specific fallback when page data is still settling.
    }
    return urlId;
  }

  async function detect() {
    if (!isChatGPTPage()) return { loggedIn: false, accountLabel: undefined };
    const chatgpt = await getChatGPT();
    const input = chatgpt.getChatBox?.() || chatgpt.getChatInput?.();
    const loginButton = chatgpt.getLoginButton?.();
    return {
      loggedIn: Boolean(input) && !loginButton,
      accountLabel: document.title || 'ChatGPT',
    };
  }

  async function bind() {
    const chatgpt = await getChatGPT();
    const detected = await detect();
    if (!detected.loggedIn) throw error('CHATGPT_LOGIN_REQUIRED', '请先在当前 ChatGPT 页面完成登录');
    const conversationId = await getActiveConversationId(chatgpt);
    if (!conversationId) throw error('CHATGPT_THREAD_UNAVAILABLE', '请先打开一个已有的 ChatGPT 对话线程');
    return {
      sessionRef: { kind: 'conversation_id', value: conversationId },
      accountLabel: detected.accountLabel,
    };
  }

  function getComposer(chatgpt) {
    return chatgpt.getChatBox?.()
      || document.querySelector('textarea[aria-label], textarea[data-testid="prompt-textarea"], [contenteditable="true"]');
  }

  function getSendButton(chatgpt) {
    return chatgpt.getSendButton?.()
      || document.querySelector('button[data-testid="send-button"]');
  }

  function setComposerValue(composer, message) {
    if (composer instanceof HTMLTextAreaElement || composer instanceof HTMLInputElement) {
      const prototype = Object.getPrototypeOf(composer);
      const valueSetter = Object.getOwnPropertyDescriptor(prototype, 'value')?.set;
      valueSetter?.call(composer, message);
      composer.dispatchEvent(new Event('input', { bubbles: true }));
      composer.dispatchEvent(new Event('change', { bubbles: true }));
      return;
    }
    composer.focus();
    composer.textContent = message;
    composer.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'insertText', data: message }));
  }

  async function waitForSendButton(chatgpt) {
    const deadline = Date.now() + SEND_CONFIRM_TIMEOUT_MS;
    while (Date.now() < deadline) {
      const button = getSendButton(chatgpt);
      if (button && button.isConnected && !button.disabled && !button.hasAttribute('disabled') && button.getAttribute('aria-disabled') !== 'true') {
        return button;
      }
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
    throw error('CHATGPT_SEND_UNAVAILABLE', 'ChatGPT 发送按钮不可用');
  }

  async function sendThroughCurrentComposer(chatgpt, message) {
    const composer = getComposer(chatgpt);
    if (!composer) throw error('CHATGPT_INPUT_UNAVAILABLE', 'ChatGPT 输入框不可用');
    setComposerValue(composer, message);
    const button = await waitForSendButton(chatgpt);
    button.click();

    const deadline = Date.now() + SEND_CONFIRM_TIMEOUT_MS;
    while (Date.now() < deadline) {
      const prompts = document.querySelectorAll('[data-message-author-role="user"]');
      const latestPrompt = prompts[prompts.length - 1]?.innerText?.trim() || '';
      const composerCleared = composer instanceof HTMLTextAreaElement || composer instanceof HTMLInputElement
        ? !composer.value.trim()
        : !(composer.textContent || '').trim();
      if (latestPrompt === message.trim() || composerCleared) return;
      await new Promise((resolve) => setTimeout(resolve, 150));
    }
    throw error('CHATGPT_SEND_FAILED', 'ChatGPT 未确认本次咨询已发送');
  }

  function normalizeReply(reply) {
    return typeof reply === 'string' && reply.trim() ? reply.trim() : '';
  }

  async function readLatestReply(chatgpt) {
    const reply = await chatgpt.getChatData('active', 'msg', 'chatgpt', 'latest');
    return normalizeReply(reply) || normalizeReply(await chatgpt.getLastResponse?.());
  }

  async function sendViaLibrary(chatgpt, message) {
    if (typeof chatgpt.askAndGetReply !== 'function') return null;

    const reply = await withTimeout(
      Promise.resolve().then(() => chatgpt.askAndGetReply(message)),
      RESPONSE_TIMEOUT_MS,
      'CHATGPT_RESPONSE_TIMEOUT',
      '等待 ChatGPT 回复完成超时',
    );
    const normalizedReply = normalizeReply(reply);
    if (!normalizedReply) throw error('CHATGPT_EMPTY_REPLY', 'ChatGPT 没有返回有效回复');
    return normalizedReply;
  }

  async function sendMessage(sessionRef, message) {
    const chatgpt = await getChatGPT();
    const currentId = await getActiveConversationId(chatgpt);
    if (!currentId || sessionRef?.kind !== 'conversation_id' || sessionRef.value !== currentId) {
      throw error('CHATGPT_THREAD_UNAVAILABLE', '当前标签页不是已绑定的 ChatGPT 对话线程');
    }
    if (!message.trim()) throw error('CHATGPT_MESSAGE_EMPTY', '咨询内容不能为空');

    const libraryReply = await sendViaLibrary(chatgpt, message);
    if (libraryReply !== null) return { reply: libraryReply, sessionRef };

    // Compatibility fallback for older chatgpt.js builds. Do not retry this path after
    // askAndGetReply() has started, because that could duplicate an already-sent prompt.
    await sendThroughCurrentComposer(chatgpt, message);
    const idle = await chatgpt.isIdle(RESPONSE_TIMEOUT_MS);
    if (idle === false) throw error('CHATGPT_RESPONSE_TIMEOUT', '等待 ChatGPT 回复完成超时');
    const normalizedReply = await readLatestReply(chatgpt);
    if (!normalizedReply) throw error('CHATGPT_EMPTY_REPLY', 'ChatGPT 没有返回有效回复');
    return { reply: normalizedReply, sessionRef };
  }

  window.MiraChatGPTAdapter = { detect, bind, sendMessage };
})();
