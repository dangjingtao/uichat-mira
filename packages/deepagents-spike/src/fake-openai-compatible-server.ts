import { createServer, type IncomingMessage, type Server, type ServerResponse } from "node:http";

type ChatRequest = {
  model?: string;
  messages?: Array<{
    role?: string;
    content?: unknown;
    tool_calls?: Array<{
      id?: string;
      type?: string;
      function?: {
        name?: string;
        arguments?: string;
      };
    }>;
  }>;
  tools?: Array<{
    type?: string;
    function?: {
      name?: string;
      description?: string;
    };
  }>;
};

type GatewayServerHandle = {
  server: Server;
  baseUrl: string;
  close: () => Promise<void>;
  requests: ChatRequest[];
};

const readJson = async <T>(request: IncomingMessage): Promise<T> => {
  const chunks: Buffer[] = [];
  for await (const chunk of request) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }

  return JSON.parse(Buffer.concat(chunks).toString("utf8")) as T;
};

const sendJson = (
  response: ServerResponse,
  statusCode: number,
  body: unknown,
) => {
  response.statusCode = statusCode;
  response.setHeader("content-type", "application/json");
  response.end(JSON.stringify(body));
};

const buildToolCallResponse = (model: string) => ({
  id: "chatcmpl-gateway-tool",
  object: "chat.completion",
  created: Math.floor(Date.now() / 1000),
  model,
  choices: [
    {
      index: 0,
      finish_reason: "tool_calls",
      message: {
        role: "assistant",
        content: "",
        tool_calls: [
          {
            id: "call_gateway_lookup",
            type: "function",
            function: {
              name: "gateway_lookup",
              arguments: JSON.stringify({ topic: "provider gateway" }),
            },
          },
        ],
      },
    },
  ],
  usage: {
    prompt_tokens: 10,
    completion_tokens: 10,
    total_tokens: 20,
  },
});

const buildFinalResponse = (model: string) => ({
  id: "chatcmpl-gateway-final",
  object: "chat.completion",
  created: Math.floor(Date.now() / 1000),
  model,
  choices: [
    {
      index: 0,
      finish_reason: "stop",
      message: {
        role: "assistant",
        content: "gateway tool flow completed",
      },
    },
  ],
  usage: {
    prompt_tokens: 20,
    completion_tokens: 8,
    total_tokens: 28,
  },
});

export const startFakeOpenAICompatibleServer =
  async (): Promise<GatewayServerHandle> => {
    const requests: ChatRequest[] = [];

    const server = createServer(async (request, response) => {
      if (!request.url) {
        sendJson(response, 400, { error: { message: "Missing URL" } });
        return;
      }

      if (request.method === "GET" && request.url === "/v1/models") {
        sendJson(response, 200, {
          object: "list",
          data: [{ id: "gateway-demo", object: "model" }],
        });
        return;
      }

      if (request.method === "POST" && request.url === "/v1/chat/completions") {
        const payload = await readJson<ChatRequest>(request);
        requests.push(payload);

        const model = payload.model ?? "gateway-demo";
        const lastMessage = payload.messages?.at(-1);
        if (lastMessage?.role === "tool") {
          sendJson(response, 200, buildFinalResponse(model));
          return;
        }

        sendJson(response, 200, buildToolCallResponse(model));
        return;
      }

      sendJson(response, 404, { error: { message: "Not found" } });
    });

    await new Promise<void>((resolve, reject) => {
      server.once("error", reject);
      server.listen(0, "127.0.0.1", () => {
        server.off("error", reject);
        resolve();
      });
    });

    const address = server.address();
    if (!address || typeof address === "string") {
      throw new Error("Failed to resolve fake gateway server address");
    }

    return {
      server,
      baseUrl: `http://127.0.0.1:${address.port}/v1`,
      requests,
      close: async () =>
        new Promise<void>((resolve, reject) => {
          server.close((error) => {
            if (error) {
              reject(error);
              return;
            }
            resolve();
          });
        }),
    };
  };
