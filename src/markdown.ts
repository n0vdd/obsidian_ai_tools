import type { Wikilink, Heading, Checkbox } from "./types.js";
import YAML from "yaml";

const WIKILINK_RE = /\[\[([^\]#|]+)(?:#([^\]|]+))?(?:\|([^\]]+))?\]\]/g;
const EMBED_RE = /!\[\[([^\]]+)\]\]/g;
const HEADING_RE = /^(#{1,6})\s+(.+)$/gm;
const CHECKBOX_RE = /^(\s*)- \[([ xX])\]\s+(.+)$/gm;
const TAG_RE = /(?:^|(?<=\s))#([a-zA-Z][\w/\-]*)(?=\s|$)/gm;
const FRONTMATTER_RE = /^---\r?\n([\s\S]*?\r?\n)---\r?\n/;

export function extractWikilinks(content: string): Wikilink[] {
  const lines = content.split(/\r?\n/);
  const embeds = extractEmbeds(lines);
  const links = extractPlainLinks(lines);
  return [...embeds, ...links].sort((a, b) => a.line - b.line);
}

function extractEmbeds(lines: string[]): Wikilink[] {
  const results: Wikilink[] = [];
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const lineNum = i + 1;
    const re = new RegExp(EMBED_RE.source, "g");
    let match;
    while ((match = re.exec(line)) !== null) {
      const target = match[1];
      const wlRe = new RegExp(WIKILINK_RE.source);
      const wlMatch = wlRe.exec(`[[${target}]]`);
      if (wlMatch) {
        results.push({
          name: wlMatch[1].trim(),
          heading: wlMatch[2] || null,
          alias: wlMatch[3] || null,
          line: lineNum,
          embed: true,
        });
      } else {
        results.push({
          name: target.trim(),
          heading: null,
          alias: null,
          line: lineNum,
          embed: true,
        });
      }
    }
  }
  return results;
}

function extractPlainLinks(lines: string[]): Wikilink[] {
  const results: Wikilink[] = [];
  const embedRe = new RegExp(EMBED_RE.source, "g");
  for (let i = 0; i < lines.length; i++) {
    const cleaned = lines[i].replace(embedRe, "");
    const lineNum = i + 1;
    const re = new RegExp(WIKILINK_RE.source, "g");
    let match;
    while ((match = re.exec(cleaned)) !== null) {
      results.push({
        name: match[1].trim(),
        heading: match[2] || null,
        alias: match[3] || null,
        line: lineNum,
        embed: false,
      });
    }
  }
  return results;
}

export function extractFrontmatter(
  content: string
): Record<string, unknown> | null {
  const match = FRONTMATTER_RE.exec(content);
  if (!match) return null;
  try {
    const parsed = YAML.parse(match[1]);
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      return parsed as Record<string, unknown>;
    }
    return null;
  } catch {
    return null;
  }
}

export function extractHeadings(content: string): Heading[] {
  const lines = content.split(/\r?\n/);
  const results: Heading[] = [];
  const re = new RegExp(HEADING_RE.source);
  for (let i = 0; i < lines.length; i++) {
    const match = re.exec(lines[i]);
    if (match) {
      results.push({
        level: match[1].length,
        text: match[2].trim(),
        line: i + 1,
      });
    }
  }
  return results;
}

export function extractCheckboxes(content: string): Checkbox[] {
  const lines = content.split(/\r?\n/);
  const results: Checkbox[] = [];
  const re = new RegExp(CHECKBOX_RE.source);
  for (let i = 0; i < lines.length; i++) {
    const match = re.exec(lines[i]);
    if (match) {
      results.push({
        checked: match[2] === "x" || match[2] === "X",
        text: match[3].trim(),
        line: i + 1,
        indent: match[1].length,
      });
    }
  }
  return results;
}

export function extractInlineTags(content: string): string[] {
  const body = stripFrontmatter(content);
  const lines = body.split(/\r?\n/);
  const seen = new Set<string>();
  const results: string[] = [];

  for (const line of lines) {
    if (/^\s*#{1,6}\s+/.test(line)) continue;
    const re = new RegExp(TAG_RE.source, "gm");
    let match;
    while ((match = re.exec(line)) !== null) {
      const tag = match[1];
      if (!seen.has(tag)) {
        seen.add(tag);
        results.push(tag);
      }
    }
  }
  return results;
}

export function stripFrontmatter(content: string): string {
  return content.replace(FRONTMATTER_RE, "");
}
