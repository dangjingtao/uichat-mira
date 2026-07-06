import "@/bootstrap-env.js";
import Fastify from "fastify";
import cors from "@fastify/cors";
import multipart from "@fastify/multipart";
import fastifyStatic from "@fastify/static";
import swagger from "@fastify/swagger";
import swaggerUi from "@fastify/swagger-ui";
import fs from "node:fs/promises";
import path from "node:path";
import fsSync from "node:fs";
import crypto from "node:crypto";
import {
  createComputerUsePlan,
  createComputerUseService,
  createInMemoryComputerUseEvidenceStore,
  createInMemoryComputerUseTaskStore,
  type ComputerUseExecutor,
  type ComputerUseRuntimeState,
  type ComputerUseTask,
  type ComputerUseTaskError,
} from "@/microapps/computer-use/index.js";
import { ComputerUseRuntimeManager } from "@/microapps/computer-use/runtime/manager.js";
import { runComputerUseActions } from "@/microapps/computer-use/executor/runner.js";
import {
  createAliyunWanxAdapter,
  createComfyUiLocalAdapter,
  createOpenAiImagesAdapter,
  createTencentHunyuanAdapter,
} from "@/microapps/image-generation/adapters/index.js";
import { LocalImageGenerationArtifactStore } from "@/microapps/image-generation/artifacts/index.js";
import {
  createImageGenerationService,
  createInMemoryImageGenerationJobStore,
} from "@/microapps/image-generation/index.js";
import { createMailCenterService } from "@/microapps/mail-center/index.js";
import { createNewsHubService } from "@/microapps/news-hub/index.js";
import healthRoute from "@/routes/health";
import appMetaRoute from "@/routes/app-meta";
import dbHealthRoute from "@/routes/dbHealth";
import logsRoute from "@/routes/logs";
import loginRoute from "@/routes/login";
import meRoute from "@/routes/me";
import attachmentRoute from "@/routes/attachments";
import proxyProviderRoute from "@/routes/proxy-provider/index.js";
import accountRoute from "@/routes/account";
import knowledgeBaseRoute from "@/routes/knowledge-base/index.js";
import modelConfigRoute from "@/routes/model-config";
import providerSettingsRoute from "@/routes/provider-settings/index.js";
import roleRoute from "@/routes/role/index.js";
import threadRoute from "@/routes/thread/index.js";
import chatRagRoute from "@/routes/chat-rag";
import ragRuntimeRoute from "@/routes/rag-runtime/index.js";
import evaluationRoute from "@/routes/evaluation/index.js";
import integrationsRoute from "@/routes/integrations/index.js";
import microappsRoute from "@/routes/microapps/index.js";
import wecomRoute from "@/routes/integrations/wecom.js";
import agentRoute from "@/agent/routes.js";
import mcpRoutes from "@/mcp/routes.js";
import {
  initializeExternalMcpDatabase,
  registerAllExternalMcpCapabilities,
} from "@/mcp/external.js";
import { getAuthUserFromRequest, initializeAuthDatabase } from "@/db/auth.db";
import { initializeEvaluationDatabase } from "@/db/evaluation.db";
import { initializeKnowledgeBaseDatabase } from "@/db/knowledge-base.db";
import { initializeModelConfigDatabase } from "@/db/model-config.db";
import { initializeRoleDatabase } from "@/db/role.db";
import { initializeThreadDatabase } from "@/db/thread.db";
import { agentRunRepository } from "@/db/repositories/agent-run.repository.js";
import { integrationCapabilitiesRepository } from "@/db/repositories/integration-capabilities.repository.js";
import { integrationCapabilityMicroAppsRepository } from "@/db/repositories/integration-capability-micro-apps.repository.js";
import { integrationInstancesRepository } from "@/db/repositories/integration-instances.repository.js";
import { mailAccountsRepository } from "@/db/repositories/mail-accounts.repository.js";
import { mailFoldersRepository } from "@/db/repositories/mail-folders.repository.js";
import { mailMessagesRepository } from "@/db/repositories/mail-messages.repository.js";
import { microAppsRepository } from "@/db/repositories/micro-apps.repository.js";
import { newsItemsRepository } from "@/db/repositories/news-items.repository.js";
import { webSearchSettingsRepository } from "@/db/repositories/web-search-settings.repository.js";
import { wecomSettingsRepository } from "@/db/repositories/wecom-settings.repository.js";
import { initializeVectorStore } from "@/db";
import CONFIG from "@/config";
import { isAuthExemptPath, OPENAPI_PUBLIC_TAGS } from "@/config/public-api.js";
import { getLoggerConfig } from "@/logger";
import { evaluationService } from "@/services/evaluation.service.js";
import { getAppMeta } from "@/utils/index.js";
import { sendRouteError, unauthorized } from "@/utils/route-errors.js";
import { MAX_UPLOAD_FILE_BYTES } from "@/constants/knowledge-base.js";
import { attachmentStorageRoot } from "@/services/attachment-storage.service.js";
import { configureAgentRunPersistence } from "@/agent/run-store.js";
import { agentRunStore } from "@/agent/run-store.js";
import { configureInvocationRetention } from "@/mcp/core/invocations.js";
import {
  migrateLegacyMicroAppBindings,
} from "@/microapps/legacy-sync.js";

