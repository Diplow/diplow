---
title: cubic agents
parent: 4-software-engineering/1-projects/1-hexframe/.cubic
owner: diplo
preview: >-
  The briefs of cubic's three custom agents on hexframe pull requests:
  maintainability, domain design, security. Each is a condensed copy of the
  skill or bar it comes from, kept under cubic's 10,000-character limit, and
  wired in by cubic.yaml at the repo root.
---
# cubic agents

An inner child of hexframe: how its pull requests are reviewed. `cubic.yaml` at the repo root points one custom agent at each brief here, scoped to `4-software-engineering/1-projects/1-hexframe/**`.

| Agent | Brief | Condensed from |
|---|---|---|
| Maintainability | [[4-software-engineering/1-projects/1-hexframe/.cubic/maintainability\|maintainability]] | [[.skills/2-review/maintainability-review/references/tags\|the maintainability bar]] |
| Domain design | [[4-software-engineering/1-projects/1-hexframe/.cubic/domain-design\|domain-design]] | [[.skills/2-review/domain-design/SKILL\|domain-design]], review mode, with hexframe's layers and domains |
| Security | [[4-software-engineering/1-projects/1-hexframe/.cubic/security\|security]] | The security bar in [[4-software-engineering/1-projects/1-hexframe/STACK\|STACK]] |

## Rules

- **cubic reads only the first 10,000 characters of an agent**, frontmatter included, and drops the rest without a word. `cubic.yaml` gives each agent its brief and no inline description, so a brief's length is its agent's length, and the hexframe workflow fails a brief over the limit. The skills themselves are longer, which is why these briefs exist.
- **A brief follows its source.** When the skill or the bar changes, the brief changes in the same commit. Each brief ends by naming its source.
- **cubic reads `cubic.yaml` from `main` only, and the briefs from the pull request's head.** An edit to a brief is live on its own PR; a new agent in `cubic.yaml` only fires on PRs opened after it lands.
