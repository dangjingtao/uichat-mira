import { resolveRoleContext } from "./thread-request-context-role.resolver.js";
import { resolveSummaryContext } from "./thread-request-context-summary.resolver.js";
import { resolveMemoryContext } from "./thread-request-context-memory.resolver.js";
import { resolveAgentContext } from "./thread-request-context-agent.resolver.js";
import type {
  RequestContextExecutionNode,
  RequestContextMessage,
  RequestContextResolver,
  RequestContextThread,
} from "./thread-request-context.types.js";

/**
 * Thread-level request context is persisted on the thread, but it must not be
 * rendered as visible chat history. This node is the single place that turns
 * those persisted thread fields into request-only system messages.
 *
 * Current sources:
 * 1. Role binding (`roleId`)
 * 2. Thread context summary (`contextSummary`)
 * 3. Thread long-term memory (`memoryContext`)
 * 4. Thread agent mode (`agentEnabled`)
 *
 * Future sources can be added as extra resolvers without changing the caller:
 * - vector memory hits
 * - long-term user preferences
 * - tool usage constraints
 * - role growth / dynamic persona state
 */

/**
 * Resolver chain order matters because the resulting messages are prepended to
 * the outbound request in array order.
 *
 * Current convention:
 * - stable role scaffold first
 * - evolving thread summary second
 * - durable memory after summary
 * - execution-oriented agent instructions last
 *
 * This makes future additions easier to reason about: stable identity goes
 * earlier, dynamic state goes later.
 */
const requestContextResolvers: RequestContextResolver[] = [
  resolveRoleContext,
  resolveSummaryContext,
  resolveMemoryContext,
  resolveAgentContext,
];

export const threadRequestContextNode = {
  /**
   * Collects all request-only thread context and converts it into system
   * messages that can be prepended before the visible conversation history.
   */
  createRequestContext(thread: RequestContextThread, userId: number) {
    const resolved = requestContextResolvers
      .map((resolver) => resolver({ thread, userId }))
      .filter((entry) => entry !== null);

    return {
      messages: resolved
        .map((entry) => entry?.message ?? null)
        .filter((message): message is RequestContextMessage => message !== null),
      executionNodes: resolved
        .map((entry) => entry?.executionNode ?? null)
        .filter(
          (node): node is RequestContextExecutionNode => node !== null,
        ),
    };
  },
};
