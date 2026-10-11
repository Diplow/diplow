// A vault in, or a tile out, in the conversation. An import waits for files where the tile would go,
// its pickers its actions, then works, then says what it came to: the tiles created and every file
// left behind, or every fault and nothing written. An export works a moment, then leaves its receipt,
// the zip's name in it. Controlled: the phase and the report are the import's state hook's.
import { cn } from 'cn'
import { FolderInput, PackageOpen } from 'lucide-react'
import { useRef, useState, type ReactNode } from 'react'

import { m } from '#/paraglide/messages'

import { Widget } from '../../layouts/Widget'
import { PlaceMark, whereOf, type TilePlace } from './parts'

/** A path an import left out or refused, or the whole import, and why. */
interface ReportLine {
  readonly where: string
  readonly why: string
}

interface ImportProps {
  /** Into this free place, or, `root`, as an empty System's Root. */
  into: TilePlace | 'root'
  phase: 'choosing' | 'importing' | 'landed' | 'refused'
  /** The slot takes one file alone: a Leaf's. */
  fileOnly?: boolean
  /** How many tiles it created, once landed. */
  tiles?: number
  leftOut?: readonly ReportLine[]
  faults?: readonly ReportLine[]
  onDrop: (files: DataTransfer) => void
  onPickFolder: (files: FileList | null) => void
  onPickFile: (files: FileList | null) => void
  /** Back to the pickers, after a refusal. */
  onAgain: () => void
  /** Read, or let go: the widget leaves. */
  onDone: () => void
}

/** An import into a free place, or as the Root: its pickers, then what it came to. */
export function TileImport(props: ImportProps) {
  const { into, phase, tiles = 0, leftOut = [], faults = [], onAgain, onDone } = props
  const where = into === 'root' ? m.widget_import_as_root() : whereOf(into)
  const mark =
    into === 'root' ? undefined : <PlaceMark where={into} label={m.widget_tile_place()} />
  if (phase === 'landed') {
    return (
      <Widget
        voice="human"
        mark={mark}
        icon={<FolderInput />}
        kicker={m.widget_import_kicker({ where })}
        title={m.system_import_landed({ tiles: String(tiles) })}
        actions={[{ label: m.keys_done(), onSelect: onDone }]}
        onDismiss={onDone}
      >
        {leftOut.length > 0 ? (
          <Lines title={m.system_import_left_out()} lines={leftOut} />
        ) : undefined}
      </Widget>
    )
  }
  if (phase === 'refused') {
    return (
      <Widget
        voice="human"
        state="failed"
        kicker={m.widget_import_refused_kicker()}
        title={m.system_import_vault()}
        subtitle={m.error_mapping_import_refused()}
        actions={[
          { label: m.system_import_again(), onSelect: onAgain },
          { label: m.ui_close(), onSelect: onDone },
        ]}
        onDismiss={onDone}
      >
        <div className="grid gap-4">
          <Lines title={m.system_import_faults()} lines={faults} />
          <Lines title={m.system_import_left_out()} lines={leftOut} />
        </div>
      </Widget>
    )
  }
  return <Choosing {...props} where={where} mark={mark} />
}

