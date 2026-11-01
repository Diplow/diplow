---
title: decisions, Labeled Mentions
parent: 6-politics/1-projects/1-wikipol/.run/registers/labeled-mentions
owner: diplo
preview: >-
  The choices made giving a Digest its mentions and relations where the tickets
  left room: the vocabulary as wikipol's Context, the rules check-digest holds a
  mention to, the seed terms, the Mention glossary entry for Ulysse, a Source's
  hosts in its source.yaml, how a draft proposes a term, the known names and how
  they were seeded, and the samples of WIK-14.
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

### DEC-6 A Source's hosts are in its `source.yaml`

WIK-14, answering DEC-5 with its first way. `source.hosts` lists who leads every Publication of a Source, and a mention with one of those names passes without the Raw or the title saying it; every other name keeps the check's guarantee, and no qualifier is trusted on its own. Boniface declares `Pascal Boniface`. PaduTeam declares none: its members (Padu, Chris, Zoé, in its editorial `CLAUDE.md`) are not all in every video, and the captions don't say who speaks, so a member is a mention only when the Raw or the title names them. The prompt passes the hosts to the model under their own heading.

### DEC-7 How a draft proposes a term, and where it lands

WIK-14. The draft's frontmatter, beside `preview`, holds `mentions`, `relations` and `new_terms`, one `{label|qualifier|relation: <term>, kind | from + to, definition}` per term. The pipeline reads the new terms, checks the Digest against the vocabulary with them added, and once the Digest is accepted, writes each at the end of its group in `vocabulaire.yaml`, `proposé`, every other line left as it was (the file is hand-written, with comments and one-line terms that a YAML dump would reflow). The file is written beside itself and read back before it replaces the old one, so a term that would break it (`yes`, which YAML reads as a boolean, is refused at the draft already) leaves it unchanged. A term the vocabulary already has is left out silently, a retired one is refused with its replacement. `new_terms` never reaches the Digest file.

- **A departure: `introduit_par` is the Raw's key** (`paduteam/URonNSP0qM0.md`, the Digest's `raw` field), not the Digest's path, which `.vocabulaire/CLAUDE.md` said. A Digest is written outside the Chronicle, and filing moves and renumbers it later; the Raw's key never moves, and finds the Digest by its `raw` field.
- **No lock on the file.** Runs are sequential (one backfill at a time, one runner), and a term is inserted by reading the file just before writing it. Two `wikipol digest` started side by side could lose one term; the Digest would then fail `check-digest`, which says so.
- **Mentions stay optional at version 3.** The skill asks for them, the check doesn't require them: a capsule can name no one the Raw lets us name.

### DEC-8 The known names, `noms.yaml`, and what the prompt carries of them

