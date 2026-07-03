import { get, post } from "../lib/request";
import type { SessionUser } from "../types/auth";

export interface LoginResponse {
  token: string;
  tokenType: string;
  user: SessionUser;
  expiresIn: number;
}

export interface LoginCredentials {
  username: string;
  password: string;
}

export interface ChangePasswordPayload {
  currentPassword: string;
  newPassword: string;
}

export async function login(
  credentials: LoginCredentials,
): Promise<LoginResponse> {
  return post<LoginResponse>("/login", credentials);
}

export async function getCurrentUser(): Promise<{ user: SessionUser }> {
  return get<{ user: SessionUser }>("/me");
}

export async function changePassword(
  payload: ChangePasswordPayload,
): Promise<{ user: SessionUser }> {
  return post<{ user: SessionUser }>("/account/change-password", payload);
}
