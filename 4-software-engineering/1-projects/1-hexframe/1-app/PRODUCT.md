---
title: product
parent: 4-software-engineering/1-projects/1-hexframe/1-app
owner: diplo
preview: >-
  hexframe's product truth for design work: who it is for, what it makes
  possible, what no neighbour can claim, and what future work must keep. Read
  by Impeccable before any design; the look itself is in ui/.
---

# Product

<!-- impeccable:product-schema 1 -->

> Drafted on 2026-11-01 from the repository, then confirmed by Ulysse the same day. *(open)* marks a decision nobody has made yet.

## Platform

web

One screen that also serves a phone, where the chat stays in front and the canvas behind it. The same System is shown outside the app by `2-claude-mod` (a pane in Claude Code) and `3-obsidian-plugin` (a view in Obsidian); this record covers the app.

## Users

Someone who maintains a system with AI agents (a codebase, a team, their own life) and needs two things: to say what they want, what matters most first, and to keep up with what the agents do, at the altitude they choose.

- **First user:** Ulysse, keeping this vault and hexframe itself as Systems; the vault is the first system kept this way.
- **Next:** engineers working with coding agents, who reach their System through the MCP server and a Key, from Claude Code or Obsidian.
- **Beyond:** anyone keeping a system, technical or not; the help and the tutorial are written for them.
- **Organizations** have a System of their own, under their star, with members and Groups; hexframe's own Organization holds Help and the tutorial.

## Product Purpose

Agents now do more than we can follow. What is left to us is to say what we want and to keep up with what they do. hexframe does both on one hierarchy of Tiles, read both ways: the user lays out their intent, what matters most first, and the agent works along it; the agent **unfolds** its work, goal first, then how it means to reach it, then how each part works, and the user follows it as far down as they care to go.

**Stage:** a private v0. **Success next:** Ulysse uses hexframe regularly, as his own tool, not as the thing he is building.

In the longer run, success is a user who lays out a System, lets an agent build on it, and keeps up with what changed without reading everything.

## Positioning

One hierarchy, six at most at every level, where order is intent. A notes app, a wiki or a folder of `CLAUDE.md` files holds what you know; hexframe makes the rule of six ask the questions anyone maintaining a large system with AI should ask (what matters most here, what is the smallest idea that makes the whole work better), and makes the agent answer on the same hierarchy, goal first. Every change has an **altitude**: the level it moves and the ones it leaves alone.

The thesis behind it, from 2026-10-12: intelligence has been commoditized; what remains is experience. A person is the crossroads of the things they care about; hexframe is where they deepen what they understand of each, lay it out, and share it with the world and with the agents that work beside them. Each user is a sun in hexframe's universe.

## Operating Context

- **The one screen.** No menu, no page to go to. The **Chat** shows the user's Conversation with the agent, where whatever a menu would do happens (`/keys`, `/help`, `/language`); the **Canvas** shows the System and the way through it. Each side answers the other. Signed out it is the same screen: the canvas shows Help and the chat asks who you are.
- **A new account's first journey:** the onboarding (the dawn: naming the root, the user's pseudo), then the tutorial, a shipped System of six steps (go in, six at most, context, your system, unfold, keep up), read-only on the canvas.
- **Agents reach a System** through the MCP server at `/mcp`, with a Key the user issues; Claude Code, the claude-mod pane and the Obsidian plugin are where engineers already work.
- **The Assistant** builds a System by conversation: a Turn runs Claude Code in the Account's sandbox, in ask mode (its writes become a Proposal the user decides) or apply mode (written, and undoable once).
- **Import and export:** a System is written as files, the way a vault reads as a hexframe, zipped for export and read back from a folder on import.
- **Sharing:** a Tile is shared, and a public Tile reads as Markdown at `/t/<id>.md`.

## Capabilities and Constraints

- **The model.** A System per Account, its Root the user's star. A Tile has a Title, a Preview and a Body; at most six Children (its Directions), six Leaves and six Context slots; References by id. Operations: create, edit, move, swap, delete, each undoable as a batch. Rights per Tile (read, write, @) from inherited Grants.
- **The words are the product's.** System, Tile, Root, Child, Direction, Context, Preview, Body, Altitude, Unfold, Turn, Proposal, Key: capitalized where Help capitalizes them, and defined in `STACK.md`'s language section. Copy uses them, not synonyms.
- **Two languages, English and French,** the locale in the URL (`/`, `/fr/…`). Every shipped System has a French twin; every string is a Paraglide message.
- **Access.** The Assistant is open only to the accounts listed in `ASSISTANT_ACCOUNTS`, until Stripe; each Turn spends under a ceiling and a monthly allowance.
- **Not built yet:** reviewing a pull request as what it changes in the hierarchy and what it leaves alone; paid plans. *(open: pricing, plans, and when anyone beyond Ulysse is invited)*

## Brand Commitments

- **Name:** hexframe, lowercase in running text, capitalized at the start of a sentence.
- **Voice:** plain, short, declarative sentences; the product's own words, defined once and used exactly; no marketing superlatives. Help and the tutorial are the reference.
- **Mark:** the Sunstone, a tile cut into six facets meeting at a sun (`src/front/ui/layouts/screen/Sunstone.tsx`).
- **Space theme, from the model:** going down a level is getting closer; the user's root is the sun the rest turns around; another System is another star. Amber says "you", rose says an Organization ("us").
- **Visual authority:** the direction and its six principles live in [[4-software-engineering/1-projects/1-hexframe/1-app/src/front/ui/CLAUDE|ui]] and the tokens in `src/front/styles.css`. Dark is the one theme. Obsidian is the stated closest relative.

## Evidence on Hand

- **Help** (`help/`) and **the tutorial** (`tutorial/`): two Systems hexframe ships, in English and French.
- **This vault**, kept as a hexframe: the first real System, and the working demonstration of the rule of six applied to a life.
- **The design-system deck** at `/design-system`, which opens on the direction in words.
- **The Sunstone** and `public/favicon.svg`.
- **None yet:** testimonials, customers, usage numbers, benchmarks, press, pricing. Future work must not invent them.

## Product Principles

1. **What comes first matters most.** Order is intent; every surface shows the most important thing first and the rest one altitude down.
2. **Six at most is the work.** Choosing which six is the point; never relax the limit to fit more in.
3. **One screen, two sides.** The chat acts, the canvas carries; nothing needs a page or a menu of its own.
4. **The human directs, the agent unfolds.** The user's intent and words lead; the agent shows its goal before its detail, and what it drafts stays the user's to take.
5. **Experience over intelligence.** Intelligence is common; the care put into understanding is what hexframe serves.

## Accessibility & Inclusion

The target is **WCAG 2.2 AA**.

- Reduced motion is honoured everywhere: with it, everything lands at once (lint enforces `motion-reduce` beside every Radix state animation).
- The phone is a first-class width, not a fallback.
- Two languages from the start; nothing is written in only one.
- Keyboard use goes through shortcuts in `ui/`.
