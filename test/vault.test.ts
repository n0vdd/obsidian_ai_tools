import { describe, test, expect } from "vitest";
import { join, basename } from "path";
import { scanVault, readNote } from "../src/vault.js";

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
    expect(paths).toEqual([...paths].sort());
  });
});

describe("readNote", () => {
  test("reads and parses a note", () => {
    const path = join(fixturesPath, "Note A.md");
    const note = readNote(path);

    expect(note.name).toBe("Note A");
    expect(note.path).toBe(path);
    expect(note.frontmatter).not.toBeNull();
    expect(note.tags).toContain("project");
    expect(note.tags).toContain("active");
    expect(note.wikilinks.length).toBeGreaterThan(0);
  });

  test("combines frontmatter tags and inline tags", () => {
    const path = join(fixturesPath, "Note A.md");
    const note = readNote(path);

    // Frontmatter tags
    expect(note.tags).toContain("project");
    expect(note.tags).toContain("active");
    // Inline tags
    expect(note.tags).toContain("tag1");
    expect(note.tags).toContain("nested/tag2");
  });

  test("throws for missing file", () => {
    expect(() => readNote("/nonexistent/path.md")).toThrow();
  });
});
