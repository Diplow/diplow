---
title: wikipol
parent: .skills/6-politics/1-wikipol
owner: diplo
preview: >-
  The two skills a session runs on wikipol's pipeline: new-source turns a YouTube
  channel into a Source node with a drafted editorial context, ingest-source
  fetches a Source's videos and files one Digest each in its Chronicle. The
  prompts the pipeline itself calls (write-digest, write-period) stay in wikipol's Skills/.
---
# wikipol

Skills a session runs on [[6-politics/1-projects/1-wikipol/CLAUDE|wikipol]], the pipeline that fills [[6-politics/2-sources/CLAUDE|the Sources]]. They drive its commands (`wikipol fetch`, `digest`, `file`, `index`) and write nothing the commands don't check. The words are those of [[6-politics/1-projects/1-wikipol/CONTEXT|wikipol's glossary]]: Source, Raw, Digest, Chronicle, Period.

| Skill | Use it to |
|---|---|
| [[.skills/6-politics/1-wikipol/new-source/SKILL\|new-source]] | Add a YouTube channel as a Source: its node, its config, a drafted editorial context |
| [[.skills/6-politics/1-wikipol/ingest-source/SKILL\|ingest-source]] | Fetch one or several Sources' videos, write a Digest for each, file them in the Chronicles |

A new channel takes both, in that order. A Source that already has its Chronicle takes `ingest-source` alone, which then only brings in the videos published since.

The skills wikipol's own commands call through `claude -p`, `write-digest` and `write-period`, are prompts, not commands: they stay in `6-politics/1-projects/1-wikipol/Skills/`, where the pipeline reads them by path.
