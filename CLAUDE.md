# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

VaultKit is a TypeScript MCP (Model Context Protocol) server that exposes tools for querying and navigating an Obsidian vault. It parses Obsidian-flavored markdown (wikilinks, frontmatter, inline tags, embeds) and maintains an in-memory link graph for fast traversal.

## Build & Development Commands

```bash
npm install               # Install dependencies
npm run build             # Compile TypeScript
npm test                  # Run all tests (vitest)
npm run test:watch        # Run tests in watch mode
npm start                 # Start the MCP server (requires build first)
```

The vault path is configured via the `VAULT_PATH` environment variable (defaults to `~/Dropbox/notes`).

## Architecture

**Data flow:** MCP client -> `index.ts` (McpServer) -> Tool module -> `graph.ts` or `vault.ts` -> JSON response over stdio

### Core Modules (`src/`)

- **`types.ts`** — Interfaces: `Note`, `Wikilink`, `Heading`, `Checkbox`.
- **`markdown.ts`** — Pure parsing functions for wikilinks (`[[Note]]`, `[[Note#Heading]]`, `[[Note|Alias]]`, `![[Embed]]`), YAML frontmatter, headings, checkboxes, and inline tags. Uses 6 regexes.
- **`vault.ts`** — File I/O layer. `scanVault()` finds `.md` files (excluding `.obsidian`, `smart-chats`, `templates`, `.claude`, `Excalidraw`, `.trash`, `TagsRoutes/reports/`). `readNote()` reads notes into `Note` objects.
- **`graph.ts`** — In-memory link graph built on startup using `Map`/`Set`. Stores forward/backward adjacency maps and missing (broken) links. Provides BFS traversal, backlink lookup, orphan detection, fuzzy name resolution (case-insensitive, ignores `-_`), and search.
- **`index.ts`** — Entry point: reads `VAULT_PATH`, builds graph, registers tools, connects stdio transport.

### MCP Tools (`src/tools/`)

Each tool module exports a `register*` function that calls `server.registerTool()` with a Zod input schema and a callback. 8 tools: `traverse_links`, `find_backlinks`, `find_orphans`, `find_missing_notes`, `resolve_wikilink`, `vault_search`, `read_frontmatter`, `vault_stats`.

### Tests (`test/`)

Tests use vitest and run against fixtures in `test/fixtures/`. No server startup needed — tests import functions directly.

## Key Dependencies

- **@modelcontextprotocol/sdk** (^1.26) — MCP protocol server framework
- **zod** (^3.x) — Schema validation for tool inputs
- **yaml** (^2.x) — YAML frontmatter parsing
- **vitest** (^2.x) — Test runner (dev only)
