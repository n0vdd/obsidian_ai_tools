import { z } from "zod";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { orphans, type GraphState } from "../graph.js";

export function registerFindOrphans(server: McpServer, state: GraphState) {
  server.registerTool(
    "find_orphans",
    {
      description: "Find notes with no incoming links (orphans).",
      inputSchema: {
        limit: z
          .number()
          .int()
          .optional()
          .default(50)
          .describe("Maximum number of results to return (default: 50)"),
        offset: z
          .number()
          .int()
          .optional()
          .default(0)
          .describe("Number of results to skip (default: 0)"),
      },
    },
    ({ limit, offset }) => {
      const result = orphans(state, { limit, offset });
      return { content: [{ type: "text", text: JSON.stringify(result) }] };
    }
  );
}
