---
title: decisions, Sources from YouTube
parent: 6-politics/1-projects/1-wikipol/.run/registers/sources-from-youtube
owner: diplo
preview: >-
  The choices the autonomous run made building wikipol's pipeline where a ticket
  left room: the Source nodes and their frozen vaults, how the Raws reached the
  bucket, how the Fetcher picks videos, how a Digest is written and checked, and
  how the Chronicle splits its Periods and files Digests in them, and how a
  Source's history is backfilled.
---
# Decisions

### DEC-1 PaduTeam's override skills sit in a `.skills/` Context folder, in three groups

WIK-1. PaduTeam's vault had eleven override skills in `Skills/`, and the Source node must keep the rule of 6. An unnumbered `Skills/` folder would have taken a Branch slot, and the project keeps the Source's five slots after `1-chronicle/` free for a structure that emerges. So the skills became the node's Context, `.skills/`, the way the repo root keeps its own skills, regrouped by wikipol's `BUILD.md` classes:

- `1-ingest/`: `gather-context`, `ingest-batch`, `ingest-video`
- `2-write-basic/`: `write-concept`, `write-entity`, `write-evenement`, `write-video`
- `3-write-advanced/`: `write-conjoncture`, `write-enjeu`, `write-methode`, `write-possible`

The folder is still the skill's name, so the override rule only gains a wildcard: `6-politics/2-sources/<n>-<slug>/.skills/*/<name>/SKILL.md` wins over `wikipol/Skills/<name>/SKILL.md`. The root `.skills/sync` scans the root `.skills/` only, so none of these reach Claude Code's skill list.

### DEC-2 `source.yaml` points at its frozen vault with `legacy.vault`, and `source_config` resolves vault paths from it

WIK-1. Moving `source.yaml` out of the vault broke `Scripts/source_config.py`, which took the folder holding `source.yaml` for the vault root. Each `source.yaml` now carries `legacy.vault`, the vault's path relative to the file (`../../1-projects/1-wikipol/Legacy/Paduteam`), and `SourceConfig` gains `vault_root`: the inventory, the `_CHRONOLOGIQUE.md` tracker and the transcripts resolve from it, and `source_root` stays the Source node. A Source with no vault gets `vault_root = source_root`. This also gives WIK-4 the way from a Source to its legacy notes, which `write-digest` reads as extra input.

### DEC-3 The legacy scripts are kept for reference; `new_source.py` scaffolds a Source node

WIK-1. `run_ingest.py`, `generate_chronological.py`, `batch_transcripts.py` and the `ingest-*`, `gather-context` and `write-*` skills all write into a vault, and the vaults are frozen. I fixed their paths (`--source` now takes the Source node, vault files go through `vault_root`) and put a line at the top of each script and in wikipol's `CLAUDE.md` saying they are the legacy pipeline, kept for reference and not to be run on a frozen vault. WIK-3 takes discovery and caption parsing out of `batch_transcripts.py`. Those three scripts also stop, through `source_config.require_writable_vault`, before writing anything: on a Source with no `legacy.vault`, and on a vault under `wikipol/Legacy/`. Today that is every Source, so the freeze is enforced, not only written down: running them again means moving a vault out of `Legacy/`, a decision for Ulysse.

`new_source.py` would have recreated `wikipol/Sources/<Name>/`, a vault in the place the glossary just retired. It now scaffolds a Source node at the first free number of `6-politics/2-sources/`: `source.yaml`, the editorial `CLAUDE.md` from the template (now with the four-field frontmatter) and an empty `1-chronicle/CLAUDE.md` from a new `Templates/chronicle_CLAUDE.md.tmpl`. It refuses a seventh Source until the six are regrouped. `Templates/source_BUILD.md.tmpl`, the vault's local taxonomy, had no reader left and is gone.

### DEC-4 The moved editorial files keep their text; only their frontmatter, a lead note and literal paths changed

