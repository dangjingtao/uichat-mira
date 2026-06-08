# assistant-ui

> React components for AI chat interfaces

## LLM Documentation Files

- [Full documentation](https://www.assistant-ui.com/llms-full.txt): all docs and examples pages rendered into one large text file.
- Per-page markdown: append `.mdx` to any docs page URL. For example, `/docs/getting-started.mdx` returns the markdown for `/docs/getting-started`, and `/examples/ai-sdk.mdx` returns the markdown for `/examples/ai-sdk`.
- Markdown by Accept header: requesting a docs or examples page with `Accept: text/markdown` also returns that page's markdown.
- Use the index below to choose a specific page. Remove the `.mdx` suffix to open the human-readable docs page.

## Table of Contents

### architecture

- [Architecture](https://www.assistant-ui.com/docs/architecture.mdx): How components, runtimes, and cloud services fit together.

### cli

- [CLI](https://www.assistant-ui.com/docs/cli.mdx): Scaffold projects, add components, and manage updates from the command line.

### devtools

- [DevTools](https://www.assistant-ui.com/docs/devtools.mdx): Inspect runtime state, context, and events in the browser.

### root

- [Documentation](https://www.assistant-ui.com/docs.mdx): Build production-grade AI chat experiences in React with assistant-ui — components, runtimes, and primitives for ChatGPT-style UIs, copilots, and agents.

### installation

- [Installation](https://www.assistant-ui.com/docs/installation.mdx): Get assistant-ui running in 5 minutes with npm and your first chat component.

### llm

- [Agent Skills](https://www.assistant-ui.com/docs/llm.mdx): Use AI tools to build with assistant-ui faster. AI-accessible documentation, Claude Code skills, and MCP integration.

### rtl

- [RTL Support](https://www.assistant-ui.com/docs/rtl.mdx): Use assistant-ui with right-to-left languages like Arabic, Hebrew, and Persian.

### cloud

- [AI SDK + assistant-ui](https://www.assistant-ui.com/docs/cloud/ai-sdk-assistant-ui.mdx): Integrate cloud persistence using assistant-ui runtime and pre-built components.
- [AI SDK](https://www.assistant-ui.com/docs/cloud/ai-sdk.mdx): Add cloud persistence to your existing AI SDK app with a single hook.
- [User Authorization](https://www.assistant-ui.com/docs/cloud/authorization.mdx): Configure workspace auth tokens and integrate with auth providers.
- [Cloud Persistence](https://www.assistant-ui.com/docs/cloud.mdx): Add managed thread persistence and chat history to your AI app in minutes — assistant-ui Cloud handles thread sync, search, and multi-tenant storage.
- [LangGraph + assistant-ui](https://www.assistant-ui.com/docs/cloud/langgraph.mdx): Integrate cloud persistence and thread management with LangGraph Cloud.

### copilots

- [Assistant Frame API](https://www.assistant-ui.com/docs/copilots/assistant-frame.mdx): Share model context across iframe boundaries
- [makeAssistantVisible](https://www.assistant-ui.com/docs/copilots/make-assistant-visible.mdx): Make React components visible and interactive to assistants via higher-order component wrapping.
- [Model Context](https://www.assistant-ui.com/docs/copilots/model-context.mdx): Configure assistant behavior through system instructions, tools, and context providers.
- [Intelligent Components](https://www.assistant-ui.com/docs/copilots/motivation.mdx): Add intelligence to React components through readable interfaces and assistant tools.
- [useAssistantInstructions](https://www.assistant-ui.com/docs/copilots/use-assistant-instructions.mdx): React hook for setting system instructions to guide assistant behavior.

### guides

- [File Attachments](https://www.assistant-ui.com/docs/guides/attachments.mdx): Let users attach images, PDFs, and other files to AI chat messages in React. Drag-drop, paste, and vision-model support, built into assistant-ui.
- [Message Branching](https://www.assistant-ui.com/docs/guides/branching.mdx): Edit messages or regenerate AI responses, then switch between alternative replies. Branching navigation built into assistant-ui's React chat UI.
- [Chain of Thought UI](https://www.assistant-ui.com/docs/guides/chain-of-thought.mdx): Show AI reasoning steps and tool calls in a collapsible thinking accordion. Build chain-of-thought visualizations in React chat with assistant-ui.
- [Assistant Context API](https://www.assistant-ui.com/docs/guides/context-api.mdx): Read and update assistant state to build custom React components in your chat UI — composable context API for thread, message, and runtime data via assistant-ui.
- [Speech-to-Text Dictation](https://www.assistant-ui.com/docs/guides/dictation.mdx): Add voice dictation to your AI chat composer with the Web Speech API or a custom adapter. Speech-to-text in React, integrated through assistant-ui.
- [Message Editing](https://www.assistant-ui.com/docs/guides/editing.mdx): Let users edit their messages and regenerate AI responses with custom editor interfaces. Edit-and-resubmit patterns for React chat via assistant-ui.
- [Image Generation](https://www.assistant-ui.com/docs/guides/image-generation.mdx): Generate images in your backend and render them inline in an assistant-ui thread.
- [Guides](https://www.assistant-ui.com/docs/guides.mdx): Practical recipes for building AI chat features in React with assistant-ui — attachments, branching, multi-agent, voice, slash commands, generative UI, and more.
- [LaTeX in Chat Messages](https://www.assistant-ui.com/docs/guides/latex.mdx): Render LaTeX math expressions in AI chat messages with KaTeX — drop-in equation support for React chat UIs built on assistant-ui.
- [Mentions in Chat](https://www.assistant-ui.com/docs/guides/mentions.mdx): Let users @-mention tools or custom items in the AI chat composer to guide the LLM. Mention picker built into assistant-ui's React composer.
- [Message Timing & Token Stats](https://www.assistant-ui.com/docs/guides/message-timing.mdx): Display stream metadata in AI chat — generation duration, tokens per second, and time to first token, rendered via assistant-ui's React components.
- [Quote Selected Text](https://www.assistant-ui.com/docs/guides/quoting.mdx): Let users select text from AI messages and quote it back into the composer. Full quoting flow with backend handling and programmatic API in assistant-ui.
- [Resumable Stream Deployment](https://www.assistant-ui.com/docs/guides/resumable-stream-deployment.mdx): Production hardening for resumable streams. Authorization, serverless lifetimes, TTLs, key isolation, observability, resource limits, and incident response.
- [Custom Resumable Stream Stores](https://www.assistant-ui.com/docs/guides/resumable-stream-stores.mdx): Implement the ResumableStreamStore interface to back resumable streams with Postgres, Cloudflare Durable Objects, Upstash REST, InstantDB, or any other backend.
- [Resumable Streams](https://www.assistant-ui.com/docs/guides/resumable-streams.mdx): Persist an in-flight LLM response on the server so the client can reload, lose its connection, or open a new tab and pick up the same stream.
- [Slash Commands](https://www.assistant-ui.com/docs/guides/slash-commands.mdx): Trigger predefined actions in your AI chat by typing / — slash command palette with popover, search, and action handlers in React via assistant-ui.
- [Text-to-Speech for Chat](https://www.assistant-ui.com/docs/guides/speech.mdx): Read AI chat messages aloud with the Web Speech API or a custom TTS adapter. Speech synthesis for React chat UIs, integrated with assistant-ui.
- [Suggested Prompts](https://www.assistant-ui.com/docs/guides/suggestions.mdx): Display suggested starter prompts in your AI chat to onboard users faster. Configurable suggestion components for React, built into assistant-ui.
- [Realtime Voice Chat](https://www.assistant-ui.com/docs/guides/voice.mdx): Build bidirectional voice conversations with AI in React — realtime audio streaming, interruption handling, and visual state, integrated via assistant-ui.

### ink

- [Adapters](https://www.assistant-ui.com/docs/ink/adapters.mdx): Attachment, title generation, and storage adapters for React Ink.
- [Custom Backend](https://www.assistant-ui.com/docs/ink/custom-backend.mdx): Connect your terminal app to your own backend API.
- [Hooks](https://www.assistant-ui.com/docs/ink/hooks.mdx): Reactive hooks for accessing runtime state in React Ink.
- [Terminal AI Chat with Ink](https://www.assistant-ui.com/docs/ink.mdx): Build AI chat interfaces for the terminal in TypeScript with @assistant-ui/react-ink — streaming, tool calls, and keyboard navigation in CLI apps.
- [Migration from Web](https://www.assistant-ui.com/docs/ink/migration.mdx): Migrate an existing @assistant-ui/react app to the terminal with React Ink.
- [Primitives](https://www.assistant-ui.com/docs/ink/primitives.mdx): Composable terminal components for building chat UIs with Ink.

### integrations

- [Integrations](https://www.assistant-ui.com/docs/integrations.mdx): Adapters for Vercel AI SDK, LangChain, LangGraph, Mastra, plus auth, persistence, observability, and tool services — drop into a React chat UI built with assistant-ui.
- [better-auth](https://www.assistant-ui.com/docs/integrations/auth/better-auth.mdx): TypeScript-first auth with database-owned sessions; gate the chat route and scope threads to the signed-in user.
- [Clerk](https://www.assistant-ui.com/docs/integrations/auth/clerk.mdx): Gate the chat route and scope thread persistence to the signed-in user with Clerk.
- [Auth.js (next-auth)](https://www.assistant-ui.com/docs/integrations/auth/next-auth.mdx): Gate the chat route and scope thread persistence to the signed-in user with Auth.js v5.
- [Custom attachment uploads](https://www.assistant-ui.com/docs/integrations/attachments/custom-adapter.mdx): Upload chat attachments to object storage with a presigned-URL AttachmentAdapter.
- [Vercel AI SDK Integration](https://www.assistant-ui.com/docs/integrations/frameworks/ai-sdk.mdx): Wire the Vercel AI SDK into a React chat UI with assistant-ui — useChat, streaming, tools, attachments, multi-step agents, and persistence covered end-to-end.
- [LLM Gateway Integrations](https://www.assistant-ui.com/docs/integrations/gateways.mdx): Route AI chat traffic through OpenAI-compatible LLM gateways (OpenRouter, LiteLLM, Portkey, etc.) for cost, fallback, and BYOK in assistant-ui apps.
- [Helicone](https://www.assistant-ui.com/docs/integrations/observability/helicone.mdx): Log and monitor LLM calls by routing them through the Helicone proxy.
- [Langfuse](https://www.assistant-ui.com/docs/integrations/observability/langfuse.mdx): Trace AI SDK calls into Langfuse via OpenTelemetry for tracing, evals, and prompt management.
- [LangSmith](https://www.assistant-ui.com/docs/integrations/observability/langsmith.mdx): Trace AI SDK calls into LangSmith with the wrapAISDK helper.
- [Custom thread persistence](https://www.assistant-ui.com/docs/integrations/persistence/custom-adapter.mdx): Persist threads and messages to your own database with RemoteThreadListAdapter and ThreadHistoryAdapter.
- [Cloudflare Agents Integration](https://www.assistant-ui.com/docs/integrations/frameworks/cloudflare-agents/overview.mdx): Wire Cloudflare's stateful agent framework into a React chat UI with assistant-ui via the standard AI SDK runtime. WebSocket transport, server-side persistence, tool calling, all preserved.
- [Full-stack integration](https://www.assistant-ui.com/docs/integrations/frameworks/mastra/full-stack.mdx): Run Mastra agents inside your Next.js API routes.
- [Mastra Integration](https://www.assistant-ui.com/docs/integrations/frameworks/mastra/overview.mdx): Wire the Mastra TypeScript agent framework into a React chat UI with assistant-ui — full streaming, tool calling, multi-agent support, and thread management.
- [Separate server integration](https://www.assistant-ui.com/docs/integrations/frameworks/mastra/separate-server.mdx): Run Mastra as a standalone server with assistant-ui as a separate frontend.

### migrations

- [Deprecation Policy](https://www.assistant-ui.com/docs/migrations/deprecation-policy.mdx): Stability guarantees and deprecation timelines for assistant-ui features.
- [Using old React versions](https://www.assistant-ui.com/docs/migrations/react-compatibility.mdx): Compatibility notes for React 18 and 19.
- [Migrating to react-langgraph v0.7](https://www.assistant-ui.com/docs/migrations/react-langgraph-v0-7.mdx): Guide to upgrading to the simplified LangGraph integration API.
- [Migrating Tools to Toolkits](https://www.assistant-ui.com/docs/migrations/toolkit-tools.mdx): Move makeAssistantTool, useAssistantTool, makeAssistantToolUI, and useAssistantToolUI registrations to the toolkit API.
- [Migration to v0.11](https://www.assistant-ui.com/docs/migrations/v0-11.mdx): ContentPart renamed to MessagePart for better semantic clarity.
- [Migration to v0.12](https://www.assistant-ui.com/docs/migrations/v0-12.mdx): Unified state API replaces individual context hooks.
- [Migration to v0.14](https://www.assistant-ui.com/docs/migrations/v0-14.mdx): Drops APIs deprecated since v0.11/v0.12, and primitives migrate from components prop to children render functions.

### primitives

- [ActionBar](https://www.assistant-ui.com/docs/primitives/action-bar.mdx): Build message action buttons with auto-hide, copy state, and intelligent disabling.
- [AssistantModal](https://www.assistant-ui.com/docs/primitives/assistant-modal.mdx): A floating chat popover with a fixed-position trigger button that opens a chat panel.
- [Attachment](https://www.assistant-ui.com/docs/primitives/attachment.mdx): File and image attachment rendering for the composer and messages.
- [BranchPicker](https://www.assistant-ui.com/docs/primitives/branch-picker.mdx): Navigate between message branches, which are alternative responses the user can flip through.
- [ChainOfThought](https://www.assistant-ui.com/docs/primitives/chain-of-thought.mdx): Collapsible accordion for grouping reasoning steps and tool calls.
- [Composer](https://www.assistant-ui.com/docs/primitives/composer.mdx): Build custom message input UIs with full control over layout and behavior.
- [Error](https://www.assistant-ui.com/docs/primitives/error.mdx): Accessible error display for messages with automatic error text extraction.
- [Headless Chat Primitives](https://www.assistant-ui.com/docs/primitives.mdx): Unstyled, accessible Radix-style building blocks for React AI chat interfaces — Thread, Composer, Message, and more, ready to compose with assistant-ui.
- [Message](https://www.assistant-ui.com/docs/primitives/message.mdx): Build custom message rendering with content parts, attachments, and hover state.
- [SelectionToolbar](https://www.assistant-ui.com/docs/primitives/selection-toolbar.mdx): A floating toolbar that appears when text is selected within a message.
- [Suggestion](https://www.assistant-ui.com/docs/primitives/suggestion.mdx): Suggested prompts that users can click to quickly send or populate the composer.
- [ThreadList](https://www.assistant-ui.com/docs/primitives/thread-list.mdx): Multi-thread management for listing, creating, switching, archiving, and deleting conversations.
- [Thread](https://www.assistant-ui.com/docs/primitives/thread.mdx): Build custom scrollable message containers with auto-scroll, empty states, and message rendering.

### react-native

- [Adapters](https://www.assistant-ui.com/docs/react-native/adapters.mdx): Persistence and title generation adapters for React Native.
- [Custom Backend](https://www.assistant-ui.com/docs/react-native/custom-backend.mdx): Connect your React Native app to your own backend API.
- [Hooks](https://www.assistant-ui.com/docs/react-native/hooks.mdx): Reactive hooks for accessing runtime state in React Native.
- [React Native AI Chat](https://www.assistant-ui.com/docs/react-native.mdx): Build AI chat for iOS and Android with @assistant-ui/react-native — streaming, tools, attachments, and platform-native components from the same primitives as the web SDK.
- [Migration from Web](https://www.assistant-ui.com/docs/react-native/migration.mdx): Migrate an existing @assistant-ui/react app to React Native.
- [Primitives](https://www.assistant-ui.com/docs/react-native/primitives.mdx): Composable React Native components for building chat UIs.

### runtimes

- [LangChain React Runtime](https://www.assistant-ui.com/docs/runtimes/langchain.mdx): Use LangChain's useStream hook with a React chat UI through assistant-ui — a lighter LangGraph adapter that delegates streaming to @langchain/react.
- [Picking a runtime](https://www.assistant-ui.com/docs/runtimes/pick-a-runtime.mdx): Decision guide for choosing the right runtime, by framework or by feature.
- [Client and hooks](https://www.assistant-ui.com/docs/runtimes/a2a/client-and-hooks.mdx): A2AClient, useA2ARuntime options, hooks, task states, artifacts, errors.
- [A2A Agent Runtime](https://www.assistant-ui.com/docs/runtimes/a2a/overview.mdx): Connect any A2A v1.0 protocol-compliant agent server to a React chat UI with assistant-ui — full streaming, tool calls, and message metadata supported.
- [Quickstart](https://www.assistant-ui.com/docs/runtimes/a2a/quickstart.mdx): Minimal runtime and Thread setup against an A2A server.
- [AG-UI Agent Runtime](https://www.assistant-ui.com/docs/runtimes/ag-ui/overview.mdx): Wire AG-UI (Agent-User Interaction) protocol agents into a React chat UI with assistant-ui — bidirectional events, generative UI, and human-in-the-loop.
- [Quickstart](https://www.assistant-ui.com/docs/runtimes/ag-ui/quickstart.mdx): Minimal HttpAgent + useAgUiRuntime setup against an AG-UI server.
- [Runtime options](https://www.assistant-ui.com/docs/runtimes/ag-ui/runtime-options.mdx): useAgUiRuntime options, adapters, supported events, thread list.
- [Vercel AI SDK Runtime](https://www.assistant-ui.com/docs/runtimes/ai-sdk/overview.mdx): Connect the Vercel AI SDK to a React chat UI via assistant-ui — useChat hooks, custom transports, frontend tools, attachments, multi-step agents, and token usage.
- [AI SDK v4 (legacy)](https://www.assistant-ui.com/docs/runtimes/ai-sdk/v4-legacy.mdx): Reference for projects still on AI SDK v4. New projects should use v6.
- [AI SDK v5 (legacy)](https://www.assistant-ui.com/docs/runtimes/ai-sdk/v5-legacy.mdx): Reference for projects still on AI SDK v5. New projects should use v6.
- [AI SDK v6](https://www.assistant-ui.com/docs/runtimes/ai-sdk/v6.mdx): Integrate Vercel AI SDK v6 with assistant-ui for streaming chat.
- [Adapters](https://www.assistant-ui.com/docs/runtimes/concepts/adapters.mdx): Reusable extension points for attachments, speech, feedback, history, and suggestions.
- [Runtime architecture](https://www.assistant-ui.com/docs/runtimes/concepts/architecture.mdx): How core runtimes, protocol layers, and framework adapters fit together.
- [Stability](https://www.assistant-ui.com/docs/runtimes/concepts/stability.mdx): What unstable_ means, when APIs become stable, and how to track changes.
- [Threads](https://www.assistant-ui.com/docs/runtimes/concepts/threads.mdx): Single-thread, cloud, and custom-database thread management.
- [Assistant Transport](https://www.assistant-ui.com/docs/runtimes/custom/assistant-transport.mdx): Stream agent state to the frontend and handle user commands for custom agents.
- [Data Stream Protocol](https://www.assistant-ui.com/docs/runtimes/custom/data-stream.mdx): Standard message-streaming protocol on top of LocalRuntime.
- [ExternalStoreRuntime](https://www.assistant-ui.com/docs/runtimes/custom/external-store.mdx): Bring your own redux, zustand, or state manager.
- [LocalRuntime](https://www.assistant-ui.com/docs/runtimes/custom/local-runtime.mdx): Quickest path to a working chat. Handles state while you handle the API.
- [Custom Runtime](https://www.assistant-ui.com/docs/runtimes/custom/overview.mdx): Build a React chat UI for any AI backend with assistant-ui — four runtime patterns covering local state, REST, custom protocols, and external runtimes.
- [API reference](https://www.assistant-ui.com/docs/runtimes/google-adk/api.mdx): createAdkStream, server helpers, session adapter, threads, message editing.
- [Hooks](https://www.assistant-ui.com/docs/runtimes/google-adk/hooks.mdx): Tool confirmations, auth, input requests, artifacts, escalation, metadata, structured events.
- [Google ADK Runtime](https://www.assistant-ui.com/docs/runtimes/google-adk/overview.mdx): Connect Google's Agent Development Kit (ADK) to a React chat UI with assistant-ui — streaming, tool calls, and multi-agent orchestration supported.
- [Quickstart](https://www.assistant-ui.com/docs/runtimes/google-adk/quickstart.mdx): Minimal API route and client setup with createAdkApiRoute.
- [LangGraph Generative UI](https://www.assistant-ui.com/docs/runtimes/langgraph/generative-ui.mdx): Render structured UI components emitted by LangGraph alongside assistant messages.
- [Interrupts and message editing](https://www.assistant-ui.com/docs/runtimes/langgraph/interrupts.mdx): Interrupt persistence and checkpoint-based message editing.
- [LangGraph UI Runtime](https://www.assistant-ui.com/docs/runtimes/langgraph/overview.mdx): Build a chat UI for LangGraph agents in React with assistant-ui — streaming, subgraph events, UI messages, interrupts, and end-to-end cancellation supported.
- [Quickstart](https://www.assistant-ui.com/docs/runtimes/langgraph/quickstart.mdx): From-template and manual setup paths to a working LangGraph chat.
- [Streaming](https://www.assistant-ui.com/docs/runtimes/langgraph/streaming.mdx): Event handlers, message accumulator, conversion, metadata, and generative UI.
- [Threads](https://www.assistant-ui.com/docs/runtimes/langgraph/threads.mdx): Basic thread support, AssistantCloud, and custom thread list adapter.
- [Hooks](https://www.assistant-ui.com/docs/runtimes/opencode/hooks.mdx): Permissions, questions, session state, runtime extras.
- [OpenCode Runtime](https://www.assistant-ui.com/docs/runtimes/opencode/overview.mdx): Build a React chat UI for OpenCode coding agents with assistant-ui — streaming, tool calls, file edits, and terminal output rendered in chat.
- [Quickstart](https://www.assistant-ui.com/docs/runtimes/opencode/quickstart.mdx): Minimal useOpenCodeRuntime setup against a local OpenCode server.
- [Introduction](https://www.assistant-ui.com/docs/runtimes/langgraph/tutorial/introduction.mdx): Build a stockbroker assistant with LangGraph and assistant-ui.
- [Part 1: Setup frontend](https://www.assistant-ui.com/docs/runtimes/langgraph/tutorial/part-1.mdx): Create a Next.js project with the LangGraph assistant-ui template.
- [Part 2: Generative UI](https://www.assistant-ui.com/docs/runtimes/langgraph/tutorial/part-2.mdx): Display stock ticker information with generative UI components.
- [Part 3: Approval UI](https://www.assistant-ui.com/docs/runtimes/langgraph/tutorial/part-3.mdx): Add human-in-the-loop approval for tool calls.

### tools

- [Backend Tools](https://www.assistant-ui.com/docs/tools/backend.mdx): Wire assistant-ui toolkits into your server with the AI SDK — AISDKToolkit, frontendTools, mixing client and server tools, and multi-modal results.
- [Defining Tools](https://www.assistant-ui.com/docs/tools/defining-tools.mdx): Define tools for your AI chat with assistant-ui toolkits and the "use generative" directive — frontend, backend, human, and provider tools with type safety and streaming.
- [Dynamic Tools](https://www.assistant-ui.com/docs/tools/dynamic-tools.mdx): Tools whose executor closes over React state — declare the contract with stubTool() in a "use generative" file and supply the executor with useAuiToolOverrides.
- [Generative UI (JSON spec)](https://www.assistant-ui.com/docs/tools/generative-ui.mdx): Render agent-described React UI from a JSON spec with a consumer-provided component allowlist.
- [Tools](https://www.assistant-ui.com/docs/tools.mdx): Give the model callable capabilities with assistant-ui toolkits — define frontend, backend, human, and provider tools, render tool calls as interactive UI, and connect MCP servers.
- [Interactable Components](https://www.assistant-ui.com/docs/tools/interactables.mdx): Build persistent UI elements whose state the AI can read and update — copilot interactables in React with assistant-ui for forms, dashboards, and tools.
- [MCP Apps](https://www.assistant-ui.com/docs/tools/mcp-apps.mdx): Render MCP App UI resources inline in chat. Native renderer for the Model Context Protocol Apps spec — sandboxed iframes, JSON-RPC bridge, AI SDK integration.
- [Model Context Protocol (MCP)](https://www.assistant-ui.com/docs/tools/mcp.mdx): Connect MCP servers as a tool catalog in your assistant-ui app.
- [Multi-Agent Chat UI](https://www.assistant-ui.com/docs/tools/multi-agent.mdx): Render sub-agent conversations and handoffs inside tool calls. Build supervisor and multi-agent patterns in a React chat UI with assistant-ui.
- [Tool UI](https://www.assistant-ui.com/docs/tools/tool-ui.mdx): Render AI tool calls as custom React components — show loading, result, and interactive states for each tool invocation in assistant-ui.
- [User-managed MCP servers](https://www.assistant-ui.com/docs/tools/user-managed-mcp.mdx): Let end users add and authenticate MCP servers from the browser with @assistant-ui/react-mcp.

### ui

- [Accordion](https://www.assistant-ui.com/docs/ui/accordion.mdx): A vertically stacked set of interactive headings that reveal or hide content sections.
- [AssistantModal](https://www.assistant-ui.com/docs/ui/assistant-modal.mdx): Floating chat bubble for support widgets and help desks.
- [AssistantSidebar](https://www.assistant-ui.com/docs/ui/assistant-sidebar.mdx): Side panel chat for co-pilot experiences and inline assistance.
- [Attachment](https://www.assistant-ui.com/docs/ui/attachment.mdx): UI components for attaching and viewing files in messages.
- [Badge](https://www.assistant-ui.com/docs/ui/badge.mdx): A small label component for displaying status, categories, or metadata.
- [Composer Trigger Popover](https://www.assistant-ui.com/docs/ui/composer-trigger-popover.mdx): Reusable picker UI for @ mentions, / slash commands, and any other character-triggered popover.
- [Context Display](https://www.assistant-ui.com/docs/ui/context-display.mdx): Visualize token usage relative to a model's context window — ring, bar, or text — with a detailed hover popover.
- [Diff Viewer](https://www.assistant-ui.com/docs/ui/diff-viewer.mdx): Render code diffs with syntax highlighting for additions and deletions.
- [Directive Text](https://www.assistant-ui.com/docs/ui/directive-text.mdx): Render mention directives as inline chips in user messages.
- [File](https://www.assistant-ui.com/docs/ui/file.mdx): Display file message parts with icon, name, size, and download button.
- [Image](https://www.assistant-ui.com/docs/ui/image.mdx): Display image message parts with preview, loading states, and fullscreen dialog.
- [Markdown](https://www.assistant-ui.com/docs/ui/markdown.mdx): Display rich text with headings, lists, links, and code blocks.
- [MCP Config Dialog](https://www.assistant-ui.com/docs/ui/mcp-config.mdx): Drop-in shadcn dialog that lists MCP connectors and custom servers, with inline OAuth/bearer auth controls and an add form.
- [Mermaid Diagrams](https://www.assistant-ui.com/docs/ui/mermaid.mdx): Render Mermaid diagrams in chat messages with streaming support.
- [Message Timing](https://www.assistant-ui.com/docs/ui/message-timing.mdx): Display streaming performance stats — TTFT, total time, tok/s, and chunk count — as a badge with hover popover.
- [ModelSelector](https://www.assistant-ui.com/docs/ui/model-selector.mdx): Model picker with unified overlay positioning and runtime integration.
- [Message Part Grouping](https://www.assistant-ui.com/docs/ui/part-grouping.mdx): Organize message parts into custom groups with flexible grouping functions.
- [Quote](https://www.assistant-ui.com/docs/ui/quote.mdx): Let users select and quote text from messages with a floating toolbar, composer preview, and inline quote display.
- [Reasoning](https://www.assistant-ui.com/docs/ui/reasoning.mdx): Collapsible UI for displaying AI reasoning and thinking messages.
- [Custom Scrollbar](https://www.assistant-ui.com/docs/ui/scrollbar.mdx): Replace the default scrollbar with a custom Radix UI scroll area.
- [Select](https://www.assistant-ui.com/docs/ui/select.mdx): A dropdown select component with composable sub-components.
- [Sources](https://www.assistant-ui.com/docs/ui/sources.mdx): Display URL sources with favicon, title, and external link.
- [Streamdown Markdown Renderer](https://www.assistant-ui.com/docs/ui/streamdown.mdx): Stream markdown into a React chat UI with syntax highlighting, math, and Mermaid diagrams. Powered by Vercel Streamdown, integrated for assistant-ui.
- [Syntax Highlighting](https://www.assistant-ui.com/docs/ui/syntax-highlighting.mdx): Code block syntax highlighting with react-shiki or react-syntax-highlighter.
- [Tabs](https://www.assistant-ui.com/docs/ui/tabs.mdx): A multi-variant tabs component for organizing content into switchable panels.
- [Thread List Component](https://www.assistant-ui.com/docs/ui/thread-list.mdx): Sidebar or dropdown component for switching between AI chat conversations. Persistent thread state, search, and active selection — built for assistant-ui apps.
- [Thread Component](https://www.assistant-ui.com/docs/ui/thread.mdx): Stream-ready React chat container with message list, composer, auto-scroll, and accessibility built in. Drop into any AI chat UI built with assistant-ui.
- [ToolFallback](https://www.assistant-ui.com/docs/ui/tool-fallback.mdx): Default UI component for tools without dedicated custom renderers.
- [ToolGroup](https://www.assistant-ui.com/docs/ui/tool-group.mdx): Wrapper for consecutive tool calls with collapsible and styled options.
- [Voice](https://www.assistant-ui.com/docs/ui/voice.mdx): Realtime voice session controls with connect, mute, and status indicator.

### utilities

- [heat-graph](https://www.assistant-ui.com/docs/utilities/heat-graph.mdx): Headless, composable activity heatmap components for React.
- [react-o11y](https://www.assistant-ui.com/docs/utilities/react-o11y.mdx): Headless primitives for visualizing observability spans (traces, waterfalls).
- [tw-shimmer](https://www.assistant-ui.com/docs/utilities/tw-shimmer.mdx): Tailwind CSS v4 plugin for shimmer effects.

### api-reference

- [API Reference](https://www.assistant-ui.com/docs/api-reference/overview.mdx): Complete assistant-ui React API reference for building AI chat UIs with primitives, hooks, runtimes, adapters, tools, transport, voice, and integrations.
- [AssistantRuntimeProvider](https://www.assistant-ui.com/docs/api-reference/context-providers/assistant-runtime-provider.mdx): Root React provider that connects an assistant-ui runtime to primitives, hooks, threads, and composer state.
- [Context Providers API Reference](https://www.assistant-ui.com/docs/api-reference/context-providers.mdx): React context providers including AssistantRuntimeProvider that scope assistant-ui runtime, thread, message part, and attachment state for primitives, hooks, and custom chat components.
- [Scoped Providers](https://www.assistant-ui.com/docs/api-reference/context-providers/scoped-providers.mdx): Lower-level assistant-ui providers for custom renderers, scoped message parts, attachments, and advanced composition.
- [Attachment Adapters](https://www.assistant-ui.com/docs/api-reference/adapters/attachments.mdx): Attachment adapters for uploading files, handling lifecycle events, and bringing app-owned content into assistant-ui composers and messages.
- [Feedback Adapter](https://www.assistant-ui.com/docs/api-reference/adapters/feedback.mdx): Capture and respond to message feedback submitted through action primitives or runtime actions.
- [Adapters API Reference](https://www.assistant-ui.com/docs/api-reference/adapters.mdx): Adapter interfaces for connecting chat models, persistence, file attachments, feedback, and suggestions to assistant-ui React runtimes.
- [Model Adapters](https://www.assistant-ui.com/docs/api-reference/adapters/model.mdx): Adapter interfaces for connecting chat models, streaming responses, and model execution to assistant-ui runtimes.
- [Persistence Adapters](https://www.assistant-ui.com/docs/api-reference/adapters/persistence.mdx): Persistence adapters for saving assistant-ui message history, remote thread lists, and long-running chat sessions across browser reloads.
- [Runtime Adapter Context](https://www.assistant-ui.com/docs/api-reference/adapters/runtime.mdx): Provide assistant-ui runtime adapters through React context for model, attachment, speech, and feedback behavior.
- [Suggestion Adapters](https://www.assistant-ui.com/docs/api-reference/adapters/suggestions.mdx): Suggestion adapters for providing starter prompts, contextual actions, and guided composer options to assistant-ui runtimes.
- [External Store API Reference](https://www.assistant-ui.com/docs/api-reference/external-store.mdx): External store runtime, message conversion helpers, and adapters for assistant-ui React apps that own their chat state outside the runtime.
- [Message Conversion](https://www.assistant-ui.com/docs/api-reference/external-store/message-conversion.mdx): Convert external message formats into assistant-ui's message and thread state for the external store runtime.
- [External Store Runtime](https://www.assistant-ui.com/docs/api-reference/external-store/runtime.mdx): Runtime components, options, and adapters for using assistant-ui with externally owned chat state.
- [Generative UI API Reference](https://www.assistant-ui.com/docs/api-reference/generative-ui.mdx): Spec-driven generative UI for assistant-ui. The data format an assistant streams, the component registry that resolves it, and the renderer that turns it into React elements.
- [Generative UI Rendering](https://www.assistant-ui.com/docs/api-reference/generative-ui/rendering.mdx): Render a generative UI spec into React. The renderer resolves spec nodes against your component registry, and the error thrown when a component cannot be resolved.
- [Generative UI Spec](https://www.assistant-ui.com/docs/api-reference/generative-ui/spec.mdx): The serializable node tree an assistant emits to describe generative UI. Covers the GenerativeUISpec format, its nodes, and the message part that carries the spec.
- [Composer Trigger Hooks](https://www.assistant-ui.com/docs/api-reference/hooks/composer-triggers.mdx): Unstable assistant-ui hooks for mention menus, slash commands, and custom composer trigger popovers.
- [Hooks API Reference](https://www.assistant-ui.com/docs/api-reference/hooks.mdx): React hooks for assistant-ui: useAui, useAuiState, runtime creation, model context registration, and helpers for building custom AI chat behavior.
- [Model Context Hooks](https://www.assistant-ui.com/docs/api-reference/hooks/model-context.mdx): React hooks for registering assistant-ui tools, data renderers, instructions, and model context providers.
- [Primitive Hooks](https://www.assistant-ui.com/docs/api-reference/hooks/primitives.mdx): Primitive hooks for reading scoped assistant-ui runtime state, viewport behavior, timing, and message part data inside React components.
- [Runtime Hooks](https://www.assistant-ui.com/docs/api-reference/hooks/runtimes.mdx): Runtime creation hooks for local, remote, cloud, external-store, and AI SDK powered assistant-ui chat experiences.
- [State Hooks](https://www.assistant-ui.com/docs/api-reference/hooks/state.mdx): State selector and action hooks for reading assistant-ui runtime state and controlling threads, composers, messages, and attachments.
- [Utility Hooks](https://www.assistant-ui.com/docs/api-reference/hooks/utilities.mdx): Focused helpers for message parts, quotes, timing, and viewport behavior.
- [Model Context](https://www.assistant-ui.com/docs/api-reference/model-context/context.mdx): Provide model instructions, contextual state, and inline renderers to assistant-ui runtimes.
- [Model Context API Reference](https://www.assistant-ui.com/docs/api-reference/model-context.mdx): Model instructions, contextual state, provider registries, and renderers for giving assistant-ui runtimes app-aware context.
- [Model Context Registry](https://www.assistant-ui.com/docs/api-reference/model-context/registry.mdx): Register and manage assistant-ui model context providers that contribute instructions and app state.
- [@assistant-ui/cloud-ai-sdk](https://www.assistant-ui.com/docs/api-reference/integrations/cloud-ai-sdk.mdx): Assistant Cloud AI SDK hooks for connecting cloud-backed threads, persistence, and chat state to assistant-ui React runtimes.
- [Integrations API Reference](https://www.assistant-ui.com/docs/api-reference/integrations.mdx): Package-level APIs for connecting assistant-ui React to the Vercel AI SDK, Assistant Cloud, and adjacent chat ecosystem hooks and runtimes.
- [@assistant-ui/react-ai-sdk](https://www.assistant-ui.com/docs/api-reference/integrations/react-ai-sdk.mdx): Vercel AI SDK runtime hooks, chat transports, and message conversion utilities for assistant-ui React applications.
- [ActionBarMorePrimitive](https://www.assistant-ui.com/docs/api-reference/primitives/action-bar-more.mdx): Overflow menu primitives for grouping secondary assistant message actions in a custom React UI.
- [ActionBarPrimitive](https://www.assistant-ui.com/docs/api-reference/primitives/action-bar.mdx): Composable message action controls for copy, edit, reload, speech, and feedback in assistant-ui chat interfaces.
- [AuiIf](https://www.assistant-ui.com/docs/api-reference/primitives/assistant-if.mdx): Conditional rendering primitive for showing React UI from assistant-ui thread, message, composer, and runtime state.
- [AssistantModalPrimitive](https://www.assistant-ui.com/docs/api-reference/primitives/assistant-modal.mdx): Floating assistant modal primitives for building support chat, copilot, and embedded assistant experiences.
- [AttachmentPrimitive](https://www.assistant-ui.com/docs/api-reference/primitives/attachment.mdx): Attachment primitives for rendering file previews, names, thumbnails, and remove controls in assistant-ui messages and composers.
- [BranchPickerPrimitive](https://www.assistant-ui.com/docs/api-reference/primitives/branch-picker.mdx): Branch picker primitives for navigating regenerated assistant responses and alternate message paths inside a chat thread.
- [ChainOfThoughtPrimitive](https://www.assistant-ui.com/docs/api-reference/primitives/chain-of-thought.mdx): Chain of thought primitives for rendering assistant reasoning, step lists, and collapsible disclosure UI in message content.
- [ComposerPrimitive](https://www.assistant-ui.com/docs/api-reference/primitives/composer.mdx): Composable input primitives for assistant-ui prompts, send controls, cancellation, attachments, and composer state.
- [Composition](https://www.assistant-ui.com/docs/api-reference/primitives/composition.mdx): How to compose primitives with custom components using asChild.
- [ErrorPrimitive](https://www.assistant-ui.com/docs/api-reference/primitives/error.mdx): Error primitives for rendering assistant-ui runtime, thread, and message failures inside custom chat interfaces.
- [Primitives API Reference](https://www.assistant-ui.com/docs/api-reference/primitives.mdx): Composable React primitives for assistant-ui chat UIs: Thread, Composer, Message, BranchPicker, ActionBar, and the parts that build threads, message lists, attachments, and editing flows.
- [MessagePartPrimitive](https://www.assistant-ui.com/docs/api-reference/primitives/message-part.mdx): Message part primitives for rendering text, tool calls, data parts, reasoning, source content, and custom assistant output.
- [MessagePrimitive](https://www.assistant-ui.com/docs/api-reference/primitives/message.mdx): Message primitives for rendering assistant and user turns, message parts, attachments, actions, editing, and branch controls.
- [QueueItemPrimitive](https://www.assistant-ui.com/docs/api-reference/primitives/queue-item.mdx): Queue item primitives for rendering pending assistant-ui thread operations, optimistic work, and runtime queue state.
- [SelectionToolbarPrimitive](https://www.assistant-ui.com/docs/api-reference/primitives/selection-toolbar.mdx): Selection toolbar primitives for quote, copy, and contextual actions on selected chat text.
- [SuggestionPrimitive](https://www.assistant-ui.com/docs/api-reference/primitives/suggestion.mdx): Suggestion primitives for rendering starter prompts, follow-up actions, and composer suggestions in assistant-ui threads.
- [ThreadListItemMorePrimitive](https://www.assistant-ui.com/docs/api-reference/primitives/thread-list-item-more.mdx): Overflow menu primitives for secondary thread list item actions in custom assistant-ui sidebars.
- [ThreadListItemPrimitive](https://www.assistant-ui.com/docs/api-reference/primitives/thread-list-item.mdx): Thread list item primitives for rendering selectable conversation rows with titles, archive controls, delete actions, and menus.
- [ThreadListPrimitive](https://www.assistant-ui.com/docs/api-reference/primitives/thread-list.mdx): Thread list primitives for rendering conversation navigation, new thread actions, and custom assistant sidebars.
- [ThreadPrimitive](https://www.assistant-ui.com/docs/api-reference/primitives/thread.mdx): Thread primitives for rendering chat transcripts, message lists, viewport state, suggestions, and composers in assistant-ui.
- [AssistantRuntime](https://www.assistant-ui.com/docs/api-reference/runtimes/assistant-runtime.mdx): Top-level assistant-ui runtime actions and state for tools, threads, composers, messages, and assistant behavior.
- [AttachmentRuntime](https://www.assistant-ui.com/docs/api-reference/runtimes/attachment-runtime.mdx): AttachmentRuntime state and actions for reading attachment data and controlling files inside assistant-ui messages and composers.
- [ComposerRuntime](https://www.assistant-ui.com/docs/api-reference/runtimes/composer-runtime.mdx): ComposerRuntime state and actions for controlling assistant-ui composer text, attachments, submission, cancellation, and pending input.
- [Runtime State API Reference](https://www.assistant-ui.com/docs/api-reference/runtimes.mdx): Runtime state and actions exposed through useAui and useAuiState, covering AssistantRuntime, ThreadRuntime, ThreadListRuntime, ComposerRuntime, MessageRuntime, and attachment APIs for controlling assistant-ui chat.
- [MessagePartRuntime](https://www.assistant-ui.com/docs/api-reference/runtimes/message-part-runtime.mdx): MessagePartRuntime state and helpers for inspecting assistant-ui text, tool calls, data parts, reasoning, and custom message content.
- [MessageRuntime](https://www.assistant-ui.com/docs/api-reference/runtimes/message-runtime.mdx): MessageRuntime state and actions for editing, reloading, copying, rating, speaking, and branching assistant-ui messages.
- [QueueItemState](https://www.assistant-ui.com/docs/api-reference/runtimes/queue-state.mdx): State shape for queued assistant-ui thread operations and pending runtime work.
- [ThreadListItemRuntime](https://www.assistant-ui.com/docs/api-reference/runtimes/thread-list-item-runtime.mdx): ThreadListItemRuntime state and actions for selecting, archiving, unarchiving, deleting, and renaming assistant-ui conversations.
- [ThreadListRuntime](https://www.assistant-ui.com/docs/api-reference/runtimes/thread-list-runtime.mdx): ThreadListRuntime state and actions for managing remote assistant-ui conversations, active thread selection, and new thread creation.
- [ThreadRuntime](https://www.assistant-ui.com/docs/api-reference/runtimes/thread-runtime.mdx): ThreadRuntime state and actions for controlling assistant-ui messages, composers, suggestions, model context, and the full thread lifecycle.
- [Component Tools](https://www.assistant-ui.com/docs/api-reference/tools/component-tools.mdx): Register assistant tools from mounted React components, scoped to the lifetime of part of the UI tree.
- [Tools API Reference](https://www.assistant-ui.com/docs/api-reference/tools.mdx): Tool definitions, React renderers, status helpers, and toolkits for exposing callable app capabilities to assistant-ui chat models.
- [Tool Rendering](https://www.assistant-ui.com/docs/api-reference/tools/rendering.mdx): Register React renderers for assistant-ui tool calls, tool results, and model data parts.
- [Tool Status](https://www.assistant-ui.com/docs/api-reference/tools/status.mdx): Read tool arguments, execution status, and result state inside assistant-ui tool UI components.
- [Toolkits](https://www.assistant-ui.com/docs/api-reference/tools/toolkits.mdx): Define model-facing tools and compose them into named toolkits registered with an assistant-ui runtime scope.
- [Assistant Transport](https://www.assistant-ui.com/docs/api-reference/transport/assistant-transport.mdx): Command, protocol, and transport types for connecting assistant-ui runtimes across execution boundaries.
- [Assistant Frame](https://www.assistant-ui.com/docs/api-reference/transport/frame.mdx): Frame bridge APIs and serialized message types for embedding assistant-ui runtimes in external contexts.
- [Transport API Reference](https://www.assistant-ui.com/docs/api-reference/transport.mdx): Transport commands, frame messages, and protocol types for synchronizing assistant-ui runtimes across process or iframe boundaries.
- [Utilities API Reference](https://www.assistant-ui.com/docs/api-reference/utilities.mdx): Utility exports for custom rendering, composition, and advanced assistant-ui behavior that does not fit a larger API family.
- [Utilities](https://www.assistant-ui.com/docs/api-reference/utilities/miscellaneous.mdx): Miscellaneous @assistant-ui/react utilities for custom rendering, composition, and advanced assistant UI behavior.
- [Voice API Reference](https://www.assistant-ui.com/docs/api-reference/voice.mdx): Realtime voice, speech synthesis, and dictation contracts for wiring spoken assistant flows into React chat UIs.
- [Voice Sessions](https://www.assistant-ui.com/docs/api-reference/voice/session.mdx): Create and control realtime assistant-ui voice sessions, state, controls, and helpers.
- [Speech and Dictation](https://www.assistant-ui.com/docs/api-reference/voice/speech-dictation.mdx): Connect speech synthesis and dictation adapters to assistant-ui voice and composer workflows.

### examples

- [AI SDK Chat Persistence](https://www.assistant-ui.com/examples/ai-sdk.mdx): Vercel AI SDK chat with thread persistence — open-source React example combining the AI SDK and assistant-ui for streaming, thread management, and message history.
- [Claude Artifacts Example](https://www.assistant-ui.com/examples/artifacts.mdx): Open-source Claude Artifacts implementation in React — generate websites and components in a side panel from chat messages, built on assistant-ui.
- [ChatGPT Clone Example](https://www.assistant-ui.com/examples/chatgpt.mdx): Open-source ChatGPT clone built in React with assistant-ui — centered welcome composer, Tools dropdown, four-state primary action, and full assistant action bar.
- [Claude Clone](https://www.assistant-ui.com/examples/claude.mdx): Open-source Claude clone in React — warm cream theme, serif typography, hover-only action bars, and a clean minimal-shadow composer styled after claude.ai.
- [Expo React Native AI Chat](https://www.assistant-ui.com/examples/expo.mdx): Native iOS and Android AI chat app with Expo — drawer navigation, thread persistence, and the assistant-ui React Native components for mobile.
- [Form-Filling AI Copilot](https://www.assistant-ui.com/examples/form-demo.mdx): Open-source AI copilot that fills forms for users — sidebar UI, field-aware tool calls, and a working React example built with assistant-ui.
- [Gemini Clone](https://www.assistant-ui.com/examples/gemini.mdx): Open-source Gemini clone in React with a centered greeting over an ambient glow, a single-row pill composer, avatar-free assistant replies, and disabled, ready, and stop send states.
- [Generative UI Example (Tool UI)](https://www.assistant-ui.com/examples/generative-ui.mdx): Live demo of toolkit Tool UI patterns — charts, date pickers, contact forms, and maps. For the GenerativeUI JSON-spec primitive, see /gui-chat and /primitive in the same example app.
- [Grok Clone](https://www.assistant-ui.com/examples/grok.mdx): Open-source Grok clone in React — pill composer with paperclip, animated Mic↔Send, functional model picker dropdown, and message timing tooltip.
- [Examples](https://www.assistant-ui.com/examples.mdx): Production-ready examples of AI chat in React — ChatGPT clones, copilots, generative UI, artifacts, multimodal, and more, all built with assistant-ui.
- [Mem0 Memory Chat](https://www.assistant-ui.com/examples/mem0.mdx): AI chat with persistent memory powered by Mem0 — remembers user preferences, facts, and history across sessions. Open-source React example built on assistant-ui.
- [Floating Modal Chat](https://www.assistant-ui.com/examples/modal.mdx): Embeddable AI assistant in a floating button modal — drop into any React app for in-product copilots or support chat, built on assistant-ui.
- [Perplexity Clone](https://www.assistant-ui.com/examples/perplexity.mdx): Open-source Perplexity-style chat in React — theme-aware composer, functional Search and Model dropdowns, four-state primary action, and a Search-icon assistant avatar.
- [LangGraph Stockbroker Demo](https://www.assistant-ui.com/examples/stockbroker.mdx): Human-in-the-loop AI stockbroker built on LangGraph and assistant-ui — interrupt handling, tool approval, and an interactive React chat UI.