import type {
  FastifyError,
  FastifyReply,
  FastifyRequest,
  FastifySchema,
  RawReplyDefaultExpression,
  RawRequestDefaultExpression,
  RawServerDefault,
  RouteGenericInterface,
} from "fastify";
import {
  createAppError,
  getErrorMessage,
  INVALID_REQUEST_PAYLOAD_MESSAGE,
  isAppError,
} from "@/utils/errors.js";
import {
  errorResponse,
  ErrorCodes,
  type ErrorCode,
} from "@/utils/response.js";

export type RouteFailureCode = ErrorCode | string | number;

export const createRouteError = (input: {
  statusCode: number;
  code: RouteFailureCode;
  message: string;
  errors?: unknown[];
  cause?: unknown;
  logMessage?: string;
}) => createAppError(input);

export const badRequest = (
  message: string,
  options?: { errors?: unknown[]; cause?: unknown; logMessage?: string },
) =>
  createRouteError({
    statusCode: 400,
    code: ErrorCodes.VALIDATION_ERROR,
    message,
    ...options,
  });

export const notFound = (
  message: string,
  options?: { cause?: unknown; logMessage?: string },
) =>
  createRouteError({
    statusCode: 404,
    code: ErrorCodes.NOT_FOUND,
    message,
    ...options,
  });

export const unauthorized = (message: string) =>
  createRouteError({
    statusCode: 401,
    code: ErrorCodes.UNAUTHORIZED,
    message,
  });

export const forbidden = (
  message: string,
  options?: { cause?: unknown; logMessage?: string },
) =>
  createRouteError({
    statusCode: 403,
    code: ErrorCodes.FORBIDDEN,
    message,
    ...options,
  });

export const internalError = (
  message: string,
  options?: { cause?: unknown; logMessage?: string },
) =>
  createRouteError({
    statusCode: 500,
    code: ErrorCodes.INTERNAL_ERROR,
    message,
    ...options,
  });

/**
 * Wrap route handlers with a consistent failure message while preserving typed
 * AppError details thrown inside the handler.
 */
export const routeHandler =
  <RouteGeneric extends RouteGenericInterface = RouteGenericInterface>(
    failureMessage: string,
    handler: (
      request: FastifyRequest<
        RouteGeneric,
        RawServerDefault,
        RawRequestDefaultExpression<RawServerDefault>,
        FastifySchema
      >,
      reply: FastifyReply<
        RawServerDefault,
        RawRequestDefaultExpression<RawServerDefault>,
        RawReplyDefaultExpression<RawServerDefault>,
        RouteGeneric
      >,
    ) => unknown | Promise<unknown>,
  ) =>
  (async function wrappedRouteHandler(
    request: FastifyRequest<
      RouteGeneric,
      RawServerDefault,
      RawRequestDefaultExpression<RawServerDefault>,
      FastifySchema
    >,
    reply: FastifyReply<
      RawServerDefault,
      RawRequestDefaultExpression<RawServerDefault>,
      RawReplyDefaultExpression<RawServerDefault>,
      RouteGeneric
    >,
  ) {
    try {
      return await handler(request, reply);
    } catch (error) {
      if (isAppError(error)) {
        throw error;
      }

      throw internalError(failureMessage, {
        cause: error,
        logMessage: failureMessage,
      });
    }
  });

export const sendRouteError = (
  err: FastifyError,
  request: FastifyRequest,
  reply: FastifyReply,
): void => {
  if (isAppError(err)) {
    const shouldLogAsError = err.statusCode >= 500;
    const logPayload = {
      err: err.cause ?? err,
      code: err.code,
      statusCode: err.statusCode,
      method: request.method,
      url: request.url,
    };

    if (shouldLogAsError) {
      request.log.error(logPayload, err.logMessage ?? err.message);
    } else {
      request.log.warn(logPayload, err.logMessage ?? err.message);
    }

    reply
      .code(err.statusCode)
      .send(errorResponse(err.message, err.code, err.errors));
    return;
  }

  const statusCode = err.statusCode && err.statusCode >= 400
    ? err.statusCode
    : 500;
  const isValidation = statusCode === 400 && Boolean(err.validation);
  const message = isValidation
    ? INVALID_REQUEST_PAYLOAD_MESSAGE
    : getErrorMessage(err);
  const code = isValidation
    ? ErrorCodes.VALIDATION_ERROR
    : ErrorCodes.INTERNAL_ERROR;
  const errors = isValidation ? err.validation : undefined;

  request.log.error(
    {
      err,
      code,
      statusCode,
      method: request.method,
      url: request.url,
    },
    message,
  );
  reply.code(statusCode).send(errorResponse(message, code, errors));
};
