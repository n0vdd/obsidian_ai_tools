import type { Note } from "./types.js";
import { scanVault, readNote } from "./vault.js";

export interface GraphState {
  vaultPath: string;
  notes: Map<string, Note>;
  forward: Map<string, Set<string>>;
  backward: Map<string, Set<string>>;
  missing: Map<string, Set<string>>;
}

export function buildGraph(vaultPath: string): GraphState {
  const paths = scanVault(vaultPath);
  const notes = new Map<string, Note>();

  for (const path of paths) {
    try {
      const note = readNote(path);
      notes.set(normalize(note.name), note);
    } catch {
      // skip unreadable files
    }
  }

  const { forward, backward, missing } = buildAdjacency(notes);
  return { vaultPath, notes, forward, backward, missing };
}

function buildAdjacency(notes: Map<string, Note>) {
  const forward = new Map<string, Set<string>>();
  const backward = new Map<string, Set<string>>();
  const missing = new Map<string, Set<string>>();

  for (const [sourceKey, note] of notes) {
    const targets = [...new Set(note.wikilinks.map((wl) => normalize(wl.name)))];
    forward.set(sourceKey, new Set(targets));

    for (const targetKey of targets) {
      if (!backward.has(targetKey)) backward.set(targetKey, new Set());
      backward.get(targetKey)!.add(sourceKey);

      if (!notes.has(targetKey)) {
        if (!missing.has(targetKey)) missing.set(targetKey, new Set());
        missing.get(targetKey)!.add(sourceKey);
      }
    }
  }

  return { forward, backward, missing };
}

export function resolve(
  name: string,
  state: GraphState
): Note | null {
  const key = normalize(name);
  const note = state.notes.get(key);
  if (note) return note;
  return fuzzyResolve(name, state);
}

function fuzzyResolve(name: string, state: GraphState): Note | null {
  const target = normalizeFuzzy(name);
  for (const [, note] of state.notes) {
    if (normalizeFuzzy(note.name) === target) return note;
  }
  return null;
}

export function backlinks(
  noteName: string,
  state: GraphState
): { name: string; path: string | null }[] {
  const key = normalize(noteName);
  const refs = state.backward.get(key);
  if (!refs) return [];

  return [...refs].map((refKey) => {
    const note = state.notes.get(refKey);
    return note
      ? { name: note.name, path: note.path }
      : { name: refKey, path: null };
  });
}

export function orphans(
  state: GraphState,
  opts: { limit?: number; offset?: number } = {}
): { total: number; offset: number; limit: number; results: { name: string; path: string; tags: string[] }[] } {
  const limit = opts.limit ?? 50;
  const offset = opts.offset ?? 0;

  const orphanList: { name: string; path: string; tags: string[] }[] = [];
  for (const [key, note] of state.notes) {
    const refs = state.backward.get(key);
    if (!refs || refs.size === 0) {
      orphanList.push({ name: note.name, path: note.path, tags: note.tags });
    }
  }
  orphanList.sort((a, b) => a.name.localeCompare(b.name));

  const total = orphanList.length;
  const page = orphanList.slice(offset, offset + limit);
  return { total, offset, limit, results: page };
}

export function missingNotes(
  state: GraphState,
  opts: { limit?: number; offset?: number } = {}
): { total: number; offset: number; limit: number; results: { name: string; referenced_by: string[]; count: number }[] } {
  const limit = opts.limit ?? 50;
  const offset = opts.offset ?? 0;

  const missingList: { name: string; referenced_by: string[]; count: number }[] = [];
  for (const [name, referrers] of state.missing) {
    missingList.push({
      name,
      referenced_by: [...referrers],
      count: referrers.size,
    });
  }
  missingList.sort((a, b) => b.count - a.count);

  const total = missingList.length;
  const page = missingList.slice(offset, offset + limit);
  return { total, offset, limit, results: page };
}

export function traverse(
  noteName: string,
  maxDepth: number,
  state: GraphState
) {
  const startNote = resolve(noteName, state);
  if (!startNote) {
    return { error: `Note '${noteName}' not found`, notes: [], missing: [] };
  }

  const startKey = normalize(noteName);
  const visited = new Map<string, number>();
  const missingFound = new Set<string>();

  // BFS
  const queue: [string, number][] = [[startKey, 0]];
  while (queue.length > 0) {
    const [key, depth] = queue.shift()!;
    if (visited.has(key)) continue;
    visited.set(key, depth);

    if (depth < maxDepth) {
      const targets = state.forward.get(key);
      if (targets) {
        for (const target of targets) {
          if (state.notes.has(target)) {
            queue.push([target, depth + 1]);
          } else {
            missingFound.add(target);
          }
        }
      }
    }
  }

  const notes = [...visited.entries()]
    .map(([key, depth]) => {
      const note = state.notes.get(key)!;
      return {
        name: note.name,
        path: note.path,
        depth,
        frontmatter: note.frontmatter,
        tags: note.tags,
      };
    })
    .sort((a, b) => a.depth - b.depth || a.name.localeCompare(b.name));

  const missingResult = [...missingFound].map((name) => {
    const referrers = state.missing.get(name);
    return {
      name,
      referenced_by: referrers ? [...referrers] : [],
    };
  });

  return { root: startNote.name, depth: maxDepth, notes, missing: missingResult };
}

export function stats(state: GraphState) {
  const total = state.notes.size;
  let tagged = 0;
  for (const [, note] of state.notes) {
    if (note.tags.length > 0) tagged++;
  }

  let orphanCount = 0;
  for (const [key] of state.notes) {
    const refs = state.backward.get(key);
    if (!refs || refs.size === 0) orphanCount++;
  }

  return {
    total_notes: total,
    tagged,
    untagged: total - tagged,
    orphans: orphanCount,
    missing_links: state.missing.size,
  };
}

export function search(
  query: string,
  state: GraphState,
  opts: { limit?: number; offset?: number } = {}
) {
  const limit = opts.limit ?? 50;
  const offset = opts.offset ?? 0;
  const q = query.toLowerCase();
  const needed = offset + limit;

  let total = 0;
  const collected: { file: string; path: string; line: number; text: string }[] = [];

  for (const [, note] of state.notes) {
    const lines = note.content.split(/\r?\n/);
    for (let i = 0; i < lines.length; i++) {
      if (lines[i].toLowerCase().includes(q)) {
        total++;
        if (collected.length < needed) {
          collected.push({
            file: note.name,
            path: note.path,
            line: i + 1,
            text: lines[i].trim(),
          });
        }
      }
    }
  }

  const page = collected.slice(offset, offset + limit);
  return { total, offset, limit, results: page };
}

function normalize(name: string): string {
  return name.trim().toLowerCase();
}

function normalizeFuzzy(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .replace(/[-_]/g, "")
    .normalize("NFD")
    .replace(/[^\x00-\x7F]/g, "");
}
