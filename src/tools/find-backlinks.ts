import { z } from "zod";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { backlinks, type GraphState } from "../graph.js";

export function registerFindBacklinks(server: McpServer, state: GraphState) {
  server.registerTool(
    "find_backlinks",
    {
      description: "Find notes that link to the given note.",
      inputSchema: {
        note_name: z
          .string()
          .describe("Name of the note to find backlinks for"),
      },
    },
    ({ note_name }) => {
      const result = backlinks(note_name, state);
      return { content: [{ type: "text", text: JSON.stringify(result) }] };
    }
  );
}
