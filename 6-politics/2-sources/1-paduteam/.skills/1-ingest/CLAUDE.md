---
title: ingest
parent: 6-politics/2-sources/1-paduteam/.skills/1-ingest
owner: diplo
preview: >-
  PaduTeam's ingestion skills: gather-context maps what the vault knows on a
  subject, ingest-video and ingest-batch drive the write-* skills over one
  transcript or a batch. Written for the frozen Graphiked vault.
---
# ingest

| Skill | Does |
|---|---|
| `gather-context` | Maps what the vault already knows about a subject, ahead of every `write-*` |
| `ingest-video` | Ingests one transcript: `gather-context`, then the `write-*` skills, then git |
| `ingest-batch` | Ingests a batch of related transcripts, one subagent per video, then consolidates the Enjeux |