const app = Fastify({
  bodyLimit: MAX_UPLOAD_FILE_BYTES,
  logger: getLoggerConfig(),
  serializerOpts: { encoding: "utf8" },
});
const allowBackendReuse = process.env.UI_CHAT_ALLOW_BACKEND_REUSE === "1";
const builtinAvatarRoot = path.resolve(process.cwd(), "static", "avatars");
const clientCoverageRoot = path.resolve(process.cwd(), "client-coverage");
const serverCoverageRoot = path.resolve(process.cwd(), "server-coverage");
const docsSiteRoot = path.resolve(process.cwd(), "docs-site");
const swaggerLogoPath = path.resolve(process.cwd(), "static", "logo.png");
const imageGenerationArtifactRoot = path.resolve(
  process.cwd(),
  ".artifacts",
  "image-generation",
);
const computerUseArtifactRoot = path.resolve(
  process.cwd(),
  ".artifacts",
  "computer-use",
);
const computerUseRuntimeRoot = path.resolve(
  computerUseArtifactRoot,
  "runtime",
);
const workspaceSwaggerLogoPath = path.resolve(
  process.cwd(),
  "..",
  "desktop",
  "src",
  "assets",
  "branding",
  "uichat-logo-icon.png",
);

const readSwaggerLogo = async () => {
  const logoPath = fsSync.existsSync(swaggerLogoPath)
    ? swaggerLogoPath
    : workspaceSwaggerLogoPath;
  return fs.readFile(logoPath);
};

app.setErrorHandler(sendRouteError);

