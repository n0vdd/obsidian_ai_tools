import { describe, test, expect, beforeAll } from "vitest";
import { join } from "path";
import {
  buildGraph,
  resolve,
  backlinks,
  orphans,
  missingNotes,
  traverse,
  stats,
  search,
  type GraphState,
} from "../src/graph.js";

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
});

describe("backlinks", () => {
  test("finds notes linking to the given note", () => {
    const refs = backlinks("Note B", state);
    const names = refs.map((r) => r.name);
    expect(names).toContain("Note A");
    expect(names).toContain("Note C");
  });

  test("returns empty for notes with no backlinks", () => {
    const refs = backlinks("Orphan Note", state);
    expect(refs).toEqual([]);
  });
});

describe("orphans", () => {
  test("finds notes with no incoming links", () => {
    const result = orphans(state);
    const names = result.results.map((r) => r.name);
    expect(names).toContain("Orphan Note");
    expect(result.total).toBeGreaterThan(0);
  });

  test("respects limit and offset", () => {
    const result = orphans(state, { limit: 1, offset: 0 });
    expect(result.results.length).toBeLessThanOrEqual(1);
    expect(result.limit).toBe(1);
    expect(result.offset).toBe(0);
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
});

describe("stats", () => {
  test("returns vault statistics", () => {
    const s = stats(state);
    expect(s.total_notes).toBe(4);
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
});
