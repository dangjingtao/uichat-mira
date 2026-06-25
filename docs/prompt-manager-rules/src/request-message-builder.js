'use strict';

/**
 * Create a simple system message record.
 *
 * @param {string} content
 * @param {string} [id]
 * @returns {{id: string|undefined, role: string, content: string, kind: string}}
 */
function systemMessage(content, id) {
  return {
    id,
    role: 'system',
    content: String(content ?? ''),
    kind: 'prompt',
  };
}

/**
 * Create a normalized chat message.
 *
 * @param {string} role
 * @param {string} content
 * @param {string} [id]
 * @returns {{id: string|undefined, role: string, content: string, kind: string}}
 */
function chatMessage(role, content, id) {
  return {
    id,
    role,
    content: String(content ?? ''),
    kind: 'history',
  };
}

/**
 * Replace all supported template variables in a text block.
 *
 * This function intentionally performs multiple passes so that:
 * - `systemPrompt: "{{char}} must stay calm"` still resolves correctly
 * - nested substitutions can expand in a predictable way
 *
 * @param {string} text
 * @param {Record<string, string>} variables
 * @param {number} [maxPasses]
 * @returns {string}
 */
function renderTemplate(text, variables, maxPasses = 3) {
  let output = String(text ?? '');

  for (let pass = 0; pass < maxPasses; pass += 1) {
    const next = output.replace(/\{\{([a-zA-Z0-9_.-]+)\}\}/g, (match, key) => {
      if (!Object.prototype.hasOwnProperty.call(variables, key)) {
        return match;
      }
      return String(variables[key] ?? '');
    });

    if (next === output) {
      break;
    }

    output = next;
  }

  return output;
}

/**
 * Render the variable map used by all prompt blocks.
 *
 * Keeping this logic centralized makes it much easier to debug prompt drift.
 *
 * @param {object} state
 * @returns {Record<string, string>}
 */
function buildTemplateVariables(state) {
  return {
    user: String(state.userName ?? 'User'),
    char: String(state.character?.name ?? 'Assistant'),
    summary: String(state.summary ?? ''),
    world_info: state.worldInfoMatches.map(item => item.content).join('\n'),
    latest_user_input: String(state.latestUserInput ?? ''),
    systemPrompt: String(state.promptConfig?.systemPrompt ?? ''),
    postHistoryInstructions: String(state.promptConfig?.postHistoryInstructions ?? ''),
    ...(state.promptConfig?.variables ?? {}),
  };
}

/**
 * Decide whether a prompt block should be active for the current trigger type.
 *
 * @param {object} prompt
 * @param {string} triggerType
 * @returns {boolean}
 */
function shouldUsePrompt(prompt, triggerType) {
  if (prompt.enabled === false) {
    return false;
  }

  if (!Array.isArray(prompt.triggers) || prompt.triggers.length === 0) {
    return true;
  }

  return prompt.triggers.includes(triggerType);
}

/**
 * Convert character-card fields into stable global prompt blocks.
 *
 * These are the "identity skeleton" prompts. They should survive history trimming
 * for as long as possible.
 *
 * @param {object} state
 * @param {Record<string, string>} variables
 * @returns {Array<{id: string, role: string, content: string, kind: string}>}
 */
function buildGlobalPromptBlocks(state, variables) {
  const blocks = [];
  const character = state.character ?? {};
  const promptConfig = state.promptConfig ?? {};

  if (promptConfig.systemPrompt) {
    blocks.push(systemMessage(renderTemplate(promptConfig.systemPrompt, variables), 'system_prompt'));
  }

  if (character.description) {
    blocks.push(systemMessage(renderTemplate(character.description, variables), 'character_description'));
  }

  if (character.personality) {
    blocks.push(systemMessage(renderTemplate(character.personality, variables), 'character_personality'));
  }

  if (character.scenario) {
    blocks.push(systemMessage(renderTemplate(character.scenario, variables), 'scenario'));
  }

  if (state.summary) {
    blocks.push(systemMessage(renderTemplate(`Summary:\n{{summary}}`, variables), 'summary'));
  }

  for (const entry of state.worldInfoMatches ?? []) {
    blocks.push(systemMessage(renderTemplate(entry.content, variables), `world_info_${entry.id ?? blocks.length}`));
  }

  for (const entry of state.dynamicBlocks ?? []) {
    if (!shouldUsePrompt(entry, state.triggerType)) {
      continue;
    }

    if (entry.placement !== 'global') {
      continue;
    }

    blocks.push({
      id: entry.id ?? `dynamic_global_${blocks.length}`,
      role: entry.role ?? 'system',
      content: renderTemplate(entry.content, variables),
      kind: 'prompt',
    });
  }

  return blocks.filter(block => block.content.trim().length > 0);
}