const createImageGenerationAdapterRegistry = () => {
  const adapters = [
    process.env.UI_CHAT_IMAGE_GENERATION_OPENAI_API_KEY
      ? createOpenAiImagesAdapter({
          apiKey: process.env.UI_CHAT_IMAGE_GENERATION_OPENAI_API_KEY,
          baseUrl: process.env.UI_CHAT_IMAGE_GENERATION_OPENAI_BASE_URL,
          defaultModel: process.env.UI_CHAT_IMAGE_GENERATION_OPENAI_MODEL,
        })
      : null,
    process.env.UI_CHAT_IMAGE_GENERATION_ALIYUN_API_KEY &&
      process.env.UI_CHAT_IMAGE_GENERATION_ALIYUN_BASE_URL
      ? createAliyunWanxAdapter({
          apiKey: process.env.UI_CHAT_IMAGE_GENERATION_ALIYUN_API_KEY,
          baseUrl: process.env.UI_CHAT_IMAGE_GENERATION_ALIYUN_BASE_URL,
          defaultModel: process.env.UI_CHAT_IMAGE_GENERATION_ALIYUN_MODEL,
        })
      : null,
    process.env.UI_CHAT_IMAGE_GENERATION_TENCENT_SECRET_ID &&
      process.env.UI_CHAT_IMAGE_GENERATION_TENCENT_SECRET_KEY
      ? createTencentHunyuanAdapter({
          secretId: process.env.UI_CHAT_IMAGE_GENERATION_TENCENT_SECRET_ID,
          secretKey: process.env.UI_CHAT_IMAGE_GENERATION_TENCENT_SECRET_KEY,
          region: process.env.UI_CHAT_IMAGE_GENERATION_TENCENT_REGION,
          endpoint: process.env.UI_CHAT_IMAGE_GENERATION_TENCENT_ENDPOINT,
          version: process.env.UI_CHAT_IMAGE_GENERATION_TENCENT_VERSION,
        })
      : null,
    process.env.UI_CHAT_IMAGE_GENERATION_COMFYUI_BASE_URL
      ? createComfyUiLocalAdapter({
          baseUrl: process.env.UI_CHAT_IMAGE_GENERATION_COMFYUI_BASE_URL,
          clientId: process.env.UI_CHAT_IMAGE_GENERATION_COMFYUI_CLIENT_ID,
        })
      : null,
  ].filter((adapter) => adapter !== null);

  return {
    getAdapter(providerId: string) {
      return adapters.find((item) => item.providerId === providerId) ?? null;
    },
  };
};

const imageGenerationService = createImageGenerationService({
  adapterRegistry: createImageGenerationAdapterRegistry(),
  artifactStore: new LocalImageGenerationArtifactStore({
    rootDir: imageGenerationArtifactRoot,
  }),
  // Current strategy is intentionally temporary: jobs stay in process memory
  // until a dedicated persistent store is approved and implemented.
  jobStore: createInMemoryImageGenerationJobStore(),
});

const computerUseRuntimeManager = new ComputerUseRuntimeManager({
  storageRoot: computerUseRuntimeRoot,
});

const nowIso = () => new Date().toISOString();

const toComputerUseRuntimeState = (
  checkedAt: string,
): ComputerUseRuntimeState => {
  const resolved = computerUseRuntimeManager.resolveRuntime();

  if (resolved.status === "ready") {
    return {
      status: "ready",
      browserEngine: resolved.runtime.channel,
      version: resolved.runtime.version,
      checkedAt,
      details: {
        strategy: resolved.strategy,
        executablePath: resolved.runtime.executablePath,
        source: resolved.runtime.source,
        inspectedCandidates: resolved.inspectedCandidates,
      },
    };
  }

  return {
    status: "not_installed",
    checkedAt,
    message: resolved.reason,
    details: {
      strategy: resolved.strategy,
      inspectedCandidates: resolved.inspectedCandidates,
    },
  };
};

const extractFirstUrl = (input: string) => {
  const matched = input.match(/https?:\/\/[^\s]+/i);
  return matched?.[0];
};

const normalizeSiteTarget = (value?: string) => {
  if (!value) {
    return undefined;
  }
  if (/^https?:\/\//i.test(value)) {
    return value;
  }
  return `https://${value}`;
};

const resolveTargetUrl = (task: ComputerUseTask) =>
  extractFirstUrl(task.goal) ?? normalizeSiteTarget(task.siteScope[0]);

const createApprovalRequest = (task: ComputerUseTask) => ({
  id: `approval_${crypto.randomUUID()}`,
  stepId: "step-submit",
  status: "pending" as const,
  title: "Approve browser task execution",
  reason:
    "This browser task may navigate, click, or submit data on an external site.",
  requestedAt: nowIso(),
  requestedBy: task.requestedBy,
});

const createBlockedResult = (
  summary: string,
  error: ComputerUseTaskError,
  completedAt: string,
) => ({
  status: "blocked" as const,
  summary,
  completedAt,
  error,
});

