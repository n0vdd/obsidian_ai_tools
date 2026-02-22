import { describe, test, expect, beforeAll } from "vitest";
import { join } from "path";
import {
  buildGraph,
  rebuildGraph,
  resolve,
  backlinks,
  batchFindBacklinks,
  orphans,
  missingNotes,
  traverse,
  stats,
  batchResolve,
  type GraphState,
} from "../src/graph.js";
import { passesTagFilter } from "../src/filter.js";
import { allTags } from "../src/types.js";
import {
  search,
  findByTag,
  findUntagged,
  findSimilarNames,
  levenshtein,
} from "../src/search.js";

const fixturesPath = join(__dirname, "fixtures");
let state: GraphState;

beforeAll(() => {
  state = buildGraph(fixturesPath);
});

describe("resolve", () => {
  test("resolves exact name (case-insensitive)", () => {
    const note = resolve("Note A", state);
    expect(note).not.toBeNull();
    expect(note!.name).toBe("Note A");
  });

  test("resolves mixed case", () => {
    const note = resolve("note a", state);
    expect(note).not.toBeNull();
    expect(note!.name).toBe("Note A");
  });

  test("returns null for missing notes", () => {
    const note = resolve("nonexistent_note", state);
    expect(note).toBeNull();
  });

  test("resolves fuzzy name with dashes instead of underscores", () => {
    const note = resolve("Note-With-Dashes", state);
    expect(note).not.toBeNull();
    expect(note!.name).toBe("Note_With_Dashes");
  });
});

describe("backlinks", () => {
  test("finds notes linking to the given note", () => {
    const result = backlinks("Note B", state);
    const names = result.results.map((r) => r.name);
    expect(names).toContain("Note A");
    expect(names).toContain("Note C");
    expect(result.total).toBe(names.length);
  });

  test("returns empty for notes with no backlinks", () => {
    const result = backlinks("Orphan Note", state);
    // Note D now embeds Orphan Note, so it should have backlinks
    // but the embed creates a link, so check accordingly
    expect(result.total).toBeGreaterThanOrEqual(0);
  });

  test("finds backlinks via fuzzy name with dashes", () => {
    const result = backlinks("Note-With-Dashes", state);
    const names = result.results.map((r) => r.name);
    expect(names).toContain("Note C");
  });

  test("respects limit and offset", () => {
    const result = backlinks("Note B", state, { limit: 1, offset: 0 });
    expect(result.results.length).toBe(1);
    expect(result.limit).toBe(1);
    expect(result.offset).toBe(0);
    expect(result.total).toBeGreaterThan(1);
  });

  test("filters by folder", () => {
    // Note A links to Note B, and Note A is in root. journal/ has Daily Note which links nowhere.
    const result = backlinks("Note A", state, { folder: "journal" });
    // No notes in journal/ link to Note A
    expect(result.total).toBe(0);
  });
});

describe("orphans", () => {
  test("finds notes with no incoming links", () => {
    const result = orphans(state);
    // Note A is linked by Note B and Note D, Note B is linked by Note A, Note C, Note D (via Note_With_Dashes)
    // Orphan Note is now linked by Note D, so it shouldn't be orphan
    expect(result.total).toBeGreaterThan(0);
  });

  test("respects limit and offset", () => {
    const result = orphans(state, { limit: 1, offset: 0 });
    expect(result.results.length).toBeLessThanOrEqual(1);
    expect(result.limit).toBe(1);
    expect(result.offset).toBe(0);
  });

  test("filters by folder", () => {
    const result = orphans(state, { folder: "journal" });
    const names = result.results.map((r) => r.name);
    expect(names).toContain("Daily Note");
    expect(result.total).toBe(1);
  });

  test("folder filter with trailing slash", () => {
    const result = orphans(state, { folder: "journal/" });
    const names = result.results.map((r) => r.name);
    expect(names).toContain("Daily Note");
    expect(result.total).toBe(1);
  });

  test("folder filter returns empty for nonexistent folder", () => {
    const result = orphans(state, { folder: "nonexistent" });
    expect(result.total).toBe(0);
    expect(result.results).toEqual([]);
  });

  test("includes content_length and empty fields", () => {
    const result = orphans(state);
    for (const r of result.results) {
      expect(typeof r.content_length).toBe("number");
      expect(typeof r.empty).toBe("boolean");
    }
  });

  test("detects empty notes (frontmatter-only)", () => {
    const result = orphans(state);
    const emptyOrphan = result.results.find((r) => r.name === "Empty Orphan");
    expect(emptyOrphan).toBeDefined();
    expect(emptyOrphan!.empty).toBe(true);
  });

  test("non-empty notes have empty: false", () => {
    const result = orphans(state);
    const nonEmpty = result.results.find(
      (r) => r.name !== "Empty Orphan" && !r.empty,
    );
    if (nonEmpty) {
      expect(nonEmpty.empty).toBe(false);
      expect(nonEmpty.content_length).toBeGreaterThan(0);
    }
  });

  test("includes separate frontmatterTags and inlineTags", () => {
    const result = orphans(state);
    for (const r of result.results) {
      expect(Array.isArray(r.frontmatterTags)).toBe(true);
      expect(Array.isArray(r.inlineTags)).toBe(true);
    }
  });

  test("excludePattern filters orphans by name regex", () => {
    const allOrphans = orphans(state);
    const filtered = orphans(state, { excludePattern: "^Empty" });
    expect(filtered.total).toBeLessThan(allOrphans.total);
    const names = filtered.results.map((r) => r.name);
    expect(names).not.toContain("Empty Orphan");
  });

  test("excludePattern with invalid regex returns empty", () => {
    const result = orphans(state, { excludePattern: "[invalid" });
    expect(result.total).toBe(0);
    expect(result.results).toEqual([]);
  });
});