/**
 * Normalize visible chat history and append the latest user input.
 *
 * This function is intentionally strict: only visible conversation messages should
 * enter this stage. Request-only prompts should not be mixed into the stored history.
 *
 * @param {object} state
 * @returns {Array<{id: string|undefined, role: string, content: string, kind: string}>}
 */
function buildVisibleHistory(state) {
  const visibleHistory = (state.history ?? []).map(message => chatMessage(
    message.role ?? 'user',
    message.content ?? '',
    message.id,
  ));

  if (state.latestUserInput) {
    visibleHistory.push(chatMessage('user', state.latestUserInput, state.latestUserMessageId));
  }

  return visibleHistory;
}

/**
 * Build in-chat prompt objects that can be inserted into visible history by depth.
 *
 * `depth = 0` means "closest to the end of the conversation".
 *
 * @param {object} state
 * @param {Record<string, string>} variables
 * @returns {Array<{id: string, role: string, content: string, depth: number, order: number, kind: string}>}
 */
function buildInChatPrompts(state, variables) {
  const prompts = [];
  const promptConfig = state.promptConfig ?? {};

  if (promptConfig.postHistoryInstructions) {
    prompts.push({
      id: 'post_history_instructions',
      role: 'system',
      content: renderTemplate(promptConfig.postHistoryInstructions, variables),
      depth: 0,
      order: 1000,
      kind: 'injection',
    });
  }

  for (const entry of promptConfig.inChatPrompts ?? []) {
    if (!shouldUsePrompt(entry, state.triggerType)) {
      continue;
    }

    prompts.push({
      id: entry.id ?? `in_chat_${prompts.length}`,
      role: entry.role ?? 'system',
      content: renderTemplate(entry.content, variables),
      depth: Number.isFinite(entry.depth) ? entry.depth : 0,
      order: Number.isFinite(entry.order) ? entry.order : 100,
      kind: 'injection',
    });
  }

  for (const entry of state.dynamicBlocks ?? []) {
    if (!shouldUsePrompt(entry, state.triggerType)) {
      continue;
    }

    if (entry.placement !== 'in_chat') {
      continue;
    }

    prompts.push({
      id: entry.id ?? `dynamic_in_chat_${prompts.length}`,
      role: entry.role ?? 'system',
      content: renderTemplate(entry.content, variables),
      depth: Number.isFinite(entry.depth) ? entry.depth : 0,
      order: Number.isFinite(entry.order) ? entry.order : 100,
      kind: 'injection',
    });
  }

  return prompts.filter(prompt => prompt.content.trim().length > 0);
}

/**
 * Insert in-chat prompts into visible history.
 *
 * The algorithm mirrors the common "depth from tail" prompt strategy:
 * - depth 0: insert nearest the current turn
 * - depth 1: insert one step farther away
 * - deeper values: push the injected prompt farther into older history
 *
 * @param {Array<{role: string, content: string, id?: string, kind: string}>} history
 * @param {Array<{role: string, content: string, id: string, depth: number, order: number, kind: string}>} prompts
 * @returns {Array<{role: string, content: string, id?: string, kind: string}>}
 */
function injectInChatPrompts(history, prompts) {
  const reversedHistory = [...history].reverse();
  let totalInserted = 0;

  const maxDepth = prompts.reduce((max, prompt) => Math.max(max, prompt.depth), 0);

  for (let depth = 0; depth <= maxDepth; depth += 1) {
    const depthPrompts = prompts
      .filter(prompt => prompt.depth === depth)
      .sort((left, right) => right.order - left.order);

    if (depthPrompts.length === 0) {
      continue;
    }

    const insertIndex = Math.min(depth + totalInserted, reversedHistory.length);
    reversedHistory.splice(insertIndex, 0, ...depthPrompts);
    totalInserted += depthPrompts.length;
  }

  return reversedHistory.reverse();
}

