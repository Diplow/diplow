---
title: A Source's editorial context
parent: .skills/6-politics/1-wikipol/new-source
owner: diplo
preview: >-
  What new-source writes in a Source's CLAUDE.md, the text write-digest reads
  before every Digest: what the sweep of the channel must return, the sections
  of the file, the rules of the "Pour le Digest" section, and how one Digest
  proves the draft.
---
# A Source's editorial context

A Source's `CLAUDE.md` is its Tile and its editorial context. `wikipol digest` gives the whole file to `write-digest` before every Digest, and `wikipol file` gives it to `write-period` before every Period summary. A rule written here changes hundreds of Digests, and a wrong one misattributes hundreds of claims. The two files written by hand are the models: [[6-politics/2-sources/2-boniface/CLAUDE|Boniface]] for one person speaking in his own name, [[6-politics/2-sources/1-paduteam/CLAUDE|PaduTeam]] for a collective. Both carry sections about their frozen vaults that a new Source has no use for.

## What the sweep returns

The subagent that reads the channel answers these, in 40 lines at most, each with where it read it: the About text, a title, or a Raw with its timestamp. An answer it could not ground says `not found`, and the file then leaves the point out.

1. **Who speaks.** One person, a fixed team, a host with guests? Their names as the channel gives them, and whether captions can tell the voices apart (they carry no speaker labels).
2. **Formats.** The kinds of videos the channel makes (an explainer, an interview, a live, a series with a name), how to tell each from its title, and how long each runs.
3. **What it argues.** The subjects it comes back to and the position it takes on them, in its own words when a Raw gives them.
4. **How it argues.** Does it cite sources, show data, nuance its own claims, joke, play a character?
5. **What is not the channel's own voice.** Sponsor reads, partnership videos on an imposed subject, calls to donate or subscribe, a scripted second character, a guest's theses, clips it plays and comments.
6. **Traps.** What someone who reads only the captions gets wrong: irony, a devil's advocate, a title that says more than the video, a thesis stated to be refuted.

## The file

In French, like every Source file. The frontmatter the template wrote stays, with the `preview` rewritten to say who the Source is, in 350 characters at most. Then these sections, in this order. The whole file stays under 90 lines: it rides along with every Digest prompt.

| Section | Holds |
|---|---|
| a first quoted line | `> Brouillon écrit par /politics:wikipol:new-source le <date>, à partir de la page de la chaîne et de <n> Raws. À relire.` |
| `## Pour le Digest` | the rules below: the only section written as instructions |
| `## Objectif` | what the Source brings to the corpus, in two or three sentences: its subjects, the kind of argument it makes. Why I follow it is mine to add; leave no guess |
| `## Qui est la source` | who makes it, since when, the formats, how it is funded when the channel says so |
| `## Principes éditoriaux` | the posture: a faithful account of what the Source argues, in its terms, with its own nuances, as for every Source so far |
| `## Pièges de lecture` | the traps of the sweep, numbered, each with what to do about it |
| `## Attribution` | how a sentence names the speaker, and when a claim goes to someone else |
| `## Usage de la Source` and `## Principe d'auto-amélioration` | as the template wrote them |

Delete the template's HTML comments and its `## Skills spécifiques à cette source` section: a new Source has no skill of its own.

## The rules of "Pour le Digest"

One bullet per rule, each a bold name, a period, then what to write and what to leave out. Write a rule only for what the sweep found. Cover, when the channel has it:

- **Attribution.** The words a claim uses for the speaker (`Gilles Mitteau soutient que…`, `la PaduTeam`), the same as `source.attribution` and `source.hosts` of `source.yaml`.
- **Other voices.** A guest's thesis is kept only when named as the guest's and when it carries the video. A scripted character, a devil's advocate or a quoted opponent is not the Source: its lines back no claim attributed to the Source.
- **What is not a claim.** Sponsor reads, partnership segments, calls to donate, announcements. No claim, no Extract.
- **Each format.** What a Digest of that format holds: for an explainer, the mechanism explained and the conclusion drawn from it, and not a summary of the lesson's outline.
- **Nuance and sources.** Whether its reservations, its orders of magnitude and the sources it names belong in the claim.
- **How many claims.** What the usual length gives: a ten-minute video often two or three, an hour up to six.

## The proof

A draft is proven on one Digest, not by rereading it. After `digest.sh` writes the Digest of a sampled Raw, check three things in it against the Raw's title and the sweep:

1. Every claim names its speaker the way the Attribution rule says.
2. No claim or Extract comes from a voice the file excludes.
3. The Preview states what the video argues, not its subject.

A miss on any of them is a rule that is missing or unclear: fix the rule, delete the staged Digest, write it again. Two rounds at most; what still misses after the second goes in the report as an open point. A Digest that passes stays staged: `ingest-source` files it with the others.
