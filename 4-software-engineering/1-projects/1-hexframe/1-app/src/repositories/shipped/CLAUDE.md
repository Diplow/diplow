---
title: shipped
parent: 4-software-engineering/1-projects/1-hexframe/1-app/src/repositories/shipped
owner: diplo
preview: >-
  The repository of the Systems hexframe ships, Help and the tutorial: the
  notes of the app's help/ and tutorial/ folders, bundled into the server at
  build time by Vite's import.meta.glob, and the reader that splits a note into
  its frontmatter and its Markdown. It speaks notes; Mapping decides which Tile
  each one is.
---
# shipped

Where [[4-software-engineering/1-projects/1-hexframe/1-app/src/domains/mapping/CLAUDE|Mapping]] gets the Systems hexframe ships from, Help and the tutorial, each the same thing by its Root. Each is a vault folder of the app, `help/` ([[4-software-engineering/1-projects/1-hexframe/1-app/help/CLAUDE|help]]) and `tutorial/` ([[4-software-engineering/1-projects/1-hexframe/1-app/tutorial/CLAUDE|tutorial]]), and this repository holds the errands of reading them: what the build bundles, and how a note is written. It speaks notes, as the tiles repository speaks rows; Mapping decides what a folder's name and a note's fields mean, which Tile each is, and what keeps one from being a Tile (`domains/mapping/shipped/`). It was Help's alone, `repositories/help/`, until the tutorial came (`hexframe-app-tutorial/decisions.md#DEC-1`).

| File | Holds |
|---|---|
| `shipped.ts` | `shippedNotes`, by folder, `help` and `tutorial`, then by language, the text of every `CLAUDE.md` under the folder (`en`) and of every `CLAUDE.fr.md` (`fr`), by its folder's path from there, `''` for the Root: an eager `import.meta.glob` per language over both folders, written out, since Vite takes a glob's arguments as literals, `exhaustive` so the dot folders of Context Tiles come too |
| `note.ts` | `shippedFolders`, the folders the build bundles, Help's then the tutorial's, each a System whose Root is its name, which the build's check reads too; `noteOf`, a note split into the scalar fields of its frontmatter (`key: value`, quoted or not, and the `>` and `|` block scalars) and its Markdown, with no YAML library; `missingFrom`, the vault's fields, `parent` and `owner`, that a note lacks (a Tile's own, its Title and Preview, are Mapping's to check); and `noteFiles`, a note's name in each language, `CLAUDE.md` in English and `CLAUDE.fr.md` in French. Which languages the shipped Systems are written in is Mapping's (`ShippedLanguage`, `domains/mapping/shipped/shipped.ts`) |
| `note.test.ts` | A note read, one with no frontmatter or an unclosed one, and the notes the build bundles: a folder of them per shipped System, a Root in each, Help's Context folders included, the tutorial's apart from Help's, each French twin under its English note's path |

## Rules

- **Nothing reads the file system at request time.** The notes are text in the server bundle; the build's check of the shipped folders (`scripts/check-shipped.ts`) is the only reader of them on disk, and it runs before Vite bundles them.
- **`note.ts` stays free of `import.meta.glob`.** The build's check loads it, and Mapping's `vault.ts` through it, with the Vite config, where the glob does not exist.
- **A folder named in `shippedFolders` is globbed by name in `shipped.ts`.** The type of `shippedNotes` asks for an entry per folder, and `note.test.ts` for a Root in each, in both languages, so a folder added to one and not the other fails the typecheck or the test.
