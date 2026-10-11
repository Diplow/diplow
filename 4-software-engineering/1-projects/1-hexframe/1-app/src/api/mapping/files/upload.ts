// What the browser takes of Mapping and of the zip repository to prune and zip an import before its
// upload (`front/client/mapping/import/upload.ts`). Pure modules only: never `landing/landing.ts`, which
// reaches the database, nor the `Zip` service, the server's runtime's.
export type { LeftOut } from '#/domains/mapping/files/import/plan'
export { isSettingsFile, leftOutOf, skippedAsBinary } from '#/domains/mapping/files/import/read'
export {
  archiveBounds,
  pastBounds,
  pathFaults,
  stoppedAt,
  uploadFaults,
  wrappingFolder,
} from '#/domains/mapping/landing/archive'
export { type ArchiveEntry, unpacked } from '#/repositories/zip/unzip'
export { archived } from '#/repositories/zip/zip'
