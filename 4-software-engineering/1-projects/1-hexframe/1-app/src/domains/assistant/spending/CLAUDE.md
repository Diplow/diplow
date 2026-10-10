---
title: spending
parent: 4-software-engineering/1-projects/1-hexframe/1-app/src/domains/assistant/spending
owner: diplo
preview: >-
  What a Turn spends on the model, pure: the model call the proxy lets
  through, decoded by a strict schema built on the settings, and the prices,
  the reservation, the charge and the two limits a call is held under, a
  Turn's ceiling and the month's allowance, and when a call waits.
---
# spending

A sub-model of [[4-software-engineering/1-projects/1-hexframe/1-app/src/domains/assistant/CLAUDE|Assistant]]: what a Turn's agent may ask the model, and what it costs. Pure functions over the settings (`../settings.ts`); the application service, `../assistant.ts`, runs them on what the Turns repository holds (`admitCall`, `relayCall`, `settleCall`). Not part of Assistant's door: the front never reads it.

| File | Holds |
|---|---|
| `call.ts` | `allowedCall`: a call's body and the headers Anthropic reads, as the proxy lets them through, or why not. The body is decoded by a schema whose fields are the settings' (`model.fields`, each given its shape), with `onExcessProperty: 'error'`; a version that is no date and a beta the settings don't name are refused; `max_tokens` is capped and a thinking budget kept below it |
| `limits.ts` | `reserved`, what a call reserves before it goes, its body's length as input at the dearest input price and its `max_tokens` as output; `charged`, what it used at its model's price, an answer cut short charged the output it may have answered, one Anthropic refused nothing; `monthOf`; `limitReached`, the ceiling, then the allowance, on what was spent; `mustWait`, whether a call waits for the calls under way |
| `spending.test.ts` | Calls shaped as Claude Code sends them, let through or refused; prices, reservations, an answer cut short; both limits and the wait at their boundaries; the month's first instant |

## Rules

- **The settings name, the schema shapes.** A field, a model or a beta the settings don't name is refused, and the compiler refuses a field named without a shape. A limit is read from the settings, never written here.
- **Anthropic's words, on purpose.** The call is relayed unchanged, so the rule on it speaks the wire's vocabulary (`hexframe-app-assistant/decisions.md#DEC-12`).
- **A call is charged once its answer ended**: what it used, or the most it may have cost when it was cut short, never less than what it said it used.
