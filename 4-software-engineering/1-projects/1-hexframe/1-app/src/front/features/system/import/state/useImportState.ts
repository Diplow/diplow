// The import's state, as its drawer shows it: what the place takes, whether it is waiting for files,
// at work, landed or refused, and each line of its report in the page's language. The import itself is
// a write, Query's (`useImportTiles`); the files come from the browser's pickers and drops, read by
// `front/client/mapping/files.ts`. The component renders this and calls the actions, nothing more.
import { isLeafSlot } from '#/domains/mapping/entities'
import { dropped, pickedFile, pickedFolder } from '#/front/client/mapping/files'
import { type ImportPlace, type Imported, useImportTiles } from '#/front/client/mapping/queries'
import type { Given, LeftOut } from '#/front/client/mapping/upload'
import { m } from '#/paraglide/messages'

type Refused = Extract<Imported, { _tag: 'Refused' }>

/** Why a file stayed behind, left out by the browser or skipped by the server alike. */
const reasons: Record<LeftOut['reason'], () => string> = {
  Excluded: m.system_import_reason_excluded,
  DotFile: m.system_import_reason_dot_file,
  Binary: m.system_import_reason_binary,
  Shadowed: m.system_import_reason_shadowed,
}

/** What is wrong with a path, as the browser or the server refuses an import for it. */
type Fault = Refused['faults'][number]['fault']

const faults: Record<Fault, () => string> = {
  RingOverflows: m.system_import_fault_ring_overflows,
  DirectionClaimed: m.system_import_fault_direction_claimed,
  TitleTooLong: m.system_import_fault_title_too_long,
  PreviewTooLong: m.system_import_fault_preview_too_long,
  BodyTooLong: m.system_import_fault_body_too_long,
  FileTooLarge: m.system_import_fault_file_too_large,
  NameInvalid: m.system_import_fault_name_invalid,
  TooDeep: m.system_import_fault_too_deep,
  FrontmatterInvalid: m.system_import_fault_frontmatter_invalid,
  ConfigInvalid: m.system_import_fault_config_invalid,
  ExclusionsInvalid: m.system_import_fault_exclusions_invalid,
  ReferenceHoldsSomething: m.system_import_fault_reference_holds_something,
  NothingToImport: m.system_import_fault_nothing_to_import,
  UploadTooLarge: m.system_import_fault_upload_too_large,
  TooManyEntries: m.system_import_fault_too_many_entries,
  UnpackedTooLarge: m.system_import_fault_unpacked_too_large,
  ArchiveUnreadable: m.system_import_fault_archive_unreadable,
  Symlink: m.system_import_fault_symlink,
  PathAbsolute: m.system_import_fault_path_absolute,
  DrivePrefix: m.system_import_fault_drive_prefix,
  Backslash: m.system_import_fault_backslash,
  DotSegment: m.system_import_fault_dot_segment,
  PathNotNormal: m.system_import_fault_path_not_normal,
  PathsClash: m.system_import_fault_paths_clash,
}

/** One line of a report: where, a path or the whole import, and why. */
export interface ReportLine {
  readonly where: string
  readonly why: string
}

const lineOf = (path: string, why: string): ReportLine => ({
  where: path === '' ? m.system_import_whole() : path,
  why,
})

const leftOutLines = ({ leftOut }: Imported) =>
  leftOut.map(({ path, reason }) => lineOf(path, reasons[reason]()))

/**
 * The import as its drawer shows it: `choosing` while it waits for files, again once a failure went
 * to its toast; `importing`; `landed`, with the Tiles created and every file left out or skipped; or
 * `refused`, every fault on its path, nothing written, and what was left out beside them.
 */
type ImportView =
  | { readonly phase: 'choosing' | 'importing' }
  | {
      readonly phase: 'landed'
      readonly tiles: number
      readonly leftOut: ReadonlyArray<ReportLine>
    }
  | {
      readonly phase: 'refused'
      readonly faults: ReadonlyArray<ReportLine>
      readonly leftOut: ReadonlyArray<ReportLine>
    }

function viewOf(imported: Imported | undefined, pending: boolean): ImportView {
  if (pending) return { phase: 'importing' }
  if (imported === undefined) return { phase: 'choosing' }
  if (imported._tag === 'Refused') {
    return {
      phase: 'refused',
      faults: imported.faults.map(({ path, fault }) => lineOf(path, faults[fault]())),
      leftOut: leftOutLines(imported),
    }
  }
  const skipped = imported.report.skipped.map(({ path, reason }) => lineOf(path, reasons[reason]()))
  return {
    phase: 'landed',
    tiles: imported.report.tiles,
    leftOut: [...leftOutLines(imported), ...skipped],
  }
}

/**
 * The import into `place`: what it takes, a Leaf slot one file alone; where it stands; and the
 * actions its pickers and its drop zone call, each starting the import unless one is under way.
 */
export function useImportState(place: ImportPlace) {
  const importing = useImportTiles()
  const takes = { fileOnly: place._tag === 'Slot' && isLeafSlot(place.slot) }
  const start = (given: Given | Promise<Given> | undefined) => {
    if (given !== undefined && !importing.isPending) importing.mutate({ given, place })
  }
  return {
    state: { ...takes, ...viewOf(importing.data, importing.isPending) },
    actions: {
      /** The files `<input webkitdirectory>` picked, read before the input forgets them. */
      pickFolder: (files: FileList | null) => {
        start(pickedFolder([...(files ?? [])]))
      },
      pickFile: (files: FileList | null) => {
        const file = files?.[0]
        start(file === undefined ? undefined : pickedFile(file, takes))
      },
      /** What a drop holds, taken while its event lasts. */
      drop: (transfer: DataTransfer) => {
        start(dropped(transfer, takes))
      },
      /** Back to the pickers, the last answer forgotten. */
      again: () => {
        importing.reset()
      },
    },
  }
}
