// An import, in its drawer: a drop zone and its pickers while it waits for files, then what it came
// to, the Tiles created and every file left behind, or every fault and nothing written. What it holds
// and does is its state hook's (./state/useImportState.ts); this only shows it.
import { cn } from 'cn'
import { useRef, useState } from 'react'

import type { ImportPlace } from '#/front/client/mapping/queries'
import { m } from '#/paraglide/messages'
import { Button } from '#/front/ui/inputs/controls/button'
import { Input } from '#/front/ui/inputs/controls/input'

import { type ReportLine, useImportState } from './state/useImportState'

interface ImportProps {
  place: ImportPlace
  /** Closes the drawer once the user has read the report. */
  onDone: () => void
}

export function Import({ place, onDone }: ImportProps) {
  const { state, actions } = useImportState(place)
  if (state.phase === 'landed') {
    return (
      <div className="grid gap-4 pb-4">
        <p role="status" className="font-medium">
          {m.system_import_landed({ tiles: String(state.tiles) })}
        </p>
        <Lines title={m.system_import_left_out()} lines={state.leftOut} />
        <div>
          <Button size="sm" onClick={onDone}>
            {m.ui_close()}
          </Button>
        </div>
      </div>
    )
  }
  if (state.phase === 'refused') {
    return (
      <div className="grid gap-4 pb-4">
        <p role="alert" className="font-medium text-destructive">
          {m.error_mapping_import_refused()}
        </p>
        <Lines title={m.system_import_faults()} lines={state.faults} />
        <Lines title={m.system_import_left_out()} lines={state.leftOut} />
        <div>
          <Button variant="outline" size="sm" onClick={actions.again}>
            {m.system_import_again()}
          </Button>
        </div>
      </div>
    )
  }
  return (
    <Choosing fileOnly={state.fileOnly} importing={state.phase === 'importing'} actions={actions} />
  )
}

interface ChoosingProps {
  fileOnly: boolean
  importing: boolean
  actions: ReturnType<typeof useImportState>['actions']
}

/** The drop zone and its pickers, a folder's left out where a slot takes one file alone. */
function Choosing({ fileOnly, importing, actions }: ChoosingProps) {
  const folderPicker = useRef<HTMLInputElement>(null)
  const filePicker = useRef<HTMLInputElement>(null)
  const [over, setOver] = useState(false)
  return (
    <div className="grid gap-4 pb-4">
      <div
        className={cn(
          'grid place-items-center gap-3 rounded-lg border-2 border-dashed p-6 text-center text-sm text-muted-foreground transition-colors',
          over && 'border-brand bg-accent',
        )}
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
          actions.drop(event.dataTransfer)
        }}
      >
        {importing ? (
          <p role="status">{m.system_import_working()}</p>
        ) : (
          <>
            <p>{fileOnly ? m.system_import_drop_file() : m.system_import_drop()}</p>
            <div className="flex flex-wrap justify-center gap-2">
              {!fileOnly && (
                <Button variant="outline" size="sm" onClick={() => folderPicker.current?.click()}>
                  {m.system_import_pick_folder()}
                </Button>
              )}
              <Button variant="outline" size="sm" onClick={() => filePicker.current?.click()}>
                {fileOnly ? m.system_import_pick_file() : m.system_import_pick_zip()}
              </Button>
            </div>
          </>
        )}
      </div>
      <p className="text-xs text-muted-foreground">{m.system_import_hint()}</p>
      {/* The pickers the buttons open; an input forgets its files, so the same ones can be picked again. */}
      <Input
        ref={folderPicker}
        type="file"
        hidden
        tabIndex={-1}
        // The folder picker: React knows no `webkitdirectory` prop, so it passes as an attribute.
        {...{ webkitdirectory: '' }}
        onChange={(event) => {
          actions.pickFolder(event.target.files)
          event.target.value = ''
        }}
      />
      <Input
        ref={filePicker}
        type="file"
        hidden
        tabIndex={-1}
        onChange={(event) => {
          actions.pickFile(event.target.files)
          event.target.value = ''
        }}
      />
    </div>
  )
}

/** A titled list of report lines, each a path, or the whole import, and why; nothing when empty. */
function Lines({ title, lines }: { title: string; lines: ReadonlyArray<ReportLine> }) {
  if (lines.length === 0) return null
  return (
    <section className="grid gap-2">
      <h3 className="text-sm font-medium">{title}</h3>
      <ul className="grid gap-2 text-sm">
        {lines.map(({ where, why }, index) => (
          <li key={`${String(index)}:${where}`} className="grid gap-0.5">
            <code className="font-mono text-xs break-all">{where}</code>
            <span className="text-muted-foreground">{why}</span>
          </li>
        ))}
      </ul>
    </section>
  )
}
