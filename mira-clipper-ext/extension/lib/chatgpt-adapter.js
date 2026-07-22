/* ChatGPT webpage adapter backed by @kudoai/chatgpt.js. */
(function () {
  'use strict';

  const CHATGPT_HOSTS = new Set(['chatgpt.com', 'chat.openai.com']);
  const LIBRARY_TIMEOUT_MS = 15000;
  const SEND_CONFIRM_TIMEOUT_MS = 8000;
  const RESPONSE_TIMEOUT_MS = 110000;
  let libraryPromise = null;

  function error(code, message) {
    return Object.assign(new Error(message), { code });
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

  async function getActiveConversationId() {
    // The URL is the only reliable identity for the conversation actually shown
    // in this tab. History APIs can resolve a different item on the blank route.
    return getConversationIdFromUrl();
  }

  function getComposer(chatgpt) {
    return document.querySelector('#prompt-textarea')
      || document.querySelector('textarea[data-testid="prompt-textarea"]')
      || document.querySelector('[contenteditable="true"][data-testid="prompt-textarea"]')
      || chatgpt.getChatBox?.()
      || document.querySelector('textarea[aria-label], [contenteditable="true"]');
  }

  async function waitForNewChatReady(chatgpt) {
    const deadline = Date.now() + LIBRARY_TIMEOUT_MS;
    while (Date.now() < deadline) {
      if (!getConversationIdFromUrl() && getComposer(chatgpt)) return;
      await new Promise((resolve) => setTimeout(resolve, 150));
    }
    throw error('CHATGPT_NEW_THREAD_UNAVAILABLE', 'ChatGPT 新对话页面尚未就绪');
  }

  async function detect() {
    if (!isChatGPTPage()) return { loggedIn: false, accountLabel: undefined };
    const chatgpt = await getChatGPT();
    const input = getComposer(chatgpt);
    const loginButton = chatgpt.getLoginButton?.();
    return {
      loggedIn: Boolean(input) && !loginButton,
      accountLabel: document.title || 'ChatGPT',
    };
  }

  async function connect() {
    const chatgpt = await getChatGPT();
    const detected = await detect();
    if (!detected.loggedIn) throw error('CHATGPT_LOGIN_REQUIRED', '请先在当前 ChatGPT 页面完成登录');
    if (typeof chatgpt.startNewChat !== 'function') throw error('CHATGPT_NEW_THREAD_UNAVAILABLE', '当前 ChatGPT.js 不支持新建对话');
    await chatgpt.startNewChat();
    await waitForNewChatReady(chatgpt);
    return {
      sessionRef: { kind: 'provider_state', value: window.location.href || 'new-chat' },
      accountLabel: detected.accountLabel,
    };
  }

  function normalizeText(value) {
    return String(value || '').replace(/\u00a0/g, ' ').replace(/\r\n/g, '\n').trim();
  }

  function readComposerValue(composer) {
    if (composer instanceof HTMLTextAreaElement || composer instanceof HTMLInputElement) {
      return composer.value || '';
    }
    return composer.innerText || composer.textContent || '';
  }

  function isVisibleElement(element) {
    if (!(element instanceof Element) || !element.isConnected) return false;
    const style = getComputedStyle(element);
    if (style.display === 'none' || style.visibility === 'hidden' || style.pointerEvents === 'none') return false;
    const rect = element.getBoundingClientRect();
    return rect.width > 0 && rect.height > 0;
  }

  function findSendButton(chatgpt, composer) {
    const form = composer?.closest?.('form');
    const candidates = [
      form?.querySelector?.('button[data-testid="send-button"]'),
      document.querySelector('button[data-testid="send-button"]'),
      chatgpt.getSendButton?.(),
    ];
    return candidates.find((button) => button instanceof HTMLButtonElement && isVisibleElement(button)) || null;
  }

  async function setComposerValue(composer, message) {
    composer.focus?.();

    if (composer instanceof HTMLTextAreaElement || composer instanceof HTMLInputElement) {
      const prototype = composer instanceof HTMLTextAreaElement
        ? HTMLTextAreaElement.prototype
        : HTMLInputElement.prototype;
      const valueSetter = Object.getOwnPropertyDescriptor(prototype, 'value')?.set;
      if (valueSetter) valueSetter.call(composer, message);
      else composer.value = message;
      composer.dispatchEvent(new InputEvent('input', {
        bubbles: true,
        composed: true,
        inputType: 'insertText',
        data: message,
      }));
      composer.dispatchEvent(new Event('change', { bubbles: true }));
    } else if (composer instanceof HTMLElement && composer.isContentEditable) {
      const selection = window.getSelection();
      const range = document.createRange();
      range.selectNodeContents(composer);
      selection?.removeAllRanges();
      selection?.addRange(range);

      let inserted = false;
      try {
        inserted = document.execCommand('insertText', false, message) === true;
      } catch (_) {
        inserted = false;
      }

      if (!inserted || normalizeText(readComposerValue(composer)) !== normalizeText(message)) {
        composer.replaceChildren(document.createTextNode(message));
        composer.dispatchEvent(new InputEvent('input', {
          bubbles: true,
          composed: true,
          inputType: 'insertText',
          data: message,
        }));
      }
    } else {
      throw error('CHATGPT_INPUT_UNAVAILABLE', 'ChatGPT 输入框类型不可用');
    }

    await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
  }

  async function waitForComposerReady(chatgpt, composer, message) {
    const expected = normalizeText(message);
    const deadline = Date.now() + SEND_CONFIRM_TIMEOUT_MS;
    while (Date.now() < deadline) {
      const actual = normalizeText(readComposerValue(composer));
      const button = findSendButton(chatgpt, composer);
      if (
        actual === expected
        && button
        && !button.disabled
        && !button.hasAttribute('disabled')
        && button.getAttribute('aria-disabled') !== 'true'
      ) {
        return button;
      }
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
    throw error('CHATGPT_SEND_UNAVAILABLE', 'ChatGPT 输入状态未就绪或发送按钮不可用');
  }

  function sentPromptCount() {
    return document.querySelectorAll('[data-message-author-role="user"]').length;
  }

  async function waitForSendConfirmation(composer, message, promptCountBefore) {
    const expected = normalizeText(message);
    const deadline = Date.now() + SEND_CONFIRM_TIMEOUT_MS;
    while (Date.now() < deadline) {
      const prompts = document.querySelectorAll('[data-message-author-role="user"]');
      const latestPrompt = normalizeText(prompts[prompts.length - 1]?.innerText || '');
      if (prompts.length > promptCountBefore && latestPrompt === expected) return true;

      const composerCleared = !normalizeText(readComposerValue(composer));
      if (composerCleared && getConversationIdFromUrl()) return true;
      await new Promise((resolve) => setTimeout(resolve, 120));
    }
    return false;
  }

  async function sendThroughCurrentComposer(chatgpt, message) {
    const composer = getComposer(chatgpt);
    if (!composer) throw error('CHATGPT_INPUT_UNAVAILABLE', 'ChatGPT 输入框不可用');

    const promptCountBefore = sentPromptCount();
    await setComposerValue(composer, message);
    let button = await waitForComposerReady(chatgpt, composer, message);
    button.click();

    if (await waitForSendConfirmation(composer, message, promptCountBefore)) return;

    // A click that leaves the exact prompt untouched did not submit. Retry once
    // through the current form submit path, but never retry after the composer clears.
    if (normalizeText(readComposerValue(composer)) === normalizeText(message)) {
      button = findSendButton(chatgpt, composer);
      const form = composer.closest?.('form');
      if (button && form instanceof HTMLFormElement && typeof form.requestSubmit === 'function') {
        form.requestSubmit(button);
        if (await waitForSendConfirmation(composer, message, promptCountBefore)) return;
      }
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

  async function sendMessage(sessionRef, message) {
    const chatgpt = await getChatGPT();
    const currentId = await getActiveConversationId();
    const isNewConversation = !sessionRef || sessionRef.kind === 'provider_state';
    if (isNewConversation && currentId) throw error('CHATGPT_THREAD_UNAVAILABLE', '新专家连接未处于空白 ChatGPT 对话');
    if (!isNewConversation && (!currentId || sessionRef.kind !== 'conversation_id' || sessionRef.value !== currentId)) {
      throw error('CHATGPT_THREAD_UNAVAILABLE', '当前标签页不是已绑定的 ChatGPT 对话线程');
    }
    if (!message.trim()) throw error('CHATGPT_MESSAGE_EMPTY', '咨询内容不能为空');
    await chatgpt.isIdle(LIBRARY_TIMEOUT_MS);

    await sendThroughCurrentComposer(chatgpt, message);
    const idle = await chatgpt.isIdle(RESPONSE_TIMEOUT_MS);
    if (idle === false) throw error('CHATGPT_RESPONSE_TIMEOUT', '等待 ChatGPT 回复完成超时');
    const updatedConversationId = await getActiveConversationId();
    const updatedSessionRef = updatedConversationId
      ? { kind: 'conversation_id', value: updatedConversationId }
      : sessionRef;
    const normalizedReply = await readLatestReply(chatgpt);
    if (!normalizedReply) throw error('CHATGPT_EMPTY_REPLY', 'ChatGPT 没有返回有效回复');
    return { reply: normalizedReply, sessionRef: updatedSessionRef };
  }

  window.MiraChatGPTAdapter = { detect, connect, sendMessage };
})();