---
title: Writing tone
parent: .skills
owner: diplo
preview: >-
  The voice for every skill here and everything a skill publishes: tickets, PR
  bodies and comments, reports. A four-step rewrite, how to add soul, 31
  patterns to detect and fix, and the few exceptions where a character carries
  meaning. Adapted from lauren's unslop skill.
---
# Writing tone

The tone reference for every skill in `.skills/`. If the voice changes, fix it here, not in each skill.

## What it governs

Two kinds of text:

1. **What a skill publishes.** Linear tickets and comments, PR bodies and comments, committed reports, terminal reports a human will read or paste.
2. **The skills themselves.** `SKILL.md` prose and `references/` files.

A skill that writes outward text points here rather than restating the rules. `skill-reviewer` grades both halves: criterion **H4** covers the mechanical tells, **J7** the voice and vocabulary.

This is about voice, not language. A skill writes each artifact in its destination's language; the rules apply either way.

## Where it comes from

The steps below, "Adding soul" and the 31 patterns are adapted, closely and in places verbatim, from the [`unslop` skill](https://github.com/cursor/plugins/blob/60c641e4fad674784b30abcf9f8915dea39df38d/pstack/skills/unslop/SKILL.md) by [lauren (@poteto)](https://github.com/poteto) in `cursor/plugins`. The scope and the exceptions are mine.

## How to use it

1. Scan for the patterns below.
2. Rewrite. Preserve meaning, match the intended tone.
3. Add soul (next section).
4. Self-audit: "what makes this obviously AI generated?" Fix what is left.

## Adding soul

Removing patterns is half the job. Sterile, voiceless writing is just as
obvious.

- **Have opinions.** React to facts instead of neutrally listing pros and cons.
- **Vary rhythm.** Short sentences. Then longer ones that take their time. Mix it up.
- **Acknowledge complexity.** "Impressive but also kind of unsettling" beats "impressive."
- **Use "I" when it fits.** First person isn't unprofessional.
- **Let some mess in.** Perfect structure looks machine-made.
- **Be specific.** Not "this is concerning" but "there's something unsettling about agents churning away at 3am."

## Patterns to detect and fix

### Content

1. **Puffery.** "pivotal moment", "testament to", "evolving landscape", "setting the stage for", "indelible mark", "deeply rooted". Cut puffery, state what happened.
2. **Name-dropping.** Listing media outlets without context. Pick one, say what was said.
3. **Superficial -ing phrases.** "highlighting...", "ensuring...", "reflecting...", "showcasing...", "fostering...". Delete or expand with real sources.
4. **Promotional language.** "nestled", "vibrant", "breathtaking", "groundbreaking", "renowned", "stunning", "must-visit". Use neutral descriptions.
5. **Vague attributions.** "Experts believe", "Industry reports suggest", "Some critics argue". Name the source or delete.
6. **Formulaic challenges.** "Despite challenges... continues to thrive." Replace with specific facts.

### Language

7. **AI vocabulary.** Additionally, crucial, delve, enduring, enhance, fostering, garner, interplay, intricate, landscape (abstract), pivotal, showcase, tapestry (abstract), testament, underscore, vibrant. Replace with plain words.
8. **Fancy ways to say "is".** "serves as", "stands as", "boasts", "features". Just say "is" or "has".
9. **"Not just X, but Y."** State the point directly instead.
10. **Rule of three.** Forcing ideas into groups of three. Use the natural number.
11. **Synonym cycling.** Protagonist, main character, central figure, hero all in one paragraph. Pick one, repeat it.
12. **False ranges.** "from X to Y" where X and Y aren't on a meaningful scale. List topics directly.

### Style

13. **Em dash overuse.** Avoid em dashes entirely. Use periods or commas only (no parentheses, no en dashes, no hyphen-as-dash substitutes). Em dashes are an AI tell, and reaching for parentheses instead just trades one tell for another. If a thought needs separation, end the sentence or use a comma.
14. **Colon overuse.** Colons are fine before a list or example. Not as mid-sentence connectors. "If you're coming from traditional automation: instead of registering event handlers, you describe conditions" adds nothing with the colon. Rewrite to let the point stand on its own without comparison framing. "Describing when the scheduler should fire works best as plain English." Same meaning, no crutch punctuation.
15. **Boldface overuse.** Don't bold every proper noun or acronym.
16. **Inline-header lists.** The tell is a bold label and colon that restates the line: "**Performance:** Performance improved...". Convert those to prose. A bold lead-in that ends in a period, names the item, and is followed by genuinely new detail ("**Schema in TypeScript.** Tables live in one file.") is fine, not a tell.
17. **Title case headings.** Use sentence case.
18. **Decorative emojis.** Remove from headings and bullets.
19. **Curly quotes.** Replace with straight quotes.

### Communication artifacts

20. **Chatbot phrases.** "I hope this helps!", "Let me know if...", "Of course!", "Certainly!", "Found the smoking gun!" Remove.
21. **Cutoff disclaimers.** "While specific details are limited..." Find sources or remove.
22. **Sycophantic tone.** "Great question! You're absolutely right!" Respond directly.

### Filler

23. **Filler phrases.** "In order to" becomes "To". "Due to the fact that" becomes "Because". "It is important to note that" gets deleted.
24. **Excessive hedging.** "could potentially possibly be argued that it might" becomes "may".
25. **Generic conclusions.** "The future looks bright." State specific plans or facts.

### Jargon

26. **Abstract metaphor nouns.** Substrate, wedge, vector, locus, vantage, nexus, primitive (as noun), harness (as metaphor), surface (as in "API surface"), bedrock, scaffolding (as metaphor), modality, paradigm, gold-plating, ratchet (as metaphor), evacuate (for moving code), endgame, north star, flywheel. These read as technical but usually have a plainer concrete word. "Substrate" becomes "base". "Wedge in" becomes "add". "Vector" becomes "way" or "method". "Gold-plating" becomes "more than the job needs". "Ratchet" becomes the mechanism's real name or "a limit that only tightens". "Evacuate" becomes "move out". "Endgame" becomes "the last phase". Pick the concrete word.

### Plain speech

27. **Say what it does, not how it feels.** "the database stays close at hand", "SQL you can read", "types that follow your schema" name a feeling. The fix names the mechanism or a number: "`.toSQL()` returns the exact string sent to the database", "a column rename fails the build". Ask what the sentence tells the reader to do or know, then write that. If you can't restate it as a concrete instruction, fact, or number, cut it. One more check: if the sentence could appear unchanged in another project's docs, it says nothing about this one. Cut it.
28. **Shorten or split dense sentences.** If the reader has to backtrack to parse a sentence, break it in two or drop clauses. One idea per sentence.
29. **Active voice.** Prefer it. Catch "is/are/was/were + past participle" and name the actor: "queries are validated" becomes "the compiler validates queries", "the file is parsed by the loader" becomes "the loader parses the file". Passive is fine only when the actor is unknown or genuinely doesn't matter.
30. **Cut adverbs, or use a stronger verb.** "runs quickly" becomes "is fast" or the number. "significantly improves" becomes the measured delta. An adverb propping up a weak verb means the verb is wrong.
31. **Prefer the plain word.** "utilize" becomes "use", "leverage" becomes "use", "facilitate" becomes "help", "numerous" becomes "many", "in the event that" becomes "if". The fancier synonym is rarely clearer.

## Exceptions

Three carve-outs, each because the general rule would fire on something that carries meaning. Frontmatter `description` fields, output templates and report skeletons are not on this list: they are ordinary prose and follow every rule.

**"harness" and "surface" stay** (rule 26). A harness is a concrete thing here, the runtime executing a skill (Claude Code, Codex), and criterion J6 is named after it. "Surface" as in the code a change touches is equally load-bearing in review skills. The rest of rule 26 applies as written.

**Emoji that carry meaning stay** (rule 18). The 🔴 / 🟡 / ✅ severity markers in a review report are data, not decoration. Rule 18 targets emoji added for warmth.

**A string something else must match stays** (rule 13, and any rule that would edit a literal). Some text is a key, not prose:

- **Strings a skill greps for**, such as a marker a later run searches for in a previous report.
- **Strings a test asserts on**, such as product UI copy quoted byte for byte.
- **Code.** Shell, TypeScript, JSON and their comments inside fenced blocks.

The test is whether changing the character breaks a match. If nothing compares the string to anything, it is prose, and the rules apply.
