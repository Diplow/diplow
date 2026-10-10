---
title: design system
parent: 4-software-engineering/1-projects/3-design-system
owner: diplo
preview: >-
  The look hexframe and my site share: surfaces drawn by their light rather than
  by lines, a warm human and a cool agent, square corners, dark by default and
  light as its equal. The tokens and fonts as a shadcn registry a project
  installs by path, the prototype it came from, and the components it proposes
  for hexframe's conversation and canvas.
---
# design system

The look hexframe and my site share. It came out of a prototype, kept here: hexframe's main screen, a canvas of tiles beside a conversation with an agent. Futuristic, as hexframe is a bet on a future where agents help people explore where they want to go: large empty space and imbalance, light instead of boxes, a warm human and a cool agent. [[4-software-engineering/1-projects/3-design-system/DIRECTION|DIRECTION]] says why it looks this way, [[4-software-engineering/1-projects/3-design-system/TOKENS|TOKENS]] what each token is for.

The tokens and fonts are a shadcn registry: a project on shadcn installs them from here, and shadcn copies them into the project, which owns them from then on. The registry brings no components and no shadcn style. A project's components are drawn from the principles where they are used, on the canvas and in the conversation, and keep shadcn's token names, so a component copied from shadcn takes the look without a change. `components.html` proposes hexframe's, before any is built.

| # | Child | What it holds |
|---|---|---|
| 1 | [[4-software-engineering/1-projects/3-design-system/1-registry/CLAUDE\|registry]] | The items a project installs: the tokens in both themes, and the three fonts |

| File | What it holds |
|---|---|
| [[4-software-engineering/1-projects/3-design-system/DIRECTION\|DIRECTION]] | The six principles, and why |
| [[4-software-engineering/1-projects/3-design-system/TOKENS\|TOKENS]] | Every token and what it is for, the type, the light and the motion |
| `prototype.html` | The mood prototype, hexframe's main screen in both themes. It reads its colours from the registry, so it shows what a project installs. It needs a server: `python3 -m http.server` in this folder, then `localhost:8000/prototype.html` (`#light` opens in the light) |
| `components.html` | The components it proposes for hexframe, each in its states beside its notes and open questions: the conversation's (the widgets, the composer, its text, the dialog), then the canvas's (a tile in its kinds and states, the text inside it, who acts on it, its menu, moving it). It reads the registry as the prototype does: `localhost:8000/components.html` |

## Installing it

In a project on shadcn with Tailwind v4, `$DS` being the relative path to `1-registry/`:

1. **The tokens and fonts.** `pnpm dlx shadcn@latest add $DS/font-geist.json $DS/font-newsreader.json $DS/font-geist-mono.json $DS/design-system.json`. It touches the project's CSS and its font dependencies, never its components. A new project runs `pnpm dlx shadcn@latest init` first, with any style: its components are the project's to draw.
2. **Dark by default.** The project puts `dark` on `<html>` unless the user chose light.

## Rules

- **A token changes here first.** The registry, then each project adds the items again, with `--diff` to see what moves. The prototype reads the registry, so it shows the change at once.
- **A project adds no colour of its own.** A colour the design system lacks gets both themes here, then the project adds the items again.
- **Components stay in their project** until a second project needs the same one; then it moves here as an item of the registry.
