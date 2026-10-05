---
title: help
parent: 4-software-engineering/1-projects/1-hexframe/1-app/src/repositories/help
owner: diplo
preview: >-
  Help's repository: the notes of the app's help/ folder, bundled into the
  server at build time by Vite's import.meta.glob, and the reader that splits
  a note into its frontmatter and its Markdown. It speaks notes; Mapping
  decides which Tile each one is.
---
# help

Where [[4-software-engineering/1-projects/1-hexframe/1-app/src/domains/mapping/CLAUDE|Mapping]] gets Help from. Help is a vault folder, the app's `help/` ([[4-software-engineering/1-projects/1-hexframe/1-app/help/CLAUDE|help]]), and this repository holds the errands of reading it: what the build bundles, and how a note is written. It speaks notes, as the tiles repository speaks rows; Mapping decides what a folder's name and a note's fields mean, which Tile each is, and what keeps one from being a Tile (`domains/mapping/help/`).

| File | Holds |
|---|---|
| `help.ts` | `helpNotes`, by language, the text of every `CLAUDE.md` under `help/` (`en`) and of every `CLAUDE.fr.md` (`fr`), by its folder's path from there, `''` for the Root: an eager `import.meta.glob` per language, since Vite takes a glob's arguments as literals, `exhaustive` so the dot folders of Context Tiles come too |
| `note.ts` | `noteOf`, a note split into the scalar fields of its frontmatter (`key: value`, quoted or not, and the `>` and `|` block scalars) and its Markdown, with no YAML library; `missingFrom`, the fields of `title`, `parent`, `owner` and `preview`, which every note of the vault holds, that a note lacks; and `noteFiles`, a note's name in each language, `CLAUDE.md` in English and `CLAUDE.fr.md` in French. Which languages Help is written in is Mapping's (`HelpLanguage`, `domains/mapping/help/help.ts`) |
| `note.test.ts` | A note read, one with no frontmatter or an unclosed one, and the notes the build bundles, Context folders included, each French twin under its English note's path |

## Rules

- **Nothing reads the file system at request time.** The notes are text in the server bundle; the build's check of Help (`scripts/check-help.ts`) is the only reader of the folder on disk, and it runs before Vite bundles it.
- **`note.ts` stays free of `import.meta.glob`.** The build's check loads it, through Mapping's `vault.ts`, with the Vite config, where the glob does not exist.
