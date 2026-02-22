import { readFileSync, readdirSync, realpathSync, statSync } from "fs";
import { join, basename, extname, relative, resolve } from "path";
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
  const vaultRoot = realpathSync(resolve(vaultPath));
  walk(vaultRoot, vaultRoot, results);
  return results.sort((a, b) => a.localeCompare(b));
}

// eslint-disable-next-line sonarjs/cognitive-complexity -- recursive directory walk with symlink safety checks
function walk(dir: string, vaultRoot: string, results: string[]): void {
  const entries = readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = join(dir, entry.name);
    let realPath: string;
    try {
      realPath = realpathSync(fullPath);
    } catch {
      continue; // skip unresolvable symlinks (e.g. ELOOP from circular symlinks)
    }
    if (!realPath.startsWith(vaultRoot + "/") && realPath !== vaultRoot)
      continue;

    if (entry.isDirectory()) {
      if (!EXCLUDED_DIRS.has(entry.name)) {
        const rel = relative(vaultRoot, realPath);
        if (!EXCLUDED_PREFIXES.some((p) => rel.startsWith(p))) {
          walk(fullPath, vaultRoot, results);
        }
      }
    } else if (entry.isFile() && extname(entry.name) === ".md") {
      const rel = relative(vaultRoot, realPath);
      if (!EXCLUDED_PREFIXES.some((p) => rel.startsWith(p))) {
        results.push(fullPath);
      }
    }
  }
}

export function readNote(path: string): Note {
  const content = readFileSync(path, "utf-8");
  const lines = content.split(/\r?\n/);
  const name = basename(path, ".md");
  const frontmatter = extractFrontmatter(content);
  const frontmatterTags = extractFrontmatterTags(frontmatter);
  const inlineTags = extractInlineTags(lines);
  const mtime = statSync(path).mtime;

  return {
    path,
    name,
    content,
    frontmatter,
    wikilinks: extractWikilinks(lines),
    frontmatterTags,
    inlineTags,
    headings: extractHeadings(lines),
    checkboxes: extractCheckboxes(lines),
    mtime,
  };
}

function extractFrontmatterTags(fm: Record<string, unknown> | null): string[] {
  if (!fm) return [];
  const tags = fm["tags"];
  if (Array.isArray(tags)) return tags.map(String);
  if (typeof tags === "string") return [tags];
  return [];
}
