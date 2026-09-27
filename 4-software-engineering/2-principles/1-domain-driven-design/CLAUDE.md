---
title: Domain-driven design
parent: 4-software-engineering/2-principles/1-domain-driven-design
owner: diplo
preview: >-
  Business logic is isolated in domains, each with a strict language that maps
  an understanding of the business in abstract, non-technical terms.
  Repositories take the technical complexity below; the API layer does the
  plumbing and composes domains that ignore each other. Humans own the domains.
---
# Domain-driven design

Business logic is isolated in domains. A domain introduces a strict language that maps one's understanding of the business in an abstract, non-technical way: its words are the concepts of the business, not tables or endpoints.

Each layer has one job:

| Layer | Holds |
|---|---|
| API, above the domains | Plumbing (middlewares, controllers, routers) and the composition of domains |
| Domains | The business logic, in each domain's language |
| Repositories, below the domains | The technical complexity |

Domains ignore each other; only the API layer composes them. That is how the complexity stays under control: a domain can be read and changed without holding any other in mind.

## Who owns what

The humans maintaining a system focus on owning the domains and the [[4-software-engineering/2-principles/CLAUDE|principles]]. A domain's language is also where precise types come from: see [[4-software-engineering/2-principles/3-feedback/CLAUDE|Feedback]].