WIK-1. The two editorial `CLAUDE.md` files and PaduTeam's eleven skills were written for their vault. I left their bodies as written and changed three kinds of thing: the frontmatter (`parent` set to the new node, the editorial previews rewritten for a Source, the four fields added to every `SKILL.md`); a short lead note on each editorial `CLAUDE.md` saying the text below describes the frozen vault and that its relative paths read there; and the literal paths that pointed at the old place (`--source Sources/Paduteam`, Boniface's `../../CLAUDE.md`, `Sources/Paduteam/` in the four advanced skills, the rclone commands). The vault's notes under `Legacy/` are untouched; `Legacy/CLAUDE.md` is new and says they are frozen.

### DEC-5 For Ulysse: the glossary still places the legacy vaults at `wikipol/Sources/`

WIK-1. `CONTEXT.md`'s **Source** entry says "the legacy vaults under `wikipol/Sources/` are not Sources". They are now under `wikipol/Legacy/`. The run doesn't edit `CONTEXT.md`, so the path is yours to update. The run config's comments name `wikipol/Sources/` too, for the rule that freezes the legacy notes there.

### DEC-6 `copy-from-drive` finds a Raw's id and date beyond its frontmatter; 609 of the 621 Raws are in the bucket

WIK-2. The ticket asked for the `youtube_id` from the transcript's frontmatter, the others listed. On Drive that left 38 of 621 without one: Boniface's five transcripts carry no frontmatter at all, and none of the 621 carries its publication date. So `copy-from-drive` looks, in order, at the frontmatter's `youtube_id`, its `url` (`watch?v=`), then, read-only, the frozen vault: a `Videos/` note's `youtube_id` and `date` for the transcript it links under `## Transcript`, and a row of the vault's inventory table (Boniface's), whose URL, date and transcript link sit on one line. A transcript two entries tie to different ids gets none.

