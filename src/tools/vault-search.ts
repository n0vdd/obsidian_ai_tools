import { z } from "zod";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { search, type GraphState } from "../graph.js";

export function registerVaultSearch(server: McpServer, state: GraphState) {
  server.registerTool(
    "vault_search",
    {
      description: "Search vault content for a query string.",
      inputSchema: {
        query: z
          .string()
          .describe("Search query string (case-insensitive)"),
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
    ({ query, limit, offset }) => {
      const result = search(query, state, { limit, offset });
      return { content: [{ type: "text", text: JSON.stringify(result) }] };
    }
  );
}