const executeBrowserTask = async (
  task: ComputerUseTask,
  runtime: ComputerUseRuntimeState,
) => {
  const checkedAt = nowIso();
  const executablePath =
    typeof runtime.details?.executablePath === "string"
      ? runtime.details.executablePath
      : undefined;
  const targetUrl = resolveTargetUrl(task);

  if (!executablePath || !targetUrl) {
    const completedAt = nowIso();
    return {
      status: "blocked" as const,
      currentStepId: "step-open",
      evidenceEntries: [
        {
          id: `evidence_${crypto.randomUUID()}`,
          kind: "error" as const,
          message: !targetUrl
            ? "Task is missing a concrete target URL or site scope."
            : "Runtime is ready but executablePath is unavailable.",
          createdAt: checkedAt,
          stepId: "step-open",
        },
      ],
      result: createBlockedResult(
        !targetUrl
          ? "Task is blocked because no target URL or site scope was provided."
          : "Task is blocked because the runtime executable path is unavailable.",
        {
          code: !targetUrl
            ? "COMPUTER_USE_TARGET_REQUIRED"
            : "COMPUTER_USE_RUNTIME_EXECUTABLE_MISSING",
          message: !targetUrl
            ? "Provide a URL in the goal or a siteScope entry before starting the task."
            : "Runtime executablePath is missing from the resolved runtime state.",
        },
        completedAt,
      ),
      meta: {
        checkedAt,
      },
    };
  }

  const artifactDir = path.join(computerUseArtifactRoot, "tasks", task.id);
  const execution = await runComputerUseActions(
    [
      { kind: "navigate", url: targetUrl, waitUntil: "load" },
      {
        kind: "capture",
        artifactPath: path.join(task.id, "landing-page.png"),
      },
      {
        kind: "finish",
        summary: `Opened ${targetUrl} and captured the landing page.`,
      },
    ],
    {
      artifactRoot: artifactDir,
      executablePath,
      headless: true,
    },
  );

  const finishedAt = nowIso();
  const capturePath = execution.captures[0];

  return {
    status: "succeeded" as const,
    currentStepId: "step-open",
    evidenceEntries: execution.steps.map((step, index) => ({
      id: `evidence_${crypto.randomUUID()}`,
      kind: "action" as const,
      message: step.detail,
      createdAt: checkedAt,
      stepId: index === execution.steps.length - 1 ? "step-capture" : "step-open",
    })),
    artifacts: capturePath
      ? [
          {
            id: `artifact_${crypto.randomUUID()}`,
            kind: "screenshot" as const,
            label: "Landing page capture",
            filePath: capturePath,
            createdAt: finishedAt,
          },
        ]
      : [],
    result: {
      status: "succeeded" as const,
      summary:
        execution.finishSummary ??
        `Opened ${targetUrl} and captured the landing page.`,
      completedAt: finishedAt,
      finalUrl: execution.finalUrl,
    },
  };
};

const computerUseExecutor: ComputerUseExecutor = {
  async createPlan({ goal, siteScope }) {
    const targetUrl = extractFirstUrl(goal) ?? normalizeSiteTarget(siteScope[0]);
    return createComputerUsePlan({
      createdAt: nowIso(),
      summary: targetUrl
        ? `Open ${targetUrl}, observe the page state, and capture a screenshot.`
        : "Resolve the target site, open it in the managed browser, and capture a screenshot.",
      steps: [
        {
          id: "step-open",
          title: "Open target page",
          description: targetUrl
            ? `Navigate to ${targetUrl}.`
            : "Navigate to the requested target page.",
          status: "pending",
          requiresApproval: false,
        },
        {
          id: "step-capture",
          title: "Capture evidence",
          description: "Capture a screenshot after the page loads.",
          status: "pending",
          requiresApproval: false,
        },
        {
          id: "step-submit",
          title: "Approve high-risk browser actions",
          description:
            "If the task needs clicks, typing, or data submission, require explicit approval before continuing.",
          status: "pending",
          requiresApproval: true,
          approvalReason:
            "Browser tasks may trigger clicks or send data to an external site.",
        },
      ],
      riskSummary:
        "第一阶段 server 只自动执行受控打开页和截图；后续点击、输入、提交属于需要审批的高风险动作。",
    });
  },
  async runTask({ task, runtime }) {
    const goalLower = task.goal.toLowerCase();
    const needsApproval =
      goalLower.includes("submit") ||
      goalLower.includes("send") ||
      goalLower.includes("login") ||
      goalLower.includes("purchase") ||
      goalLower.includes("delete");

    if (needsApproval) {
      return {
        status: "awaiting_approval" as const,
        currentStepId: "step-submit",
        evidenceEntries: [
          {
            id: `evidence_${crypto.randomUUID()}`,
            kind: "approval" as const,
            message:
              "Task paused before high-risk browser actions and is waiting for approval.",
            createdAt: nowIso(),
            stepId: "step-submit",
          },
        ],
        approvalRequest: createApprovalRequest(task),
      };
    }

    return executeBrowserTask(task, runtime);
  },
  async resumeTask({ task, runtime }) {
    return executeBrowserTask(task, runtime);
  },
  async cancelTask() {
    return;
  },
};

