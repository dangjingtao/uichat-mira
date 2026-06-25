import { resolveRoleContext } from "./thread-request-context-role.resolver.js";
import { resolveSummaryContext } from "./thread-request-context-summary.resolver.js";
import type {
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
 *
 * This makes future additions easier to reason about: stable identity goes
 * earlier, dynamic state goes later.
 */
const requestContextResolvers: RequestContextResolver[] = [
  resolveRoleContext,
  resolveSummaryContext,
];

export const threadRequestContextNode = {
  /**
   * Collects all request-only thread context and converts it into system
   * messages that can be prepended before the visible conversation history.
   */
  createRequestMessages(thread: RequestContextThread, userId: number) {
    return requestContextResolvers
      .map((resolver) => resolver({ thread, userId }))
      .filter((message): message is RequestContextMessage => message !== null);
  },
};
