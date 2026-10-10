---
title: registry
parent: 4-software-engineering/1-projects/3-design-system/1-registry
owner: diplo
preview: >-
  The shadcn items a project installs: design-system, the tokens in both
  themes, the type and motion variables, on Sera; and the two fonts Sera doesn't
  bring, Newsreader for headings and Geist Mono for code. Installed by path, all
  three in one command, after the Sera preset.
---
# registry

The items a project installs with `shadcn add`, by path: [[4-software-engineering/1-projects/3-design-system/CLAUDE#Installing it|the design system]] gives the commands. Each file is a shadcn registry item ([schema](https://ui.shadcn.com/schema/registry-item.json)); there is no build.

| File | Item |
|---|---|
| `design-system.json` | The tokens: the colours in both themes, the type (`font-heading`, `font-human`, `font-agent`, `text-prose`, `text-mono`), the easings and the breath in the theme, no radius, the durations of the motion, and `color-scheme` by theme. What each is for: [[4-software-engineering/1-projects/3-design-system/TOKENS\|TOKENS]] |
| `font-newsreader.json` | Newsreader from fontsource as `font-serif`, set on `h1` to `h6` |
| `font-geist-mono.json` | Geist Mono from fontsource as `font-mono`, set on `code`, `kbd`, `pre` and `samp` |

## Rules

- **Three paths in one command, no dependencies between items.** shadcn resolves an item's relative dependency from the project, not from the item, and a registry namespace has to be a URL (checked with shadcn 4.21.4 on 2026-10-10). Once a project outside this repo needs the items, a `registry.json` at the repo root, including this folder's, makes them `shadcn add Diplow/diplow/<item>`.
- **A font names its selector.** Without one, shadcn sets the font on `html`, and the last font installed would become the page's.
- **`design-system.json` only adds and overrides.** The preset brings the rest (shadcn's base layer, `font-sans`, the radius scale), so the item is added after it.
- **The prototype reads `design-system.json`**: a value changed here shows there on reload.
