---
title: zip
parent: 4-software-engineering/1-projects/1-hexframe/1-app/src/repositories/zip
owner: diplo
preview: >-
  The zip repository, the one folder that imports fflate: a list of files
  streamed into a zip archive, one file deflated each time the reader asks for
  more, as the Zip service Mapping exports through; and, for tests, an archive
  read back into its files. It speaks paths and bytes; Mapping decides the
  files.
---
# zip

Where hexframe meets the zip format, through [fflate](https://github.com/101arrowz/fflate): small, streaming, and the same code in Node and the browser. Only this folder imports it (`dependency-cruiser.config.ts`, `sdks`). It speaks paths and bytes: which files an export holds, and what they say, is [[4-software-engineering/1-projects/1-hexframe/1-app/src/domains/mapping/CLAUDE|Mapping]]'s (`files/`).

| File | Holds |
|---|---|
| `zip.ts` | `zipped`, a list of files (`Entry`, a path and its text) as a `ReadableStream` of the archive's bytes, which deflates one file each time its reader asks for more, so the archive is never whole in memory and a response that sends it streams; `Zip`, the service the server's runtime provides Mapping, and `layer`, over fflate |
| `testing.ts` | `unzipped`, an archive read back whole into its files, for the tests of this folder and of the export (`api/mapping/download.test.ts`) |
| `zip.test.ts` | Files zipped and read back the same, paths and text in UTF-8, an empty archive, and an archive that comes in more reads than it holds files |

## Rules

- **An archive streams out.** `zipped` adds the next file only on a pull, through fflate's synchronous `ZipDeflate`, never its worker-backed one: a function answers with the stream while the archive is still being written (`hexframe-app-import-export/decisions.md#DEC-9`).
- **Reading one back is for tests, for now.** `unzipped` trusts the archive and reads it whole: it is for an archive the app wrote itself, as the tests do. An import, which reads archives a user sends, brings its own reader, bounded as it inflates ([[4-software-engineering/1-projects/1-hexframe/1-app/src/domains/mapping/CLAUDE|mapping]], "Later").