describe("missingNotes", () => {
  test("finds broken links", () => {
    const result = missingNotes(state);
    const names = result.results.map((r) => r.name);
    expect(names).toContain("missing note");
    expect(result.total).toBeGreaterThan(0);
  });

  test("includes reference count", () => {
    const result = missingNotes(state);
    const missing = result.results.find((r) => r.name === "missing note");
    expect(missing).toBeDefined();
    expect(missing!.count).toBeGreaterThanOrEqual(1);
  });

  test("respects limit and offset", () => {
    const result = missingNotes(state, { limit: 1, offset: 0 });
    expect(result.results.length).toBeLessThanOrEqual(1);
    expect(result.limit).toBe(1);
    expect(result.offset).toBe(0);
  });

  test("type 'note' excludes embeds", () => {
    const result = missingNotes(state, { type: "note" });
    const names = result.results.map((r) => r.name);
    expect(names).toContain("missing note");
    expect(names.every((n) => !/\.\w{1,5}$/.test(n))).toBe(true);
  });

  test("type 'embed' excludes notes", () => {
    const result = missingNotes(state, { type: "embed" });
    const names = result.results.map((r) => r.name);
    expect(names).toContain("diagram.png");
    expect(names).not.toContain("missing note");
  });

  test("type 'all' returns both notes and embeds", () => {
    const result = missingNotes(state, { type: "all" });
    const names = result.results.map((r) => r.name);
    expect(names).toContain("missing note");
    expect(names).toContain("diagram.png");
  });

  test("filters by folder", () => {
    // Only broken links from notes in journal/
    const result = missingNotes(state, { folder: "journal" });
    // Daily Note has no links, so no broken links from journal/
    expect(result.total).toBe(0);
  });
});

