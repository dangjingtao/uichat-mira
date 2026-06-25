# Prompt Manager Rules

This directory contains a backend-oriented reference implementation of a prompt manager inspired by SillyTavern's prompt assembly flow.

## Goals

- Keep visible chat messages separate from invisible request-only prompts.
- Rebuild request messages on every generation.
- Support long conversations without relying on a dedicated memory subsystem.
- Keep the logic deterministic and easy to debug.

## Core Rules

### 1. Separate visible messages from request-only prompts

We keep two different data flows:

- `conversation messages`: user-visible chat history
- `request messages`: transient prompt payload assembled before every model call

Request-only prompts include:

- system prompt
- character description
- character personality
- scenario
- world info matches
- author notes
- post-history instructions
- in-chat depth prompts

These should not be stored as normal visible chat messages.

### 2. Rebuild on every request

Every generation request should rebuild the full request payload from current state:

- current chat history
- latest user input
- current character card
- current prompt settings
- current world info matches
- current dynamic prompt values

Do not cache a final request message list across turns.

### 3. Treat prompt assembly as a pure function

`buildRequestMessages(state)` should:

- read a normalized state object
- return an ordered message list
- avoid writing to storage
- avoid mutating external state

Write-side effects belong in a separate post-generation step.

### 4. Use layered prompt placement

Prompt placement should be split into:

- `global prompts`: always placed before chat history
- `in-chat prompts`: inserted into chat history by depth
- `tail prompts`: placed near the end to reinforce behavior during long chats

This helps keep role consistency stronger over long dialogues.

### 5. Support generation-specific triggers

Prompts may apply only to certain generation types:

- `normal`
- `continue`
- `regenerate`
- `impersonate`
- `quiet`

This keeps special workflows from reusing unsuitable prompt fragments.

### 6. Prefer trimming old history before trimming identity

When context is too long:

1. keep global identity prompts
2. keep recent history
3. keep latest user message
4. trim older non-critical history first

If your system drops identity prompts too early, long chats will drift faster.

### 7. Make dynamic prompt rendering explicit

Dynamic prompt rendering should happen by replacing named variables:

- `{{user}}`
- `{{char}}`
- `{{summary}}`
- `{{world_info}}`
- custom values from retrieval or workflow state

Avoid hidden string mutations spread across the codebase.

### 8. Keep provider adaptation separate from prompt assembly

Prompt assembly should produce one normalized message format.

Provider adapters should then convert it into:

- OpenAI-style chat messages
- Claude-style messages + system blocks
- Gemini `contents` + `systemInstruction`
- custom internal protocol

Do not mix role conversion and prompt policy into the same function if you can avoid it.

## Suggested Data Model

```js
{
  conversationId: 'chat-001',
  triggerType: 'normal',
  latestUserInput: 'I am not here to cause trouble.',
  tokenBudget: 16000,
  character: {
    name: 'Aileen',
    description: '...',
    personality: '...',
    scenario: '...'
  },
  promptConfig: {
    systemPrompt: '...',
    postHistoryInstructions: '...',
    inChatPrompts: []
  },
  history: [
    { role: 'user', content: '...' },
    { role: 'assistant', content: '...' }
  ],
  worldInfoMatches: [],
  dynamicBlocks: [],
  summary: ''
}
```

## Files

- [src/request-message-builder.js](D:\workspace\SillyTavern-Launcher\prompt-manager-rules\src\request-message-builder.js)
- [src/example.js](D:\workspace\SillyTavern-Launcher\prompt-manager-rules\src\example.js)
- [rag-demo-integration.md](D:\workspace\rag-demo\docs\prompt-manager-rules\rag-demo-integration.md)
- [rag-demo-types-draft.md](D:\workspace\rag-demo\docs\prompt-manager-rules\rag-demo-types-draft.md)
