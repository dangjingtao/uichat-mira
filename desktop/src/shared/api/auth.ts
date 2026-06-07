import { get, post } from "../lib/request";
import type { SessionUser } from "../types/auth";

// 登录响应类型
export interface LoginResponse {
  token: string;
  tokenType: string;
  user: SessionUser;
  expiresIn: number;
}

// 登录请求参数
export interface LoginCredentials {
  username: string;
  password: string;
}

/**
 * 用户登录
 * @param credentials 登录凭证
 * @returns Promise<LoginResponse>
 */
export async function login(
  credentials: LoginCredentials,
): Promise<LoginResponse> {
  return post<LoginResponse>("/login", credentials);
}

/**
 * 获取当前用户信息
 * @returns Promise<{ user: SessionUser }>
 */
export async function getCurrentUser(): Promise<{ user: SessionUser }> {
  return get<{ user: SessionUser }>("/me");
}
