---
title: Riftbound
parent: .skills/3-games/1-riftbound
owner: diplo
preview: >-
  Skills for the Riftbound TCG, working on the data in 3-games/1-riftbound: look
  up a card, look up a rule, load a deckbuilding session, and play a game on
  tcg-arena.fr with a strategist and a tactician subagent.
---
# Riftbound

Skills for the Riftbound TCG. They read and write [[3-games/1-riftbound/CLAUDE|the Riftbound folder]], and their paths start from `3-games/1-riftbound/`. They are written in French, like that folder.

| Skill | Use it to |
|---|---|
| [[.skills/3-games/1-riftbound/card/SKILL\|card]] | Look up a card's exact text and stats |
| [[.skills/3-games/1-riftbound/rules/SKILL\|rules]] | Look up a rule, a keyword or an interaction |
| [[.skills/3-games/1-riftbound/deckbuild/SKILL\|deckbuild]] | Load everything a deckbuilding session around a legend needs |
| [[.skills/3-games/1-riftbound/play/SKILL\|play]] | Play a game on tcg-arena.fr through Claude-in-Chrome |

`play` ships two subagents in `play/agents/`, linked into `.claude/agents/` by `.skills/sync`: [[.skills/3-games/1-riftbound/play/agents/riftbound-strategist\|riftbound-strategist]] sets the gameplan of a matchup, [[.skills/3-games/1-riftbound/play/agents/riftbound-tactician\|riftbound-tactician]] takes one decision at a time.
