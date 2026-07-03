// @vitest-environment jsdom
import { describe, expect, it, beforeEach } from "vitest";
import {
  clearSessionFromStorage,
  getSession,
  readSessionFromStorage,
  writeSessionToStorage,
} from "./sessionStorage";
import type { SessionState } from "../types/auth";

const validSession: SessionState = {
  token: "token-1",
  user: { username: "alice", role: "admin" },
};

describe("sessionStorage", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("returns null when localStorage is empty", () => {
    expect(readSessionFromStorage()).toBeNull();
    expect(getSession()).toBeNull();
  });

  it("returns null for invalid JSON", () => {
    localStorage.setItem("rag-demo-auth-session", "not-json");
    expect(readSessionFromStorage()).toBeNull();
  });

  it("returns null when required fields are missing", () => {
    localStorage.setItem(
      "rag-demo-auth-session",
      JSON.stringify({ token: "only-token" }),
    );
    expect(readSessionFromStorage()).toBeNull();
  });

  it("writes and reads a valid session", () => {
    writeSessionToStorage(validSession);
    expect(readSessionFromStorage()).toEqual(validSession);
  });

  it("clears the stored session", () => {
    writeSessionToStorage(validSession);
    clearSessionFromStorage();
    expect(readSessionFromStorage()).toBeNull();
  });

  it("getSession is an alias for readSessionFromStorage", () => {
    writeSessionToStorage(validSession);
    expect(getSession()).toEqual(readSessionFromStorage());
  });
});
