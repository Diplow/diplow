---
title: registry
parent: 4-software-engineering/1-projects/3-design-system/1-registry
owner: diplo
preview: >-
  The shadcn items a project installs: design-system, the tokens in both
  themes, the type and motion variables; and the three fonts, Geist for the
  interface, Newsreader for headings and Geist Mono for code. Installed by
  path, all four in one command.
---
# registry

The items a project installs with `shadcn add`, by path: [[4-software-engineering/1-projects/3-design-system/CLAUDE#Installing it|the design system]] gives the commands. Each file is a shadcn registry item ([schema](https://ui.shadcn.com/schema/registry-item.json)); there is no build.

| File | Item |
|---|---|
| `design-system.json` | The tokens: the colours in both themes, the type (`font-heading`, `font-human`, `font-agent`, `text-prose`, `text-mono`), the easings and the breath in the theme, no radius, the durations of the motion, and `color-scheme` by theme. What each is for: [[4-software-engineering/1-projects/3-design-system/TOKENS\|TOKENS]] |
| `font-geist.json` | Geist from fontsource as `font-sans`, the page's font |
| `font-newsreader.json` | Newsreader from fontsource as `font-serif`, set on `h1` to `h6` |
| `font-geist-mono.json` | Geist Mono from fontsource as `font-mono`, set on `code`, `kbd`, `pre` and `samp` |

## Rules

- **Four paths in one command, no dependencies between items.** shadcn resolves an item's relative dependency from the project, not from the item, and a registry namespace has to be a URL (checked with shadcn 4.21.4 on 2026-10-10). Once a project outside this repo needs the items, a `registry.json` at the repo root, including this folder's, makes them `shadcn add Diplow/diplow/<item>`.
- **A font names its selector, but Geist.** Without one, shadcn sets the font on `html`: Geist alone goes there, as the page's font.
- **`design-system.json` only adds and overrides.** shadcn's `init` brings the rest, its base layer and the radius scale, whatever the style it was run with. The item names no style and brings no component (checked with shadcn 4.21.4 on 2026-10-10, on its default style).
- **The prototype reads `design-system.json`**: a value changed here shows there on reload.
