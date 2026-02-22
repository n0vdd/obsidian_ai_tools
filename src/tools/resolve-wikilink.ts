import { z } from "zod";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { resolve, type GraphState } from "../graph.js";

export function registerResolveWikilink(
  server: McpServer,
  state: GraphState
) {
  server.registerTool(
    "resolve_wikilink",
    {
      description:
        "Resolve a wikilink name to the actual note with content and frontmatter.",
      inputSchema: {
        name: z
          .string()
          .describe("Wikilink name to resolve (case-insensitive)"),
      },
    },
    ({ name }) => {
      const note = resolve(name, state);
      if (!note) {
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify({ error: `Note '${name}' not found` }),
            },
          ],
        };
      }
      const result = {
        name: note.name,
        path: note.path,
        content: note.content,
        frontmatter: note.frontmatter,
        tags: note.tags,
      };
      return { content: [{ type: "text", text: JSON.stringify(result) }] };
    }
  );
}
