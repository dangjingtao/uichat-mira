import assert from "node:assert/strict";
import Fastify, { type FastifyInstance } from "fastify";
import { afterEach, test } from "vitest";
import logsRoute from "@/routes/logs";
import { getLoggerConfig, writeStructuredLog } from "@/logger";
import { sendRouteError } from "@/utils/route-errors.js";

const parseSseFrames = (buffer: string) =>
  buffer
    .replace(/\r\n/g, "\n")
    .split("\n\n")
    .map((segment) =>
      segment
        .split("\n")
        .filter((line) => line.startsWith("data:"))
        .map((line) => line.slice(5).trimStart())
        .join("\n"),
    )
    .filter(Boolean)
    .map((frame) => JSON.parse(frame) as { type: string; entries?: string[]; entry?: string });

const runningApps: FastifyInstance[] = [];

afterEach(async () => {
  await Promise.all(
    runningApps.splice(0).map(async (app) => {
      await app.close();
    }),
  );
});

test("GET /logs/stream returns snapshot then live append events", async () => {
  const app = Fastify({
    logger: getLoggerConfig(),
    serializerOpts: { encoding: "utf8" },
  });
  runningApps.push(app);
  app.setErrorHandler(sendRouteError);
  app.addHook("preHandler", async (request) => {
    request.authUser = { id: 1, username: "tester", role: "admin" };
  });
  await app.register(logsRoute);
  await app.listen({ host: "127.0.0.1", port: 0 });

  const address = app.server.address();
  if (!address || typeof address === "string") {
    throw new Error("Unable to resolve test server address");
  }

  writeStructuredLog("info", {
    msg: "logs route snapshot seed",
    event: "logs-route-seed",
  });

  const response = await fetch(
    `http://127.0.0.1:${address.port}/logs/stream?limit=5`,
    {
      headers: {
        Authorization: "Bearer test-token",
      },
    },
  );

  assert.equal(response.status, 200);
  assert.match(
    response.headers.get("content-type") ?? "",
    /^text\/event-stream/i,
  );
  assert.ok(response.body);

  const reader = response.body!.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (!buffer.includes("\n\n")) {
    const { done, value } = await reader.read();
    if (done) {
      break;
    }

    buffer += decoder.decode(value, { stream: true });
  }

  const snapshotEvents = parseSseFrames(buffer);
  assert.equal(snapshotEvents[0]?.type, "snapshot");
  assert.ok(
    snapshotEvents[0]?.entries?.some((entry) =>
      entry.includes("logs route snapshot seed")
    ),
  );

  writeStructuredLog("warn", {
    msg: "logs route append test",
    event: "logs-route-append",
  });

  buffer = "";
  while (!buffer.includes("\n\n")) {
    const { done, value } = await reader.read();
    if (done) {
      break;
    }

    buffer += decoder.decode(value, { stream: true });
  }

  const appendEvents = parseSseFrames(buffer);
  assert.equal(appendEvents[0]?.type, "append");
  assert.match(appendEvents[0]?.entry ?? "", /logs route append test/);

  await reader.cancel();
});
