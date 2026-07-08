import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";

const server = new McpServer({
  name: "deepagents-spike-local",
  version: "0.0.0",
});

server.registerTool(
  "local_lookup",
  {
    description: "Return a deterministic MCP lookup result for spike testing.",
    inputSchema: {
      topic: z.string(),
    },
  },
  async ({ topic }) => ({
    content: [
      {
        type: "text",
        text: `mcp:${topic}`,
      },
    ],
  }),
);

const transport = new StdioServerTransport();
await server.connect(transport);