const computerUseService = createComputerUseService({
  runtimeManager: {
    async getRuntimeState() {
      return toComputerUseRuntimeState(nowIso());
    },
  },
  executor: computerUseExecutor,
  evidenceStore: createInMemoryComputerUseEvidenceStore(),
  taskStore: createInMemoryComputerUseTaskStore(),
});

const computerUseRuntimeService = {
  async getRuntimeState() {
    return toComputerUseRuntimeState(nowIso());
  },
  async installRuntime(request: {
    version: string;
    archiveUrl: string;
    executableRelativePath: string;
    expectedSha256?: string;
  }) {
    await computerUseRuntimeManager.installManagedRuntime(request);
    return toComputerUseRuntimeState(nowIso());
  },
};

const mailCenterService = createMailCenterService();
const newsHubService = createNewsHubService();

const setupPlugins = async () => {
  const appMeta = getAppMeta();

  await app.register(cors, {
    origin: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    exposedHeaders: ["Content-Disposition", "Content-Length"],
  });

  await app.register(multipart, {
    limits: {
      files: 1,
      fileSize: MAX_UPLOAD_FILE_BYTES,
    },
  });

  await fs.mkdir(attachmentStorageRoot, { recursive: true });
  await app.register(fastifyStatic, {
    root: attachmentStorageRoot,
    prefix: "/attachments/",
    decorateReply: false,
    setHeaders(response) {
      response.setHeader(
        "Cache-Control",
        "private, max-age=31536000, immutable",
      );
    },
  });

  if (fsSync.existsSync(builtinAvatarRoot)) {
    await app.register(fastifyStatic, {
      root: builtinAvatarRoot,
      prefix: "/assets/avatars/",
      decorateReply: false,
      setHeaders(response) {
        response.setHeader(
          "Cache-Control",
          "public, max-age=31536000, immutable",
        );
      },
    });
  }

  if (fsSync.existsSync(clientCoverageRoot)) {
    await app.register(fastifyStatic, {
      root: clientCoverageRoot,
      prefix: "/client-coverage/",
      decorateReply: false,
      setHeaders(response) {
        response.setHeader("Cache-Control", "private, no-cache");
      },
    });
  }

  if (fsSync.existsSync(serverCoverageRoot)) {
    await app.register(fastifyStatic, {
      root: serverCoverageRoot,
      prefix: "/server-coverage/",
      decorateReply: false,
      setHeaders(response) {
        response.setHeader("Cache-Control", "private, no-cache");
      },
    });
  }

  if (fsSync.existsSync(docsSiteRoot)) {
    await app.register(fastifyStatic, {
      root: docsSiteRoot,
      prefix: "/docs/",
      decorateReply: false,
      wildcard: false,
      index: ["index.html"],
      setHeaders(response) {
        response.setHeader("Cache-Control", "private, no-cache");
      },
    });

    app.get("/docs", async (_request, reply) => {
      return reply.sendFile("index.html");
    });

    app.get("/docs/*", async (request, reply) => {
      const docsPath = (request.params as { "*": string })["*"] ?? "";
      const normalizedPath = path
        .normalize(docsPath)
        .replace(/^(\.\.[/\\])+/, "");
      const candidatePath = path.join(docsSiteRoot, normalizedPath);
      const withinRoot =
        candidatePath === docsSiteRoot ||
        candidatePath.startsWith(`${docsSiteRoot}${path.sep}`);

      if (!withinRoot) {
        reply.code(403);
        return reply.send("Forbidden");
      }

      const existingPath = fsSync.existsSync(candidatePath)
        ? candidatePath
        : null;
      if (existingPath && fsSync.statSync(existingPath).isFile()) {
        return reply.sendFile(normalizedPath);
      }

      return reply.sendFile("index.html");
    });
  }

  app.addHook("preHandler", async (request, reply) => {
    if (request.method === "OPTIONS" || isAuthExemptPath(request.url)) {
      return;
    }

    const user = getAuthUserFromRequest(request);
    if (!user) {
      const authHeader = request.headers.authorization;
      throw unauthorized(
        authHeader && authHeader.startsWith("Bearer ")
          ? "Invalid auth token"
          : "Missing auth token",
      );
    }

    request.authUser = user;
  });

  await app.register(swagger, {
    openapi: {
      info: {
        title: "UIChat Mira Server API",
        description: "Backend APIs for UIChat Mira desktop/server integration",
        version: appMeta.version,
      },
      servers: [{ url: `http://127.0.0.1:${CONFIG.PORT}` }],
      tags: [
        { name: "System", description: "系统健康检查与状态" },
        { name: "Auth", description: "用户鉴权与账户管理" },
        {
          name: "Knowledge Base - Collections",
          description: "知识库集合的创建、查询、更新与删除",
        },
        {
          name: "Knowledge Base - Documents",
          description: "知识库文档列表、详情、状态与 CRUD",
        },
        {
          name: "Knowledge Base - Upload & Preview",
          description: "文档上传、分块预览与导入流程",
        },
        { name: "Model Settings", description: "模型配置与参数模板" },
        {
          name: "Provider Settings",
          description: "服务商连接与模型同步",
        },
        ...OPENAPI_PUBLIC_TAGS,
        { name: "Role", description: "角色原型与提示词素材管理" },
        { name: "Thread", description: "对话会话与消息管理" },
        { name: "Chat", description: "RAG 增强聊天与检索" },
        { name: "Evaluation", description: "评测工作台与评测任务" },
        { name: "Tools", description: "Built-in agent tools" },
      ],
      components: {
        securitySchemes: {
          bearerAuth: {
            type: "http",
            scheme: "bearer",
            bearerFormat: "JWT",
          },
        },
      },
    },
  });

  await app.register(swaggerUi, {
    routePrefix: CONFIG.SWAGGER_PREFIX,
    logo: {
      type: "image/png",
      content: await readSwaggerLogo(),
    },
    uiConfig: {
      docExpansion: "list",
      deepLinking: true,
    },
  });
};

