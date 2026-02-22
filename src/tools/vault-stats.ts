import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { stats, type GraphState } from "../graph.js";

export function registerVaultStats(server: McpServer, state: GraphState) {
  server.registerTool(
    "vault_stats",
    {
      description:
        "Return vault-wide statistics: total notes, tagged, untagged, orphans, missing.",
    },
    () => {
      const result = stats(state);
      return { content: [{ type: "text", text: JSON.stringify(result) }] };
    }
  );
}
