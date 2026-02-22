import { describe, test, expect } from "vitest";
import { join, basename } from "path";
import { scanVault, readNote } from "../src/vault.js";
import { allTags } from "../src/types.js";

const fixturesPath = join(__dirname, "fixtures");

describe("scanVault", () => {
  test("finds all .md files", () => {
    const paths = scanVault(fixturesPath);
    const names = paths.map((p) => basename(p));
    expect(names).toContain("Note A.md");
    expect(names).toContain("Note B.md");
    expect(names).toContain("Note C.md");
    expect(names).toContain("Orphan Note.md");
  });

  test("excludes .obsidian directory", () => {
    const paths = scanVault(fixturesPath);
    expect(paths.some((p) => p.includes(".obsidian"))).toBe(false);
  });

  test("returns sorted paths", () => {
    const paths = scanVault(fixturesPath);
    expect(paths).toEqual([...paths].sort((a, b) => a.localeCompare(b)));
  });
});

describe("readNote", () => {
  test("reads and parses a note", () => {
    const path = join(fixturesPath, "Note A.md");
    const note = readNote(path);

    expect(note.name).toBe("Note A");
    expect(note.path).toBe(path);
    expect(note.frontmatter).not.toBeNull();
    expect(allTags(note)).toContain("project");
    expect(allTags(note)).toContain("active");
    expect(note.wikilinks.length).toBeGreaterThan(0);
  });

  test("allTags combines frontmatter tags and inline tags", () => {
    const path = join(fixturesPath, "Note A.md");
    const note = readNote(path);
    const tags = allTags(note);

    // Frontmatter tags
    expect(tags).toContain("project");
    expect(tags).toContain("active");
    // Inline tags
    expect(tags).toContain("tag1");
    expect(tags).toContain("nested/tag2");
  });

  test("separates frontmatterTags and inlineTags", () => {
    const path = join(fixturesPath, "Note A.md");
    const note = readNote(path);

    expect(note.frontmatterTags).toContain("project");
    expect(note.frontmatterTags).toContain("active");
    expect(note.frontmatterTags).not.toContain("tag1");

    expect(note.inlineTags).toContain("tag1");
    expect(note.inlineTags).toContain("nested/tag2");
    expect(note.inlineTags).not.toContain("project");
  });

  test("has mtime as Date", () => {
    const path = join(fixturesPath, "Note A.md");
    const note = readNote(path);
    expect(note.mtime).toBeInstanceOf(Date);
  });

  test("throws for missing file", () => {
    expect(() => readNote("/nonexistent/path.md")).toThrow();
  });
});