/**
 * Estimate token usage with a cheap heuristic.
 *
 * Replace this with a provider tokenizer when you integrate the module for real.
 *
 * @param {string} text
 * @returns {number}
 */
function estimateTokens(text) {
  return Math.ceil(String(text ?? '').length / 4);
}

/**
 * Trim request messages so that identity prompts stay in place as long as possible.
 *
 * The trimming policy is intentionally conservative:
 * - keep all global prompt blocks
 * - keep the latest user message
 * - remove older non-system history first
 *
 * @param {Array<{role: string, content: string, kind: string}>} messages
 * @param {number} tokenBudget
 * @returns {Array<{role: string, content: string, kind: string}>}
 */
function trimToBudget(messages, tokenBudget) {
  const result = [...messages];

  const currentTokens = () => result.reduce((sum, message) => sum + estimateTokens(message.content), 0);

  while (currentTokens() > tokenBudget) {
    const removableIndex = result.findIndex(message => {
      return message.kind === 'history' && message.role !== 'system';
    });

    if (removableIndex === -1) {
      break;
    }

    result.splice(removableIndex, 1);
  }

  return result;
}

/**
 * Convert normalized messages into a provider-neutral payload.
 *
 * You can replace this with your own protocol adapter later without touching
 * prompt assembly rules.
 *
 * @param {Array<{role: string, content: string, kind: string, id?: string}>} messages
 * @param {object} state
 * @returns {{conversationId: string|undefined, messages: Array<{role: string, content: string}>}}
 */
function buildProviderPayload(messages, state) {
  return {
    conversationId: state.conversationId,
    messages: messages.map(message => ({
      role: message.role,
      content: message.content,
    })),
  };
}

/**
 * Load a normalized conversation state object.
 *
 * This is intentionally repository-driven. Each dependency can be replaced with
 * a real database adapter in your own system.
 *
 * @param {object} deps
 * @param {object} input
 * @returns {Promise<object>}
 */
async function loadConversationState(deps, input) {
  const conversation = await deps.conversationRepo.getById(input.conversationId);
  const character = await deps.characterRepo.getById(conversation.characterId);
  const history = await deps.messageRepo.listVisibleMessages(input.conversationId);
  const summary = await deps.summaryRepo.getLatestSummary(input.conversationId);

  const worldInfoMatches = await deps.worldInfoRepo.match({
    characterId: character.id,
    latestUserInput: input.latestUserInput,
    history,
    summary,
  });

  const dynamicBlocks = await deps.promptRepo.listDynamicBlocks({
    conversationId: input.conversationId,
    characterId: character.id,
    triggerType: input.triggerType ?? 'normal',
  });

  return {
    conversationId: input.conversationId,
    triggerType: input.triggerType ?? 'normal',
    latestUserInput: input.latestUserInput,
    latestUserMessageId: input.latestUserMessageId,
    tokenBudget: input.tokenBudget ?? 16000,
    userName: input.userName ?? conversation.userName ?? 'User',
    character,
    history,
    summary,
    worldInfoMatches,
    dynamicBlocks,
    promptConfig: input.promptConfig ?? {},
  };
}

/**
 * Build request messages from normalized state.
 *
 * This function is the core of the module:
 * - it reads state
 * - it renders variables
 * - it assembles global prompts
 * - it injects in-chat prompts
 * - it trims to budget
 * - it produces the final provider-neutral payload
 *
 * @param {object} state
 * @returns {{messages: Array<object>, rawPrompt: string, payload: object}}
 */
function buildRequestMessages(state) {
  const variables = buildTemplateVariables(state);
  const globalPrompts = buildGlobalPromptBlocks(state, variables);
  const history = buildVisibleHistory(state);
  const inChatPrompts = buildInChatPrompts(state, variables);
  const injectedHistory = injectInChatPrompts(history, inChatPrompts);
  const finalMessages = trimToBudget([...globalPrompts, ...injectedHistory], state.tokenBudget);

  return {
    messages: finalMessages,
    rawPrompt: finalMessages.map(message => `${message.role}: ${message.content}`).join('\n'),
    payload: buildProviderPayload(finalMessages, state),
  };
}

module.exports = {
  buildRequestMessages,
  loadConversationState,
  buildTemplateVariables,
  buildGlobalPromptBlocks,
  buildVisibleHistory,
  buildInChatPrompts,
  injectInChatPrompts,
  trimToBudget,
  renderTemplate,
};