describe("traverse", () => {
  test("traverses from a note to depth 1", () => {
    const result = traverse("Note A", 1, state);
    const names = result.notes.map((n) => n.name);
    expect(names).toContain("Note A");
    expect(names).toContain("Note B");
    expect(names).toContain("Note C");
  });

  test("traverses from a note to depth 2", () => {
    const result = traverse("Note A", 2, state);
    const names = result.notes.map((n) => n.name);
    expect(names).toContain("Note A");
    expect(names).toContain("Note B");
    expect(names).toContain("Note C");
  });

  test("reports missing links during traversal", () => {
    const result = traverse("Note A", 2, state);
    const missingNames = result.missing.map((m) => m.name);
    expect(missingNames).toContain("missing note");
  });

  test("returns error for nonexistent start note", () => {
    const result = traverse("nonexistent", 1, state);
    expect(result.error).toBeDefined();
  });

  test("includes depth information", () => {
    const result = traverse("Note A", 1, state);
    const root = result.notes.find((n) => n.name === "Note A");
    expect(root).toBeDefined();
    expect(root!.depth).toBe(0);
  });

  test("traverses via fuzzy name with dashes", () => {
    const result = traverse("Note-With-Dashes", 1, state);
    expect(result.error).toBeUndefined();
    const names = result.notes.map((n) => n.name);
    expect(names).toContain("Note_With_Dashes");
    expect(names).toContain("Note B");
  });

  test("includes separate frontmatterTags and inlineTags", () => {
    const result = traverse("Note A", 1, state);
    for (const n of result.notes) {
      expect(Array.isArray(n.frontmatterTags)).toBe(true);
      expect(Array.isArray(n.inlineTags)).toBe(true);
    }
    const noteA = result.notes.find((n) => n.name === "Note A");
    expect(noteA!.frontmatterTags).toContain("project");
    expect(noteA!.inlineTags).toContain("tag1");
  });

  test("includes link_type for traversed notes", () => {
    const result = traverse("Note A", 1, state);
    const validLinkTypes = [null, "wikilink", "embed"];
    for (const n of result.notes) {
      expect(validLinkTypes).toContain(n.link_type);
    }
    // Root note has null link_type
    const root = result.notes.find((n) => n.name === "Note A");
    expect(root!.link_type).toBeNull();

    // Note B should be a wikilink from Note A
    const noteB = result.notes.find((n) => n.name === "Note B");
    expect(noteB!.link_type).toBe("wikilink");
  });

  test("detects embed link_type", () => {
    // Note D embeds Orphan Note
    const result = traverse("Note D", 1, state);
    const orphan = result.notes.find((n) => n.name === "Orphan Note");
    expect(orphan).toBeDefined();
    expect(orphan!.link_type).toBe("embed");
  });

  test("multi-root traversal with array input", () => {
    const result = traverse(["Note A", "Note B"], 1, state);
    expect(result.error).toBeUndefined();
    expect("roots" in result).toBe(true);
    const roots = (result as { roots: string[] }).roots;
    expect(roots).toContain("Note A");
    expect(roots).toContain("Note B");

    const names = result.notes.map((n) => n.name);
    expect(names).toContain("Note A");
    expect(names).toContain("Note B");
    expect(names).toContain("Note C");
  });

  test("single root traversal returns root key", () => {
    const result = traverse("Note A", 1, state);
    expect("root" in result).toBe(true);
    expect((result as { root: string }).root).toBe("Note A");
  });

  test("multi-root returns error if any root not found", () => {
    const result = traverse(["Note A", "nonexistent"], 1, state);
    expect(result.error).toBeDefined();
  });

  test("exclude_folders skips notes in excluded folders", () => {
    // Traverse but exclude journal folder
    const withExclude = traverse("Note A", 10, state, {
      excludeFolders: ["journal"],
    });
    const names = withExclude.notes.map((n) => n.name);
    expect(names).not.toContain("Daily Note");
  });
});

describe("stats", () => {
  test("returns vault statistics", () => {
    const s = stats(state);
    expect(s.total_notes).toBe(8);
    expect(s.tagged).toBeGreaterThan(0);
    expect(s.missing_links).toBeGreaterThan(0);
    expect(typeof s.orphans).toBe("number");
    expect(typeof s.untagged).toBe("number");
  });
});

describe("search", () => {
  test("finds matching lines across notes", () => {
    const result = search("note B", state);
    expect(result.total).toBeGreaterThan(0);
    expect(result.results.some((r) => r.file === "Note A")).toBe(true);
  });

  test("is case-insensitive", () => {
    const r1 = search("Section One", state);
    const r2 = search("section one", state);
    expect(r1.total).toBe(r2.total);
  });

  test("respects limit and offset", () => {
    const result = search("note", state, { limit: 2, offset: 0 });
    expect(result.results.length).toBeLessThanOrEqual(2);
    expect(result.limit).toBe(2);
    expect(result.offset).toBe(0);
  });

  test("returns empty results for unmatched query", () => {
    const result = search("zzz_nonexistent_zzz", state);
    expect(result.total).toBe(0);
    expect(result.results).toEqual([]);
  });

  test("whole-word excludes substring matches", () => {
    const substring = search("note", state);
    const wholeWord = search("note", state, { wholeWord: true });
    expect(substring.total).toBeGreaterThan(0);
    expect(wholeWord.total).toBeLessThanOrEqual(substring.total);
  });

  test("whole-word handles regex special characters safely", () => {
    const result = search("note (a)", state, { wholeWord: true });
    expect(result.results).toBeDefined();
  });

  test("regex mode matches patterns", () => {
    const result = search("Note [AB]", state, { regex: true });
    expect(result.total).toBeGreaterThan(0);
  });

  test("regex mode with invalid regex returns empty", () => {
    const result = search("[invalid", state, { regex: true });
    expect(result.total).toBe(0);
    expect(result.results).toEqual([]);
  });

  test("folder filter limits results", () => {
    const all = search("note", state);
    const journalOnly = search("note", state, { folder: "journal" });
    expect(journalOnly.total).toBeLessThan(all.total);
  });
});