WIK-14. A second file in `.vocabulaire/`, beside the vocabulary: it is how wikipol spells things, about the node like the vocabulary (DEC-2). One line per name, by kind, `{name, aliases}`. `wikipol seed-names` drew 1 134 names from the frozen vaults (PaduTeam's 874 `Individus/` and 270 `Organisations/` notes, Boniface's 3, the folders' `CLAUDE.md` index notes left out):

- **The name is the note's heading**, which keeps the accents its file name dropped (`Le Média TV` for `Le Media TV.md`), or an alias that only adds accents to it (`Confédération Paysanne`). The file name and the other aliases become aliases; a form that is the name with other accents is left out, since a name is matched accents aside.
- **A note is left out only when its name is already a form of a name**, so a hand correction survives a new seed. A first seed merged notes on any shared form, and that glued different people through a common alias (`AOC` for Ocasio-Cortez and Oudéa-Castéra, `Bush`, `Abbas`, `UE` for the Union étudiante and the European Union), keeping whichever note came first, often the misspelled one. Two notes that share only an alias are now two names; such an alias says nothing to the write check below.
- **Hand corrections, 1 126 names after them** (1 135 once DEC-10 added the names and spellings the samples confirmed and #186's review found more), applied once and kept by re-seeding. Headings that were captions' misspellings, the right name in an alias: Adama Traoré, Claude Guéant, Daniel Křetínský, Gisèle Pelicot, France Télévisions, Anasse Kazib, Bernard Arnault, Bruno Gollnisch, Gilles-William Goldnadel, Renaud Camus, Zohran Mamdani. Duplicate notes merged into one name: François Bégaudeau, Antonio Gramsci, Johanna Rolland, Michel Onfray, Mouammar Kadhafi, Nathalie Saint-Cricq, Sarah Saldmann, Lénine, MoDem, ZawaProd. `Helydia` and `Celia` stay apart, `Célia` no longer an alias of the first: I can't tell they are one person. The review of #186 found the rest: Yolanda Díaz listed as an alias of Irène Montero (now a name of her own), two names a correction had listed twice (Goldnadel, Mamdani, merged), aliases that only changed the name's case, and five notes that wrote their aliases as one string, `"[a, b]"`, which the seed now splits. The legacy Title Case stays (the checker matches a name case aside) but for the three parties the samples meet most: `La France insoumise` (with `LFI`, `les Insoumis`), `Parti socialiste` (`PS`), `Rassemblement national` (`RN`). `Front national`, `Pôle emploi` and `Parti ouvrier indépendant` are names of their own, split from their successors' aliases: a name that was right at its date is not an alias of the next one.
- **Only the names the Publication says go into the prompt**: those a form of which is in the Raw or the title, case, accents and punctuation aside, as check-digest finds a mention. All 1 135 would be some 15 000 tokens per Digest, mostly noise. A name the captions mangle beyond every known form is left to the model's knowledge, `unsure` when it doubts.
- **The write path refuses a mention named by an alias.** Round 1 of the samples (DEC-10) kept the captions' `Johanna Roland` though the list gave `Johanna Rolland`: a mention whose name is, case and accents aside, the alias of exactly one known name and no known name itself goes back to the model with the canonical name. Only `wikipol digest` and `backfill` hold it, not `check-digest`: the list changes by hand, and a Digest already written shouldn't fail because a name was corrected later. An alias two names share (`POI`) says nothing.
- Some aliases are descriptions the legacy pipeline kept (`chef de HTS`, `président PRG`); they only widen which names reach the prompt.

### DEC-9 The pull request goes to `main`

WIK-14 said "into the project branch", but `project/sources-from-youtube` merged into `main` (#185) and Labeled Mentions has no branch of its own nor a run config. The ticket's PR targets `main`, before the PaduTeam backfill resumes: `DIGEST_VERSION` is now 3, so the next backfill rewrites the 30 Digests in the Chronicles (all at version 1) with their mentions.

### DEC-10 The samples, in three rounds; for Ulysse to review on the pull request

WIK-14, 2026-11-01, `wikipol digest` on `claude-sonnet-5-5`, over the five PaduTeam Publications of [[6-politics/1-projects/1-wikipol/.run/registers/sources-from-youtube/decisions#DEC-13 Five sample Digests of PaduTeam, all checked; for Ulysse to review on WIK-12|Sources from YouTube, DEC-13]] (`URonNSP0qM0`, `X0tXWZsjENQ`, `wsiChBGb6T0`, `ADd-wfitfm8`, `bfgICs0Y6y0`) and two of Boniface: an interview, `qI54neb3QCI` (Sylvie Bermann), and a "J'ai lu", `kePXt-ktSMY` (Didier Billion, the video of DEC-5). Each round wrote the seven, every one accepted, and `check-digest` passes them against the bucket. They are pasted in the pull request and not committed: the backfill writes the Chronicle's Digests anew at version 3.

- **Round 1**, the skill as first written: the names come out canonical where the captions mangle them (*Gill Boulot* → Gilles Boulot, *Shishinping* → Xi Jinping, *Olivier Fort* → Olivier Faure, *Nicolas Meer Rossignol* → Nicolas Mayer-Rossignol), Pascal Boniface passes as host, Lu Shaye is marked `unsure`. But no term was proposed: the model forced the nearest label (`ministre` for Netanyahu, `groupe-armé` for Action Française, `chef-d-état` for Pedro Sánchez) or left labels empty for Macron and Le Pen; one capsule held 28 mentions, a list of historical figures among them; and it kept *Johanna Roland* though the known names gave Johanna Rolland.
- **Round 2**, after the skill said a near label is a wrong one, gave the test for a passing name, and asked for a label wherever the model knows one: three terms proposed and written into the vocabulary (`dirigeant-de-parti`, `chef-de-gouvernement`, `institut-de-sondage`), labels filled, 7 to 24 mentions a Digest. *Johanna Roland* stayed, which is what DEC-8's write check now refuses, and showed the first seed's merge fault.
- **Round 3**, with the check and the re-seeded names: *Johanna Roland* went back once and came back as Johanna Rolland, `heard_as: Johanna Roland`. One regression, model variance: *Olivier Fort* stayed uncorrected, where rounds 1 and 2 wrote Olivier Faure. Hence the last step of the ticket: the captions' spellings the samples confirmed are now aliases of their names (`Olivier Fort` of Olivier Faure, 23 more), so the next run gets the correction from the list rather than from the model's memory. A spelling marked `unsure` (Antoine Oberdorff, Lu Shaye) is not added.

For Ulysse:

- **The three `proposé` terms**: accept, rename or retire them. Their `introduit_par` names the sample Publications.
- **First-name guests**: PaduTeam's student unionists are *Fanny*, *David*, *Gabin*, *Dabia*, each `unsure` in round 3. A first name the Raw gives is all there is; whether such a mention is worth keeping is yours to say.
- **Dubious picks** the check can't see: *On ne veut plus* as a `média`, Mao Zedong labeled `dirigeant-de-parti` rather than `chef-d-état`, Robespierre as `élu`. The labels at the Publication's date are the model's knowledge, unchecked.
- **The members**: Chris, Padu and Dr Zoé are mentions when the Raw names them (DEC-6), with labels that vary between `militant` and `vidéaste` from one Digest to the next.
