---
title: Context
parent: 4-software-engineering/1-projects/1-hexframe/1-app/help/4-context
owner: diplo
preview: >-
  Context says what a Tile is, where its Children say what it does. Up to six
  Context slots, -1 to -6, in the same Directions as the Children; each holds a
  Tile of its own, or a Reference to a Tile elsewhere in the System.
---
A Tile's Children say what it **does**. Its **Context** says what it **is**: the principles it follows, the constraints it lives under, the background a reader needs before the Children make sense.

A codebase's Children might be its frontend, its backend and its CI. Its Context would be the principles it is written by.

A Tile has six Context slots, numbered -1 to -6 in the same Directions as its Children. Each slot holds either:

- a **Tile** of its own, written for this Tile alone; or
- a **Reference** to a Tile that lives elsewhere in the System, when the same context applies in several places.

This help's own Context holds one Tile, at `help/-1`: the idea behind everything here.
