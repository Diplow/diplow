// The hexframe settings: a panel over what a folder leaves out, every candidate of each kind with a
// checkbox that leaves it out and a live count against six, saved to the folder's
// `.hexframe/exclusions.yaml`; "Exclude from the six", which writes the same file at once; and the
// button that opens the panel from the view. Obsidian sends no event for a dot folder, so whoever
// asks is told after a save, to draw again.
import { Modal, Notice, setIcon, type App } from 'obsidian'

import {
  exclusionsFile,
  parseExclusions,
  patternOf,
} from '../../2-claude-mod/hooks/shape/exclusions.ts'
import type { MemberKind, Slot } from '../../2-claude-mod/hooks/shape/node.ts'
import {
  candidatesOf,
  changeOf,
  countLine,
  countsOf,
  handWritten,
  isNameable,
  leavingOf,
  toggled,
  togetherLine,
  type Change,
} from './exclusions.ts'
import type { Excluded } from './menu.ts'
import { diskOf, writerOf } from './vault/disk.ts'
import {
  inFolder,
  messageOf,
  readSettings,
  saveSettings,
  type Disk,
  type Settings,
} from './vault/frame.ts'

/** The panel's name, on its button, its title and its command. */
const title = 'Hexframe settings'

/**
 * The saves still running, one after the other: each reads the file just before writing it, so a
 * second `E` pressed while the first writes waits for it rather than writing over its line.
 */
let saving: Promise<unknown> = Promise.resolve()

/** `change` saved in `folder`'s `exclusions.yaml` once every earlier save has ended. */
function queuedSave(app: App, disk: Disk, folder: string, change: Change) {
  const saved = saving.then(() => saveSettings(disk, writerOf(app), folder, change))
  saving = saved.catch(() => undefined)
  return saved
}

/**
 * Opens the settings of `folder`, once the vault lets the panel write there, and runs `saved` once
 * a change is written; a notice says why when it can't.
 */
export async function openSettings(app: App, folder: string, saved: () => void) {
  const disk = diskOf(app)
  if (disk === undefined) return
  const settings = await readSettings(disk, folder)
  if ('refused' in settings) {
    new Notice(`Hexframe can't change what ${nameOf(folder)} leaves out, as ${settings.refused}.`)
    return
  }
  const save = async (change: Change) => {
    const result = await queuedSave(app, disk, folder, change)
    if ('refused' in result) {
      new Notice(`Hexframe can't save ${inFolder(folder, exclusionsFile)}, as ${result.refused}.`)
      return false
    }
    saved()
    return true
  }
  new SettingsModal(app, { folder, settings, save }).open()
}

/**
 * Leaves `excluded`'s candidate out of its folder's rings, written to that folder's
 * `exclusions.yaml` at once, and runs `saved`; a notice says what was written, or why nothing was.
 */
export async function excludeFrom(app: App, { folder, slot }: Excluded, saved: () => void) {
  const disk = diskOf(app)
  if (disk === undefined) return
  const pattern = patternOf(slot)
  const result = await queuedSave(app, disk, folder, { add: [pattern], remove: [] })
  if ('refused' in result) {
    new Notice(`Hexframe can't leave ${pattern} out, as ${result.refused}.`)
    return
  }
  new Notice(`${nameOf(folder)} leaves ${pattern} out, in ${result.saved}.`)
  saved()
}

/** Adds the button that opens the settings, floating in the top right of `container`. */
export function addSettingsButton(container: HTMLElement, open: () => void) {
  const button = container.createEl('button', {
    cls: ['clickable-icon', 'hexframe-settings-button'],
    attr: { 'aria-label': title },
  })
  setIcon(button, 'settings')
  button.addEventListener('click', open)
}

/** How the panel names each kind of candidate, in the order it lists them. */
const kinds: readonly [MemberKind, string][] = [
  ['branch', 'Branches'],
  ['leaf', 'Leaves'],
  ['context', 'Context folders'],
]

/** What the panel edits, and how it saves: whether the change was written. */
interface Panel {
  folder: string
  settings: Settings
  save: (change: Change) => Promise<boolean>
}

/**
 * The panel over a folder's exclusions. Every candidate of each kind has a checkbox, ticked when
 * the folder leaves it out; one a glob leaves out stays ticked, and names the glob. Each kind's
 * count against six follows the ticks, and Save writes what changed, the rest of the file kept.
 */