The copy of 2026-10-31: PaduTeam 604 of 616, Boniface 5 of 5, every object byte for byte its Drive file (a second run found all 609 already there, compared by content). Left on Drive, listed in the pull request: 11 PaduTeam transcripts with an English title (YouTube's translated title) and no id anywhere offline, and one duplicate, `THAÏS les VSS l'ont rendue NAZIE !.md`, a second transcript of `4MLEHjkr7Rs` in another format; the first by name went in. For Ulysse: the 11 ids can only come from YouTube, by hand or through the Fetcher once WIK-3 lands. 150 PaduTeam Raws have no `published` in their metadata; the index (WIK-7) searches by date, so the Fetcher's metadata will have to fill it.

`~/.config/wikipol/.env` held neither `WIKIPOL_S3_BUCKET` nor `WIKIPOL_S3_ENDPOINT` at the time; the copy ran with them set in its process environment (`wikipol-raws`, `https://s3.fr-par.scw.cloud`). For Ulysse: add both lines to the file, or every later command needs them on its command line.

### DEC-7 ruff covers the new package, not the legacy scripts beside it

WIK-2. The gate runs `ruff check .` and `ruff format --check .` from `Scripts/`, where the six legacy scripts of DEC-3 also sit. Linting them would mean rewriting code kept for reference and never run, so `pyproject.toml` lists them in `extend-exclude`, by name: a new file in `Scripts/` is linted, and moving a legacy script into the package means removing its line. No rule is lowered for the code the run writes.

### DEC-8 A Raw's metadata carries its Drive title, percent-encoded; four Raws don't use the `M:SS` blocks

WIK-2. S3 metadata travels as HTTP headers, ASCII only, so the store percent-encodes `title` and decodes it on `get`. The title is the frontmatter's `titre` when there is one, else the Drive file's name, which is the video's title with `:`, `?` and `|` dropped; the true title comes with the Fetcher's metadata.

Most Raws are 30-second blocks, a `M:SS` line then text. Four are not, and WIK-4 and WIK-7 must not assume it: `X0tXWZsjENQ`, `4MLEHjkr7Rs` and `mCek51AyK50` use `**[MM:SS](https://www.youtube.com/watch?v=ID&t=N)**` blocks under a title and URL header, and `wsiChBGb6T0` (BORIS VALLAUD N'A PAS DIT SON DERNIER MOT !) has no timestamp at all, so no Extract of it can carry one.

### DEC-9 The Fetcher: `--limit` counts videos tried, one yt-dlp call per video, Supadata behind the flag

WIK-3. `wikipol fetch --source <slug> [--limit N]` lists the channel, keeps the videos whose Raw the bucket lacks, and fetches them newest first, 8 s apart, stopping after 3 failures in a row. Where the ticket left room:

- **`--limit` counts the videos tried, failures included**, not the Raws stored, so a sample named on a ticket never grows into more videos than it says.
- **A video YouTube has no French captions for is not a failure.** It is skipped, counted against `--limit`, and tried again next run, since YouTube's speech recognition can take hours after an upload; only real failures (a refusal, a timeout, captions YouTube lists but yt-dlp didn't write) count toward the stop after 3 in a row. Counting it, as `batch_transcripts.py` did, would let three captionless videos at the top of the channel stop every daily run before it reached a fetchable one. Each one costs a yt-dlp call and a pause per run until it gets captions. A video that fails every time for another reason (age-restricted, login-gated) still counts: for Ulysse and WIK-9, three of those at the top of the channel would stop each daily run, and the run's report names them.
- **One yt-dlp call per video** writes the French captions (json3, else WebVTT) and the info file, instead of the legacy script's two caption calls and a third for the date. The info file gives the title, the publication date (`upload_date`) and the duration. The listing skips an upcoming or running live and a members-only video, which have no captions for us and would count as failures each day.
- **A fetched Raw is today's format and nothing more**: a frontmatter holding only `youtube_id`, then the 30-second blocks, two blank lines apart, as `batch_transcripts.py` wrote them. Title, date and duration go to the object's metadata; `RawMeta` gains `duration`, in seconds, absent on the Raws copied from Drive.
- **The Fetcher is picked by `WIKIPOL_FETCHER`** (`yt-dlp` by default, or `transcript-api`), and `--fetcher` on the command line wins over it.
- **The transcript API is Supadata**, the ticket naming none: `/youtube/channel/videos` lists, `/metadata` gives title, date and duration, `/transcript` in `native` mode returns the video's own captions, never an AI transcription, and a video with no French transcript is treated as one without French captions. It is tested on answers shaped like its documentation, never against the service: the run had no key. For Ulysse: to use it, add `WIKIPOL_TRANSCRIPT_API_KEY` to `~/.config/wikipol/.env`, and check its answers on one video before trusting it; another vendor means another class with the same two methods.
- **`batch_transcripts.py` keeps its copy** of the discovery and parsing code: it is the legacy pipeline of DEC-3, kept for reference, and the package's version now lives in `wikipol/fetch/`.

The real run of 2026-10-31, `--limit 3` on PaduTeam: the channel lists 1173 videos, 569 of them without a Raw; the three newest (`URonNSP0qM0`, `9aqNacmyf0c`, `hDtlb7vMGvo`, published 2026-10-28 to 30) were stored with their title, date and duration, 566 left. For Ulysse: those 566 are PaduTeam's backfill on WIK-12, about 75 minutes of pauses alone. The Fetcher does not fill the `published` date of the 150 Raws of DEC-6: their objects can't be rewritten, so WIK-7 has to take those dates from the Fetcher's metadata into its index.

### DEC-10 Python fills a Digest's fields, the skill writes its Preview and claims, the checker decides

WIK-4. The ticket asked for `claude -p` with the `write-digest` skill to turn a Raw into a Digest. `wikipol digest --source <slug> --id=<id> --out <file>` splits the work so that the model never writes a fact the pipeline already holds:

- **Python** reads the Raw from the bucket, the Source's editorial `CLAUDE.md` and the frozen vault's `Videos/` note on the Publication when there is one (`legacy_index.find_video_note`), then fills the whole frontmatter and the `# <title>` heading. The model writes the Preview and the claims only, in a small frontmatter-and-body draft.
- **`claude -p`** gets the skill as its system prompt (`--system-prompt`), the inputs on stdin, `--model` from `claude.default_model`, no tool (`--tools ""`), no MCP server, no session kept, and an empty temporary folder as its working directory, so neither this repo's `CLAUDE.md` nor its hooks join in. Its JSON answer is refused when `modelUsage` lists models and none is the pinned one (an extra entry, such as a small model Claude Code calls on its own, is let through; an answer without `modelUsage` is trusted to the `--model` flag), a check the halting rules called for.
- **The checker** (`wikipol.digest.format.check_digest`) runs on the assembled file. A refused draft goes back once with the problems listed; a second refusal writes nothing and leaves the draft in a temporary folder for a human. `wikipol check-digest <files>` runs the same check on files already written, against their Raw in the bucket.
- **Filing** is not done here: `--out` is any path, and `parent` is the folder it is written in when that is inside the repo, the Source's Chronicle otherwise. Numbering `N-<slug>.md` and placing it in a Period is WIK-5's.
- **An alias is refused when `source.yaml` is read**, not only when a Digest is written: `load_source` raises on `claude.default_model: sonnet`. The two Sources and the template now pin `claude-sonnet-5-5`; the legacy `source_config.py` still defaults to `sonnet` when the key is missing, for the legacy scripts only.

### DEC-11 The Digest's shape where the project description left room

WIK-4. The project fixed the fields and the limits; the rest, as `BUILD.md` ("Le Digest") now writes it:

- **A claim is a `## <n>. <claim>` heading**, numbered from 1, with up to three sentences of development under it; nothing else goes under the title, so the Body splits into claims without guessing.
- **An Extract is one line**, `> [<clock>](https://www.youtube.com/watch?v=<id>&t=<n>s) « <quote> »`, Extracts a blank line apart. Its link opens the video at the start of the 30-second block the quote begins in, a second the Raw itself carries.
- **A Raw without any timestamp gives Extracts without a link**, `> « <quote> »`. DEC-8 named one such Raw, `wsiChBGb6T0`; reading all 612 Raws of the bucket found a second, `xnU_T2a6Nz0` (BACKSEAT vs PADUTEAM : COMMENT EMPÊCHER LE RN EN RURALITÉ ?!), and every other one timed.
- **`published` and `duration` may be `null`.** `published` comes from the Raw's metadata, else from the legacy note's `date`; DEC-6's 150 PaduTeam Raws without a date may still lack one. `duration` is known only for Raws the Fetcher stored (3 today); the 609 copied from Drive have none until something reads it from YouTube.
- **`raw` is the bucket key**, `<source>/<youtube_id>.md`, not a URL, so the field survives a change of bucket or endpoint.
- **`digest_version` is an integer, `1`**, a constant of `wikipol/digest/format.py`, bumped when the format or the skill changes what a Digest says; the legacy notes' `skill_version: write-video-<date>` named a skill, not a format.
- **`title` is the Raw's metadata title.** For Raws copied from Drive that is DEC-8's approximation, the file name with `:`, `?` and `|` dropped and sometimes a letter lost (`MEYER HABIB  LE PEUPLE PALSTINIEN EST UN CANCER !!`). For Ulysse: the true titles come with YouTube's metadata, which the Fetcher reads for new videos only.
- **Wikilinks go only to Digests that exist** in the Source's Chronicle, listed to the model with their titles; with an empty Chronicle, a Digest carries none. A link to a legacy note is refused.

### DEC-12 What the checker holds a quote to

WIK-4, for the rule "never a timestamp the Raw doesn't hold, nor a quote that isn't in it". A quote is matched on its words: lowercased, accents normalized, punctuation and apostrophes turned into spaces, since captions punctuate loosely and the model tidies them. The words must follow each other in the Raw, the first one inside the block the link points to; the quote may run on into the next blocks. A cut (`[…]`) fails, as does a changed word. Words in guillemets elsewhere, in the Preview or a claim's development, quote the Source too: they must be in the Raw, anywhere in it, and may be a single word (« cancer », « dictateur » in the samples), since they back no claim on their own. Five words at least, so a quote can't be two common words found anywhere. The link's second must open a block of the Raw, its label must read as that second, and it must fall before the video's `duration` when that is known. The Raw reader takes the three shapes of DEC-8: `m:ss` lines, `**[MM:SS](…&t=N)**` lines (whose `t` it trusts), and none.

### DEC-13 Five sample Digests of PaduTeam, all checked; for Ulysse to review on WIK-12

WIK-4, 2026-10-31, five runs of `wikipol digest` on `claude-sonnet-5-5`, chosen to cover what differs between Raws: `URonNSP0qM0` (a capsule fetched by WIK-3, with its duration, no legacy note), `X0tXWZsjENQ` (a Graphomarxisme lesson, an old `**[MM:SS]**` Raw, with a legacy note), `wsiChBGb6T0` (commentary from a Raw without timestamps), `ADd-wfitfm8` (an eight-minute reaction) and `bfgICs0Y6y0` (a two-hour debate with guests). Four passed the checker on the first draft, `bfgICs0Y6y0` on the second; `wikipol check-digest` passes all five against the bucket. They are pasted in WIK-4's pull request and not committed: filing them in the Chronicle is WIK-5's. For Ulysse: whether the claims restitute PaduTeam faithfully, whether six claims for a two-hour debate is enough, and whether the Preview reads as a thesis, are the review WIK-12 lists.

### DEC-14 The Chronicle splits like a B-tree: halves of four and three, siblings, the root going down a level

WIK-5. ADR 0001 says a full Period splits by count; the ticket asked for contiguous, balanced date ranges. A Period that overflows to seven splits into two of four and three, the second half becoming a new sibling right after it, and the parent may overflow in turn. The Chronicle has no sibling: when it overflows, its children go down into two new Periods under it. So every Digest sits at the same depth and two sibling Periods never overlap. Where the ticket left room:

- **Two halves, not six parts, and siblings, not children.** Splitting a Period into sub-Periods inside itself would make the newest branch one level deeper at every overflow, since Digests arrive in date order: a chain, not a tree. Splitting upward keeps the depth logarithmic: 283 Digests in one year sit three Periods deep (`test_283_digests_in_one_year_keep_the_rule_of_6_at_one_depth`).
- **Balanced, as the ticket asks, so a Period holds three to six.** Appending in date order leaves each older Period with four or three Digests, so a year of PaduTeam takes about 90 Periods. Cutting 6 + 1 on an append would fill them, but it is not balanced; for Ulysse, if summaries of three Digests read thin.
- **The cut falls between two dates when it can**: of the two middles, the one between different days, so two siblings share a day only when the day itself holds more than one half.
- **A Digest goes into the last Period starting on or before its date**, else the first; between two Digests of one day, the `youtube_id` decides. Out-of-order inserts end in date order (`test_digests_filed_out_of_order_end_in_date_order`).
- **A Digest without a date has no place**, so `wikipol file` refuses it. For Ulysse and WIK-6: DEC-6's 150 PaduTeam Raws without `published` give Digests without one (DEC-11), and they can't be filed until a date reaches them (the Fetcher's metadata, DEC-9).
- **A Digest filed again on the same date replaces itself in place**, so a Digest rewritten after a `digest_version` bump keeps its place; on another date it is refused, since moving it would mean removing it from its old Period, which the split rules don't cover.

### DEC-15 A Period's names: `N-<first date>/`, a date-range title, and the Chronicle as the root Period

WIK-5. The ticket said a Period's title is its date range; the rest was open.

- **The folder is `N-<first date>`**, such as `2-2026-01-05/`, not the range: the newest Period's last date changes with every Digest, and a folder named by it would move, with every link into it, every day. Its first date changes only on a split or an older Digest filed at its head.
- **The title is the range**, `2026-01-05 → 2026-01-07`, or one date when every Digest is of the same day, in ISO like the Digests' `published`.
- **A Digest is `N-<slug>.md`**, the slug the first six words of its title, lowercase ASCII, accents dropped, every other sign a `-`; the `youtube_id` when the title leaves nothing. Children are numbered by date, so filing an older Digest renumbers the ones after it.
- **The Chronicle is the root Period**: it holds up to six Digests or Periods like any other, and `write-period` rewrites its Preview and Body whenever a filing touches it, which is every filing. It keeps its own title, `Chronicle`. The two Chronicles' hand-written text ("Vide pour l'instant") goes at the first filing, replaced by a summary of everything filed: for Ulysse, if the Chronicle should rather keep a fixed text and only list its Periods.
- **Python writes a Period's frontmatter, title and `## Contenu`**, the list of its children with a wikilink each (a Period's as `<folder>/CLAUDE`, the repo's way to link a node); the skill writes only the Preview and the summary above it. A Period's file reads back by splitting at `## Contenu`.

### DEC-16 `wikipol file` files, summarizes, then writes, and follows every move across the repo

WIK-5. `wikipol file --source <slug> <Digest files>` reads the Chronicle into a tree, files the Digests, numbers everything again and works out what moved, in memory. Then `write-period` summarizes every touched Period, deepest first, and only then is anything written: the Chronicle's files, the `parent` of every moved file, and the wikilinks that named a moved Digest or Period. A summary refused twice leaves the disk as it was, like a Digest refused twice.

- **Touched** is every Period whose children changed: those above the new Digest and those a split created. A Period that only moved (renumbered, or one level down after the Chronicle split) keeps its summary; its file is written again only for its new `parent` and links.
- **Links are followed in every Markdown file of the repo**, outside dot folders, `node_modules/` and `Legacy/`: later hexframes will cite Digests from anywhere, and the frozen vaults link none. Only links that named a moved path change, so a file elsewhere is untouched unless it cites a Digest.
- **The Digest files given stay where they are**: filing copies them, and one already inside the Chronicle is refused, since the tree would read it twice.
- **`claude -p` moved to `wikipol/claude.py`** with the draft splitter and the retry prompt, now shared by `write-digest` and `write-period`; `wikipol digest` is unchanged.

### DEC-17 `write-period` reads only its children's titles and Previews; it has not run on the model yet

WIK-5. `Skills/write-period/SKILL.md` sits beside `write-digest`, under wikipol's `Skills/` (where WIK-4 put its skill, outside the frozen root `.skills/`). It gets the Source's editorial `CLAUDE.md`, the Period's range and size, and each child's link, title, date and Preview, never a Raw or a Digest's body: a Period is a summary of summaries, and its cost stays flat however long its Digests are. It returns a Preview (350 characters at most) and one to three paragraphs; the checker refuses a heading, a block quote, a link to anything but a child, and words in « » that no child's title or Preview holds, the rule of DEC-12 carried one level up. It runs on `claude.default_model`, like `write-digest`.

The ticket named no sample for `claude -p`, so the run never called it: `write-period` is tested on a fake writer only, and WIK-4's five sample Digests (DEC-13) are not filed, since filing them means summarizing their Periods. For Ulysse and WIK-6: its run on 20 PaduTeam Raws is the skill's first real run; read the Periods it writes before the backfill.

### DEC-18 `wikipol backfill`: oldest first, filed six at a time, resumed from a staging folder outside the repo

WIK-6. The ticket asked for `backfill --source <slug> [--limit N]`, resumable and idempotent, digesting the Raws without a Digest at the current `digest_version` and `model`, filing them and re-summarizing the Periods they touch. Where it left room:

- **What needs a Digest is read from the Chronicle**, not from a state file: a Raw whose Digest is in the Chronicle at `DIGEST_VERSION` and the model pinned in `source.yaml` is done. A run over a finished backfill asks the model nothing and writes nothing. A Digest at an older version or by another model is written again and, filed on the same date, replaces itself in place (DEC-14).
- **Oldest first, by the date the Digest will carry**: the Raw's `published`, else its legacy note's `date`, the rule of DEC-11, the youtube_id breaking ties as in the tree. Appending in date order is the case the splits of DEC-14 were balanced for, and it is what the ticket's "20 oldest" asks.
- **Filed six at a time.** Filing one Digest at a time would summarize its whole branch (three or four Periods) per Digest; filing everything at the end would leave nothing in the Chronicle until the last Raw, and no Digest could cite an earlier one. A batch of six is filed, its Periods summarized and the Chronicle written before the next batch is digested, whose Digests may then cite the batch before.
- **Resumed from a staging folder outside the repo**, `~/.cache/wikipol/backfill/<slug>/` (`--staging` for another): a Digest lands there once checked and leaves once filed. A stopped run (a crash, a summary refused twice, Ctrl-C) leaves its unfiled Digests there, and the next run checks each one again, against its Raw and the Chronicle as it is then, and files it without a second call to the model; one that no longer checks is dropped and written again. The folder is in the user's cache, not in the repo, so nothing of a half-done run can be committed, and not in a clone's `.git`, so the backfill and the daily runner (WIK-9) of two clones share it; every staged Digest is checked before it is filed, so one written in another clone is filed only if it still holds.
- **Skipped, and listed by the report**: a Raw without a date (DEC-14 gives it no place, so no model call is spent on it), and a Raw without usable captions, fewer than five spoken words once bracketed annotations (`[Musique]`) are dropped, five being the shortest quote an Extract may hold (DEC-12). The dry run of 2026-10-31 found 139 PaduTeam Raws without a date (the 150 of DEC-6 less 11 dated by their legacy note) and none without usable captions.
- **A failure** is a Digest refused twice or a `claude -p` that gives no draft. Its last draft stays in `rejected/` of the staging folder; three in a row stop the run, as in `wikipol fetch`. A Raw that fails is tried again on the next run: for Ulysse and WIK-9, three Raws that always fail, next to each other in date order, would stop every run at the same place, and the report names them. A summary refused twice stops the run with the Chronicle unchanged, the batch kept in staging.
- **`--limit N` counts the Raws handed to the model**, failures included, as `wikipol fetch` counts videos tried (DEC-9); Digests taken back from staging cost no call and don't count. `write-period`'s calls are not capped by it: they are part of filing what the limit let through.
- **`video_notes`** reads a vault's `Videos/` notes once for the whole Source, where `find_video_note` reads them all for one id, which over 600 Raws would read the vault 600 times.

### DEC-19 The first backfill: PaduTeam's 20 oldest Raws, filed in five Periods, `write-period`'s first run; for Ulysse to review on WIK-12

WIK-6, 2026-10-31, `wikipol backfill --source paduteam --limit 20` on `claude-sonnet-5-5`, about 15 minutes for 35 model calls. Of the 607 PaduTeam Raws in the bucket, 139 have no date and 468 can be digested; the 20 oldest were written (16 on the first draft, 4 on the second), filed in four batches, and `wikipol check-digest` passes all 20 against the bucket. Nothing failed, nothing was left in staging. A dry run afterwards reads the 20 as up to date and lists 448 to go. The Chronicle now holds five Periods of four Digests each, from `1-2019-09-12/` to `5-2024-03-28/`: the first batch filled the Chronicle to six, the second split it as DEC-14 says.

- **`write-period` ran for the first time (DEC-17)**: 11 summaries over the four filings, every one accepted, none refused twice. They read as a thesis and a few dated threads, with links to the child Periods where the Chronicle names them. For Ulysse: whether the Chronicle's summary of everything filed reads right at five Periods, and whether it still will at a hundred, is the question DEC-15 left you.
- **No Digest cites another.** The fourteen written after the first filing were given the Digests already filed, and none linked one. Whether that is the skill or these twenty videos shows only at scale.
- **Many legacy dates are placeholders.** The 20 Raws copied from Drive carry the date of their legacy note (DEC-6), and six of the twenty are on the first of a month (`2021-01-01`, `2022-10-01`, `2024-01-01`, `2024-02-01`, twice `2024-03-01`); 50 of the vault's 480 `Videos/` notes are, about three times what chance gives. So the order of the old Digests, and the first Period's `2019-09-12 → 2024-01-01`, is only as good as those notes. For Ulysse: YouTube's `upload_date`, which the Fetcher reads (DEC-9), would correct them, and a Digest refiled on another date is refused (DEC-14), so a correction means moving the Digest by hand or rewriting it after its date is fixed.
- **The full backfill is WIK-12's**: the 448 left, about 780 more model calls with the retries and the summaries, at this run's pace about five hours, resumable at any point. The 139 Raws without a date wait for one.
