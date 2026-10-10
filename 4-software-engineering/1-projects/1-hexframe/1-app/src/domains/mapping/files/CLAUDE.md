---
title: files
parent: 4-software-engineering/1-projects/1-hexframe/1-app/src/domains/mapping/files
owner: diplo
preview: >-
  A System as the files of a vault folder, both ways: a Tile and everything
  below it written as files for an export, and files read back into an import
  plan the way the shape reads a vault (import/). The one folder of the app
  that imports yaml, and the one whose import/shape.ts calls the shape. Pure:
  paths and text in, paths and text out; zipping, landing and the wire are
  elsewhere.
---
# files

How [[4-software-engineering/1-projects/1-hexframe/1-app/src/domains/mapping/CLAUDE|Mapping]] writes a System as files and reads files back, so a vault exports as itself and imports into the same tree. It decides every path and every line; the zip repository only packs them (`repositories/zip/`), `landing/` lands what an import plans, and the API layer carries both across the wire (`api/mapping/files/`).

| File | Holds |
|---|---|
| `files.ts` | `exportOf`, the files an export holds and its Tile's slug, from a System, a Tile's id and the function the caller links a Tile by: a folder per Branch, Context Tile and Reference, a file per Leaf, a `.hexframe/config.yaml` where a Tile sets its naming, the root's carrying the naming it inherits; the naming in force at each folder worked out on the way down, by `entities/kept/naming.ts`'s `inherited` (`hexframe-app-import-export/decisions.md#DEC-8`) |
| `names.ts` | `namesIn`, what a folder's entries are named, a kept Name dressed for its slot or the folder pattern in force, numbered wherever the shape would not read it back in its Direction; `slugOf`; `isVerbatim`, a Leaf written as its content alone, which the API layer offers the browser too (`api/mapping/files/download.ts`) (`#DEC-7`) |
| `frontmatter.ts` | The YAML an export writes and an import reads back, every value on its key's line (`#DEC-6`) |
| `files.test.ts`, `names.test.ts` | On Systems and entries made by hand: every file split back as the shape splits it, every name seated where the shape's `sortEntries` seats it, the naming inherited and overridden, Help exported whole |

| Folder | Holds |
|---|---|
| `import/` | Files read back. `read.ts`, `importOf`, a folder's files or one file alone read the way the shape reads a vault into an import plan, the Tiles an import creates and what it left out, or `ImportRefused` with every fault; and what a sender leaves out before an upload, the way a reading would: `leftOutOf`, by names, `skippedAsBinary`, by bytes, `isSettingsFile`, the `.hexframe/` files a sender reads first. `plan.ts`, what it reads and plans, in Mapping's words, `LeftOut`, a file left out and why, by a sender or a reading alike, and `importedAs`, the event a plan makes once landed, `TilesImported`, with how many Tiles came below the one it landed as. `shape.ts`, the one module of the app that calls the shape, its rules answered in Mapping's types. `read.test.ts`, on file lists made by hand; `round-trip.test.ts`, a varied System exported, read back into the same tree, and exported again into the same files but for their ids (`#DEC-10`) |

## Rules

- **Only this folder imports `yaml`.** dependency-cruiser's `no-yaml-outside-mapping-files` holds it here: `frontmatter.ts` writes it, `import/read.ts` reads it back, so what an export writes reads back as written (`#DEC-6`).
- **Only `import/shape.ts` calls the shape**, and only its reading rules, `node.ts` and `exclusions.ts`, besides Mapping's tests (`no-shape-outside-its-seams`). Every other module speaks Mapping's types (`#DEC-10`).
- **The browser runs part of `import/read.ts`.** A sender leaves out what a reading would before it uploads, so `leftOutOf`, `skippedAsBinary` and `isSettingsFile` sit beside `importOf` and can't drift from it, and the API layer offers them to the browser (`api/mapping/files/upload.ts`). Everything that module imports must stay pure: no repository but the zip repository's types, nothing that reaches the database, or `build`'s bundle check fails (`#DEC-12`).
- **Pure, and a defect rather than a wrong file.** An export throws on a name that isn't one path segment, or one the shape would read back elsewhere after three rounds, rather than write it; an import refuses the whole of what it can't read, every fault at once.
