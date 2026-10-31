---
title: decisions, Sources from YouTube
parent: 6-politics/1-projects/1-wikipol/.run/registers/sources-from-youtube
owner: diplo
preview: >-
  The choices the autonomous run made building wikipol's pipeline where a ticket
  left room: the Source nodes and their frozen vaults, how the Raws reached the
  bucket and which stayed on Drive, how the Fetcher picks and paces videos, and
  how a Digest is shared between Python and the write-digest skill, formatted
  and checked.
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
- **`claude -p`** gets the skill as its system prompt (`--system-prompt`), the inputs on stdin, `--model` from `claude.default_model`, no tool (`--tools ""`), no MCP server, no session kept, and an empty temporary folder as its working directory, so neither this repo's `CLAUDE.md` nor its hooks join in. Its JSON answer is refused when `modelUsage` names another model than the pinned one, a check the halting rules called for.
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

WIK-4, for the rule "never a timestamp the Raw doesn't hold, nor a quote that isn't in it". A quote is matched on its words: lowercased, accents normalized, punctuation and apostrophes turned into spaces, since captions punctuate loosely and the model tidies them. The words must follow each other in the Raw, the first one inside the block the link points to; the quote may run on into the next blocks. A cut (`[…]`) fails, as does a changed word. Five words at least, so a quote can't be two common words found anywhere. The link's second must open a block of the Raw, its label must read as that second, and it must fall before the video's `duration` when that is known. The Raw reader takes the three shapes of DEC-8: `m:ss` lines, `**[MM:SS](…&t=N)**` lines (whose `t` it trusts), and none.

### DEC-13 Five sample Digests of PaduTeam, all checked; for Ulysse to review on WIK-12

WIK-4, 2026-10-31, five runs of `wikipol digest` on `claude-sonnet-5-5`, chosen to cover what differs between Raws: `URonNSP0qM0` (a capsule fetched by WIK-3, with its duration, no legacy note), `X0tXWZsjENQ` (a Graphomarxisme lesson, an old `**[MM:SS]**` Raw, with a legacy note), `wsiChBGb6T0` (commentary from a Raw without timestamps), `ADd-wfitfm8` (an eight-minute reaction) and `bfgICs0Y6y0` (a two-hour debate with guests). Four passed the checker on the first draft, `bfgICs0Y6y0` on the second; `wikipol check-digest` passes all five against the bucket. They are pasted in WIK-4's pull request and not committed: filing them in the Chronicle is WIK-5's. For Ulysse: whether the claims restitute PaduTeam faithfully, whether six claims for a two-hour debate is enough, and whether the Preview reads as a thesis, are the review WIK-12 lists.
