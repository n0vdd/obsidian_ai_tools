import { z } from "zod";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { missingNotes, type GraphState } from "../graph.js";

export function registerFindMissingNotes(
  server: McpServer,
  state: GraphState
) {
  server.registerTool(
    "find_missing_notes",
    {
      description: "Find broken links \u2014 referenced notes that don't exist.",
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
      const result = missingNotes(state, { limit, offset });
      return { content: [{ type: "text", text: JSON.stringify(result) }] };
    }
  );
}
