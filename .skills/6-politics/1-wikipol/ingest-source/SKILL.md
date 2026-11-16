---
name: ingest-source
description: "Bring one or several wikipol Sources up to date, with nobody watching: fetch the Raws of the videos their bucket lacks, have wikipol write and check one Digest per Raw, file the Digests in each Source's Chronicle with their Periods summarized, commit and push on the working branch, then refresh the search index. The session is the root of three levels: it keeps one batch agent per Source in flight, and each batch agent hands every Raw to an agent of its own. The same command ingests a new Source's whole history and brings in the videos an existing Source published since the last run; stopped, it resumes when run again. Use when someone says \"ingest heureka\", \"load the new videos of blast\", \"continue the ingestion\", \"resume the digest loop\" or \"/politics:wikipol:ingest-source <slug> [<slug> …]\". A channel that is not a Source yet goes through new-source first. It opens no pull request and merges nothing."
argument-hint: "<slug> [<slug> …]"
title: ingest-source
parent: .skills/6-politics/1-wikipol/ingest-source
owner: diplo
preview: >-
  Fetches the videos a Source's bucket lacks, writes one Digest per Raw, files
  them six at a time in its Chronicle, commits, pushes and indexes. Three levels:
  the session, one batch agent per Source, one agent per Raw. Several Sources run
  side by side; a stopped run resumes when the command is run again.
---

# ingest-source. From a channel's videos to its Chronicle

wikipol's commands do the work: `wikipol fetch` stores a video's captions as a Raw, `wikipol digest` has `write-digest` write the Raw's Digest and checks every quote against the Raw, `wikipol file` places Digests in the Chronicle and has `write-period` summarize the Periods they touch. What they do and why is in `6-politics/1-projects/1-wikipol/CLAUDE.md`; the shape of a Digest and of a Chronicle is in its `BUILD.md`. This skill is the loop around them, the one that wrote the first 3,200 Digests.

| Level | Who | Does | Holds in context |
|---|---|---|---|
| 0 | the root, the session that invoked the skill | fetches, builds each Source's queue, keeps one batch agent per Source in flight, pushes, indexes, reports | one line per batch |
| 1 | a batch agent, one per Source at a time | takes up to 24 Raws from the queue, one Raw agent each, in turn; files every six Digests | one line per Raw |
| 2 | a Raw agent | has one Digest written, reads it, records one result line | one Digest |

A Source's history is hundreds of Digests and a run lasts hours. The levels exist so that no context fills up: a root that handled each Raw itself grew by about 1,700 tokens per Digest.

## Invocation

```
/politics:wikipol:ingest-source <slug> [<slug> …]
```

Each `<slug>` is the `source.slug` of a node under `6-politics/2-sources/`. No argument, or a slug no Source declares: print the usage line and the Sources' slugs, and stop. The skill asks nothing after that.

The scripts are in this skill's `scripts/`, called below by name. Resolve the skill's folder to an absolute path once, `SKILL_DIR`: the agents you spawn receive it. Every script finds the repo from its own location, so the working directory doesn't matter.

## 1. Preflight

```bash
INGEST_TRAILER='<the attribution line your session ends its commits with, if it was given one>' \
  scripts/preflight.sh <slug> …
```

It checks `uv`, `git` and `claude`, that the bucket's settings load, that each slug is a Source with a channel and a pinned model, and that the branch is a working branch. It prints one line per Source (its channel, where its Chronicle starts, how many Digests it holds), the branch, and the state folder. Exit 2 names what to fix: relay it and stop.

Three of its answers are yours to act on.

- **On the default branch**, which is an exit 2. Filing commits, and `main` only takes pull requests. Create `wikipol/ingest-<yyyy-mm-dd>` with `git switch -c` and run the preflight again. A Conductor workspace is never on `main` (`.skills/conductor-workspaces.md`), so there the branch is already right: keep it.
- **`warning: gh is not logged in`.** `push.sh` then pushes with git's own credentials, which GitHub may refuse. When a push fails, the commits stay on the local branch and the run goes on: say so in the report, with `gh auth login` as the fix.
- **`warning: the search index will be skipped`.** The database's settings are missing. Skip `index.sh` in step 4 and say in the report that the index was not refreshed, with the setting the warning names.

Print what the preflight printed, so someone reading the transcript later sees what the run believed at launch. Then carry on without waiting.

## 2. Fetch the Raws

For each Source, start `scripts/fetch.sh <slug>` in the background, with the longest timeout the harness gives (7200000 ms on Claude Code): a whole channel of 150 videos takes about forty minutes, at one video every 8 s plus the download. Start them all at once. One lock for the machine makes them run one after the other, whatever session or checkout started them, because YouTube bans an IP that asks faster.

