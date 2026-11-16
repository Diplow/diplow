---
title: The batch agent's brief
parent: .skills/6-politics/1-wikipol/ingest-source
owner: diplo
preview: >-
  What the middle agent of an ingest-source run does: take up to BATCH Raws of
  one Source from the queue, one Raw agent each, in turn, let next.sh file the
  Digests six at a time, and answer one line: written, failed, filed, how it ended, flags.
---
# The batch agent's brief

You run one batch of Digests for one Source. Your prompt gives `SOURCE`, `BATCH` and `SKILL_DIR`. You are the middle level: a Raw agent writes and reads each Digest, so your context holds one line per Raw and lasts the batch. The scripts are in `SKILL_DIR/scripts/`.

Repeat up to `BATCH` times:

1. Run `SKILL_DIR/scripts/next.sh SOURCE` with a 600000 ms timeout. Once six Digests are staged it files them first: `wikipol file` puts them in the Chronicle, `write-period` summarizes each Period touched, and the result is committed on the current branch. That can take most of the ten minutes. Then it prints one line:
   - a YouTube id: go to step 2;
   - `none`, the queue is done: end the loop;
   - `STOP: …`: end the loop and keep the line for your answer.

   If the call times out, run it again: a filing cut short leaves the Chronicle as it was and the Digests staged.
2. Spawn one Raw agent for that id and wait for it: a **work-tier** subagent (on Claude Code, `subagent_type: general-purpose`, `model: sonnet`, `run_in_background: false`, whatever model you run on: a run spawns one per video, and Sonnet wrote and read the first 3,200 Digests). Its prompt, with the three values filled in:

   `SOURCE=<SOURCE> YOUTUBE_ID=<id> SKILL_DIR=<SKILL_DIR>. Read <SKILL_DIR>/references/raw.md and follow it.`

   Its answer is one tab-separated line: `SOURCE id ok|failed published claims flag note`. Keep the status, and the id with its flag when the flag is not `-`.
3. If the Raw agent stopped without answering that line, record the Raw yourself: `SKILL_DIR/scripts/lost.sh SOURCE <id> "<its last words, or the error>"`. It records `ok`, written and not read, when the Digest is staged all the same, and `failed` otherwise.

After the loop, file what is left with `SKILL_DIR/scripts/file.sh SOURCE` (600000 ms; run it again after a timeout). Then run `SKILL_DIR/scripts/status.sh SOURCE` and take your counts from the commits `next.sh` and `file.sh` reported and from that line, not from memory.

Leave the rest to the root: pushing, the next batch, a Digest that deserves a correction. You edit no file.

Your final answer is one line, 400 characters at most:

`SOURCE: written N, failed M, filed K (commits abc1234 def5678), end: batch done | none | STOP: <why>; flags: <id> (<flag>), …`
