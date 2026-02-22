export interface Wikilink {
  name: string;
  heading: string | null;
  alias: string | null;
  line: number;
  embed: boolean;
}

export interface Heading {
  level: number;
  text: string;
  line: number;
}

export interface Checkbox {
  checked: boolean;
  text: string;
  line: number;
  indent: number;
}

export interface Note {
  path: string;
  name: string;
  content: string;
  frontmatter: Record<string, unknown> | null;
  wikilinks: Wikilink[];
  frontmatterTags: string[];
  inlineTags: string[];
  headings: Heading[];
  checkboxes: Checkbox[];
  mtime: Date;
}

export function allTags(note: Note): string[] {
  if (note.inlineTags.length === 0) return note.frontmatterTags;
  if (note.frontmatterTags.length === 0) return note.inlineTags;
  const seen = new Set(note.frontmatterTags);
  const result = [...note.frontmatterTags];
  for (const t of note.inlineTags) {
    if (!seen.has(t)) {
      seen.add(t);
      result.push(t);
    }
  }
  return result;
}
