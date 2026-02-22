import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { GraphState } from "../graph.js";
import { registerTraverseLinks } from "./traverse-links.js";
import { registerFindBacklinks } from "./find-backlinks.js";
import { registerFindOrphans } from "./find-orphans.js";
import { registerFindMissingNotes } from "./find-missing-notes.js";
import { registerResolveWikilink } from "./resolve-wikilink.js";
import { registerVaultSearch } from "./vault-search.js";
import { registerReadFrontmatter } from "./read-frontmatter.js";
import { registerVaultStats } from "./vault-stats.js";

export function registerAllTools(server: McpServer, state: GraphState) {
  registerTraverseLinks(server, state);
  registerFindBacklinks(server, state);
  registerFindOrphans(server, state);
  registerFindMissingNotes(server, state);
  registerResolveWikilink(server, state);
  registerVaultSearch(server, state);
  registerReadFrontmatter(server, state);
  registerVaultStats(server, state);
}
