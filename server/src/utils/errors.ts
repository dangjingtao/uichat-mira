export const DEFAULT_UNKNOWN_ERROR_MESSAGE = "Unknown error";
export const INVALID_REQUEST_PAYLOAD_MESSAGE = "Invalid request payload";
export const THREAD_NOT_FOUND_MESSAGE = "Thread not found";
export const THREAD_ACCESS_ERROR_MESSAGE = "Thread not found or not accessible";
export const DOCUMENT_NOT_FOUND_MESSAGE = "Document not found";
export const MODEL_CONFIG_NOT_FOUND_MESSAGE = "Config not found";
export const PROVIDER_CONNECTION_NOT_FOUND_MESSAGE =
  "Provider connection not found";
export const PROVIDER_MODEL_NOT_FOUND_MESSAGE = "Provider model not found";
export const FAILED_GENERATE_EMBEDDINGS_MESSAGE =
  "Failed to generate embeddings";
export const FAILED_SYNC_PROVIDER_MODELS_MESSAGE =
  "Failed to sync provider models";
export const FAILED_SELECT_DEFAULT_MODEL_MESSAGE =
  "Failed to select default model";
export const FAILED_UPDATE_PROVIDER_STATUS_MESSAGE =
  "Failed to update provider status";

export interface AppErrorOptions {
  statusCode: number;
  code: string | number;
  message: string;
  errors?: unknown[];
  cause?: unknown;
  logMessage?: string;
}

export class AppError extends Error {
  readonly statusCode: number;
  readonly code: string | number;
  readonly errors?: unknown[];
  readonly logMessage?: string;

  constructor(options: AppErrorOptions) {
    super(options.message);
    this.name = "AppError";
    this.statusCode = options.statusCode;
    this.code = options.code;
    this.errors = options.errors;
    this.cause = options.cause;
    this.logMessage = options.logMessage;
  }
}

export const isAppError = (error: unknown): error is AppError =>
  error instanceof AppError;

export const createAppError = (options: AppErrorOptions): AppError =>
  new AppError(options);

export const getErrorMessage = (
  error: unknown,
  fallback = DEFAULT_UNKNOWN_ERROR_MESSAGE,
) => (error instanceof Error ? error.message : fallback);

export const isErrorMessage = (error: unknown, message: string) =>
  error instanceof Error && error.message === message;
