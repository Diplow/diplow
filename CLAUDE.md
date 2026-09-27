---
title: diplow
parent: .
owner: diplo
preview: >-
  An entry point to who I am: what I aim at, what I think about the world and why.
  A context about my life, maintained so agents can be steered along my direction,
  cut into six domains: Leadership, Education, Games, Software Engineering,
  Startups, Politics. First draft, still being clarified.
---
# diplow

> First draft (HEX-1). The purpose below is still being clarified; treat it as direction, not settled doctrine.

## What this repo is

This repo is an entry point to who I am (Ulysse, "diplow"). It exists so that an AI (Claude, for now) can browse:

- **what I am aiming at**: my goals and self-identified direction;
- **what I think about the world**, consolidated in one place;
- **why I think it**: the justification behind each position.

## Why it exists

It is a maintained context about my life, kept so it can be put to work: the point is for agents to serve my goals. Writing my direction down is what makes it possible to steer agents along it.

## How it is organized

The repo is a hexframe: a node with at most 6 meta folders, 6 child folders and 6 files, the same shape at every level.

## Six domains

The six children are the domains where I want to have something to say. Everything I do, and want captured here, falls into one of them. Choosing only six is the point: it says who I am, what I want, and where I am relevant.

| # | Domain | Folder | Across the ring |
|---|---|---|---|
| 1 | Leadership | `1-leadership/` | Software Engineering |
| 2 | Education | `2-education/` | Startups |
| 3 | Games | `3-games/` | Politics |
| 4 | Software Engineering | `4-software-engineering/` | Leadership |
| 5 | Startups | `5-startups/` | Education |
| 6 | Politics | `6-politics/` | Games |

## Conventions

Every Markdown file opens with a frontmatter (`title`, `parent`, `owner`, `preview`) and links with `[[wikilinks]]`. Read [[STACK]] before adding a file, a folder, a domain or a skill, or touching root-level config (`.claude/`, `.obsidian/`, `.skills/`, `.conductor/`, `.github/`).
