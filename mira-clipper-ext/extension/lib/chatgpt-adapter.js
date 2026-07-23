/* ChatGPT webpage adapter backed by @kudoai/chatgpt.js. */
(function () {
  'use strict';

  const CHATGPT_HOSTS = new Set(['chatgpt.com', 'chat.openai.com']);
  const LIBRARY_TIMEOUT_MS = 15000;
  const SEND_CONFIRM_TIMEOUT_MS = 8000;
  const COMPOSER_SETTLE_MS = 350;
  const RESPONSE_TIMEOUT_MS = 110000;
  let libraryPromise = null;

  function error(code, message, diagnostics) {
    const detail = diagnostics ? ` [${diagnostics}]` : '';
    return Object.assign(new Error(`${message}${detail}`), { code, diagnostics });
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

  function composerType(composer) {
    if (composer instanceof HTMLTextAreaElement) return 'textarea';
    if (composer instanceof HTMLInputElement) return 'input';
    if (composer instanceof HTMLElement && composer.isContentEditable) {
      return composer.getAttribute('contenteditable') === 'plaintext-only' ? 'plaintext-contenteditable' : 'contenteditable';
    }
    return composer?.tagName?.toLowerCase() || 'unknown';
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

  function isUsableSendButton(button) {
    return button instanceof HTMLButtonElement
      && isVisibleElement(button)
      && !button.disabled
      && !button.hasAttribute('disabled')
      && button.getAttribute('aria-disabled') !== 'true';
  }

  function buttonBelongsToComposer(button, composer) {
    if (!button || !composer) return false;
    const form = composer.closest?.('form');
    if (form) return button.form === form || form.contains(button);

    let scope = composer;
    for (let level = 0; scope && level < 6; level += 1, scope = scope.parentElement) {
      if (scope.contains(button)) return true;
    }
    return false;
  }

  function findSendButtonCandidate(chatgpt, composer) {
    const form = composer?.closest?.('form');
    const formButtons = form
      ? Array.from(form.querySelectorAll('button[data-testid="send-button"]'))
      : [];
    const libraryButton = chatgpt.getSendButton?.();
    const candidates = [...formButtons, libraryButton];
    return candidates.find((button) => button instanceof HTMLButtonElement && buttonBelongsToComposer(button, composer)) || null;
  }

  function findSendButton(chatgpt, composer) {
    const button = findSendButtonCandidate(chatgpt, composer);
    return isUsableSendButton(button) ? button : null;
  }

  function readGeneratingState(chatgpt) {
    const stopButton = chatgpt.getStopButton?.()
      || document.querySelector('button[data-testid="stop-button"]');
    return Boolean(stopButton && isVisibleElement(stopButton));
  }

  function describeSendState({ composer, button, promptCountBefore, promptCountAfter, conversationIdBefore, conversationIdAfter, chatgpt, message }) {
    const composerText = normalizeText(readComposerValue(composer));
    const expectedText = normalizeText(message || '');
    const state = [
      `composerType=${composerType(composer)}`,
      `composerConnected=${Boolean(composer?.isConnected)}`,
      `composerTextMatches=${expectedText ? composerText === expectedText : 'unknown'}`,
      `composerEmpty=${!composerText}`,
      `sendButton=${Boolean(button)}`,
      `sendButtonDisabled=${button ? Boolean(button.disabled || button.hasAttribute('disabled')) : 'unknown'}`,
      `sendButtonAriaDisabled=${button?.getAttribute?.('aria-disabled') || 'unknown'}`,
      `userMessages=${promptCountBefore}->${promptCountAfter}`,
      `conversation=${conversationIdBefore || 'none'}->${conversationIdAfter || 'none'}`,
      `generating=${readGeneratingState(chatgpt)}`,
      `visibility=${document.visibilityState}`,
      `documentHasFocus=${document.hasFocus()}`,
    ];
    const detail = state.join(',');
    console.warn(`[MiraChatGPTAdapter] ${detail}`);
    return detail;
  }

  async function setComposerValue(composer, message) {
    if (!composer?.isConnected || !isVisibleElement(composer)) {
      throw error('INPUT_NOT_ACCEPTED', 'ChatGPT 输入框不可用', `composerType=${composerType(composer)},composerConnected=${Boolean(composer?.isConnected)}`);
    }
    composer.focus();

    if (composer instanceof HTMLTextAreaElement || composer instanceof HTMLInputElement) {
      const prototype = composer instanceof HTMLTextAreaElement
        ? HTMLTextAreaElement.prototype
        : HTMLInputElement.prototype;
      const valueSetter = Object.getOwnPropertyDescriptor(prototype, 'value')?.set;
      const beforeInput = new InputEvent('beforeinput', {
        bubbles: true,
        cancelable: true,
        composed: true,
        inputType: 'insertText',
        data: message,
      });
      if (!composer.dispatchEvent(beforeInput)) {
        throw error('INPUT_NOT_ACCEPTED', 'ChatGPT 编辑器拒绝了输入', `composerType=${composerType(composer)}`);
      }
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

      const beforeInput = new InputEvent('beforeinput', {
        bubbles: true,
        cancelable: true,
        composed: true,
        inputType: 'insertText',
        data: message,
      });
      if (!composer.dispatchEvent(beforeInput)) {
        throw error('INPUT_NOT_ACCEPTED', 'ChatGPT 编辑器拒绝了输入', `composerType=${composerType(composer)}`);
      }

      try {
        document.execCommand('insertText', false, message);
      } catch (cause) {
        throw error('INPUT_NOT_ACCEPTED', `ChatGPT 原生编辑输入失败：${cause?.message || '未知错误'}`, `composerType=${composerType(composer)}`);
      }

      if (normalizeText(readComposerValue(composer)) !== normalizeText(message)) {
        throw error('INPUT_NOT_ACCEPTED', 'ChatGPT 编辑器没有接受输入', `composerType=${composerType(composer)},composerTextMatches=false`);
      }
    } else {
      throw error('INPUT_NOT_ACCEPTED', 'ChatGPT 输入框类型不可用', `composerType=${composerType(composer)}`);
    }

    // Background tabs pause animation frames; waitForComposerReady provides timer-based settling.
  }

  async function waitForComposerReady(chatgpt, composer, message) {
    const expected = normalizeText(message);
    const deadline = Date.now() + SEND_CONFIRM_TIMEOUT_MS;
    let stableSince = 0;
    let stableButton = null;
    while (Date.now() < deadline) {
      const actual = normalizeText(readComposerValue(composer));
      const button = findSendButton(chatgpt, composer);
      if (actual !== expected) {
        stableSince = 0;
        stableButton = null;
        await new Promise((resolve) => setTimeout(resolve, 100));
        continue;
      }
      if (button) {
        if (stableButton !== button) {
          stableButton = button;
          stableSince = Date.now();
        } else if (Date.now() - stableSince >= COMPOSER_SETTLE_MS) {
          return button;
        }
      } else {
        stableSince = 0;
        stableButton = null;
      }
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
    const button = findSendButtonCandidate(chatgpt, composer);
    const diagnostics = describeSendState({
      composer,
      button,
      promptCountBefore: sentPromptCount(),
      promptCountAfter: sentPromptCount(),
      conversationIdBefore: getConversationIdFromUrl(),
      conversationIdAfter: getConversationIdFromUrl(),
      chatgpt,
      message,
    });
    if (!button) throw error('SEND_BUTTON_NOT_READY', 'ChatGPT 当前输入框的发送按钮不可用', diagnostics);
    throw error('INPUT_NOT_ACCEPTED', 'ChatGPT 编辑器没有确认输入已接受', diagnostics);
  }

  function sentPromptCount() {
    return document.querySelectorAll('[data-message-author-role="user"]').length;
  }

  function assistantMessageElements() {
    return Array.from(document.querySelectorAll('[data-message-author-role="assistant"]'));
  }

  function latestAssistantDomText() {
    const messages = assistantMessageElements();
    return normalizeText(messages[messages.length - 1]?.innerText || '');
  }

  function responseDiagnostics({ assistantCountBefore, assistantCountAfter, conversationIdBefore, conversationIdAfter, chatgpt }) {
    const detail = [
      `assistantMessages=${assistantCountBefore}->${assistantCountAfter}`,
      `assistantTextLength=${latestAssistantDomText().length}`,
      `conversation=${conversationIdBefore || 'none'}->${conversationIdAfter || 'none'}`,
      `generating=${readGeneratingState(chatgpt)}`,
    ].join(',');
    console.warn(`[MiraChatGPTAdapter] ${detail}`);
    return detail;
  }

  async function waitForResponseCompletion(chatgpt, assistantCountBefore, assistantTextBefore, conversationIdBefore) {
    const deadline = Date.now() + RESPONSE_TIMEOUT_MS;
    let previousText = '';
    let stableSince = 0;

    while (Date.now() < deadline) {
      const assistantCountAfter = assistantMessageElements().length;
      const latestText = latestAssistantDomText();
      const generating = readGeneratingState(chatgpt);
      const hasNewAssistant = assistantCountAfter > assistantCountBefore
        || (Boolean(latestText) && latestText !== assistantTextBefore);

      if (hasNewAssistant && latestText) {
        if (latestText !== previousText) {
          previousText = latestText;
          stableSince = Date.now();
        } else if (!generating && Date.now() - stableSince >= 700) {
          return latestText;
        }
      }

      await new Promise((resolve) => setTimeout(resolve, 150));
    }

    throw error(
      'RESPONSE_TIMEOUT',
      '等待 ChatGPT 回复完成超时',
      responseDiagnostics({
        assistantCountBefore,
        assistantCountAfter: assistantMessageElements().length,
        conversationIdBefore,
        conversationIdAfter: getConversationIdFromUrl(),
        chatgpt,
      }),
    );
  }

  async function waitForSendConfirmation(chatgpt, composer, message, promptCountBefore, conversationIdBefore) {
    const expected = normalizeText(message);
    const deadline = Date.now() + SEND_CONFIRM_TIMEOUT_MS;
    while (Date.now() < deadline) {
      const prompts = document.querySelectorAll('[data-message-author-role="user"]');
      const latestPrompt = normalizeText(prompts[prompts.length - 1]?.innerText || '');
      const conversationIdAfter = getConversationIdFromUrl();
      if (prompts.length > promptCountBefore && latestPrompt === expected) return { confirmed: true };

      const composerCleared = !normalizeText(readComposerValue(composer));
      const generating = readGeneratingState(chatgpt);
      if (composerCleared && (prompts.length > promptCountBefore || conversationIdAfter !== conversationIdBefore || generating)) {
        return { confirmed: true };
      }
      await new Promise((resolve) => setTimeout(resolve, 120));
    }
    return {
      confirmed: false,
      diagnostics: describeSendState({
        composer,
        button: findSendButtonCandidate(chatgpt, composer),
        promptCountBefore,
        promptCountAfter: sentPromptCount(),
        conversationIdBefore,
        conversationIdAfter: getConversationIdFromUrl(),
        chatgpt,
        message,
      }),
    };
  }

  async function sendThroughCurrentComposer(chatgpt, message) {
    const composer = getComposer(chatgpt);
    if (!composer) throw error('INPUT_NOT_ACCEPTED', 'ChatGPT 输入框不可用', 'composerType=unknown,composerConnected=false');

    const promptCountBefore = sentPromptCount();
    const conversationIdBefore = getConversationIdFromUrl();
    await setComposerValue(composer, message);
    let button = await waitForComposerReady(chatgpt, composer, message);
    try {
      button.click();
    } catch (cause) {
      const diagnostics = describeSendState({
        composer,
        button,
        promptCountBefore,
        promptCountAfter: sentPromptCount(),
        conversationIdBefore,
        conversationIdAfter: getConversationIdFromUrl(),
        chatgpt,
        message,
      });
      throw error('SEND_TRIGGER_FAILED', `ChatGPT 发送按钮触发失败：${cause?.message || '未知错误'}`, diagnostics);
    }

    const firstAttempt = await waitForSendConfirmation(chatgpt, composer, message, promptCountBefore, conversationIdBefore);
    if (firstAttempt.confirmed) return;

    // A click that leaves the exact prompt untouched did not submit. Retry once
    // through the current form submit path, but never retry after the composer clears.
    const noEvidenceOfSend = sentPromptCount() === promptCountBefore
      && getConversationIdFromUrl() === conversationIdBefore
      && normalizeText(readComposerValue(composer)) === normalizeText(message)
      && !readGeneratingState(chatgpt);
    if (noEvidenceOfSend) {
      button = findSendButton(chatgpt, composer);
      const form = composer.closest?.('form');
      const fallbackSubmit = () => {
        composer.focus();
        form.requestSubmit(button);
      };
      if (button && form instanceof HTMLFormElement && typeof form.requestSubmit === 'function') {
        try {
          fallbackSubmit();
        } catch (cause) {
          const diagnostics = describeSendState({
            composer,
            button,
            promptCountBefore,
            promptCountAfter: sentPromptCount(),
            conversationIdBefore,
            conversationIdAfter: getConversationIdFromUrl(),
            chatgpt,
            message,
          });
          throw error('SEND_TRIGGER_FAILED', `ChatGPT 备用发送失败：${cause?.message || '未知错误'}`, diagnostics);
        }
        const retry = await waitForSendConfirmation(chatgpt, composer, message, promptCountBefore, conversationIdBefore);
        if (retry.confirmed) return;
        throw error('SEND_NOT_CONFIRMED', 'ChatGPT 未确认本轮咨询已发送', retry.diagnostics);
      }
    }

    throw error('SEND_NOT_CONFIRMED', 'ChatGPT 未确认本轮咨询已发送', firstAttempt.diagnostics);
  }

  function normalizeReply(reply) {
    return typeof reply === 'string' && reply.trim() ? reply.trim() : '';
  }

  async function readLatestReply(chatgpt) {
    let reply = '';
    try {
      reply = normalizeReply(
        await chatgpt.response?.getFromDOM?.('last')
          || await chatgpt.getResponseFromDOM?.('last'),
      );
    } catch (cause) {
      console.warn(`[MiraChatGPTAdapter] ChatGPT.js DOM response read failed: ${cause?.message || 'unknown'}`);
    }
    if (reply) return reply;
    try {
      reply = normalizeReply(await chatgpt.getChatData('active', 'msg', 'chatgpt', 'latest'));
    } catch (cause) {
      console.warn(`[MiraChatGPTAdapter] ChatGPT.js getChatData failed: ${cause?.message || 'unknown'}`);
    }
    if (!reply) {
      try {
        reply = normalizeReply(await chatgpt.getLastResponse?.());
      } catch (cause) {
        console.warn(`[MiraChatGPTAdapter] ChatGPT.js getLastResponse failed: ${cause?.message || 'unknown'}`);
      }
    }
    return reply || latestAssistantDomText();
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
    const assistantCountBefore = assistantMessageElements().length;
    const assistantTextBefore = latestAssistantDomText();
    const conversationIdBefore = getConversationIdFromUrl();
    await sendThroughCurrentComposer(chatgpt, message);
    await waitForResponseCompletion(chatgpt, assistantCountBefore, assistantTextBefore, conversationIdBefore);
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
