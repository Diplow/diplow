---
title: The Raw agent's brief
parent: .skills/6-politics/1-wikipol/ingest-source
owner: diplo
preview: >-
  What the agent at the bottom of an ingest-source run does: have wikipol digest
  write one Raw's Digest into staging, read it as a reader would, record one
  result line with a flag when a claim is wrong, and answer that line only.
---
# The Raw agent's brief

You write one wikipol Digest, for the Raw your prompt names: `SOURCE`, `YOUTUBE_ID` and `SKILL_DIR`. You edit nothing: not the Digest, not the repo. The scripts are in `SKILL_DIR/scripts/`.

1. Run `SKILL_DIR/scripts/digest.sh SOURCE YOUTUBE_ID` with a 600000 ms timeout. It reads the Raw from the bucket, has `claude -p` write the Digest with wikipol's `write-digest` skill, checks it (the format, the Preview, every Extract found in the Raw at the second its link names) and writes it to the Source's staging folder, whose path it prints. A draft the checker refuses goes back to the model once.
2. Read the exit code.
   - 0, the Digest is staged. Go to step 3.
   - 1, the checker refused it twice. Record `failed` (step 4) with the first problem it printed as the note. A third try would cost two more calls for the same refusal.
   - 2 or a timeout, it could not run: the bucket, the network, a `claude -p` that gave no answer. Run it once more. A second time, record `failed` with the last line of its output as the note, word for word: the level above reads it to tell a usage limit from a bad Raw.
3. Read the staged file the way someone who has not seen the video would.
   - Does the Preview state a thesis, something the Source argues, and not only the subject?
   - Are the claims distinct from one another, and in French?
   - Do the mentions look sane: canonical names, nobody the Digest doesn't speak of?
   - Take one or two claims and read their Extracts: do the quoted words back the claim?

   A **flag** is a problem that makes the Digest say something false or leaves it broken: a claim its Extract contradicts or does not support, a claim attributed to the wrong speaker, a canonical name misspelled (`Sébastien Le Cornu` for Lecornu), a claim with neither a development nor an Extract. A weak Preview or two claims that overlap go in the note, not in the flag.
4. Record the outcome with `SKILL_DIR/scripts/result.sh SOURCE YOUTUBE_ID <ok|failed> <published> <claims> <flag> <note>`, seven arguments, `-` for one that has nothing:
   - `published` and `claims`: the Digest's `published` date and its number of `## n.` claims;
   - `flag`: the problem of step 3 in ten words at most, naming the claim (`claim 3: the Extract says the opposite`), or `-`;
   - `note`: one sentence on what you read, or why it failed.
5. Your final answer is the line `result.sh` printed and nothing else. The batch agent reads only that.
