"""The search index: each Raw of the bucket as a Publication and as embedded chunks, in a
Serverless SQL database with pgvector.

`chunks` cuts a Raw into chunks of about two minutes, `embed` turns them into vectors through
Scaleway's Generative APIs, `store` writes them to the database, whose schema is `migrations/`,
and `run` indexes a Source's Raws, the new ones only.
"""
