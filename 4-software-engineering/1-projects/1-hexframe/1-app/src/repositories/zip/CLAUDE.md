---
title: zip
parent: 4-software-engineering/1-projects/1-hexframe/1-app/src/repositories/zip
owner: diplo
preview: >-
  The zip repository, the one folder that imports fflate: a list of files
  streamed into a zip archive, one file deflated each time the reader asks for
  more, and an archive a user sends unpacked in memory, counted as it
  inflates, as the Zip service Mapping exports and imports through; the
  archive a browser uploads, zipped whole; and, for tests, archives written
  and read back. It speaks paths and bytes; Mapping decides the files.
---
# zip

Where hexframe meets the zip format, through [fflate](https://github.com/101arrowz/fflate): small, streaming, and the same code in Node and the browser. Only this folder imports it (`dependency-cruiser.config.ts`, `sdks`). It speaks paths and bytes: which files an export holds, and what they say, is [[4-software-engineering/1-projects/1-hexframe/1-app/src/domains/mapping/CLAUDE|Mapping]]'s (`files/`), as is what an import's entries may be (`landing/`).

| File | Holds |
|---|---|
| `zip.ts` | `zipped`, a list of files (`Entry`, a path and its text) as a `ReadableStream` of the archive's bytes, which deflates one file each time its reader asks for more, so the archive is never whole in memory and a response that sends it streams; `archived`, files (`ArchivedFile`, a path and its bytes) zipped whole in memory, the archive a browser uploads; `Zip`, the service the server's runtime provides Mapping, `zipped` and `unpacked`, and `layer`, over fflate |
| `unzip.ts` | `unpacked`, an archive a user sends read in memory within the bounds its caller gives (`UnpackBounds`): its central directory read here, each file inflated through fflate's streaming `Inflate` a kilobyte of compressed data at a time, its bytes counted as they come out, never taken from the headers; each entry (`ArchiveEntry`) its path as written, a file, a folder or a symlink by its header, and a file's bytes; or where it stopped (`Unpacked`): too many entries, before inflating any, an entry or the whole past its bound, at that entry, or an archive it can't read (no zip, encrypted, zip64, a method but stored or deflated, corrupt data) |
| `testing.ts` | `unzipped`, an archive read back whole into its files, for the tests of this folder and of the export (`api/mapping/files/download.test.ts`); `archiveOf`, files zipped whole through `archived`, for the tests of an import |
| `zip.test.ts` | Files zipped and read back the same, paths and text in UTF-8, an empty archive, and an archive that comes in more reads than it holds files; files zipped whole unpacked as the same bytes |
| `unzip.test.ts` | Archives crafted with fflate unpacked: entries in their order, paths as written however they read, a symlink said and left alone, too many entries, headers lying about an entry's size and the total's, bytes that are no archive and data that doesn't inflate |

## Rules

- **An archive streams out.** `zipped` adds the next file only on a pull, through fflate's synchronous `ZipDeflate`, never its worker-backed one: a function answers with the stream while the archive is still being written (`hexframe-app-import-export/decisions.md#DEC-9`).
- **An archive a user sends is unpacked in memory, counted as it inflates.** `unpacked` never writes to a disk, trusts no size its headers give, and stops at the first slice of an entry that passes a bound; its caller, Mapping, names the bounds and judges every path, which `unpacked` answers as written (`hexframe-app-import-export/decisions.md#DEC-11`). `unzipped` trusts the archive and reads it whole: it is for archives the app wrote itself, in tests.
- **The browser reaches two plain functions, through the API layer.** `unpacked`, to read a zip the user gave, within bounds of the browser's own, and `archived`, to zip what is left once pruned, offered by `api/mapping/files/upload.ts` and called in the page by `front/client/mapping/upload.ts`, never the `Zip` service, which is the server's runtime's (`hexframe-app-import-export/decisions.md#DEC-12`).
