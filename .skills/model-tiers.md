---
title: Model tiers
parent: .skills
owner: diplo
preview: >-
  Skills name a subagent tier in prose (fetch, work, judge); this file maps each
  tier to a concrete model per harness, so a model change is fixed in one place.
  Never pin a dated model id in a skill.
---
# Model tiers

The mapping behind criterion H1 of `skill-reviewer` (`.skills/3-meta/skill-reviewer/references/criteria.md`). Skills name a **tier** in prose; this file translates it to a model per harness. If a harness adds or renames models, fix it here, not in each skill.

## The tiers

| Tier | Job | Claude Code | Codex |
|---|---|---|---|
| **fetch** | Read and summarize, grep, targeted lookups. No heavy reasoning. Keeps the raw material out of the caller's context. | Haiku (latest) | the current mini tier |
| **work** | Implementation, standard multi-step reasoning. | the session's default model | the session's default model |
| **judge** | Adversarial review, final judgment, architecture decisions. | strongest available (Opus or Fable) | strongest available |

"Latest of the family" is always meant. Never pin a dated model id in a skill.

## Stating the tier in a skill

One line, tier first, the Claude Code model in parentheses when it helps: *"spawn a **fetch-tier** subagent (cheap read and summarize, Haiku on Claude Code)"*. Harness-specific machinery, such as an explicit `model:` parameter in a tool call, states the concrete model for its harness. That is this mapping applied, not a violation.

## When the harness can't pin a model

Some harnesses can't reliably set a subagent's model. Then **still delegate, on the session's default model**. Delegation buys cheaper tokens and context isolation; the isolation survives even when the cost benefit doesn't. Never pull a sweep inline because the cheap model is out of reach.
