// The view a hexframe file opens in: its view state read from the file, the folder it centers on
// drawn at depth 2, as the expansions open it, and drawn again when the vault changes under it. A
// click on a hex moves it and shows the hex's note in a paired pane beside it; an alt-click on a
// Branch around the center opens it, and the view's header buttons open and peel the center.
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
import {
  kindsOf,
  type Direction,
  type Frame,
  type FrameKind,
} from '../../2-claude-mod/hooks/shape/node.ts'
import { actionOf, outerBranchOf, type Asked } from './click.ts'
import { drawNotes, drawView, ringNotes } from './draw.ts'
import {
  branchesToOpen,
  collapse,
  expand,
  recenter,
  sameExpansions,
  shownExpansions,
  switchBranch,
  switchInner,
  switchOuter,
  viewOf,
  type Expansions,
} from './expansions.ts'
import { diskOf } from './vault/disk.ts'
import {
  centerToShow,
  messageOf,
  readFrame,
  readOpened,
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
  touches,
  withChanges,
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
  /**
   * The last drawing of the current center: the folders it read, the center's first, and the
   * Frame kinds the center offers, which the expansions switch among, absent when it couldn't be
   * read. Undefined until that drawing is done, so a switch never resolves against another
   * folder's kinds.
   */
  private drawn: { folders: string[]; offered?: readonly FrameKind[] } | undefined
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
    this.drawn = undefined
    this.contentEl.empty()
  }

  override async onOpen(): Promise<void> {
    await super.onOpen()
    this.contentEl.addClass('hexframe-view')
    // A temporary way to switch the center's expansions, until the hex view's menu replaces it.
    this.addAction('chevrons-down-up', 'Collapse the center', () => {
      this.expandWith(collapse)
    })
    this.addAction('chevrons-up-down', 'Expand the center', () => {
      this.expandWith(expand)
    })
    this.addAction('hexagon', 'Switch the ring around the center', () => {
      this.expandWith(switchOuter)
    })
    this.addAction('circle-dot', 'Switch the ring inside the center', () => {
      this.expandWith(switchInner)
    })
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
    if (this.drawn !== undefined && touches(path, this.drawn.folders)) this.redraw()
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
   * The expansions the view shows, moved by `move` among the kinds the center offers, written to
   * the file and drawn. Nothing moves until the current center is drawn.
   */
  private expandWith(move: (shown: Expansions, offered: readonly FrameKind[]) => Expansions) {
    const offered = this.drawn?.offered
    if (offered === undefined) {
      const why = this.drawn === undefined ? 'is still reading' : "couldn't read"
      new Notice(`Hexframe ${why} this folder, so it has nothing to switch.`)
      return
    }
    const shown = shownExpansions(this.state.expansions, offered)
    const next = move(shown, offered)
    // A move that changes nothing writes nothing: the file keeps asking for what it asked for.
    if (sameExpansions(next, shown)) return
    this.commit({ ...this.state, expansions: next })
    void this.draw()
  }

  /**
   * Takes `next` as the view's state, what changed written to the hexframe file with the rest of
   * it kept, and the state read back from what is written, so what the view holds and says matches
   * the file.
   */
  private commit(next: ViewState) {
    if (next.center !== this.state.center) this.drawn = undefined
    this.text = withChanges(this.text, this.state, next)
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
      const shown = shownExpansions(this.state.expansions, kindsOf(frame.rings))
      const opened: Partial<Record<Direction, Frame>> = {}
      for (const { direction, path } of branchesToOpen(frame, shown)) {
        const branch = await readOpened(disk, vaultPath(path))
        if ('refused' in branch) warnings.push(`${path} stays closed, as ${branch.refused}.`)
        else {
          opened[direction] = branch.frame
          warnings.push(...branch.warnings)
        }
      }
      if (drawing !== this.drawings) return
      const view = viewOf(frame, shown, opened)
      const folders = [folder, ...Object.values(opened).map(({ tile }) => vaultPath(tile.path))]
      this.drawn = { folders, offered: kindsOf(frame.rings) }
      drawView(this.contentEl, view, [...notes, ...warnings, ...ringNotes(view)], (hex, event) => {
        void this.onHex(hex, event)
      })
    } catch (error) {
      if (drawing !== this.drawings) return
      this.drawn = { folders: [folder] }
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
    if (event.altKey) {
      await this.switchBranch(placement)
      return
    }
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
        this.commit({ center: action.center, expansions: recenter(this.state.expansions) })
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

  /**
   * An alt-click on `placement`: when it is a Branch of the ring around the center, the Branch
   * opens into the next kind its folder offers, or closes after the last one.
   */
  private async switchBranch(placement: Placement) {
    const direction = outerBranchOf(placement)
    const disk = diskOf(this.app)
    if (direction === undefined || placement.kind === 'empty' || disk === undefined) return
    // Dropped when a later click, another file or another center overtakes it during the read.
    const click = ++this.clicks
    const { file } = this
    const center = this.drawn?.folders[0]
    const branch = await readOpened(disk, vaultPath(placement.tile.path))
    if (click !== this.clicks || file !== this.file || center !== this.drawn?.folders[0]) return
    if ('refused' in branch) {
      new Notice(`Hexframe can't open ${placement.tile.path}, as ${branch.refused}.`)
      return
    }
    const offered = kindsOf(branch.frame.rings)
    this.expandWith((expansions) => switchBranch(expansions, direction, offered))
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
