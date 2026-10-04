// The view a hexframe file opens in: its view state read from the file, the folder it centers on
// drawn at depth 1, and drawn again when the vault changes under it. A click on a hex moves it and
// shows the hex's note in a paired pane beside it.
import {
  debounce,
  Notice,
  TextFileView,
  type App,
  type TAbstractFile,
  type TFile,
  type WorkspaceLeaf,
} from 'obsidian'

import type { Placement } from '../../2-claude-mod/hooks/shape/layout.ts'
import { kindsOf } from '../../2-claude-mod/hooks/shape/node.ts'
import { actionOf, type Asked } from './click.ts'
import { drawNotes, drawView, ringNotes } from './draw.ts'
import { diskOf } from './vault/disk.ts'
import {
  centerToShow,
  messageOf,
  readFrame,
  refusal,
  unopenable,
  vaultPath,
  type Disk,
} from './vault/frame.ts'
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
  /** The pane beside the view that shows the clicked hex's note, once a click opened it. */
  private paired: WorkspaceLeaf | undefined
  /** Counts the clicks, so one that a later click overtook during a check is dropped. */
  private clicks = 0

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
    if (followed) this.commit(next)
    if (followed || file === this.file) this.redraw()
    else {
      this.onChange(from)
      this.onChange(file.path)
    }
  }

  /**
   * Takes `next`'s center as the view's, written to the hexframe file with the rest of it kept, and
   * the state read back from what is written, so what the view holds and says matches the file.
   */
  private commit(next: ViewState) {
    this.text = withCenter(this.text, next)
    ;({ state: this.state, problems: this.problems } = decodeViewState(this.text))
    this.requestSave()
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
      drawView(this.contentEl, view, [...notes, ...warnings, ...ringNotes(view)], (hex, event) => {
        void this.onHex(hex, event)
      })
    } catch (error) {
      if (drawing !== this.drawings) return
      this.shown = folder
      this.contentEl.empty()
      drawNotes(this.contentEl, [
        ...notes,
        `Can't read ${folder || 'the vault root'}: ${messageOf(error)}`,
      ])
    }
  }

  /**
   * A click on a hex: the view centers where the click asks, then opens what it asks. A click is
   * dropped once a later one, or another file in the view, has overtaken it during a check.
   */
  private async onHex(placement: Placement, event: MouseEvent) {
    const action = actionOf(placement, event.shiftKey)
    const disk = diskOf(this.app)
    if (action === undefined || disk === undefined) return
    const click = ++this.clicks
    const file = this.file
    const isOvertaken = () => click !== this.clicks || this.file !== file
    try {
      if (action.center !== undefined) {
        const refused = await refusal(disk, action.center)
        if (isOvertaken()) return
        if (refused !== undefined) {
          new Notice(
            `Hexframe can't center on ${action.center || 'the vault root'}, as ${refused}.`,
          )
          return
        }
        this.commit({ ...this.state, center: action.center })
        void this.draw()
      }
      const checked = await checkedOf(this.app, disk, action.open)
      if (checked === undefined || isOvertaken()) return
      if ('refused' in checked) new Notice(checked.refused)
      else if ('note' in checked) {
        await this.pairedLeaf().openFile(checked.note, {
          state: { mode: 'preview' },
          active: false,
        })
      } else await openInDefaultApp(this.app, checked.system)
    } catch (error) {
      new Notice(`Hexframe can't carry out that click: ${messageOf(error)}`)
    }
  }

  /** The paired pane, split off to the right of the view the first time, and again once closed. */
  private pairedLeaf(): WorkspaceLeaf {
    const kept = this.paired
    if (kept !== undefined && isOpen(this.app, kept)) return kept
    const leaf = this.app.workspace.createLeafBySplit(this.leaf, 'vertical')
    this.paired = leaf
    return leaf
  }
}

/**
 * What a click asked to open, once checked: a note for the paired pane, a file for the system, or
 * why it opens neither.
 */
type Checked = { note: TFile } | { system: string } | { refused: string }

/**
 * What `open` comes to once checked: the first of its notes that Obsidian indexes, or its file,
 * either one held to the vault; nothing when no note exists.
 */
async function checkedOf(app: App, disk: Disk, open: Asked): Promise<Checked | undefined> {
  if ('file' in open) {
    const refused = await unopenable(disk, open.file, 'system')
    if (refused === undefined) return { system: open.file }
    return { refused: `Hexframe can't open ${open.file}, as ${refused}.` }
  }
  const { vault } = app
  const note = open.notes.map((path) => vault.getFileByPath(path)).find((found) => found !== null)
  if (note === undefined) return undefined
  const refused = await unopenable(disk, note.path)
  return refused === undefined
    ? { note }
    : { refused: `Hexframe can't open ${note.path}, as ${refused}.` }
}

/** Hands `path`, checked, to the system's default app through Obsidian's own call. */
async function openInDefaultApp(app: App, path: string) {
  if (hasDefaultApp(app)) await app.openWithDefaultApp(path)
  else new Notice(`Hexframe can't open ${path}: this Obsidian opens no file in its default app.`)
}

/**
 * Obsidian's own "Open in default app", which its API doesn't type: it takes a path relative to the
 * vault and hands the file to the system.
 */
interface DefaultApp {
  openWithDefaultApp(path: string): Promise<void>
}

function hasDefaultApp(app: App): app is App & DefaultApp {
  return 'openWithDefaultApp' in app && typeof app.openWithDefaultApp === 'function'
}

/** Whether `wanted` is still a pane of the workspace, not one the user closed. */
function isOpen(app: App, wanted: WorkspaceLeaf): boolean {
  const leaves: WorkspaceLeaf[] = []
  app.workspace.iterateAllLeaves((leaf) => {
    leaves.push(leaf)
  })
  return leaves.includes(wanted)
}
