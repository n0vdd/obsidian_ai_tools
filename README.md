# VaultKit

A TypeScript MCP server for querying and navigating an Obsidian vault. Parses Obsidian-flavored markdown (wikilinks, frontmatter, inline tags, embeds) and maintains an in-memory link graph for fast traversal.

## Setup

```bash
npm install
npm run build
```

## Usage

Set `VAULT_PATH` to your Obsidian vault directory (defaults to `~/Dropbox/notes`):

```bash
VAULT_PATH=/path/to/vault node dist/index.js
```

Or configure in `.mcp.json` for Claude Code integration.

## MCP Tools

| Tool | Description |
|------|-------------|
| `traverse_links` | BFS traversal from a note to depth N |
| `find_backlinks` | Find notes that link to a given note |
| `find_orphans` | Find notes with no incoming links |
| `find_missing_notes` | Find broken links (referenced notes that don't exist) |
| `resolve_wikilink` | Resolve a wikilink name to the actual note |
| `vault_search` | Search vault content for a query string |
| `read_frontmatter` | Read parsed frontmatter for a note |
| `vault_stats` | Return vault-wide statistics |

## Development

```bash
npm test            # Run tests
npm run test:watch  # Watch mode
npm run build       # Compile TypeScript
```