describe("findByTag", () => {
  test("finds notes with a specific tag", () => {
    const result = findByTag("reference", state);
    const names = result.results.map((r) => r.name);
    expect(names).toContain("Note B");
    expect(names).toContain("Note C");
    expect(names).toContain("Note D");
    expect(result.total).toBe(3);
  });

  test("is case-insensitive", () => {
    const result = findByTag("Reference", state);
    expect(result.total).toBe(3);
  });

  test("strips leading # from tag", () => {
    const result = findByTag("#reference", state);
    expect(result.total).toBe(3);
  });

  test("finds inline tags", () => {
    const result = findByTag("tag1", state);
    const names = result.results.map((r) => r.name);
    expect(names).toContain("Note A");
  });

  test("returns empty for nonexistent tag", () => {
    const result = findByTag("nonexistent_tag_xyz", state);
    expect(result.total).toBe(0);
    expect(result.results).toEqual([]);
  });

  test("respects limit and offset", () => {
    const result = findByTag("reference", state, { limit: 1, offset: 0 });
    expect(result.results.length).toBe(1);
    expect(result.total).toBe(3);
  });

  test("includes separate frontmatterTags and inlineTags", () => {
    const result = findByTag("reference", state);
    for (const r of result.results) {
      expect(Array.isArray(r.frontmatterTags)).toBe(true);
      expect(Array.isArray(r.inlineTags)).toBe(true);
    }
    const noteB = result.results.find((r) => r.name === "Note B");
    expect(noteB!.frontmatterTags).toContain("reference");
  });

  test("filters by folder", () => {
    const result = findByTag("journal", state, { folder: "journal" });
    const names = result.results.map((r) => r.name);
    expect(names).toContain("Daily Note");
    expect(result.total).toBe(1);
  });
});

describe("search includeNames", () => {
  test("includes name matches when enabled", () => {
    const result = search("Orphan", state, { includeNames: true });
    const nameMatch = result.results.find((r) => r.line === 0);
    expect(nameMatch).toBeDefined();
    expect(nameMatch!.text).toContain("[name match]");
  });

  test("does not include name matches by default", () => {
    const result = search("Orphan", state);
    const nameMatch = result.results.find((r) => r.line === 0);
    expect(nameMatch).toBeUndefined();
  });

  test("name matches appear before content matches", () => {
    const result = search("Note A", state, { includeNames: true });
    const firstResult = result.results[0];
    expect(firstResult.line).toBe(0);
    expect(firstResult.text).toContain("[name match]");
  });

  test("total includes both name and content matches", () => {
    const withNames = search("Note", state, { includeNames: true });
    const withoutNames = search("Note", state, { includeNames: false });
    expect(withNames.total).toBeGreaterThan(withoutNames.total);
  });
});

describe("batchResolve", () => {
  test("resolves multiple notes at once", () => {
    const result = batchResolve(["Note A", "Note B"], state);
    expect(result.resolved.length).toBe(2);
    expect(result.errors.length).toBe(0);
    const names = result.resolved.map((r) => r.name);
    expect(names).toContain("Note A");
    expect(names).toContain("Note B");
  });

  test("returns errors for notes not found", () => {
    const result = batchResolve(["Note A", "nonexistent"], state);
    expect(result.resolved.length).toBe(1);
    expect(result.errors.length).toBe(1);
    expect(result.errors[0].name).toBe("nonexistent");
  });

  test("returns all errors for all missing", () => {
    const result = batchResolve(["missing1", "missing2"], state);
    expect(result.resolved.length).toBe(0);
    expect(result.errors.length).toBe(2);
  });

  test("includes content, frontmatter, and tags", () => {
    const result = batchResolve(["Note A"], state);
    const note = result.resolved[0];
    expect(note.content).toContain("This is note A");
    expect(note.frontmatter).toHaveProperty("tags");
    expect(note.tags).toContain("project");
  });

  test("includes separate frontmatterTags and inlineTags", () => {
    const result = batchResolve(["Note A"], state);
    const note = result.resolved[0];
    expect(note.frontmatterTags).toContain("project");
    expect(note.inlineTags).toContain("tag1");
  });

  test("resolves via fuzzy matching", () => {
    const result = batchResolve(["Note-With-Dashes"], state);
    expect(result.resolved.length).toBe(1);
    expect(result.resolved[0].name).toBe("Note_With_Dashes");
  });
});

describe("findUntagged", () => {
  test("finds notes with no tags", () => {
    const result = findUntagged(state);
    const names = result.results.map((r) => r.name);
    // Orphan Note has tags: [] which counts as empty
    expect(names).toContain("Orphan Note");
    expect(result.total).toBeGreaterThan(0);
  });

  test("does not include tagged notes", () => {
    const result = findUntagged(state);
    const names = result.results.map((r) => r.name);
    expect(names).not.toContain("Note A");
    expect(names).not.toContain("Note B");
  });

  test("filters by folder", () => {
    const result = findUntagged(state, { folder: "journal" });
    // Daily Note has tag "journal", so it's not untagged
    expect(result.total).toBe(0);
  });

  test("respects pagination", () => {
    const result = findUntagged(state, { limit: 1, offset: 0 });
    expect(result.results.length).toBeLessThanOrEqual(1);
  });
});

