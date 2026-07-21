import axios, {
  AxiosInstance,
  AxiosRequestConfig,
  AxiosResponse,
  InternalAxiosRequestConfig,
  AxiosError,
} from "axios";
import { getSession, notifyAuthRequired } from "./sessionStorage";
import { getApiBaseUrl } from "@/shared/platform/desktopRuntime";

const DEFAULT_REQUEST_TIMEOUT_MS = 5 * 60 * 1000;

// ==================== 类型定义 ====================

// API 统一响应格式
export interface ApiSuccessResponse<T> {
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

export type ApiResponse<T> = ApiSuccessResponse<T> | ApiErrorResponse;

// 错误码枚举
export enum ErrorCodes {
  VALIDATION_ERROR = "VALIDATION_ERROR",
  UNAUTHORIZED = "UNAUTHORIZED",
  FORBIDDEN = "FORBIDDEN",
  NOT_FOUND = "NOT_FOUND",
  INTERNAL_ERROR = "INTERNAL_ERROR",
  DATABASE_ERROR = "DATABASE_ERROR",
}

// API 请求错误
export class ApiError extends Error {
  code?: string | number;
  errors?: any[];
  timestamp: string;

  constructor(errorResponse: ApiErrorResponse) {
    super(errorResponse.message);
    this.name = "ApiError";
    this.code = errorResponse.code;
    this.errors = errorResponse.errors;
    this.timestamp = errorResponse.timestamp;
  }
}

// ==================== 响应拦截器 ====================

// 处理成功响应
function handleSuccessResponse<T>(
  response: AxiosResponse<ApiSuccessResponse<T>>,
): T {
  if (response.data.success) {
    return response.data.data as T;
  }

  // 失败响应 - 抛出 ApiError
  const apiError = new ApiError(response.data as unknown as ApiErrorResponse);

  // 处理特定错误码
  if (apiError.code === ErrorCodes.UNAUTHORIZED) {
    notifyAuthRequired(apiError.message);
  }

  throw apiError;
}

// 处理错误响应
function handleErrorResponse(error: unknown): never {
  if (axios.isAxiosError(error)) {
    const axiosError = error as AxiosError<ApiErrorResponse>;
    const errorMessage =
      axiosError.response?.data?.message || axiosError.message || "请求失败";
    const errorCode = axiosError.response?.data?.code;
    const timestamp =
      axiosError.response?.data?.timestamp || new Date().toISOString();

    const errorResponse: ApiErrorResponse = {
      success: false,
      message: errorMessage,
      code: errorCode,
      timestamp,
    };

    const apiError = new ApiError(errorResponse);

    // 处理特定错误码
    if (apiError.code === ErrorCodes.UNAUTHORIZED) {
      notifyAuthRequired(apiError.message);
    }

    throw apiError;
  }

  throw error;
}

// ==================== API 客户端封装 ====================

// 创建封装的 API 客户端
const createApiClient = () => {
  // 创建原生 axios 实例
  const client = axios.create({
    baseURL: getApiBaseUrl(),
    timeout: DEFAULT_REQUEST_TIMEOUT_MS,
    headers: {
      "Content-Type": "application/json",
    },
  });

  // 请求拦截器
  client.interceptors.request.use(
    (config: InternalAxiosRequestConfig) => {
      if (config.data instanceof FormData) {
        delete config.headers["Content-Type"];
      }

      // 添加认证 token
      const session = getSession();
      if (session?.token) {
        config.headers.Authorization = `Bearer ${session.token}`;
      }
      return config;
    },
    (error) => {
      return Promise.reject(error);
    },
  );

  // 响应拦截器（处理错误）
  client.interceptors.response.use((response) => response, handleErrorResponse);

  // ==================== 封装的请求方法 ====================

  /**
   * GET 请求
   */
  async function get<T>(url: string, config?: AxiosRequestConfig): Promise<T> {
    try {
      const response = await client.get<ApiSuccessResponse<T>>(url, config);
      return handleSuccessResponse<T>(response);
    } catch (error) {
      return handleErrorResponse(error) as never;
    }
  }

  /**
   * POST 请求
   */
  async function post<T>(
    url: string,
    data?: any,
    config?: AxiosRequestConfig,
  ): Promise<T> {
    try {
      const response = await client.post<ApiSuccessResponse<T>>(
        url,
        data,
        config,
      );
      const resp = handleSuccessResponse<T>(response);

      return resp;
    } catch (error) {
      return handleErrorResponse(error) as never;
    }
  }

  /**
   * PUT 请求
   */
  async function put<T>(
    url: string,
    data?: any,
    config?: AxiosRequestConfig,
  ): Promise<T> {
    try {
      const response = await client.put<ApiSuccessResponse<T>>(
        url,
        data,
        config,
      );
      return handleSuccessResponse<T>(response);
    } catch (error) {
      return handleErrorResponse(error) as never;
    }
  }

  /**
   * PATCH 请求
   */
  async function patch<T>(
    url: string,
    data?: any,
    config?: AxiosRequestConfig,
  ): Promise<T> {
    try {
      const response = await client.patch<ApiSuccessResponse<T>>(
        url,
        data,
        config,
      );
      return handleSuccessResponse<T>(response);
    } catch (error) {
      return handleErrorResponse(error) as never;
    }
  }

  /**
   * DELETE 请求
   */
  async function del<T>(url: string, config?: AxiosRequestConfig): Promise<T> {
    try {
      const response = await client.delete<ApiSuccessResponse<T>>(url, config);
      return handleSuccessResponse<T>(response);
    } catch (error) {
      return handleErrorResponse(error) as never;
    }
  }

  // 返回封装的 API 客户端
  return {
    get,
    post,
    put,
    patch,
    delete: del,
    // 原始 axios 实例，供特殊需求使用
    client,
  };
};

// 创建全局 API 客户端实例
const apiClient = createApiClient();

// ==================== 导出 ====================

// 导出封装的请求方法
export const { get, post, put, patch, delete: del, client } = apiClient;

// 导出原始 axios 实例别名
export { client as apiClient };

// 导出类型
export type { AxiosRequestConfig, AxiosResponse };
