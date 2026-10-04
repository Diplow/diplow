// The view a hexframe file opens in: its view state read from the file, the folder it centers on
// drawn at depth 2, as the expansions open it, and drawn again when the vault changes under it. A
// click on a hex moves it and shows the hex's note in a paired pane beside it, and a folder's note
// opened in that pane moves it back. A right click on a hex opens its menu, and the menu's items
// are also commands, whose keys act on the hex that Tab and the digits focus. A ring that overflows
// shows as a list, whose names act as their hexes would. A button, an item and a list's "Choose
// six" open the settings of what a folder leaves out, and an item leaves a hex out at once.
import {
  debounce,
  FileView,
  Menu,
  Notice,
  Scope,
  TextFileView,
  type App,
  type TAbstractFile,
  type TFile,
  type WorkspaceLeaf,
} from 'obsidian'

import { layoutView } from '../../2-claude-mod/hooks/shape/layout.ts'
import {
  directions,
  kindsOf,
  type Direction,
  type Frame,
} from '../../2-claude-mod/hooks/shape/node.ts'
import { actionOf, type Action, type Asked } from './click.ts'
import { drawFullList, drawNotes, drawView, ringNotes, type Focus, type OnHex } from './draw.ts'
import { branchesToOpen, outerBranches, recenter, shownExpansions, viewOf } from './expansions.ts'
import { focusable, focusableInList, focusedClickable, focusToward, stepFocus } from './focus.ts'
import { followed } from './follow.ts'
import { fullListOf, type Clickable, type OpenedList } from './list.ts'
import { items, planOf, type Drawing, type ItemId, type Plan, type Target } from './menu.ts'
import { addSettingsButton, excludeFrom, openSettings } from './settings.ts'
import { diskOf } from './vault/disk.ts'
import {
  centerToShow,
  messageOf,
  readFrame,
  readBranchKinds,
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
   * The last drawing of the current center: the folders it read, the center's first, and what it
   * drew, absent when the center couldn't be read. Undefined until that drawing is done, so an item
   * never resolves against another folder's hexes or kinds.
   */
  private drawn: { folders: string[]; scene?: Scene } | undefined
  /** The path of the Tile whose hex holds the keyboard's focus; the center's when it is unset. */
  private focus: string | undefined
  /**
   * The list the user opened to fill the view, until they go back to the hexes, center elsewhere,
   * or its hex holds no list any more, as `fullListOf` says.
   */
  private listing: OpenedList | undefined
  /** Outlines the focused hex of the last drawing. */
  private outline: Focus | undefined
  /** Counts the drawings started, so one that ends after a later one is dropped. */
  private drawings = 0
  private readonly redraw = debounce(() => void this.draw(), settle, true)
  /** The pane beside the view that shows the clicked hex's note, once a click opened it. */
  private paired: WorkspaceLeaf | undefined
  /** The note of the paired pane the view dealt with last, kept as `followed` says. */
  private lastPairedNote: string | undefined
  /**
   * Counts the moves, the clicks and the opens the view follows, so one that a later move overtook
   * during a check is dropped.
   */
  private moves = 0

  /** The id of the command an item is, as the hotkey manager knows it. */
  private readonly commandOf: (item: ItemId) => string

  constructor(leaf: WorkspaceLeaf, commandOf: (item: ItemId) => string) {
    super(leaf)
    this.commandOf = commandOf
  }

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
    this.focus = undefined
    this.listing = undefined
    this.outline = undefined
    this.lastPairedNote = undefined
    this.contentEl.empty()
  }

  override async onOpen(): Promise<void> {
    await super.onOpen()
    this.contentEl.addClass('hexframe-view')
    this.listenToKeys()
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
    // Obsidian sends `file-open` when the active pane's file changes: following a link in the
    // paired pane, or coming back to it.
    this.registerEvent(
      this.app.workspace.on('file-open', (file) => {
        if (file !== null) void this.onFileOpen(file)
      }),
    )
  }

  private onChange(path: string) {
    if (this.drawn !== undefined && touches(path, this.drawn.folders)) this.redraw()
  }

  /** A renamed center, or a folder holding it, takes the view state along, written to the file. */
  private onVaultRename(file: TAbstractFile, from: string) {
    const next = followRename(this.state, from, file.path)
    const renamed = next !== this.state
    if (renamed) this.commit(next)
    if (renamed || file === this.file) this.redraw()
    else {
      this.onChange(from)
      this.onChange(file.path)
    }
  }

  /**
   * Tab and shift-Tab move the focus among the hexes, and a digit to the hex in that direction,
   * while the view has the keyboard. These keys are the view's own; the items' keys are commands.
   */
  private listenToKeys() {
    const scope = new Scope(this.scope ?? this.app.scope)
    const move = (to: (scene: Scene) => string | undefined) => {
      const scene = this.drawn?.scene
      if (scene === undefined || this.isTyping()) return true
      this.focusOn(to(scene))
      return false
    }
    scope.register([], 'Tab', () => move(({ hexes }) => stepFocus(this.focus, hexes, 1)))
    scope.register(['Shift'], 'Tab', () => move(({ hexes }) => stepFocus(this.focus, hexes, -1)))
    for (const direction of directions) {
      scope.register([], String(direction), () =>
        move(({ view, hexes }) => focusToward(this.focus, view, hexes, direction)),
      )
    }
    // Escape takes a list the user opened back to the hexes.
    scope.register([], 'Escape', () => {
      if (this.listing === undefined || this.isTyping()) return true
      this.showList(undefined)
      return false
    })
    this.scope = scope
  }

  /**
   * Whether the user is typing, in the view's title or anywhere else, a popover's editor included,
   * while the view stays the active one: the keys are then text. A modal is left out: Obsidian
   * runs no hotkey in one, and the command palette, the one way to run an item from it, keeps the
   * focus while it lists them.
   */
  private isTyping(): boolean {
    const active = this.containerEl.ownerDocument.activeElement
    const editable = 'input, textarea, [contenteditable]:not([contenteditable="false"])'
    return active?.matches(editable) === true && active.closest('.modal-container') === null
  }

  /** Moves the focus onto the hex holding the Tile at `path`, outlined; nowhere when undefined. */
  private focusOn(path: string | undefined) {
    if (path === undefined) return
    this.focus = path
    this.outline?.(path)
  }

  /**
   * The command `item` on the focused hex: whether it applies there, and when not `checking`, it
   * carried out. A command that doesn't apply does nothing, and leaves its key to whatever else
   * takes it.
   */
  runItem(item: ItemId, checking: boolean): boolean {
    const scene = this.drawn?.scene
    const hex = scene && focusedClickable(this.focus, scene.hexes)
    if (scene === undefined || hex === undefined || this.isTyping()) return false
    const plan = planOf(item, targetOf(hex, scene))
    if (plan === undefined) return false
    if (!checking) this.carryOut(plan)
    return true
  }

  /**
   * A right click on `hex`: it takes the focus, and a menu lists the items that apply to it, each
   * with the key its command is bound to, right-aligned. An item chosen runs as its command does,
   * on that hex as the view is then, and on nothing once a drawing has taken the hex away.
   */
  private onMenu(hex: Clickable, event: MouseEvent) {
    const scene = this.drawn?.scene
    if (scene === undefined) return
    const { path } = hex.tile
    this.focusOn(path)
    const target = targetOf(hex, scene)
    const applying = items.filter(({ id }) => planOf(id, target) !== undefined)
    if (applying.length === 0) return
    // Obsidian's native menus show no key beside a title, so this one is drawn by Obsidian itself.
    const menu = new Menu().setUseNativeMenu(false)
    for (const { id, name } of applying) {
      menu.addItem((item) =>
        item.setTitle(titleOf(name, hotkeyOf(this.app, this.commandOf(id)))).onClick(() => {
          if (!this.drawn?.scene?.hexes.some(({ tile }) => tile.path === path)) return
          this.focusOn(path)
          this.runItem(id, false)
        }),
      )
    }
    menu.showAtMouseEvent(event)
  }

  /**
   * Carries out what an item asks: what a click would, or new expansions, written and drawn. An
   * item that would change nothing has no plan, so nothing is written for it.
   */
  private carryOut(plan: Plan) {
    if ('click' in plan) {
      void this.act(plan.click)
      return
    }
    if ('list' in plan) {
      this.showList(plan.list)
      return
    }
    if ('exclude' in plan) {
      void excludeFrom(this.app, plan.exclude, this.redrawn)
      return
    }
    if ('settings' in plan) {
      this.openSettings(plan.settings)
      return
    }
    this.commit({ ...this.state, expansions: plan.expansions })
    void this.draw()
  }

  /**
   * Takes `next` as the view's state, what changed written to the hexframe file with the rest of
   * it kept, and the state read back from what is written, so what the view holds and says matches
   * the file.
   */
  private commit(next: ViewState) {
    // What is drawn no longer matches the state: the items and the keys wait for the next drawing.
    const kept = next.center === this.state.center ? this.drawn?.folders : undefined
    this.drawn = kept && { folders: kept }
    this.text = withChanges(this.text, this.state, next)
    ;({ state: this.state, problems: this.problems } = decodeViewState(this.text))
    this.requestSave()
  }

  private async draw() {
    const file = this.file
    const disk = diskOf(this.app)
    if (file === null) return
    const drawingId = ++this.drawings
    const notes = this.problems.map(
      (problem) => `${file.name}: ${problem}, so the view keeps its defaults there.`,
    )
    if (disk === undefined) {
      this.contentEl.empty()
      drawNotes(this.contentEl, ['Hexframe reads the vault from a file system, which it has not.'])
      return
    }
    const home = homeOf(file)
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
      // What "Expand as" may open each Branch into: an opened one's kinds from its Frame.
      const branchKinds = await readBranchKinds(disk, outerBranches(frame, shown), opened)
      if (drawingId !== this.drawings) return
      const view = viewOf(frame, shown, opened)
      const folders = [folder, ...Object.values(opened).map(({ tile }) => vaultPath(tile.path))]
      const placements = layoutView(view)
      const full = fullListOf(placements, this.listing, folder)
      if (full?.source !== 'opened') this.listing = undefined
      const hexes = full ? focusableInList(full) : focusable(placements)
      const offered = kindsOf(frame.rings)
      const fillingView = full?.holder.tile.path
      this.drawn = { folders, scene: { view, hexes, shown, offered, branchKinds, fillingView } }
      const said = [...notes, ...warnings, ...ringNotes(view)]
      this.outline = full
        ? drawFullList(this.contentEl, full, said, this.onHex())
        : drawView(this.contentEl, view, said, this.onHex())
      addSettingsButton(this.contentEl, () => {
        this.openSettings(folder)
      })
      // A focus whose hex is gone goes back to the center.
      this.focus = focusedClickable(this.focus, hexes)?.tile.path
      this.outline(this.focus)
    } catch (error) {
      if (drawingId !== this.drawings) return
      this.drawn = { folders: [folder] }
      this.outline = undefined
      this.contentEl.empty()
      drawNotes(this.contentEl, [
        ...notes,
        `Can't read ${folder || 'the vault root'}: ${messageOf(error)}`,
      ])
    }
  }

  /** What a click, a right click, or a list opened or closed, does on the drawing. */
  private onHex(): OnHex {
    return {
      click: (hex, event) => {
        this.focusOn(hex.tile.path)
        void this.act(actionOf(hex, event.shiftKey))
      },
      menu: (hex, event) => {
        this.onMenu(hex, event)
      },
      list: (hex) => {
        this.showList(hex?.tile.path)
      },
      settings: (folder) => {
        this.openSettings(folder)
      },
    }
  }

  /**
   * Opens the settings of what `folder` leaves out. Obsidian sends no event for a dot folder, so
   * the view draws again once they are saved.
   */
  private openSettings(folder: string) {
    void openSettings(this.app, folder, this.redrawn)
  }

  /** Draws the view again once its settings changed what a folder leaves out. */
  private readonly redrawn = () => {
    void this.draw()
  }

  /**
   * Opens the list of the hex holding the Tile at `path` to fill the view, the focus on it, or
   * takes the view back to the hexes when `path` is undefined.
   */
  private showList(path: string | undefined) {
    const center = this.drawn?.folders[0]
    this.listing = path === undefined || center === undefined ? undefined : { center, path }
    if (path !== undefined) this.focus = path
    void this.draw()
  }

  /**
   * What a click asks, or an item that acts as one: the view centers where it asks, then opens
   * what it asks. It is dropped once a later move, or another file in the view, has overtaken it
   * during a check.
   */
  private async act(action: Action | undefined) {
    const disk = diskOf(this.app)
    if (action === undefined || disk === undefined) return
    const isOvertaken = this.overtaker()
    try {
      if (action.center !== undefined && !(await this.centerOn(disk, action.center, isOvertaken))) {
        return
      }
      const checked = await checkedOf(this.app, disk, action.open)
      if (checked === undefined || isOvertaken()) return
      if ('refused' in checked) new Notice(checked.refused)
      else if ('note' in checked) {
        this.lastPairedNote = checked.note.path
        await this.pairedLeaf().openFile(checked.note, {
          state: { mode: 'preview' },
          active: false,
        })
      } else await openInDefaultApp(this.app, checked.system)
    } catch (error) {
      new Notice(`Hexframe can't carry that out: ${messageOf(error)}`)
    }
  }

  /**
   * `file` opened in the active pane: when that is the paired pane and `file` a folder's note, the
   * view moves onto that folder as a click would, unless it is the pane's note the view dealt with
   * last.
   */
  private async onFileOpen(file: TFile) {
    const disk = diskOf(this.app)
    const paired = this.paired
    if (disk === undefined || paired === undefined || this.file === null) return
    // Obsidian also sends `file-open` for a note embedded in the active one: the open counts only
    // when the paired pane is active and shows that very file.
    const active = this.app.workspace.getActiveViewOfType(FileView)
    const inPaired = active?.leaf === paired && active.file === file
    const opened = { path: file.path, inPaired }
    // The center drawn, which the user sees, or until it is drawn the one the file asks for.
    const center = this.drawn?.folders[0] ?? centerOf(this.state, homeOf(this.file)).folder
    const { folder, lastPairedNote } = followed(opened, this.lastPairedNote, center)
    if (lastPairedNote === this.lastPairedNote) return
    this.lastPairedNote = lastPairedNote
    // A new note in the paired pane overtakes a move still running, a follow it outdates included.
    const isOvertaken = this.overtaker()
    if (folder === undefined) return
    try {
      await this.centerOn(disk, folder, isOvertaken)
    } catch (error) {
      new Notice(`Hexframe can't follow ${file.path}: ${messageOf(error)}`)
    }
  }

  /**
   * Counts a new move of the view, a click or an open it follows, and tells whether a later one, or
   * another file in the view, has overtaken it since.
   */
  private overtaker(): () => boolean {
    const move = ++this.moves
    const { file } = this
    return () => move !== this.moves || this.file !== file
  }

  /**
   * Centers the view on `folder`, written to the file and drawn, once the vault lets it; a notice
   * says why when it doesn't. Whether it centered: not when refused, nor when overtaken meanwhile.
   */
  private async centerOn(disk: Disk, folder: string, isOvertaken: () => boolean) {
    const refused = await refusal(disk, folder)
    if (isOvertaken()) return false
    if (refused !== undefined) {
      new Notice(`Hexframe can't center on ${folder || 'the vault root'}, as ${refused}.`)
      return false
    }
    this.commit({ center: folder, expansions: recenter(this.state.expansions) })
    void this.draw()
    return true
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

/** What an item acts on at `hex`, as the last drawing drew it. */
function targetOf(hex: Clickable, scene: Scene): Target {
  const { view, shown, offered, branchKinds, fillingView } = scene
  return { hex, view, shown, offered, branchKinds, fillingView }
}

/**
 * What the last drawing drew, as the items read it, and the hexes and names of lists the focus
 * moves among.
 */
interface Scene extends Drawing {
  hexes: Clickable[]
}

/** A menu item's title: its name, then the key its command is bound to, right-aligned. */
function titleOf(name: string, key: string): DocumentFragment {
  return createFragment((fragment) => {
    fragment.createSpan({ text: name })
    if (key !== '') fragment.createSpan({ cls: 'hexframe-menu-key', text: key })
  })
}

/** The key the command `id` is bound to, as Obsidian prints it, the user's own first; or none. */
function hotkeyOf(app: App, id: string): string {
  return hasHotkeys(app) ? app.hotkeyManager.printHotkeyForCommand(id) : ''
}

/**
 * Obsidian's hotkey manager, which its API doesn't type: it prints the key a command is bound to,
 * the one set in Settings → Hotkeys, or else its default, and `''` when it has none.
 */
interface Hotkeys {
  hotkeyManager: { printHotkeyForCommand(id: string): string }
}

function hasHotkeys(app: App): app is App & Hotkeys {
  if (!('hotkeyManager' in app)) return false
  const manager = app.hotkeyManager
  return (
    typeof manager === 'object' &&
    manager !== null &&
    'printHotkeyForCommand' in manager &&
    typeof manager.printHotkeyForCommand === 'function'
  )
}

/** The folder holding the hexframe file, the view's center when the file names none. */
function homeOf(file: TFile): string {
  return vaultPath(file.parent?.path ?? '')
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
