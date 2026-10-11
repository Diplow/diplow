---
title: Direction
parent: 4-software-engineering/1-projects/3-design-system
owner: diplo
preview: >-
  Why the design system looks the way it does, as six principles: empty space
  and imbalance, light before lines, one warm light at the root, a warm human
  and a cool agent, curves as separators, and motion that tells the hierarchy.
  Dark by default, light as its equal. One screen, two sides that answer each
  other.
---
# Direction

What hexframe holds is a perspective, one a person crafts over a lifetime and that agents keep working with. The look is futuristic because hexframe is a bet on a future worth wanting: human experience at the center, people directing agents that help them find where they want to explore. Futuristic here means space, imbalance, fine lines and light, not chrome. Obsidian is the closest relative.

## Six principles

1. **Empty space and imbalance.** Nothing is centered for its own sake. On hexframe's main screen the canvas takes about 60% of the width, off to the right, and the tiles around the center run on behind the conversation instead of stopping at a frame. Space is the luxury: a screen is never filled to show it is busy.
2. **Light before lines.** A surface is drawn by its light, not by an outline: a tile is a fill, lighter than the ground, with the gap between tiles showing the ground. An opened tile loses its outline and leaves its own tile and its six around it. Only the center keeps a line. Where a separator is needed it is a hairline or a curve, never a box: a zone of the conversation is a solid fill with one fine line on top, a field is one underline.
3. **One warm light, at the root.** Amber belongs to the human. The root of a system, your own tile, holds its one warm light: lit amber, with a glow behind it that stays there as you move. Below the root the glow only hints where the root is, waiting at the edge of the screen when the root is off it. The center you look at gets a neutral line, never the warm light: amber says "you", not "here". The brand mark, the rule beside your words and the send button are amber for the same reason.
4. **A warm human, a cool agent.** Your words are set in Newsreader, a light serif; the agent's in Geist Mono, violet-marked. What the agent drafts glows violet until you take it. The interface itself speaks in Geist, quietly, so the two voices carry the page. Warning, the colour shadcn would make amber, is an ember orange, so amber keeps one meaning.
5. **Curves as separators.** The conversation is cut along one curve, which also serves as its scrollbar: a star rides it, lighting the stretch you see. The layout meets the geometry: the composer's corner sits on the edge of the tile south-west of the center.
6. **Motion tells the hierarchy.** Moving to a neighbour pans; to a child or a parent zooms, the scale changing evenly; an opened tile's children bloom out of its heart, one after another, and fold back into it. A change of theme is a change of light, not a flip. With reduced motion, everything lands at once.

## Dark by default, light as its equal

Dark is the default and light is not an afterthought: the same rule holds in both. A surface rises toward light, white on paper by day, ink at night, so a tile is always lighter than the ground. The warm light behind the root is softer on paper, where a glow shows as a tint.

## One screen, two sides

hexframe is one screen, with no menu and no page to go to. Everything happens in the chat, where you and the agent act; the canvas carries what you act on, and the way through it. Each side answers the other, and that is most of the art: a tile named in the chat lights up on the canvas, the agent at work marks the tile it is in, and the tile you center on the canvas is where the agent works next. Signed out, it is the same screen: the canvas shows hexframe's help, and the chat asks who you are. On a phone the chat stays in front and the canvas behind it, as the tiles run on behind the conversation on a wide screen; the canvas comes forward when the chat points at it, then gives it back.

## On shadcn

shadcn gives the tokens their names and, through Radix, the components their behaviour: focus, the keyboard, where a menu opens. It doesn't give the look. hexframe's components are specific to it, a tile in its states, a widget in the conversation, the menu of a tile, so each is drawn from these principles where it is used, rather than adjusted from one of shadcn's styles.
