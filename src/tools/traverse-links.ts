import { z } from "zod";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { traverse, type GraphState } from "../graph.js";

export function registerTraverseLinks(server: McpServer, state: GraphState) {
  server.registerTool(
    "traverse_links",
    {
      description:
        "BFS traversal from a note to depth N, returning notes + content + missing links.",
      inputSchema: {
        note_name: z
          .string()
          .describe("Name of the starting note (without .md extension)"),
        depth: z
          .number()
          .int()
          .optional()
          .default(2)
          .describe("Maximum traversal depth (default: 2)"),
      },
    },
    ({ note_name, depth }) => {
      const result = traverse(note_name, depth, state);
      return { content: [{ type: "text", text: JSON.stringify(result) }] };
    }
  );
}