class SettingsModal extends Modal {
  private readonly panel: Panel
  /** The exclusions as the ticks make them, written on Save. */
  private items: string[] = []
  /** Redraws the counts once the ticks change. */
  private recount: () => void = () => undefined

  constructor(app: App, panel: Panel) {
    super(app)
    this.panel = panel
  }

  override onOpen() {
    const { folder, settings } = this.panel
    const path = inFolder(folder, exclusionsFile)
    this.setTitle(`${title}: ${nameOf(folder)}`)
    this.contentEl.addClass('hexframe-settings')
    this.contentEl.createEl('p', {
      text: `Tick what ${nameOf(folder)} leaves out of its rings: six of each kind draw as hexes, more show as a list. Saved to ${path}.`,
    })
    let before: string[]
    try {
      before = parseExclusions(settings.text ?? '')
    } catch (error) {
      this.contentEl.createEl('p', {
        cls: 'hexframe-settings-warning',
        text: `${path} can't be read, so it leaves nothing out, and the panel won't write over it: ${messageOf(error)}. Mend it in a text editor first.`,
      })
      this.buttons(undefined)
      return
    }
    this.items = [...before]
    this.drawKinds()
    this.buttons(before)
  }

  override onClose() {
    this.contentEl.empty()
  }

  /** Each kind's candidates with their checkboxes and count, and what the file lists by hand. */
  private drawKinds() {
    const { entries } = this.panel.settings
    const candidates = candidatesOf(entries)
    const counts: [MemberKind, HTMLElement][] = []
    for (const [kind, name] of kinds) {
      const section = this.contentEl.createDiv({ cls: 'hexframe-settings-kind' })
      const head = section.createDiv({ cls: 'hexframe-settings-head' })
      head.createSpan({ cls: 'hexframe-settings-name', text: name })
      counts.push([kind, head.createSpan({ cls: 'hexframe-settings-count' })])
      if (candidates[kind].length === 0)
        section.createDiv({ cls: 'hexframe-settings-none', text: 'None' })
      for (const slot of candidates[kind]) this.drawRow(section, slot)
    }
    const together = this.contentEl.createEl('p', { cls: 'hexframe-settings-together' })
    const written = handWritten(this.items, candidates)
    if (written.length > 0) {
      this.contentEl.createEl('p', {
        cls: 'hexframe-settings-hand',
        text: `Also listed, and kept as written: ${written.join(', ')}.`,
      })
    }
    this.recount = () => {
      const now = countsOf(entries, this.items)
      for (const [kind, element] of counts) {
        element.setText(countLine(now[kind]))
        element.toggleClass('is-over', now[kind].overflowing)
      }
      together.setText(togetherLine(now.children))
    }
    this.recount()
  }

  /** One candidate: its checkbox, its name as an exclusion writes it, and the glob leaving it out. */
  private drawRow(section: HTMLElement, slot: Slot) {
    const row = section.createEl('label', { cls: ['hexframe-settings-row', `is-${slot.kind}`] })
    const box = row.createEl('input', { type: 'checkbox' })
    row.createSpan({ text: patternOf(slot) })
    const leaving = leavingOf(slot, this.items)
    box.checked = leaving.by !== 'none'
    if (leaving.by === 'glob') {
      box.disabled = true
      row.createSpan({ cls: 'hexframe-settings-glob', text: `left out by ${leaving.glob}` })
    } else if (leaving.by === 'none' && !isNameable(slot)) {
      box.disabled = true
      row.createSpan({ cls: 'hexframe-settings-glob', text: 'its * or ? would leave out more' })
    }
    box.addEventListener('change', () => {
      this.items = toggled(this.items, slot)
      this.recount()
    })
  }

  /** Save and Cancel, or Close alone when there is nothing to save (`before` undefined). */
  private buttons(before: readonly string[] | undefined) {
    const bar = this.contentEl.createDiv({ cls: 'modal-button-container' })
    if (before !== undefined) {
      const save = bar.createEl('button', { cls: 'mod-cta', text: 'Save' })
      save.addEventListener('click', () => {
        save.disabled = true
        void this.panel.save(changeOf(before, this.items)).then((saved) => {
          if (saved) this.close()
          else save.disabled = false
        })
      })
    }
    const cancel = bar.createEl('button', { text: before === undefined ? 'Close' : 'Cancel' })
    cancel.addEventListener('click', () => {
      this.close()
    })
  }
}

/** How the panel names a folder: its path in the vault, or "the vault root". */
function nameOf(folder: string): string {
  return folder === '' ? 'the vault root' : folder
}
