---
title: Maintainability
parent: 4-software-engineering/2-principles/5-maintainability
owner: diplo
preview: >-
  Maintainable code leaves the next reader holding the smallest mental model.
  Three convictions: the smallest model wins, complexity hides at the altitude
  it belongs to, simplicity emerges from names and types and is enforced. Seven
  checks turn them into a review bar.
---
# Maintainability

What is maintainable code? Code whose next reader holds less in their head than its author did.

## Three convictions

1. **The smallest mental model wins.** The fewer things a reader must hold to understand a change, the better.
2. **Complexity hides at the altitude it belongs to.** Real complexity is fine; complexity a reader must hold above where it is needed is the defect.
3. **Simplicity emerges from the code and is enforced.** Names and interfaces carry the model, not prose. An unenforced opinion is one option among the many an agent will pick from next week.

## Seven checks

A change clears the bar when it passes all seven.

| Check | The bar |
|---|---|
| Model | The change can be stated in two sentences, and the code doesn't outgrow them |
| Altitude | A reader at one level (a router, a service, a component) doesn't hold a detail that belongs below it |
| Emergence | Names, signatures and types say what the code means; prose only adds the why |
| Enforcement | A rule about how things are done has something automated that says no when it is broken: a type or a lint first, then a CI check, then a doc |
| Test | A test fails when the behavior changes and passes when the internals are rewritten |
| Lean | Nothing is added for a problem nobody has yet |
| Direction | Every area has a stated direction (a `CLAUDE.md`, an import boundary), and a change that moves it updates it |

Altitude is the deep-module idea of [[4-software-engineering/2-principles/4-mapping-modules/CLAUDE|mapping modules]]; enforcement is how [[4-software-engineering/2-principles/2-ai-first/CLAUDE|AI-first]] principles become the only way rather than one option.

Source: the `maintainability-review` skill, which grades pull requests against these checks.
