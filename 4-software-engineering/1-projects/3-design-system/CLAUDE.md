---
title: design system
parent: 4-software-engineering/1-projects/3-design-system
owner: diplo
preview: >-
  The look hexframe and my site share: surfaces drawn by their light rather than
  by lines, a warm human and a cool agent, square corners, dark by default and
  light as its equal. A shadcn registry on the Sera style that a project
  installs by path, and the prototype it came from.
---
# design system

The look hexframe and my site share. It came out of a prototype, kept here: hexframe's main screen, a canvas of tiles beside a conversation with an agent. Futuristic, as hexframe is a bet on a future where agents help people explore where they want to go: large empty space and imbalance, light instead of boxes, a warm human and a cool agent. [[4-software-engineering/1-projects/3-design-system/DIRECTION|DIRECTION]] says why it looks this way, [[4-software-engineering/1-projects/3-design-system/TOKENS|TOKENS]] what each token is for.

It is a shadcn registry: a project on shadcn starts from one of shadcn's styles, Sera, then installs the tokens and fonts from here. shadcn copies them into the project, which owns them from then on.

| # | Child | What it holds |
|---|---|---|
| 1 | [[4-software-engineering/1-projects/3-design-system/1-registry/CLAUDE\|registry]] | The items a project installs: the tokens in both themes, and the two fonts Sera doesn't bring |

| File | What it holds |
|---|---|
| [[4-software-engineering/1-projects/3-design-system/DIRECTION\|DIRECTION]] | The six principles, and why |
| [[4-software-engineering/1-projects/3-design-system/TOKENS\|TOKENS]] | Every token and what it is for, the type, the light and the motion |
| `prototype.html` | The mood prototype, hexframe's main screen in both themes. It reads its colours from the registry, so it shows what a project installs. It needs a server: `python3 -m http.server` in this folder, then `localhost:8000/prototype.html` (`#light` opens in the light) |

## Installing it

In a project on shadcn with Tailwind v4 and Radix, `$DS` being the relative path to `1-registry/`:

1. **The style.** `pnpm dlx shadcn@latest apply --preset b6aLGwKTQ` in a project that has shadcn already; it rewrites the shadcn components the project holds. A new project starts with `pnpm dlx shadcn@latest init --template start --base radix --preset b6aLGwKTQ`. The preset is [shadcn/create](https://ui.shadcn.com/create?preset=b6aLGwKTQ&base=radix)'s Sera, mauve, Geist for headings and text, Lucide, no radius.
2. **The tokens and fonts.** `pnpm dlx shadcn@latest add $DS/font-newsreader.json $DS/font-geist-mono.json $DS/design-system.json`. After the preset, never in the same `init`: the preset would set the heading font and the radius back.
3. **Dark by default.** The project puts `dark` on `<html>` unless the user chose light.

## Rules

- **A token changes here first.** The registry, then each project adds the items again, with `--diff` to see what moves. The prototype reads the registry, so it shows the change at once.
- **A project adds no colour of its own.** A colour the design system lacks gets both themes here, then the project adds the items again.
- **Components stay in their project** until a second project needs the same one; then it moves here as an item of the registry.
