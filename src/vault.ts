import { readFileSync, readdirSync, statSync } from "fs";
import { join, basename, extname, relative } from "path";
import type { Note } from "./types.js";
import {
  extractWikilinks,
  extractFrontmatter,
  extractHeadings,
  extractCheckboxes,
  extractInlineTags,
} from "./markdown.js";

const EXCLUDED_DIRS = new Set([
  ".obsidian",
  "smart-chats",
  "templates",
  ".claude",
  "Excalidraw",
  ".trash",
]);

const EXCLUDED_PREFIXES = ["TagsRoutes/reports/"];

export function scanVault(vaultPath: string): string[] {
  const results: string[] = [];
  walk(vaultPath, vaultPath, results);
  return results.sort();
}

function walk(dir: string, vaultPath: string, results: string[]): void {
  const entries = readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = join(dir, entry.name);
    if (entry.isDirectory()) {
      if (!EXCLUDED_DIRS.has(entry.name)) {
        const rel = relative(vaultPath, fullPath);
        if (!EXCLUDED_PREFIXES.some((p) => rel.startsWith(p))) {
          walk(fullPath, vaultPath, results);
        }
      }
    } else if (entry.isFile() && extname(entry.name) === ".md") {
      const rel = relative(vaultPath, fullPath);
      if (!EXCLUDED_PREFIXES.some((p) => rel.startsWith(p))) {
        results.push(fullPath);
      }
    }
  }
}

export function readNote(path: string): Note {
  const content = readFileSync(path, "utf-8");
  const name = basename(path, ".md");
  const frontmatter = extractFrontmatter(content);
  const fmTags = extractFrontmatterTags(frontmatter);
  const inlineTags = extractInlineTags(content);
  const allTags = [...new Set([...fmTags, ...inlineTags])];

  return {
    path,
    name,
    content,
    frontmatter,
    wikilinks: extractWikilinks(content),
    tags: allTags,
    headings: extractHeadings(content),
    checkboxes: extractCheckboxes(content),
  };
}

function extractFrontmatterTags(
  fm: Record<string, unknown> | null
): string[] {
  if (!fm) return [];
  const tags = fm["tags"];
  if (Array.isArray(tags)) return tags.map(String);
  if (typeof tags === "string") return [tags];
  return [];
}
