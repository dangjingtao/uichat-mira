/**
 * 统一 API 响应规范
 */

export interface ApiSuccessResponse<T = any> {
  success: true;
  data: T;
  message?: string;
  timestamp: string;
}

export interface ApiErrorResponse {
  success: false;
  message: string;
  code?: string | number;
  errors?: any[];
  timestamp: string;
}

export type ApiResponse<T = any> = ApiSuccessResponse<T> | ApiErrorResponse;

/**
 * 构建成功响应
 */
export function success<T>(data: T, message?: string): ApiSuccessResponse<T> {
  return {
    success: true,
    data,
    message,
    timestamp: new Date().toISOString(),
  };
}

/**
 * 构建失败响应
 */
export function error(
  message: string,
  code?: string | number,
  errors?: any[],
): ApiErrorResponse {
  return {
    success: false,
    message,
    code,
    errors,
    timestamp: new Date().toISOString(),
  };
}

/**
 * 常用错误码
 */
export const ErrorCodes = {
  VALIDATION_ERROR: "VALIDATION_ERROR",
  UNAUTHORIZED: "UNAUTHORIZED",
  FORBIDDEN: "FORBIDDEN",
  NOT_FOUND: "NOT_FOUND",
  INTERNAL_ERROR: "INTERNAL_ERROR",
  DATABASE_ERROR: "DATABASE_ERROR",
} as const;

export type ErrorCode = (typeof ErrorCodes)[keyof typeof ErrorCodes];

export function handleValidationError(request: any, reply: any) {
  if (request.validationError) {
    const validationError = request.validationError as {
      validation?: unknown[];
    };

    return reply
      .code(400)
      .send(
        error(
          "Invalid request payload",
          ErrorCodes.VALIDATION_ERROR,
          validationError.validation,
        ),
      );
  }
  return null;
}