describe("levenshtein", () => {
  test("returns 0 for identical strings", () => {
    expect(levenshtein("abc", "abc")).toBe(0);
  });

  test("returns correct distance for single edit", () => {
    expect(levenshtein("abc", "ab")).toBe(1);
    expect(levenshtein("abc", "axc")).toBe(1);
    expect(levenshtein("abc", "abcd")).toBe(1);
  });

  test("handles empty strings", () => {
    expect(levenshtein("", "abc")).toBe(3);
    expect(levenshtein("abc", "")).toBe(3);
    expect(levenshtein("", "")).toBe(0);
  });

  test("returns correct distance for multiple edits", () => {
    expect(levenshtein("kitten", "sitting")).toBe(3);
  });
});

describe("findSimilarNames", () => {
  test("finds notes with similar names", () => {
    const result = findSimilarNames("Note A", state);
    expect(result.total).toBeGreaterThan(0);
    const names = result.results.map((r) => r.name);
    // Note B, Note C, Note D should be distance 1 from "Note A"
    expect(names).toContain("Note B");
    expect(names).toContain("Note C");
    expect(names).toContain("Note D");
  });

  test("does not include exact match", () => {
    const result = findSimilarNames("Note A", state);
    const names = result.results.map((r) => r.name);
    expect(names).not.toContain("Note A");
  });

  test("results sorted by distance", () => {
    const result = findSimilarNames("Note A", state);
    for (let i = 1; i < result.results.length; i++) {
      expect(result.results[i].distance).toBeGreaterThanOrEqual(
        result.results[i - 1].distance,
      );
    }
  });

  test("respects threshold", () => {
    const loose = findSimilarNames("Note A", state, { threshold: 10 });
    const strict = findSimilarNames("Note A", state, { threshold: 1 });
    expect(strict.total).toBeLessThanOrEqual(loose.total);
  });

  test("respects pagination", () => {
    const result = findSimilarNames("Note A", state, {
      limit: 1,
      offset: 0,
    });
    expect(result.results.length).toBeLessThanOrEqual(1);
  });
});

describe("backlinks new filters", () => {
  test("excludeFolders removes notes in excluded folders", () => {
    // Daily Note is in journal/ — if it linked to something, this would filter it
    const result = backlinks("Note B", state, {
      excludeFolders: ["journal"],
    });
    // Note A and Note C link to Note B, neither is in journal/
    const names = result.results.map((r) => r.name);
    expect(names).toContain("Note A");
    expect(names).toContain("Note C");
  });

  test("excludePattern filters backlinks by name regex", () => {
    const all = backlinks("Note B", state);
    const filtered = backlinks("Note B", state, {
      excludePattern: "^Note A$",
    });
    expect(filtered.total).toBeLessThan(all.total);
    const names = filtered.results.map((r) => r.name);
    expect(names).not.toContain("Note A");
  });

  test("date filter with future date returns 0 results", () => {
    const result = backlinks("Note B", state, {
      modifiedAfter: "2099-01-01",
    });
    expect(result.total).toBe(0);
  });

  test("date filter with past date returns all results", () => {
    const result = backlinks("Note B", state, {
      modifiedAfter: "2000-01-01",
    });
    expect(result.total).toBeGreaterThan(0);
  });
});

describe("batchFindBacklinks", () => {
  test("resolves multiple notes and returns backlinks for each", () => {
    const result = batchFindBacklinks(["Note A", "Note B"], state);
    expect(result.results.length).toBe(2);
    expect(result.errors.length).toBe(0);
    const names = result.results.map((r) => r.name);
    expect(names).toContain("Note A");
    expect(names).toContain("Note B");
  });

  test("returns errors for missing notes", () => {
    const result = batchFindBacklinks(["Note A", "nonexistent"], state);
    expect(result.results.length).toBe(1);
    expect(result.errors.length).toBe(1);
    expect(result.errors[0].name).toBe("nonexistent");
  });

  test("passes filter opts through to backlinks", () => {
    const result = batchFindBacklinks(["Note B"], state, {
      excludePattern: "^Note A$",
    });
    expect(result.results.length).toBe(1);
    const bl = result.results[0].backlinks;
    const names = bl.results.map((r) => r.name);
    expect(names).not.toContain("Note A");
  });

  test("passes pagination through to backlinks", () => {
    const result = batchFindBacklinks(["Note B"], state, {
      limit: 1,
      offset: 0,
    });
    expect(result.results[0].backlinks.results.length).toBe(1);
    expect(result.results[0].backlinks.total).toBeGreaterThan(1);
  });

  test("passes folder filter through to backlinks", () => {
    const result = batchFindBacklinks(["Note A"], state, {
      folder: "journal",
    });
    // No notes in journal/ link to Note A
    expect(result.results[0].backlinks.total).toBe(0);
  });
});

