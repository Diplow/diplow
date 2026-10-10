---
title: Tokens
parent: 4-software-engineering/1-projects/3-design-system
owner: diplo
preview: >-
  What each token of the design system is for: shadcn's colours where they mean
  the same thing, new ones for the human, the agent, the light and the tiles;
  the three type families and their sizes; no radius; the light recipes of the
  canvas; the motion's easings and durations. The values live in the registry.
---
# Tokens

What each token is for. The values, in both themes, live in [[4-software-engineering/1-projects/3-design-system/1-registry/CLAUDE|the registry]]'s `design-system.json` and nowhere else; this page says what they mean.

A token keeps shadcn's name when it means what shadcn means, so every shadcn component takes the look without a change. The ones shadcn doesn't have are named for what they are in hexframe: the human, the agent, the light, the tiles.

## Colour

| Token | What it is for |
|---|---|
| `background`, `foreground` | The ground and the ink: a violet-black and a near-white at night, a cool paper and a violet-black by day |
| `card`, `popover` | A surface risen a little toward light: a zone of the conversation, a card, a menu |
| `primary`, `primary-foreground` | The ink itself. A primary button is quiet; colour is kept for the human and the agent |
| `secondary`, `muted`, `accent` | One step off the ground, for a hovered row, a pressed tab, a field's well |
| `muted-foreground` | Second-level text: a preview, the agent's words |
| `faint` | Third-level text: a placeholder, a step of the path you are not on, an empty slot's plus |
| `border`, `input` | The hairlines: `border` between things, `input` a little stronger, under a field or around the center |
| `ring` | Keyboard focus, in the human's amber |
| `human` | The human's amber, for lines and marks: the rule beside your words, the brand mark, the send button, the step of the path you are on |
| `agent` | The agent's violet: its mark, its words' accents, what it drafts. Dark enough to set text in, by day too |
| `destructive`, `success`, `warning`, `info` | The statuses, each with its `-foreground`. Warning is ember orange, away from the human's amber |
| `context` | The Context's teal on the canvas; it only strokes and tints, so it has no foreground |
| `glow`, `glow-soft` | The root's warm light, for its fill and its rim |
| `halo` | The glow behind the root, at its theme's strength: full at night, softer on paper |
| `aura` | The wide warm haze around the halo |
| `ambient` | The cool light where the canvas looks |
| `tile`, `tile-fade` | A tile's light, at its top and its foot |
| `tile-lit`, `tile-lit-fade` | The same, brighter: the center, and a tile under the pointer |
| `chart-1` to `chart-5` | The human, the agent, the Context, info, faint |
| `sidebar-*` | shadcn's sidebar, on the same surfaces |

## Type

| Family | Token | For |
|---|---|---|
| Geist | `font-sans` | The interface: labels, buttons, previews |
| Newsreader | `font-serif`, `font-heading`, `font-human` | Your words, titles and headings, at weight 300 for prose |
| Geist Mono | `font-mono`, `font-agent` | The agent's words, and code |

`text-prose` (18px, line height 1.55) is the size of your words, `text-mono` (13.5px, 1.65) the agent's. On the canvas a title is laid out at 16px and scaled with its tile, never shown above 22px nor, on a small tile, below 11px, where it shows alone on two lines at most.

## Shape

No radius: corners are square, as a hex's are. Round things are round on purpose (the dots of the path), not by a token.

## Light

How the canvas uses the light tokens, as the prototype draws them:

- **A tile** fills with `tile` fading to `tile-fade`, top to foot, with no stroke. Under the pointer it brightens to `tile-lit`.
- **The center** fills with `tile-lit` fading to `tile-lit-fade`, with an `input` line, its title in italics.
- **The root** fills with `glow` at 34% fading to `glow-soft` at 6%. Its rim, when it is the center, runs from `glow-soft` to `human`.
- **The root's glow** is a radial `halo` (50% at the heart, 30% at 42%, 8% at 70%, gone at the edge), its radius growing with the square root of the zoom so it never floods the screen, inside an `aura` two and a half times wider. Below the root it softens by a quarter, and waits at the screen's edge, toward the root, once the root is off screen.
- **The ambient** is a wide ellipse of `ambient` where the canvas looks.
- **A zone** of the conversation is `card`, tinted toward its right edge by 9% of the voice it belongs to (`human` for the composer, `agent` for a widget), with an `input` hairline on top.
- **A draft by the agent** fills with `agent` at 14% fading to nothing, behind a blurred `agent` glow that breathes (`animate-breathe`).

## Motion

| Token | Value | For |
|---|---|---|
| `ease-glide` | `cubic-bezier(0.2, 0.8, 0.2, 1)` | Things that settle: a bloom, the theme's disc, the star's glow |
| `ease-camera` | `cubic-bezier(0.65, 0, 0.35, 1)` | The camera, easing in and out |
| `--duration-bloom` | 800ms | Children blooming out of their parent's heart |
| `--duration-fold` | 500ms | Children folding back |
| `--stagger-bloom` | 40ms | Between one child and the next |
| `--duration-camera` | 800ms | A move on the same level, a pan |
| `--duration-camera-level` | 300ms | Added per level crossed, up to two |
| `--duration-turn` | 600ms | A change of theme |
| `animate-breathe` | 3.2s | A light that waits: the agent working, a draft |

Zooming, the scale changes evenly (logarithmically) and the point you travel to keeps its place on the way. With reduced motion, everything lands at once.
