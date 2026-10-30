---
title: Raws and their search live on Scaleway
parent: 6-politics/1-projects/1-wikipol/docs/adr
owner: diplo
preview: >-
  Raws go to Scaleway Object Storage, and their search to a Scaleway Serverless
  SQL database with pgvector, embedded by a Scaleway-hosted multilingual model,
  for sovereignty at a near-zero cost; Neon, already running hexframe, was
  rejected for sitting on AWS.
status: accepted
---
# Raws and their search live on Scaleway

Raws are kept in Scaleway Object Storage, and searched through a Scaleway Serverless SQL database (PostgreSQL with pgvector) holding Publications, timestamped chunks of their Raws and the chunks' embeddings, made by a multilingual model of Scaleway's Generative APIs. A European provider is the point, and at this size it costs next to nothing: the database scales to zero, and embedding the whole corpus once costs about a euro. Neon, which already runs hexframe's databases, was rejected because it runs on AWS; Google Drive, where the Raws lived until now, because it can't search them by meaning, nor by the publication dates written inside them, only by its own file dates.

Until WIK-2 lands, the Raws stay on Drive and wikipol's `CLAUDE.md` rightly says so: WIK-2 copies them into the bucket and rewrites that section, and from then on the bucket is their only home.