const setupRoutes = async () => {
  await app.register(proxyProviderRoute);
  await app.register(healthRoute);
  await app.register(appMetaRoute);
  await app.register(dbHealthRoute);
  await app.register(logsRoute);
  await app.register(loginRoute);
  await app.register(meRoute);
  await app.register(attachmentRoute);
  await app.register(accountRoute);
  await app.register(knowledgeBaseRoute);
  await app.register(modelConfigRoute);
  await app.register(providerSettingsRoute);
  await app.register(roleRoute);
  await app.register(threadRoute);
  await app.register(chatRagRoute);
  await app.register(ragRuntimeRoute);
  await app.register(evaluationRoute);
  await app.register(integrationsRoute);
  await app.register(microappsRoute, {
    imageGenerationService,
    computerUseService,
    computerUseRuntimeService,
    mailCenterService,
    newsHubService,
  });
  await app.register(wecomRoute);
  await app.register(agentRoute);
  await app.register(mcpRoutes);
};

const setupDatabase = async () => {
  if (!process.env.DATABASE_URL) {
    const dbDir = path.resolve(process.cwd(), CONFIG.DATABASE_DIR);
    await fs.mkdir(dbDir, { recursive: true });

    const dbPath = path.join(dbDir, CONFIG.DATABASE_NAME);
    const handle = await fs.open(dbPath, "a");
    await handle.close();

    process.env.DATABASE_URL = `file:${dbPath}`;
    app.log.info(`Database initialized at ${dbPath}`);
  }

  initializeAuthDatabase();
  initializeEvaluationDatabase();
  initializeModelConfigDatabase();
  initializeKnowledgeBaseDatabase();
  initializeRoleDatabase();
  initializeThreadDatabase();
  configureInvocationRetention({
    maxEntries: CONFIG.HARNESS_RETENTION_MAX_ENTRIES,
    ttlMs: CONFIG.HARNESS_RETENTION_TTL_MS,
  });
  agentRunStore.configureRetention?.({
    maxEntries: CONFIG.HARNESS_RETENTION_MAX_ENTRIES,
    ttlMs: CONFIG.HARNESS_RETENTION_TTL_MS,
  });
  configureAgentRunPersistence({
    create: (run) => {
      agentRunRepository.createPersistedRun(run);
    },
    get: agentRunRepository.get.bind(agentRunRepository),
    update: agentRunRepository.update.bind(agentRunRepository),
    addObservation: agentRunRepository.addObservation.bind(agentRunRepository),
    complete: agentRunRepository.complete.bind(agentRunRepository),
  });
  webSearchSettingsRepository.initialize();
  wecomSettingsRepository.initialize();
  integrationInstancesRepository.initialize();
  integrationCapabilitiesRepository.initialize();
  microAppsRepository.initialize();
  integrationCapabilityMicroAppsRepository.initialize();
  mailAccountsRepository.initialize();
  mailFoldersRepository.initialize();
  mailMessagesRepository.initialize();
  newsItemsRepository.initialize();
  migrateLegacyMicroAppBindings();
  initializeExternalMcpDatabase();
  registerAllExternalMcpCapabilities();
  evaluationService.initializePersistence();

  const vectorStoreHealth = initializeVectorStore();
  if (vectorStoreHealth.ok) {
    app.log.info(
      {
        provider: vectorStoreHealth.provider,
        extensionPath: vectorStoreHealth.extensionPath,
      },
      vectorStoreHealth.detail,
    );
  } else {
    app.log.warn(
      {
        provider: vectorStoreHealth.provider,
      },
      vectorStoreHealth.detail,
    );
  }
};

