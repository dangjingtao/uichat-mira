import { Readable } from "node:stream";
import Fastify from "fastify";
import { describe, expect, it } from "vitest";
import { badRequest, sendRouteError } from "./route-errors.js";

const createFailingEventStream = () =>
  Readable.from(
    (async function* () {
      await Promise.resolve();
      throw badRequest("args.query is not allowed");
    })(),
  );

describe("sendRouteError SSE handling", () => {
  it("serializes stream failures as invocation events instead of sending an object", async () => {
    const app = Fastify();
    app.setErrorHandler(sendRouteError);
    app.get("/stream", async (_request, reply) => {
      reply
        .header("Content-Type", "text/event-stream")
        .header("Cache-Control", "no-cache, no-transform")
        .header("Connection", "keep-alive");
      return reply.send(createFailingEventStream());
    });

    const response = await app.inject({ method: "GET", url: "/stream" });

    expect(response.statusCode).toBe(200);
    expect(response.headers["content-type"]).toContain("text/event-stream");
    expect(response.body).toContain('"type":"invocation:error"');
    expect(response.body).toContain('"message":"args.query is not allowed"');
    expect(response.body).toContain('"type":"invocation:finish"');
    expect(response.body).toContain('"status":"failed"');
    expect(response.body).not.toContain("FST_ERR_REP_INVALID_PAYLOAD_TYPE");

    await app.close();
  });
});
