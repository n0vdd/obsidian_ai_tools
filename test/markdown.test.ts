import { describe, test, expect } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";
import {
  extractWikilinks,
  extractFrontmatter,
  extractHeadings,
  extractCheckboxes,
  extractInlineTags,
} from "../src/markdown.js";

const noteA = readFileSync(
  join(__dirname, "fixtures", "Note A.md"),
  "utf-8"
);

describe("extractWikilinks", () => {
  test("extracts plain wikilinks", () => {
    const links = extractWikilinks("Hello [[Note B]] and [[Note C]]");
    const names = links.map((l) => l.name);
    expect(names).toContain("Note B");
    expect(names).toContain("Note C");
    expect(links.every((l) => l.embed === false)).toBe(true);
  });

  test("extracts wikilinks with headings", () => {
    const links = extractWikilinks("See [[Note B#Section One]]");
    expect(links).toHaveLength(1);
    expect(links[0]).toMatchObject({
      name: "Note B",
      heading: "Section One",
      embed: false,
    });
  });

  test("extracts wikilinks with aliases", () => {
    const links = extractWikilinks("Check [[Note C|See Note C]]");
    expect(links).toHaveLength(1);
    expect(links[0]).toMatchObject({
      name: "Note C",
      alias: "See Note C",
      embed: false,
    });
  });

  test("extracts embeds", () => {
    const links = extractWikilinks("Here: ![[diagram.png]]");
    expect(links).toHaveLength(1);
    expect(links[0]).toMatchObject({ name: "diagram.png", embed: true });
  });

  test("extracts all link types from note_a", () => {
    const links = extractWikilinks(noteA);
    const names = links.map((l) => l.name);
    expect(names).toContain("Note B");
    expect(names).toContain("Note C");
    expect(names).toContain("diagram.png");

    const embeds = links.filter((l) => l.embed);
    expect(embeds).toHaveLength(1);
    expect(embeds[0].name).toBe("diagram.png");
  });

  test("includes line numbers", () => {
    const links = extractWikilinks("line1\n[[Note B]]\nline3");
    expect(links).toHaveLength(1);
    expect(links[0]).toMatchObject({ name: "Note B", line: 2 });
  });
});

describe("extractFrontmatter", () => {
  test("parses YAML frontmatter", () => {
    const fm = extractFrontmatter(noteA);
    expect(fm).not.toBeNull();
    expect(fm!["tags"]).toEqual(["project", "active"]);
    expect(fm!["status"]).toBe("draft");
  });

  test("returns null when no frontmatter", () => {
    expect(
      extractFrontmatter("# Just a heading\n\nSome content.")
    ).toBeNull();
  });

  test("returns null for empty content", () => {
    expect(extractFrontmatter("")).toBeNull();
  });
});

describe("extractHeadings", () => {
  test("extracts headings with levels", () => {
    const headings = extractHeadings(noteA);
    expect(headings.some((h) => h.level === 1 && h.text === "Note A")).toBe(
      true
    );
    expect(headings.some((h) => h.level === 2 && h.text === "Tasks")).toBe(
      true
    );
  });

  test("detects multiple heading levels", () => {
    const content = "# H1\n## H2\n### H3\n#### H4";
    const headings = extractHeadings(content);
    expect(headings).toHaveLength(4);
    expect(headings.map((h) => h.level)).toEqual([1, 2, 3, 4]);
  });
});

describe("extractCheckboxes", () => {
  test("extracts checked and unchecked tasks", () => {
    const boxes = extractCheckboxes(noteA);
    const checked = boxes.filter((b) => b.checked);
    const unchecked = boxes.filter((b) => !b.checked);

    expect(checked).toHaveLength(1);
    expect(checked[0].text).toBe("Completed task");
    expect(unchecked).toHaveLength(2);
  });

  test("captures indent level", () => {
    const boxes = extractCheckboxes(noteA);
    const nested = boxes.find((b) => b.text === "Nested pending task");
    expect(nested).toBeDefined();
    expect(nested!.indent).toBeGreaterThan(0);
  });
});

describe("extractInlineTags", () => {
  test("extracts inline tags", () => {
    const tags = extractInlineTags(noteA);
    expect(tags).toContain("tag1");
    expect(tags).toContain("nested/tag2");
  });

  test("excludes heading markers", () => {
    const tags = extractInlineTags("# Heading\n\nSome #real_tag here");
    expect(tags.some((t) => t.startsWith(" "))).toBe(false);
    expect(tags).toContain("real_tag");
  });

  test("does not match tags inside words", () => {
    const tags = extractInlineTags("email foo#bar baz");
    expect(tags).not.toContain("bar");
  });

  test("does not include frontmatter tags", () => {
    const content = "---\ntags:\n  - yaml_tag\n---\n\nSome #inline_tag here";
    const tags = extractInlineTags(content);
    expect(tags).toContain("inline_tag");
    expect(tags).not.toContain("yaml_tag");
  });
});