const isExistingBackendHealthy = async (port: number): Promise<boolean> => {
  try {
    const response = await fetch(`http://127.0.0.1:${port}/health`);
    return response.ok || response.status === 401;
  } catch {
    return false;
  }
};

const startServer = async () => {
  await app.listen({ host: CONFIG.HOST, port: CONFIG.PORT });
  app.log.info(`Server running on http://${CONFIG.HOST}:${CONFIG.PORT}`);
  app.log.info(
    `API docs available at http://127.0.0.1:${CONFIG.PORT}${CONFIG.SWAGGER_PREFIX}`,
  );
};

const start = async () => {
  try {
    await setupPlugins();
    await setupDatabase();
    await setupRoutes();
    await startServer();
  } catch (error) {
    if (
      allowBackendReuse &&
      error instanceof Error &&
      "code" in error &&
      error.code === "EADDRINUSE" &&
      (await isExistingBackendHealthy(CONFIG.PORT))
    ) {
      app.log.info(
        `Port ${CONFIG.PORT} is already in use by a healthy backend. Reusing existing service.`,
      );
      return;
    }

    app.log.error({ err: error as Error }, "Failed to start server");
    process.exit(1);
  }
};

process.on("SIGINT", async () => {
  app.log.info("Shutting down gracefully...");
  await app.close();
  process.exit(0);
});

process.on("SIGTERM", async () => {
  app.log.info("Shutting down gracefully...");
  await app.close();
  process.exit(0);
});

void start();
