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
  tags: string[];
  headings: Heading[];
  checkboxes: Checkbox[];
}
