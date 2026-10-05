---
title: landing
parent: 4-software-engineering/1-projects/1-hexframe/1-app/src/domains/mapping/landing
owner: diplo
preview: >-
  An import, from an upload to the Tiles it lands: the bounds an archive
  unpacks within and the verdict on its entries, pure, which the browser runs
  too; then the upload read into a plan outside any transaction, and the plan
  landed in one batch, in a free slot or as the Root of an empty System.
---
# landing

Where an import becomes Tiles of a System. What the files mean is `files/import/`'s; this folder takes an upload, checks what its archive may hold, reads it through `importOf`, and writes the plan as one change of [[4-software-engineering/1-projects/1-hexframe/1-app/src/domains/mapping/CLAUDE|Mapping]]'s.

| File | Holds |
|---|---|
| `archive.ts` | `archiveBounds`, what an archive may unpack to (2,000 entries, the shape's 1 MB a file, 16 MB in all), which the zip repository counts as it inflates; `Upload`, what was sent; `folderOf`, the verdict on the entries it unpacked, every path that isn't plain, a symlink, an entry past 16 folders and two paths a case-blind disk would merge each a fault on its path (`pathFault`), or the folder's files for `importOf`. The same checks for a sender: `pastBounds`, a folder's files by their sizes, `pathFaults`, the verdict on paths alone, `stoppedAt`, where an archive stopped unpacking as a fault, `wrappingFolder`, the one folder an archive wraps its folder in. `uploadLimit`, 4 MB, `uploadFaults`, an upload's fault by its size, and `fitsUpload`, an upload refused by it before a byte is read, which the API calls first |
| `landing.ts` | `planImport`, an upload read into a plan through the `Zip` service, outside any transaction; `importTiles`, a plan landed as a change, in a free slot under a Tile or as the Root of an empty System (`isEmptySystem`, `leaves/`), every row written in one batch (`Writes.insertAll`), its References resolved, answering what it created and left out |
| `archive.test.ts` | The verdict on entry lists made by hand, file sizes against the bounds, a wrapping folder |
| `landing.test.ts` | Imports landed over PGlite: into a Branch, a Leaf and a Context slot and as the Root; refused into Help, a taken slot, a folder into a Leaf slot, and a System that isn't empty, an untitled Root's Preview or Body included; References inside, by link and broken; nothing written when refused; two copies of one zip; a large import in several statements |

## Rules

- **Planned outside the transaction, landed in one.** The API composes the two: `planImport` inflates and reads with no connection held, then `importTiles` runs in the transaction `api/mapping/programs.ts` opens, as every change does (`hexframe-app-import-export/decisions.md#DEC-11`).
- **`archive.ts` is pure, and the browser runs it.** A sender checks the same bounds and paths before it zips, through `api/mapping/files/upload.ts`, so it imports nothing but Mapping's pure modules and the zip repository's types. `landing.ts` reaches the database and never leaves the server (`#DEC-12`).
- **An import as the Root lands only in an empty System**, its Root untitled, without Preview nor Body, holding nothing: `isEmptySystem`, the rule the front offers the import by too, since landing replaces the Root's content. Any other System is `DirectionTaken`.
- **It always creates.** The `id`s an import reads are ignored; a Reference inside the plan points at the new Tile, one by link only at a Tile of the importer's own System, anything else lands broken.
