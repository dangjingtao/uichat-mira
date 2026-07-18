import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import { FastifyPluginAsync } from "fastify";
import { createAccessToken } from "@/db/auth.db.js";
import { badRequest, routeHandler, unauthorized } from "@/utils/route-errors.js";
import { success } from "@/utils/response.js";
import CONFIG from "@/config";

const CLIENT_ID = "mira-clipper";
const CODE_TTL_MS = 5 * 60 * 1000;
const codes = new Map<string, {
  clientId: string;
  redirectUri: string;
  codeChallenge: string;
  user: { id: number; username: string; role: "admin" | "user" };
  expiresAt: number;
}>();
const manualCodes = new Map<string, {
  user: { id: number; username: string; role: "admin" | "user" };
  expiresAt: number;
}>();

const base64Url = (value: Buffer) => value.toString("base64url");
const wrapExtensionCode = (code: string) => `${Buffer.from(String(CONFIG.PORT)).toString("base64url")}.${code}`;

const isAllowedRedirect = (value: string) => {
  try {
    const url = new URL(value);
    return url.protocol === "https:" && url.hostname.endsWith(".chromiumapp.org");
  } catch {
    return false;
  }
};

const validateAuthorizeQuery = (query: Record<string, string | undefined>) => {
  if (query.client_id !== CLIENT_ID || query.response_type !== "code") {
    throw badRequest("不支持的 OAuth 客户端或响应类型");
  }
  if (!query.redirect_uri || !isAllowedRedirect(query.redirect_uri)) {
    throw badRequest("无效的 OAuth 回调地址");
  }
  if (!query.state || !query.code_challenge || query.code_challenge_method !== "S256") {
    throw badRequest("OAuth 参数不完整");
  }
};

const issueCode = (input: {
  redirectUri: string;
  codeChallenge: string;
  user: { id: number; username: string; role: "admin" | "user" };
}) => {
  const code = base64Url(randomBytes(32));
  codes.set(code, {
    clientId: CLIENT_ID,
    redirectUri: input.redirectUri,
    codeChallenge: input.codeChallenge,
    user: input.user,
    expiresAt: Date.now() + CODE_TTL_MS,
  });
  return code;
};

const oauthRoute: FastifyPluginAsync = async (app) => {
  app.addContentTypeParser(
    "application/x-www-form-urlencoded",
    { parseAs: "string" },
    (_request, body, done) => {
      try {
        done(null, Object.fromEntries(new URLSearchParams(body as string)));
      } catch (error) {
        done(error as Error, undefined);
      }
    },
  );

  app.post<{ Body: Record<string, string | undefined> }>(
    "/oauth/authorize/approve",
    routeHandler("OAuth authorization failed", async (request, reply) => {
      const body = request.body as Record<string, string | undefined>;
      validateAuthorizeQuery(body);
      const user = request.authUser;
      if (!user) throw unauthorized("当前 Mira 登录状态无效");
      const code = wrapExtensionCode(issueCode({ redirectUri: body.redirect_uri!, codeChallenge: body.code_challenge!, user }));
      const redirect = new URL(body.redirect_uri!);
      redirect.searchParams.set("code", code);
      redirect.searchParams.set("state", body.state!);
      return success({ redirectUri: redirect.toString() });
    }),
  );

  app.post<{ Body: Record<string, string | undefined> }>(
    "/oauth/extension/authorization-code",
    routeHandler("Failed to create extension authorization code", async (request) => {
      const user = request.authUser;
      if (!user) throw unauthorized("当前 Mira 登录状态无效");
      const code = base64Url(randomBytes(24));
      manualCodes.set(code, { user, expiresAt: Date.now() + CODE_TTL_MS });
      return success({ code: wrapExtensionCode(code), expiresIn: Math.floor(CODE_TTL_MS / 1000) });
    }),
  );

  app.post<{ Body: Record<string, string | undefined> }>(
    "/oauth/token",
    routeHandler("OAuth token exchange failed", async (request) => {
      const body = request.body as Record<string, string | undefined>;
      if (body.grant_type !== "authorization_code" || body.client_id !== CLIENT_ID) {
        throw badRequest("无效的 OAuth 换码请求");
      }
      const manualRecord = body.code ? manualCodes.get(body.code) : undefined;
      if (manualRecord) {
        manualCodes.delete(body.code!);
        if (manualRecord.expiresAt < Date.now()) {
          throw unauthorized("授权码无效或已过期");
        }
        return {
          tokenType: "Bearer",
          accessToken: createAccessToken(manualRecord.user),
          expiresIn: CONFIG.JWT_EXPIRES_IN,
        };
      }
      const record = body.code ? codes.get(body.code) : undefined;
      if (!record || record.expiresAt < Date.now()) {
        if (body.code) codes.delete(body.code);
        throw unauthorized("授权码无效或已过期");
      }
      codes.delete(body.code!);
      if (record.redirectUri !== body.redirect_uri || !body.code_verifier) {
        throw unauthorized("OAuth 校验失败");
      }
      const expected = Buffer.from(record.codeChallenge);
      const actual = Buffer.from(base64Url(createHash("sha256").update(body.code_verifier).digest()));
      if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) {
        throw unauthorized("OAuth PKCE 校验失败");
      }
      return {
        tokenType: "Bearer",
        accessToken: createAccessToken(record.user),
        expiresIn: CONFIG.JWT_EXPIRES_IN,
      };
    }),
  );
};

export default oauthRoute;