A Source is fetched from its newest video down to `youtube.since` of its `source.yaml`, the whole channel when it has none, and only the videos whose Raw the bucket lacks. So the first run on a new Source takes its history, and a later run takes what was published since.

When a fetch ends, read its exit code and its report's first line, then start that Source's digesting (step 3) without waiting for the other fetches.

| Exit | Means | Do |
|---|---|---|
| 0 | every video in range has its Raw, or has no French captions yet | step 3 |
| 1 | stopped after three failures in a row: YouTube is refusing this machine | step 3 with what the bucket holds, and run `fetch.sh` once more for that Source when its queue is done. If that fetch stores Raws, go through step 3 again for them; if it stops too, say so in the report |
| 2 | it could not start: a setting, the channel's listing | relay the message, drop that Source from the run |
| none, the timeout cut it | the Raws stored so far are kept | run it again: it takes up where it stopped |

## 3. Digest and file, one batch at a time

`scripts/queue.sh <slug>` starts a Source's run: it lists the Raws that have no up-to-date Digest in this checkout's Chronicle, oldest first so a Digest can cite the ones before it, with the Raws that failed in an earlier run last. It prints how many there are. Zero in the queue and zero staged: go to step 4 for that Source. Exit 2 means the Chronicle or the bucket could not be read and the Source has no queue: relay the lines it printed and drop that Source from the run.

Your own calls to `queue.sh`, `file.sh` and `index.sh` take a 600000 ms timeout: a queue lists a whole bucket, a filing summarizes Periods, an index embeds Raws. After a timeout, run the same call again: each one takes up where it stopped.

Then keep **one batch agent in flight per Source**, the Sources side by side. Spawn each in the background as a **work-tier** subagent. On Claude Code that is `subagent_type: general-purpose` with `model: sonnet`, pinned in the call instead of left to the session's model: a batch agent loops over scripts and spawns for an hour, which Sonnet did for the first 3,200 Digests, and a session on a costlier model would pay its price for that. Where the harness can't set a subagent's model, spawn it all the same (`.skills/model-tiers.md`). Its prompt, values filled in:

```
SOURCE=<slug> BATCH=24 SKILL_DIR=<SKILL_DIR>. Read <SKILL_DIR>/references/batch.md and follow it.
```

It answers one line: `<slug>: written N, failed M, filed K (commits …), end: …; flags: …`. That line is a claim. When a batch returns:

1. Run `scripts/status.sh <slug>` and `scripts/push.sh`. Trust the status line over the batch's counts, which have been wrong by two or three before.
2. Act on how the batch ended.

| `end:` | Do |
|---|---|
| `batch done` | spawn the Source's next batch |
| `none` | the queue is done: step 4 for that Source |
| `STOP: 3 failures in a row` | read the notes, the last field of `tail -3 <state>/<slug>/results.tsv`, `<state>` being the folder the preflight printed. Then one of the two rows below |
| … and a note starts with `wikipol:` or says the Raw agent stopped | the run could not work: `claude` failing, timing out or out of usage, a setting, the bucket. No Raw is at fault, so let the batches in flight return, start none, and go to step 5 saying how to resume |
| … and the three notes each name a problem in a Digest | the checker refused three Digests twice. Run `queue.sh <slug>` again, which puts them last, and spawn the next batch; a second `STOP` ends that Source |
| `STOP: filing failed` | run `scripts/file.sh <slug>` yourself and act on its first line, as "When a filing fails" says below |
| `STOP: no queue` | `queue.sh <slug>` did not run or failed: run it, then spawn the batch again |
| no answer, the batch agent died | `status.sh <slug>`, then `queue.sh <slug>` (it keeps the staged Digests and lists again what was claimed and never written) and one more batch. A second death in a row is a usage limit until proven otherwise: go to step 5 |

While a Source's batch is in flight, its staging and its queue belong to that batch. Run `queue.sh` or `file.sh` for a Source only between two of its batches.

### When a filing fails

`file.sh` exits 1 and its first line says which of three things happened.

| First line | Means | Do |
|---|---|---|
| `FILING FAILED` | `wikipol file` refused: a Period's summary rejected twice, a Digest it can't place. The Chronicle is unchanged and the Digests are still staged; the refusal is in the lines that follow | run `file.sh <slug>` once more. A second failure ends that Source: quote the refusal in the report |
| `COMMIT FAILED` | the Digests are in the Chronicle and git refused the commit; git's words are at the end of `<state>/<slug>/file.log` | run `file.sh <slug>` once more: it commits what the last call placed before anything else. A second failure ends the run for every Source, since they share the checkout: quote git in the report |
| `NOT FILED` | the checkout is on the default branch or on no branch: something moved it during the run | start no batch, let those in flight return, and go to step 5. The staged Digests wait for the next run |

