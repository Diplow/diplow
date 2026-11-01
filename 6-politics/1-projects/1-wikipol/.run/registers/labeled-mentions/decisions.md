---
title: decisions, Labeled Mentions
parent: 6-politics/1-projects/1-wikipol/.run/registers/labeled-mentions
owner: diplo
preview: >-
  The choices made giving a Digest its mentions and relations where the tickets
  left room: the vocabulary as wikipol's Context, the rules check-digest holds a
  mention to, the seed terms, the Mention glossary entry for Ulysse, and the
  host the Raw never names, left to WIK-14.
---
# Decisions

### DEC-1 For Ulysse: the glossary gains Mention

WIK-13. `CONTEXT.md` is yours, so the term waits here. Proposed entry, under "What the System holds":

```markdown
**Mention**:
Who or what a Publication names, as its Digest records it: a person, an organisation, a place, an event, a work or a text, with its kind, labels and qualifiers from wikipol's vocabulary.
_Avoid_: entity, tag, named entity
```

The vocabulary's own words (kind, label, qualifier, relation) stay in `.vocabulaire/CLAUDE.md`: they name parts of a Mention, not things the System holds.

### DEC-2 The vocabulary is wikipol's Context, `.vocabulaire/`

WIK-13. The vocabulary says how wikipol's Digests name things: it is about the node, not content of it, so it is a Context tile, a dot folder, rather than a Leaf beside `BUILD.md`. A dot file would have been neither Leaf nor Context ([[4-software-engineering/1-projects/1-hexframe/.run/registers/hexframe-claude-code-mod/decisions#DEC-1 Unnumbered Leaves and dot files|hexframe DEC-1]]), so the folder holds a `CLAUDE.md` tile and `vocabulaire.yaml`. Its structural keys are the Digest's (`kinds`, `labels`, `qualifiers`, `relations`, `from`, `to`); a term's are the tickets' French (`définition`, `statut`, `introduit_par`, `remplacé_par`). The repo root's `CLAUDE.md` now names the slots, Context included ([#181](https://github.com/Diplow/diplow/pull/181)).

### DEC-3 What `check-digest` holds a mention to

WIK-13. Where the ticket left room, and one place it departs from it:

- **Optional fields, no version bump.** `mentions` and `relations` may be absent, so the 30 Digests already filed still pass (checked against their Raws on 2026-11-01). WIK-14 bumps `DIGEST_VERSION` when write-digest fills them.
- **A `proposé` term counts as known**, so WIK-14 can add a term and pass the check in the same pass. A retired term (`remplacé_par`) is refused with its replacement, until `wikipol relabel` (WIK-15) rewrites it.
- **A departure: the `heard_as`, or else the name, is looked for in the Raw, or else in the title**, case, accents and punctuation aside. The ticket said the Raw; the ticket's criterion now says the title too. The title is the video's, checked against YouTube's metadata, and it often names a guest or an author the captions don't: Boniface's "J'ai lu… « Comprendre la question kurde » de Didier Billion" never says "Didier Billion" in its Raw. Quote matching keeps its own rule ([[6-politics/1-projects/1-wikipol/.run/registers/sources-from-youtube/decisions#DEC-12 What the checker holds a quote to|Sources from YouTube, DEC-12]]): accents count there.
- **A duplicate** is the same name, case, accents and punctuation aside; a relation reads the kind of the first mention of its exact name. A variant spelling is refused as a duplicate either way, so no relation can pass on its kind.
- **Relations name their ends by `name`**, exactly as the mention writes it.
- **`heard_as` and `unsure`**: `unsure` is `true` or absent, as WIK-14 needs it.
- The vocabulary is read once per `check-digest`; a malformed one stops the command and names the term at fault.

### DEC-4 The seed vocabulary

WIK-13. The project description gave the six kinds and a handful of examples, not a list. The seed is a first draft for you to cut or rename: 6 to 18 labels a kind, a function never a judgment (`groupe-armé`, `attaque`); qualifiers per kind, so their definitions fit it; six relations (`auteur`, `organise`, `participe`, `membre`, `dirige`, `situé`). One departure from the first sketch: an organisation has no `intervenant`, since a voice in the Raw is a person's; whoever speaks for it is a personne `membre` of it.

### DEC-5 For Ulysse and WIK-14: the host the Raw never names

WIK-13, found on Boniface's "J'ai lu…" video: he hosts it and never says his own name, nor does the title. A `Pascal Boniface` mention with `animateur` is refused today, and `heard_as` can't help. Two ways for WIK-14: list a Source's hosts in its `source.yaml` (beside `attribution`) and accept their names, or exempt an `animateur` from the Raw check. The first keeps the check's guarantee; the second trusts the model with a qualifier.
