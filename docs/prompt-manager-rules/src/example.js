'use strict';

const {
  buildRequestMessages,
} = require('./request-message-builder');

/**
 * Build a small beginner-friendly example that shows how the rules work.
 *
 * @returns {object}
 */
function createExampleState() {
  return {
    conversationId: 'chat-001',
    triggerType: 'normal',
    latestUserInput: 'I really am not here to cause trouble.',
    tokenBudget: 4000,
    userName: 'Tom',
    character: {
      name: 'Aileen',
      description: 'Aileen is an intelligence liaison in a border city.',
      personality: 'She speaks briefly, stays guarded, and observes before responding.',
      scenario: '{{user}} arrives at an inn on a rainy night. {{char}} is checking whether {{user}} is safe to trust.',
    },
    history: [
      { id: 'm1', role: 'user', content: 'I need a room for the night.' },
      { id: 'm2', role: 'assistant', content: 'Rooms are easy. Explanations are harder.' },
    ],
    summary: 'Aileen is suspicious of Tom but has not rejected him yet.',
    worldInfoMatches: [
      { id: 'wi_1', content: 'The city guard is searching for a smuggler near the border inns.' },
    ],
    dynamicBlocks: [
      {
        id: 'author_note',
        placement: 'in_chat',
        role: 'system',
        depth: 1,
        order: 200,
        content: '{{char}} should stay tense and should not trust {{user}} too quickly.',
        triggers: ['normal', 'regenerate'],
      },
    ],
    promptConfig: {
      systemPrompt: 'Stay in character. Do not narrate actions for {{user}}.',
      postHistoryInstructions: '{{char}} should answer the latest user message directly.',
      variables: {},
      inChatPrompts: [
        {
          id: 'safety_rule',
          role: 'system',
          depth: 0,
          order: 1000,
          content: 'Keep the reply grounded in the current inn scene.',
        },
      ],
    },
  };
}

/**
 * Run the example and print both the normalized messages and the provider payload.
 */
function main() {
  const state = createExampleState();
  const result = buildRequestMessages(state);

  console.log('=== Normalized Messages ===');
  console.dir(result.messages, { depth: null });

  console.log('\n=== Provider Payload ===');
  console.dir(result.payload, { depth: null });

  console.log('\n=== Raw Prompt ===');
  console.log(result.rawPrompt);
}

main();

