import { Plugin } from 'obsidian'

import { commandsOf } from './menu.ts'
import { HexframeView, viewType } from './view.ts'

// The plugin Obsidian loads: a `*.hexframe` file opens in the hexframe view, and each item of the
// view's menu is a command, bound to its key by default and rebindable in Settings → Hotkeys. A
// command acts on the focused hex of the hexframe view that has the focus, and only where its item
// applies.
export default class HexframePlugin extends Plugin {
  override onload() {
    const commandOf = (item: string) => `${this.manifest.id}:${item}`
    this.registerView(viewType, (leaf) => new HexframeView(leaf, commandOf))
    this.registerExtensions(['hexframe'], viewType)
    const run = (item: Parameters<HexframeView['runItem']>[0], checking: boolean) =>
      this.app.workspace.getActiveViewOfType(HexframeView)?.runItem(item, checking)
    for (const command of commandsOf(run)) this.addCommand(command)
  }
}
