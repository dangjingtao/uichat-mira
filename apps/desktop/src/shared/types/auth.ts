export type UserRole = "admin" | "user";

export type SessionUser = {
  id: number;
  username: string;
  role: UserRole;
};

export type SessionState = {
  token: string;
  user: SessionUser;
};