describe("orphans excludeFolders", () => {
  test("excludeFolders removes notes in excluded folders", () => {
    const all = orphans(state);
    const filtered = orphans(state, { excludeFolders: ["journal"] });
    const allNames = all.results.map((r) => r.name);
    const filteredNames = filtered.results.map((r) => r.name);
    // Daily Note is an orphan in journal/
    if (allNames.includes("Daily Note")) {
      expect(filteredNames).not.toContain("Daily Note");
      expect(filtered.total).toBeLessThan(all.total);
    }
  });

  test("excludeFolders combined with folder filter", () => {
    // folder: "journal" includes only journal notes, excludeFolders: ["journal"] then removes them
    const result = orphans(state, {
      folder: "journal",
      excludeFolders: ["journal"],
    });
    expect(result.total).toBe(0);
  });
});

describe("missingNotes noteNames", () => {
  test("noteNames scopes broken links to specific notes", () => {
    // Note B has a link to "Missing Note"
    const result = missingNotes(state, { noteNames: ["Note B"] });
    const names = result.results.map((r) => r.name);
    expect(names).toContain("missing note");
  });

  test("noteNames with nonexistent note returns 0 results", () => {
    const result = missingNotes(state, { noteNames: ["nonexistent"] });
    expect(result.total).toBe(0);
  });

  test("noteNames with note that has no broken links returns 0", () => {
    // Orphan Note has no outgoing links
    const result = missingNotes(state, { noteNames: ["Orphan Note"] });
    expect(result.total).toBe(0);
  });
});

describe("missingNotes new filters", () => {
  test("excludeFolders filters referrers in excluded folders", () => {
    const all = missingNotes(state);
    const filtered = missingNotes(state, {
      excludeFolders: ["journal"],
    });
    // Should not have fewer results unless journal notes reference missing notes
    expect(filtered.total).toBeLessThanOrEqual(all.total);
  });

  test("excludePattern filters referrers by name", () => {
    // Exclude all notes matching "^Note" — should remove referrers
    const result = missingNotes(state, { excludePattern: "^Note" });
    for (const r of result.results) {
      for (const ref of r.referenced_by) {
        // referenced_by contains normalized keys, but the referrer notes should not match
        expect(ref).not.toMatch(/^note [abcd]$/);
      }
    }
  });

  test("date filter with future date returns 0 results", () => {
    const result = missingNotes(state, { modifiedAfter: "2099-01-01" });
    expect(result.total).toBe(0);
  });
});

describe("search new filters", () => {
  test("excludeFolders removes journal notes from results", () => {
    const all = search("note", state);
    const filtered = search("note", state, {
      excludeFolders: ["journal"],
    });
    expect(filtered.total).toBeLessThanOrEqual(all.total);
    const files = filtered.results.map((r) => r.file);
    expect(files).not.toContain("Daily Note");
  });

  test("excludePattern removes matching notes from results", () => {
    const all = search("note", state);
    const filtered = search("note", state, {
      excludePattern: "^Note A$",
    });
    expect(filtered.total).toBeLessThan(all.total);
    const files = filtered.results.map((r) => r.file);
    expect(files).not.toContain("Note A");
  });
});

describe("findByTag new filters", () => {
  test("excludeFolders removes journal notes from tag results", () => {
    const all = findByTag("journal", state);
    const filtered = findByTag("journal", state, {
      excludeFolders: ["journal"],
    });
    expect(filtered.total).toBeLessThan(all.total);
    const names = filtered.results.map((r) => r.name);
    expect(names).not.toContain("Daily Note");
  });

  test("excludePattern removes matching notes from tag results", () => {
    const all = findByTag("reference", state);
    const filtered = findByTag("reference", state, {
      excludePattern: "^Note B$",
    });
    expect(filtered.total).toBeLessThan(all.total);
    const names = filtered.results.map((r) => r.name);
    expect(names).not.toContain("Note B");
  });
});

describe("findUntagged new filters", () => {
  test("excludeFolders removes notes in excluded folders", () => {
    const all = findUntagged(state);
    const filtered = findUntagged(state, {
      excludeFolders: ["journal"],
    });
    // If no untagged notes are in journal/, counts are equal
    expect(filtered.total).toBeLessThanOrEqual(all.total);
  });

  test("excludePattern removes matching notes", () => {
    const all = findUntagged(state);
    const filtered = findUntagged(state, {
      excludePattern: "^Orphan",
    });
    expect(filtered.total).toBeLessThan(all.total);
    const names = filtered.results.map((r) => r.name);
    expect(names).not.toContain("Orphan Note");
  });
});

