// The view a hexframe file opens in: its view state read from the file, the folder it centers on
// drawn at depth 1, and drawn again when the vault changes under it.
import { debounce, TextFileView, type TAbstractFile } from 'obsidian'

import { kindsOf } from '../../2-claude-mod/hooks/shape/node.ts'
import { drawNotes, drawView, ringNotes } from './draw.ts'
import { diskOf } from './vault/disk.ts'
import { centerToShow, readFrame, vaultPath } from './vault/frame.ts'
import {
  centerOf,
  decodeViewState,
  defaultState,
  followRename,
  outerKindOf,
  touches,
  withCenter,
  type ViewState,
} from './view-state.ts'

export const viewType = 'hexframe'

/** How long the view waits for a burst of vault events to end before drawing again, in ms. */
const settle = 150

export class HexframeView extends TextFileView {
  /** The file's text: written back unchanged until the state changes, so a broken file stays. */
  private text = ''
  private state: ViewState = defaultState
  private problems: string[] = []
  /** The folder drawn, once a drawing is done. */
  private shown: string | undefined
  /** Counts the drawings started, so one that ends after a later one is dropped. */
  private drawings = 0
  private readonly redraw = debounce(() => void this.draw(), settle, true)

  override getViewType(): string {
    return viewType
  }

  override getViewData(): string {
    return this.text
  }

  override setViewData(data: string): void {
    this.text = data
    ;({ state: this.state, problems: this.problems } = decodeViewState(data))
    void this.draw()
  }

  override clear(): void {
    // A drawing still running for the file before is dropped when it ends.
    this.drawings++
    this.redraw.cancel()
    this.text = ''
    this.state = defaultState
    this.problems = []
    this.shown = undefined
    this.contentEl.empty()
  }

  override async onOpen(): Promise<void> {
    await super.onOpen()
    this.contentEl.addClass('hexframe-view')
    const { vault } = this.app
    this.registerEvent(
      vault.on('create', (file) => {
        this.onChange(file.path)
      }),
    )
    this.registerEvent(
      vault.on('delete', (file) => {
        this.onChange(file.path)
      }),
    )
    this.registerEvent(
      vault.on('modify', (file) => {
        this.onChange(file.path)
      }),
    )
    this.registerEvent(
      vault.on('rename', (file, from) => {
        this.onVaultRename(file, from)
      }),
    )
    // Obsidian sends no event for a dot folder, `.hexframe/` among them: coming back to the view
    // reads the folder again.
    this.registerEvent(
      this.app.workspace.on('active-leaf-change', (leaf) => {
        if (leaf === this.leaf) this.redraw()
      }),
    )
  }

  private onChange(path: string) {
    if (this.shown !== undefined && touches(path, this.shown)) this.redraw()
  }

  /** A renamed center, or a folder holding it, takes the view state along, written to the file. */
  private onVaultRename(file: TAbstractFile, from: string) {
    const next = followRename(this.state, from, file.path)
    const followed = next !== this.state
    if (followed) {
      this.state = next
      this.text = withCenter(this.text, next)
      this.requestSave()
    }
    if (followed || file === this.file) this.redraw()
    else {
      this.onChange(from)
      this.onChange(file.path)
    }
  }

  private async draw() {
    const file = this.file
    const disk = diskOf(this.app)
    if (file === null) return
    const drawing = ++this.drawings
    const notes = this.problems.map(
      (problem) => `${file.name}: ${problem}, so the view keeps its defaults there.`,
    )
    if (disk === undefined) {
      this.contentEl.empty()
      drawNotes(this.contentEl, ['Hexframe reads the vault from a file system, which it has not.'])
      return
    }
    const home = vaultPath(file.parent?.path ?? '')
    let folder = home
    try {
      const center = await centerToShow(disk, centerOf(this.state, home), home)
      if ('refused' in center) throw new Error(center.refused)
      folder = center.folder
      if (center.note !== undefined) notes.push(`${file.name}: ${center.note}.`)
      const { frame, warnings } = await readFrame(disk, folder)
      if (drawing !== this.drawings) return
      const view = { frame, frameKind: outerKindOf(this.state, kindsOf(frame.rings)) }
      this.shown = folder
      drawView(this.contentEl, view, [...notes, ...warnings, ...ringNotes(view)])
    } catch (error) {
      if (drawing !== this.drawings) return
      this.shown = folder
      this.contentEl.empty()
      const reason = error instanceof Error ? error.message : String(error)
      drawNotes(this.contentEl, [...notes, `Can't read ${folder || 'the vault root'}: ${reason}`])
    }
  }
}
