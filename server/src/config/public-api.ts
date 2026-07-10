import CONFIG from "@/config/index.js";

type AuthExemptRoute = {
  path: string;
  match: "exact" | "prefix";
};

type PublicApiRoute = {
  method: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  path: string;
  tag: string;
  summary: string;
};

export const AUTH_EXEMPT_ROUTES: AuthExemptRoute[] = [
  { path: "/login", match: "exact" },
  { path: "/health", match: "exact" },
  { path: "/app/meta", match: "exact" },
  { path: "/attachments", match: "prefix" },
  { path: "/microapps/tts/ref-audios", match: "prefix" },
  { path: "/artifacts/image-generation", match: "prefix" },
  { path: "/assets/avatars", match: "prefix" },
  { path: "/docs", match: "prefix" },
  { path: "/client-coverage", match: "prefix" },
  { path: "/server-coverage", match: "prefix" },
  { path: CONFIG.SWAGGER_PREFIX, match: "prefix" },
];

const AUTH_EXEMPT_PATH_PATTERNS = [
  /^\/microapps\/image-generation\/generations\/[^/]+\/events$/u,
];

export const PUBLIC_API_ROUTES = {
  taskDefaultChat: {
    method: "POST",
    path: "/proxy/task/default",
    tag: "Task Proxy",
    summary: "Stream task execution through the configured default task model",
  },
  providerChat: {
    method: "POST",
    path: "/proxy/chat/:provider",
    tag: "Provider Proxy",
    summary: "Stream chat through the configured provider",
  },
  providerEmbeddings: {
    method: "POST",
    path: "/proxy/embeddings/:provider",
    tag: "Provider Proxy",
    summary: "Generate embeddings through the configured provider",
  },
} as const satisfies Record<string, PublicApiRoute>;

export const OPENAPI_PUBLIC_TAGS = [
  {
    name: "Task Proxy",
    description: "公开任务模型代理接口",
  },
  {
    name: "Provider Proxy",
    description: "公开 Provider chat 与 embeddings 代理接口",
  },
  {
    name: "Attachments",
    description: "聊天附件上传与静态访问接口",
  },
  {
    name: "Built-in Assets",
    description: "内置只读静态资源，例如系统头像",
  },
];

export const isAuthExemptPath = (url: string) => {
  const pathname = url.split("?")[0] || "/";

  if (AUTH_EXEMPT_PATH_PATTERNS.some((pattern) => pattern.test(pathname))) {
    return true;
  }

  return AUTH_EXEMPT_ROUTES.some((route) => {
    if (route.match === "exact") {
      return pathname === route.path;
    }

    return pathname === route.path || pathname.startsWith(`${route.path}/`);
  });
};
