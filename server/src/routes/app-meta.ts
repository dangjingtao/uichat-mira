import type { FastifyPluginAsync } from "fastify";
import { success, getAppMeta } from "@/utils/index.js";
import { successEnvelope } from "@/routes/schema-helpers.js";

const appMetaRoute: FastifyPluginAsync = async (app) => {
  app.get(
    "/app/meta",
    {
      schema: {
        tags: ["System"],
        summary: "Application metadata",
        operationId: "getAppMeta",
        response: {
          200: successEnvelope({
            type: "object",
            required: [
              "name",
              "version",
              "displayName",
              "author",
              "description",
              "repositoryUrl",
              "homepageUrl",
              "changelog",
              "versionHistory",
              "links",
            ],
            properties: {
              name: { type: "string" },
              version: { type: "string" },
              displayName: { type: "string" },
              author: { type: "string" },
              description: { type: "string" },
              repositoryUrl: { type: "string" },
              homepageUrl: { type: "string" },
              changelog: {
                type: "array",
                items: { type: "string" },
              },
              versionHistory: {
                type: "array",
                items: {
                  type: "object",
                  required: ["version", "summary"],
                  properties: {
                    version: { type: "string" },
                    summary: { type: "string" },
                  },
                },
              },
              links: {
                type: "array",
                items: {
                  type: "object",
                  required: ["label", "value", "href"],
                  properties: {
                    label: { type: "string" },
                    value: { type: "string" },
                    href: { type: "string" },
                  },
                },
              },
              git: {
                type: "object",
                required: ["branch", "versions"],
                properties: {
                  branch: { type: "string" },
                  versions: {
                    type: "array",
                    items: {
                      type: "object",
                      required: ["version", "commit"],
                      properties: {
                        version: { type: "string" },
                        commit: {
                          type: "object",
                          required: ["hash", "shortHash", "message", "author", "date"],
                          properties: {
                            hash: { type: "string" },
                            shortHash: { type: "string" },
                            message: { type: "string" },
                            author: { type: "string" },
                            date: { type: "string" },
                          },
                        },
                      },
                    },
                  },
                },
              },
            },
          }),
        },
      },
    },
    async () => success(getAppMeta()),
  );
};

export default appMetaRoute;