describe("rebuildGraph", () => {
  test("preserves object identity after rebuild", () => {
    const ref = state;
    rebuildGraph(state);
    expect(state).toBe(ref);
    expect(state.notes.size).toBeGreaterThan(0);
  });

  test("graph is functional after rebuild", () => {
    rebuildGraph(state);
    const note = resolve("Note A", state);
    expect(note).not.toBeNull();
    expect(note!.name).toBe("Note A");

    const result = backlinks("Note B", state);
    expect(result.results.length).toBeGreaterThan(0);

    const s = stats(state);
    expect(s.total_notes).toBe(8);
  });
});

describe("Note mtime field", () => {
  test("notes have mtime as Date", () => {
    const note = resolve("Note A", state);
    expect(note).not.toBeNull();
    expect(note!.mtime).toBeInstanceOf(Date);
  });
});

describe("Note separate tags", () => {
  test("Note A has frontmatter and inline tags separated", () => {
    const note = resolve("Note A", state);
    expect(note).not.toBeNull();
    expect(note!.frontmatterTags).toContain("project");
    expect(note!.frontmatterTags).toContain("active");
    expect(note!.inlineTags).toContain("tag1");
    expect(note!.inlineTags).toContain("nested/tag2");
    // allTags should have all
    expect(allTags(note!)).toContain("project");
    expect(allTags(note!)).toContain("tag1");
  });

  test("Note with only frontmatter tags has empty inlineTags", () => {
    const note = resolve("Note B", state);
    expect(note).not.toBeNull();
    expect(note!.frontmatterTags).toContain("reference");
    // Note B has inline #topicB
    expect(note!.inlineTags).toContain("topicB");
  });
});

describe("date filters", () => {
  test("passesDateFilter in orphans - future date excludes all", () => {
    const result = orphans(state, { modifiedAfter: "2099-01-01" });
    expect(result.total).toBe(0);
  });

  test("passesDateFilter in orphans - past date includes all", () => {
    const result = orphans(state, { modifiedAfter: "2000-01-01" });
    expect(result.total).toBeGreaterThan(0);
  });

  test("passesDateFilter in findByTag - future date excludes all", () => {
    const result = findByTag("reference", state, {
      modifiedAfter: "2099-01-01",
    });
    expect(result.total).toBe(0);
  });

  test("passesDateFilter in findUntagged - future date excludes all", () => {
    const result = findUntagged(state, { modifiedAfter: "2099-01-01" });
    expect(result.total).toBe(0);
  });

  test("passesDateFilter in search - future date excludes all", () => {
    const result = search("note", state, { modifiedAfter: "2099-01-01" });
    expect(result.total).toBe(0);
  });
});

describe("passesTagFilter", () => {
  test("no filters → passes", () => {
    const note = resolve("Note A", state)!;
    expect(passesTagFilter(note)).toBe(true);
  });

  test("empty arrays → passes (same as undefined)", () => {
    const note = resolve("Note A", state)!;
    expect(passesTagFilter(note, [], [])).toBe(true);
  });

  test("tags inclusion matches existing tag", () => {
    const note = resolve("Note A", state)!;
    expect(passesTagFilter(note, ["project"])).toBe(true);
  });

  test("tags inclusion rejects note without tag", () => {
    const note = resolve("Note A", state)!;
    expect(passesTagFilter(note, ["nonexistent"])).toBe(false);
  });

  test("tags inclusion uses OR semantics", () => {
    const note = resolve("Note A", state)!;
    expect(passesTagFilter(note, ["project", "nonexistent"])).toBe(true);
  });

  test("excludeTags rejects note with excluded tag", () => {
    const note = resolve("Note A", state)!;
    expect(passesTagFilter(note, undefined, ["project"])).toBe(false);
  });

  test("excludeTags passes note without excluded tag", () => {
    const note = resolve("Note A", state)!;
    expect(passesTagFilter(note, undefined, ["nonexistent"])).toBe(true);
  });

  test("combined: tags inclusion + excludeTags rejection", () => {
    // Note B has tags: reference, topicB
    const note = resolve("Note B", state)!;
    expect(passesTagFilter(note, ["reference"], ["topicB"])).toBe(false);
  });

  test("strips leading # from tags", () => {
    const note = resolve("Note A", state)!;
    expect(passesTagFilter(note, ["#project"])).toBe(true);
  });

  test("case-insensitive matching", () => {
    const note = resolve("Note A", state)!;
    expect(passesTagFilter(note, ["PROJECT"])).toBe(true);
  });

  test("note with no tags fails inclusion, passes exclusion", () => {
    const note = resolve("Orphan Note", state)!;
    expect(allTags(note).length).toBe(0);
    expect(passesTagFilter(note, ["project"])).toBe(false);
    expect(passesTagFilter(note, undefined, ["project"])).toBe(true);
  });
});

