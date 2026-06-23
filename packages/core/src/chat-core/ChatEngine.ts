import { createChatRequestBody } from "./transport";
import type {
  ChatEngineAttachmentRepository,
  ChatEngineCreateRequestInput,
  ChatEngineThreadRepository,
  ChatEngineTransport,
  ChatRequestBody,
} from "./types";

export type ChatEngineOptions<
  TThreadSummary = unknown,
  TThreadDetail = TThreadSummary,
  TAttachmentUploadResult = unknown,
  TAttachmentDeleteResult = void,
> = {
  transport?: ChatEngineTransport;
  threads?: ChatEngineThreadRepository<TThreadSummary, TThreadDetail>;
  attachments?: ChatEngineAttachmentRepository<
    TAttachmentUploadResult,
    TAttachmentDeleteResult
  >;
};

const defaultTransport: ChatEngineTransport = {
  createRequestBody(input: ChatEngineCreateRequestInput): ChatRequestBody {
    return createChatRequestBody(input.messages, {
      threadId: input.threadId,
      baseBody: input.body,
      historyPolicy: input.historyPolicy,
    });
  },
};

/**
 * ChatEngine is the app-owned chat core entry point.
 *
 * It intentionally does not depend on React, browser local storage, or any
 * specific chat UI runtime. Consumers can wire it into uchat UI bindings or a
 * custom renderer later without changing message protocol ownership.
 */
export class ChatEngine<
  TThreadSummary = unknown,
  TThreadDetail = TThreadSummary,
  TAttachmentUploadResult = unknown,
  TAttachmentDeleteResult = void,
> {
  readonly transport: ChatEngineTransport;
  readonly threads?: ChatEngineThreadRepository<TThreadSummary, TThreadDetail>;
  readonly attachments?: ChatEngineAttachmentRepository<
    TAttachmentUploadResult,
    TAttachmentDeleteResult
  >;

  constructor(
    options: ChatEngineOptions<
      TThreadSummary,
      TThreadDetail,
      TAttachmentUploadResult,
      TAttachmentDeleteResult
    > = {},
  ) {
    this.transport = options.transport ?? defaultTransport;
    this.threads = options.threads;
    this.attachments = options.attachments;
  }

  createRequestBody(input: ChatEngineCreateRequestInput) {
    return this.transport.createRequestBody(input);
  }
}
