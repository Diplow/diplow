import { Plugin } from 'obsidian'

import { HexframeView, viewType } from './view.ts'

// The plugin Obsidian loads: a `*.hexframe` file opens in the hexframe view.
export default class HexframePlugin extends Plugin {
  override onload() {
    this.registerView(viewType, (leaf) => new HexframeView(leaf))
    this.registerExtensions(['hexframe'], viewType)
  }
}