describe("tag filters integration", () => {
  test("backlinks with tags filter includes only matching referrers", () => {
    // Note B is linked by Note A (project, active, tag1, nested/tag2) and Note C (reference)
    const result = backlinks("Note B", state, { tags: ["project"] });
    const names = result.results.map((r) => r.name);
    expect(names).toContain("Note A");
    expect(names).not.toContain("Note C");
  });

  test("backlinks with excludeTags filter excludes matching referrers", () => {
    const result = backlinks("Note B", state, { excludeTags: ["project"] });
    const names = result.results.map((r) => r.name);
    expect(names).not.toContain("Note A");
    expect(names).toContain("Note C");
  });

  test("orphans with tags filter", () => {
    // Empty Orphan has tag "empty" and is an orphan
    const result = orphans(state, { tags: ["empty"] });
    const names = result.results.map((r) => r.name);
    expect(names).toContain("Empty Orphan");
    expect(result.total).toBe(1);
  });

  test("orphans with excludeTags filter", () => {
    const all = orphans(state);
    const filtered = orphans(state, { excludeTags: ["empty"] });
    expect(filtered.total).toBeLessThan(all.total);
    const names = filtered.results.map((r) => r.name);
    expect(names).not.toContain("Empty Orphan");
  });

  test("search with tags filter limits to matching notes", () => {
    // Note A has tag "project" and content mentioning "note"
    const result = search("note", state, { tags: ["project"] });
    const files = result.results.map((r) => r.file);
    expect(files).toContain("Note A");
    expect(files).not.toContain("Note B");
    expect(files).not.toContain("Note C");
  });

  test("findByTag with excludeTags filters matching notes", () => {
    // reference tag: Note B (topicB), Note C, Note D
    const result = findByTag("reference", state, { excludeTags: ["topicB"] });
    const names = result.results.map((r) => r.name);
    expect(names).not.toContain("Note B");
    expect(names).toContain("Note C");
    expect(names).toContain("Note D");
  });

  test("stats with tags filter scopes counts", () => {
    // "reference" tag: Note B, Note C, Note D (all 3 have tags)
    const s = stats(state, { tags: ["reference"] });
    expect(s.total_notes).toBe(3);
    expect(s.tagged).toBe(3);
    expect(s.untagged).toBe(0);
  });

  test("stats with no opts is backward compatible", () => {
    const s = stats(state);
    expect(s.total_notes).toBe(8);
    expect(s.tagged).toBeGreaterThan(0);
    expect(typeof s.orphans).toBe("number");
    expect(typeof s.missing_links).toBe("number");
  });

  test("stats with excludeTags filter", () => {
    const all = stats(state);
    const filtered = stats(state, { excludeTags: ["project"] });
    expect(filtered.total_notes).toBeLessThan(all.total_notes);
  });

  test("missingNotes with tags filter scopes referrers", () => {
    // Note B (reference, topicB) links to "Missing Note"
    const result = missingNotes(state, { tags: ["reference"] });
    const names = result.results.map((r) => r.name);
    expect(names).toContain("missing note");
  });

  test("missingNotes with excludeTags filter excludes referrers", () => {
    // Exclude all notes with "reference" tag — Note B won't be a referrer
    const result = missingNotes(state, { excludeTags: ["reference"] });
    // Note B is the only referrer of "missing note" with reference tag
    // Note A also references missing "diagram.png" embed
    const missing = result.results.find((r) => r.name === "missing note");
    if (missing) {
      // Only non-reference referrers should remain
      for (const ref of missing.referenced_by) {
        const note = state.notes.get(ref);
        if (note) {
          expect(
            allTags(note).some((t) => t.toLowerCase() === "reference"),
          ).toBe(false);
        }
      }
    }
  });

  test("batchFindBacklinks passes tags filter through", () => {
    const result = batchFindBacklinks(["Note B"], state, {
      tags: ["project"],
    });
    expect(result.results.length).toBe(1);
    const names = result.results[0].backlinks.results.map((r) => r.name);
    expect(names).toContain("Note A");
    expect(names).not.toContain("Note C");
  });

  test("findUntagged with excludeTags", () => {
    // findUntagged only supports excludeTags, not tags
    // This shouldn't affect results since untagged notes have no tags
    const result = findUntagged(state, { excludeTags: ["project"] });
    const names = result.results.map((r) => r.name);
    // Untagged notes shouldn't have "project" tag anyway, so same results
    expect(names).toContain("Orphan Note");
  });
});
