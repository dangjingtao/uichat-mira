import crypto from "node:crypto";
import type { NormalizedChatMessage } from "@/services/provider-proxy.message-protocol.js";
import { prepareSkillContext } from "../context/index.js";
import {
  getSkillConversationFlowRuntime,
  getSkillDirectiveHandoffRuntime,
} from "./registry.js";
import { getSkillFlowSession, saveSkillFlowSession } from "./state-store.js";
import type {
  SkillDirective,
  SkillFlowRuntimeResult,
  StoredSkillFlowSession,
} from "./types.js";

const MAX_PROCESSED_MESSAGE_IDS = 64;

const createSession = (input: {
  threadId: string;
  userId: number;
  skillId: string;
  skillVersion: string;
  maxRounds: number;
  state: Record<string, unknown>;
}): StoredSkillFlowSession => {
  const now = new Date().toISOString();
  return {
    sessionId: crypto.randomUUID(),
    threadId: input.threadId,
    userId: input.userId,
    skillId: input.skillId,
    skillVersion: input.skillVersion,
    status: "collecting",
    round: 0,
    maxRounds: input.maxRounds,
    state: input.state,
    processedMessageIds: [],
    createdAt: now,
    updatedAt: now,
  };
};

const withProcessedMessage = (
  session: StoredSkillFlowSession,
  userMessageId: string,
  directive: SkillDirective,
): StoredSkillFlowSession => ({
  ...session,
  lastDirective: directive,
  processedMessageIds: [
    ...session.processedMessageIds.filter((id) => id !== userMessageId),
    userMessageId,
  ].slice(-MAX_PROCESSED_MESSAGE_IDS),
  updatedAt: new Date().toISOString(),
});

const executeBoundedHandoff = async (
  result: SkillFlowRuntimeResult,
): Promise<SkillFlowRuntimeResult> => {
  const targetSkillId = result.directive.next?.targetSkillId;
  if (!result.directive.flowCompleted || !targetSkillId) return result;

  const handoffRuntime = getSkillDirectiveHandoffRuntime(targetSkillId);
  if (!handoffRuntime) return result;

  return handoffRuntime.execute({
    session: result.session,
    sourceDirective: result.directive,
    args: result.directive.next?.args ?? {},
  });
};

export type PreparedSkillConversationFlow = {
  directive: SkillDirective;
  activeSkillId: string;
  requestContextMessages?: NormalizedChatMessage[];
};

export const prepareSkillConversationFlow = async (input: {
  threadId: string;
  userId: number;
  userMessageId: string;
  query: string;
  messages: NormalizedChatMessage[];
}): Promise<PreparedSkillConversationFlow | undefined> => {
  let session = await getSkillFlowSession({
    threadId: input.threadId,
    userId: input.userId,
  });

  if (
    session?.lastDirective &&
    session.processedMessageIds.includes(input.userMessageId)
  ) {
    return {
      directive: session.lastDirective,
      activeSkillId: session.lastDirective.skillId,
    };
  }

  let runtime =
    session &&
    (session.status === "collecting" || session.status === "final_confirmation")
      ? getSkillConversationFlowRuntime(session.skillId)
      : null;

  if (!runtime) {
    const matched = await prepareSkillContext({
      query: input.query,
      messages: input.messages,
    });
    const matchedSkillId = matched?.primary?.id;
    runtime = matchedSkillId
      ? getSkillConversationFlowRuntime(matchedSkillId)
      : null;
    if (!runtime) return undefined;

    session = createSession({
      threadId: input.threadId,
      userId: input.userId,
      skillId: runtime.skillId,
      skillVersion: runtime.version,
      maxRounds: runtime.maxRounds,
      state: runtime.createInitialState(),
    });
  }

  const conversationResult = await runtime.processTurn({
    session,
    threadId: input.threadId,
    userId: input.userId,
    userMessageId: input.userMessageId,
    query: input.query,
    messages: input.messages,
  });
  const result = await executeBoundedHandoff(conversationResult);
  const persistedSession = withProcessedMessage(
    result.session,
    input.userMessageId,
    result.directive,
  );
  await saveSkillFlowSession(persistedSession);

  return {
    directive: result.directive,
    activeSkillId: result.directive.skillId,
    requestContextMessages: result.requestContextMessages,
  };
};