A call that prints `filed` or `nothing staged` succeeded: the failure passed, so spawn the Source's next batch.

## 4. Close a Source

When a Source's queue is done:

1. `scripts/file.sh <slug>` files what is still staged. The batch agent does it too; a second call says `nothing staged`. If it exits 1, "When a filing fails" above applies.
2. `scripts/index.sh <slug>` puts its new Raws in the search index and brings the path of every Digest the Chronicle moved up to date. Nothing else refreshes the index on a machine without wikipol's daily runner. A failure here loses nothing: quote its message in the report and go on.
3. `scripts/push.sh`.

The other Sources' batches keep running meanwhile.

## 5. Report

One report when every Source is closed or stopped, in the voice of `.skills/writing-tone.md`. `scripts/status.sh --report <slug> …` prints what it needs, counted from this session's preflight: per Source, the status line (written, failed, staged), `fetch:` (what the last fetch stored and skipped), `at the last queue:` (what the Chronicle still lacked then), `chronicle:` (its size and dates), one `failed:` line per Raw that has no Digest and one `flag:` line per flagged Digest. The filing commits are in `git log`, the index's answer is what `index.sh` printed. Say what is true of each Source:

```
<slug>: <stored> Raws fetched, <written> Digests written and <filed> filed, <failed> failed.
  Chronicle: <n> Digests, <first date> to <last date>. Index: <indexed, or the failure>.
  Stopped: <why, and the command that resumes it>            (only when it did not finish)
Flagged for a reading, <n> Digests:
  <slug> <youtube_id>: <flag>
Not done: <what the run left: Raws without a date or captions, videos without French captions yet, Digests refused twice>
Branch <branch>, pushed at <sha>. No pull request opened.
```

The flags are Digests a Raw agent found wrong after the checker passed them: a claim its Extract does not support, a misspelled name. They are filed as written. Correcting one, or a name in `6-politics/1-projects/1-wikipol/.vocabulaire/noms.yaml`, is the user's call: list them, change none.

## Running it again

Every step reads what is there. The fetch stores only missing Raws, the queue lists only Raws without a Digest in the Chronicle, a staged Digest is filed and not written twice, a commit already made is not made again. So after a stop (a usage limit, a closed laptop, a crash), the same command resumes the run. Raws that failed are tried once more per run, at the end.

## What the run never does

- **Open or merge a pull request, or push the default branch.** When a Chronicle lands on `main` is the user's decision, and a branch of a thousand Digests is theirs to read first.
- **Edit a Digest, a Period or the vocabulary by hand.** Everything in a Chronicle passed `wikipol`'s checks; a hand edit would not have. Problems go in the report.
- **Run two fetches at once, or two ingestions of one Source.** `fetch.sh` enforces the first. The second is yours: one session per Source, as many Sources per session as you like.
- **Touch a Source's staging while its batch runs.**

## Files

| File | Read or run by | Holds |
|---|---|---|
| `references/batch.md` | the batch agent | its loop: `next.sh`, one Raw agent per id, the final line |
| `references/raw.md` | the Raw agent | one Digest: write, read, flag, record |
| `scripts/lib.sh` | every script, and those of `new-source` | the repo, the pipeline, the state folder (`~/.cache/wikipol/ingest/<checkout>/<slug>/`), the locks |
| `scripts/preflight.sh` | the root, and `new-source` | the checks of step 1; where this session's counts start |
| `scripts/fetch.sh` | the root | `wikipol fetch` behind the machine's fetch lock |
| `scripts/queue.sh` | the root | a run's queue for one Source, from `wikipol backfill --dry-run` |
| `scripts/next.sh` | the batch agent | files at six staged Digests, then the next id, `none` or `STOP` |
| `scripts/digest.sh` | the Raw agent, and `new-source` | `wikipol digest` into staging |
| `scripts/result.sh` | the Raw agent | one line of `results.tsv` |
| `scripts/lost.sh` | the batch agent | the result of a Raw whose agent stopped |
| `scripts/file.sh` | `next.sh`, the batch agent, the root | `wikipol file` and its commit, one filing at a time per checkout |
| `scripts/status.sh` | the batch agent, the root | where a run stands; with `--report`, what step 5 needs |
| `scripts/push.sh` | the root, and `new-source` | the push of the working branch |
| `scripts/index.sh` | the root | `wikipol index` for one Source |