/** The pickers while the import waits for files, the place lit; working once they are given. */
function Choosing({
  into,
  phase,
  fileOnly = false,
  onDrop,
  onPickFolder,
  onPickFile,
  onDone,
  where,
  mark,
}: ImportProps & { where: string; mark: ReactNode }) {
  const folderPicker = useRef<HTMLInputElement>(null)
  const filePicker = useRef<HTMLInputElement>(null)
  const [over, setOver] = useState(false)
  const importing = phase === 'importing'
  return (
    <Widget
      voice="human"
      state={importing ? 'working' : 'waiting'}
      mark={mark}
      icon={<FolderInput />}
      kicker={importing ? m.system_import_working() : m.widget_import_kicker({ where })}
      title={m.system_import_vault()}
      subtitle={into === 'root' ? m.system_import_root_description() : undefined}
      actions={
        importing
          ? []
          : [
              ...(fileOnly
                ? []
                : [
                    {
                      label: m.system_import_pick_folder(),
                      onSelect: () => folderPicker.current?.click(),
                    },
                  ]),
              {
                label: fileOnly ? m.system_import_pick_file() : m.system_import_pick_zip(),
                onSelect: () => filePicker.current?.click(),
              },
              { label: m.ui_cancel(), onSelect: onDone, apart: true },
            ]
      }
      onDismiss={onDone}
    >
      <div className="grid gap-2.5">
        {/* A ground the files are dropped on, lit in the voice while they hover it. */}
        <div
          onDragOver={(event) => {
            event.preventDefault()
            setOver(true)
          }}
          onDragLeave={() => {
            setOver(false)
          }}
          onDrop={(event) => {
            event.preventDefault()
            setOver(false)
            onDrop(event.dataTransfer)
          }}
          className={cn(
            'grid min-h-20 place-items-center bg-foreground/5 px-4 py-5 text-center text-[0.8125rem] font-light text-muted-foreground transition-colors duration-300',
            over && 'bg-(--voice)/12 text-foreground',
          )}
        >
          {fileOnly ? m.system_import_drop_file() : m.system_import_drop()}
        </div>
        {!fileOnly && (
          <p className="text-xs leading-normal font-light text-muted-foreground">
            {m.system_import_hint()}
          </p>
        )}
        {/* The pickers its actions open; an input forgets its files, so the same can be picked again. */}
        <input
          ref={folderPicker}
          type="file"
          hidden
          tabIndex={-1}
          // React knows no `webkitdirectory` prop, so it passes as an attribute.
          {...{ webkitdirectory: '' }}
          onChange={(event) => {
            onPickFolder(event.target.files)
            event.target.value = ''
          }}
        />
        <input
          ref={filePicker}
          type="file"
          hidden
          tabIndex={-1}
          onChange={(event) => {
            onPickFile(event.target.files)
            event.target.value = ''
          }}
        />
      </div>
    </Widget>
  )
}

/** A titled list of report lines, each a path and why; nothing when empty. */
function Lines({ title, lines }: { title: string; lines: readonly ReportLine[] }) {
  if (lines.length === 0) return null
  return (
    <section className="grid gap-2">
      <h4 className="font-mono text-[0.6875rem] text-muted-foreground">{title}</h4>
      <ul className="grid gap-2">
        {lines.map(({ where, why }, index) => (
          <li
            key={`${String(index)}:${where}`}
            className="grid gap-0.5 border-t border-border pt-2 text-[0.8125rem] font-light"
          >
            <code className="font-mono text-xs break-all text-foreground">{where}</code>
            <span className="text-muted-foreground">{why}</span>
          </li>
        ))}
      </ul>
    </section>
  )
}

interface ExportProps {
  /** The tile exported, with everything below it. */
  title: string
  /** How many tiles below it go along. */
  below: number
  phase: 'working' | 'done' | 'failed'
  /** The zip's name, once saved. */
  file?: string
  /** Why it failed. */
  reason?: string
  at?: string
  onRetry: () => void
  onDismiss: () => void
}

/** A tile and everything below it, saved as a zip: working a moment, then its receipt. */
export function TileExport({
  title,
  below,
  phase,
  file = '',
  reason,
  at,
  onRetry,
  onDismiss,
}: ExportProps) {
  if (phase === 'done') {
    return (
      <Widget
        voice="human"
        state="done"
        receipt={{
          text: (
            <>
              {m.widget_export_did()} <b>{title}</b>,{' '}
              {m.widget_export_receipt({ below: String(below), file })}
            </>
          ),
          at,
        }}
      />
    )
  }
  const failed = phase === 'failed'
  return (
    <Widget
      voice="human"
      state={failed ? 'failed' : 'working'}
      icon={<PackageOpen />}
      kicker={failed ? m.widget_export_failed_kicker() : m.widget_export_kicker()}
      title={title}
      subtitle={m.widget_export_what({ below: String(below) })}
      actions={failed ? [{ label: m.ui_retry(), onSelect: onRetry }] : []}
      onDismiss={onDismiss}
    >
      {failed && reason !== undefined ? (
        <p className="text-[0.84375rem] leading-normal font-light text-muted-foreground">
          {reason}
        </p>
      ) : undefined}
    </Widget>
  )
}
