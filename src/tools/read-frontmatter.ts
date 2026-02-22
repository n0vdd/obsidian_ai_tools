import { z } from "zod";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { resolve, type GraphState } from "../graph.js";

export function registerReadFrontmatter(
  server: McpServer,
  state: GraphState
) {
  server.registerTool(
    "read_frontmatter",
    {
      description: "Read and return parsed frontmatter for a given note.",
      inputSchema: {
        note_name: z
          .string()
          .describe("Name of the note (without .md extension)"),
      },
    },
    ({ note_name }) => {
      const note = resolve(note_name, state);
      if (!note) {
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify({
                error: `Note '${note_name}' not found`,
              }),
            },
          ],
        };
      }
      const result = {
        name: note.name,
        path: note.path,
        frontmatter: note.frontmatter ?? {},
      };
      return { content: [{ type: "text", text: JSON.stringify(result) }] };
    }
  );
}
