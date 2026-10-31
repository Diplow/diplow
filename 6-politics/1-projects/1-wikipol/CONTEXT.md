---
title: Glossary
parent: 6-politics/1-projects/1-wikipol
owner: diplo
preview: >-
  wikipol's words, one tight definition each: a Source is a media outlet, a
  Publication one thing it publishes, a Digest the Tile that summarizes it, citing
  Extracts of its Raw, filed by date in the Source's Chronicle of Periods. A
  glossary only: no spec, no implementation.
---
# Glossary

wikipol turns what political media publish into Tiles of my System, so my own hexframes can cite them. These are its words.

## Language

### What comes in

**Source**:
A media outlet whose content I find worth following: a YouTube channel today, a newspaper or a website tomorrow. Its Tile, under Sources, bears its name; the legacy vaults under `wikipol/Legacy/` are not Sources.
_Avoid_: channel, vault, media

**Publication**:
One piece of content a Source publishes: a video, an article, an episode.
_Avoid_: content, video, item

**Raw**:
A Publication's original material as it was fetched, a transcript or a PDF, kept outside the System and the repo.
_Avoid_: transcript (for the stored file), source file

**Extract**:
A passage of a Raw quoted by a Digest, with where it sits in the Raw: a timestamp, a page, a paragraph.
_Avoid_: quote, citation, clip

### What the System holds

**Digest**:
The one Tile that summarizes one Publication: its claims, each backed by Extracts.
_Avoid_: summary, résumé, fiche, video note

**Chronicle**:
The child of a Source that files its Digests by date, as a tree of Periods.
_Avoid_: Chronological, timeline, inventory

**Period**:
A Tile of a Chronicle covering a date range, holding the shorter Periods or the Digests of that range, and summarizing it.
_Avoid_: month, bucket, batch
