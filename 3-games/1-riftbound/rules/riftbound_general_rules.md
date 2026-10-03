
# Riftbound — General Rules (game engine reference)

> **Riftbound** is the *League of Legends* trading card game by Riot Games (published with UVS Games), for 2–4 players. You choose a champion, command an army of units and spells, and battle to control battlefields and score points.

This is a working reference written from Riot's **Official Rules Documents (ORD)** and judge-level rulings. It is **not** a verbatim copy of the rulebook — for the authoritative wording, always use the official PDFs linked below.

This file covers the **game engine** (zones, resources, turn structure, combat, scoring) — content that doesn't change with the date. Anything **date-dependent** (legal sets, rotation, ban list, format-specific construction) lives in `scripts/riftbound_format_generator.py`, which is the single source of truth for that.

---

## Official Source Documents (always check these for the latest)

| Document | What it covers | Link |
|---|---|---|
| **Core Rules (CR)** | Deckbuilding, timing, resolution, layering, full game flow | [Rules Hub PDF](https://playriftbound.com/en-us/rules-hub/) |
| **Tournament Rules (TR)** | Event procedures, formats, penalties, sideboarding | [Rules Hub PDF](https://playriftbound.com/en-us/rules-hub/) |
| **Rules Hub** (landing page) | Both PDFs + ban list + patch notes + errata | https://playriftbound.com/en-us/rules-hub/ |
| **How to Play** (beginner) | Quick-start guide | [playriftbound.com](https://playriftbound.com/en-us/news/rules-and-releases/how-to-play-get-started/) |
| **Core Rules Patch Notes** | Plain-language summary of major rule changes | [Patch Notes](https://playriftbound.com/en-us/news/rules-and-releases/riftbound-core-rules-patch-notes/) |

> For **legal sets, rotation, and ban list at a given date**, run `scripts/riftbound_format_generator.py --format <fmt> --date <iso>`. Do not duplicate that data here.

---

## 1. What You Bring to a Game

Each player brings:

- **1 Legend** — your leader and deck identity. Defines your **Domain Identity** (your color/colors). In *Origins*, all Legends have two domains. The Legend lives in the **Legend Zone** all game; it never enters play and can't be targeted unless a card explicitly says so.
- **1 Champion Unit** — starts in the **Champion Zone**; you can pay its cost to bring it into play later. (A Champion Unit must share its tag with your Legend. Signature cards are *not* Champion Units.)
- **1 Main Deck** — Units, Spells, Gear, and Signatures. Size is format-specific.
- **1 Rune Deck** — a separate side deck used to generate resources.
- **3 Battlefields** — each player brings three, but only one is chosen for the game.
  - **Best-of-1 (Duel):** randomly select one.
  - **Best-of-3 (Match):** players actively choose; no battlefield may be reused within a match.

---

## 2. Deckbuilding Legality (Constructed)

- All cards must fit your Legend's **Domain Identity** (its two rune colors). No off-color cards or runes.
- **Signature cards** must share a **Champion Tag** with your Legend, and are limited to **3 total per matching Champion Tag** — not 3 per card name (e.g., 2× Fox-Fire + 1× another Ahri signature = legal; 4 total = illegal).

*(CR 103.2–103.3 deckbuilding/legality; CR 169.1 Legend defines Domain Identity.)*

> Main Deck size, Rune Deck size, per-card copy limits, sideboard structure, and the **current ban list** depend on the format and date — see `scripts/riftbound_format_generator.py`.

---

## 3. The Zones

**Board zones** (cards here are visible and can affect the game directly): **Base**, **Battlefields**.

**Non-board zones:** Hand, Main Deck, Rune Deck, Legend Zone, Champion Zone, Trash, Banishment.

| Zone | Purpose |
|---|---|
| **Hand** | Your private cards; not in play until played. |
| **Main Deck** | Main library; drawn from and Recycled into. |
| **Rune Deck** | Runes; channeled each turn for resources. |
| **Legend Zone** | Holds your Legend all game; defines Domain Identity. |
| **Champion Zone** | Holds your chosen Champion Unit at start. |
| **Base** | Your side of the board; Units, Gear, and Runes enter here by default. |
| **Battlefield** | Where combat happens; Units move here to conquer or defend. |
| **Trash** | Discard pile (used spells, destroyed cards). |
| **Banishment** | Exile; removed from the game unless an effect retrieves them. |

Most passive/triggered effects function only **while on the Board** unless a card says otherwise. *(CR 130.1–130.9.)*

---

## 4. Resources — Runes, Energy & Power

Card costs are paid in **Energy** and/or **Power**, both generated from your **Runes** and held in your **Rune Pool**.

- **Exhaust** a Rune (turn it sideways) → **+1 Energy** (generic; any rune works). Pays the top-left **Energy cost**.
- **Recycle** a Rune (send it to the bottom of the Rune Deck) → **+1 Power** of that rune's **domain** (color-specific). Pays **Power costs** (shown below the energy cost, e.g. "1 🔴 Fury Recycled").
- The **Rune Pool empties** at the end of the **Draw Phase** and at **End of Turn** — unspent Energy/Power is lost.

You channel **2 new Runes** into your Base each turn (Channel Phase).

> ⚠️ **Trap:** a card's **Domain** is deckbuilding legality only. What actually requires matching runes is the **colored pip** on the Power cost / Equip cost — not the card's domain itself. A Chaos-domain card with only generic energy costs runs fine in a 12-Calm rune deck as long as the Legend includes Chaos.

---

## 5. Turn Structure — The Six Phases

Mnemonic for the opening four: **A–B–C–D**.

1. **Awaken** — Ready all your exhausted objects (Runes, Units, Gear). No plays.
2. **Beginning** — Score 1 point for each battlefield you **Hold** uncontested; resolve "start of turn" triggers.
3. **Channel** — Channel 2 Runes from your Rune Deck into your Base (Ready).
4. **Draw** — Draw 1 card; then the Rune Pool empties.
5. **Action** — The main phase: play cards, activate abilities, move units, initiate combat. No fixed action limit.
6. **End of Turn** — Expire all "this turn" effects, clear **Marked Damage**, empty the Rune Pool, pass the turn.

*(CR 514–517.)*

### Phase quick-reference

| Phase | Play cards? | React (triggers/hidden)? | Score? |
|---|---|---|---|
| Awaken | ❌ | ❌ | ❌ |
| Beginning | ❌ | ✅ triggers | ✅ Hold |
| Channel | ❌ | ✅ triggers | ❌ |
| Draw | ❌ | ✅ triggers | ❌ |
| Action | ✅ | ✅ | ✅ via Conquer |
| End of Turn | ❌ | ✅ end triggers | ❌ |

---

## 6. Game Start Sequence

1. Declare your **Legend** → Legend Zone.
2. Declare your **Champion Unit** → Champion Zone.
3. Choose your **Battlefield** from your three (Bo1 random / Bo3 chosen).
4. Shuffle Main Deck and Rune Deck **separately**.
5. Draw **4 cards**.
6. **Mulligan:** set aside up to **2 cards**, draw that many replacements, then **Recycle** the set-aside cards to the **bottom** of your Main Deck. (You do **not** reshuffle.)
7. First player begins with the **Awaken Phase**. (You do *not* channel runes during setup — channeling starts on your first turn.)

**Second-player compensation:** on their first turn, the second player channels **3 Runes** instead of 2.

*(CR 110–118 setup & mulligan; CR 606.2.a channel timing.)*

---

## 7. Playing a Card (5 steps)

1. **Declare** targets, battlefield, and any optional/additional costs.
2. **Calculate** total cost (Energy + Power + additional costs).
3. **Pay** from your Rune Pool (Exhaust for Energy, Recycle for Power).
4. **Verify legality** — if invalid here, the play is reversed.
5. **Resolve** — the card enters play or its effect executes.

**Card text beats the rulebook** when they conflict. *(CR 554–563.)*

---

## 8. Targeting, the Chain & Resolution

**Targeting**

- Targets are chosen **when the card is played**, before costs are paid.
- If **all** targets become invalid before resolution, the instruction does nothing but the card still counts as played. If **some** remain valid, only those are affected.
- Targeting restrictions (e.g., a unit with **Deflect** requiring you to Recycle a rune to target it) must be satisfied at the moment of targeting. *(CR 559.3.)*

**The Chain**

- Playing a card / activating an ability puts it on the **Chain**.
- While a Chain exists, the turn is in a **Closed State** — only **Reaction** cards and **Triggered Abilities** can be added.
- The Chain resolves **Last-In, First-Out (LIFO)**. When it empties, the turn returns to an **Open State**. *(CR 509.1–509.2.)*

**Resolution**

- Units & Gear → enter the board. Spells → resolve, then go to Trash. Triggered abilities → added to the Chain when their condition is met.
- Instructions that can't be followed are skipped; partially-followable ones do as much as possible. *(CR 563.2.c.)*

---

## 9. Turn States & Timing Permissions

**Turn States**

- **Neutral State** — default; normal actions allowed.
- **Showdown State** — begins when a unit enters a contested/uncontrolled battlefield; only **Action** or **Reaction** cards may be played until combat resolves and cleanup completes. *(CR 508.)*

**Timing States**

- **Open State** — no Chain exists; the player with Priority/Focus may act.
- **Closed State** — a Chain exists; only Reactions and Triggered Abilities. *(CR 509.)*

**Permissions**

- **Priority** — permission to take discretionary actions in a Neutral Open State. *(CR 512.1.)*
- **Focus** — the combat-specific version of Priority during a Showdown. *(CR 513.1.)*
- Only one player holds Priority/Focus at a time.

> ⚠️ **Trap:** an activated ability without a `[Reaction]` or `[Action]` tag defaults to **Neutral speed** — usable only on your own turn, outside Showdowns and Chains. It is NOT a combat trick. For in-combat pumps, you need `[Reaction]` spells (e.g. Discipline, Feral Strength, Defiant Dance) or Quick-Draw equipment.

---

## 10. Combat & Showdowns

Combat isn't a separate phase — it happens **within the Action Phase**.

- A **Showdown** triggers when a unit enters a **contested or uncontrolled** battlefield. The entering player gains **Focus**; players may respond with **Reactions**.
- **Combat** occurs only if **both players have units present** after the Showdown.
- Units use their **Might** (combat strength), modified by keywords/abilities/effects.
- A unit taking **Lethal Damage** (damage ≥ its current Might) is destroyed → Trash.
- **Marked Damage clears at the end of combat** and at end of turn (not during interim cleanups). *(CR 516.4, 627.5, 517.2.a.)*
- Winning combat lets you **Conquer** the battlefield.
- **Combat ties** where both sides retain units → attacker **recall**.

**Cleanup windows** run automatically after a Chain, Move, Showdown, or Combat. They check: marked damage (destroy lethal units), battlefield control, expiring "while/as long as" effects, and removing Hidden cards with no friendly unit present. No player may act during cleanup. *(CR 519–526.)*

> ⚠️ **Trap:** **Recall ≠ Move.** Official text: "Send it to base. This isn't a move." Recall does NOT trigger "when I move" abilities. Only effects that explicitly say *Move* (e.g. The Syren) do.

---

## 11. Scoring & Winning

**Victory Score = 8 points** (11 in a team game). Reaching it wins immediately, subject to the Final Point rule below. *(CR 633, 644.3.)*

**Ways to score:**

- **Conquer** a battlefield → **1 point** (once per turn per battlefield, when you control it after combat).
- **Hold** a battlefield → **1 point** at the start of your turn if you still control one you previously conquered.
- **Burn Out** your opponent → **1 point** if they must draw from an empty Main Deck. *(CR 607.1.)*
- **Card effects** → some cards grant points.

**Final Point rule (how the 8th point lands):**

- **By Hold** → win instantly.
- **By Conquer** → you must have scored **both** battlefields that turn to win; otherwise you draw a card instead of gaining the point.
- **By card effect** → win instantly.

**Victory Score modifiers:** some battlefields (e.g., *Aspirant's Climb*) raise the Victory Score by 1, making the final point the 9th — all Final Point rules still apply.

---

## 12. Key Terms (quick glossary)

- **Exhaust** — turn a card sideways (e.g., a rune for Energy, or a tapped ability cost).
- **Recycle** — return a card/rune to the **bottom** of its own deck (not the Trash).
- **Channel** — draw runes from the Rune Deck into your Base, Ready, at the start of your turn.
- **Might** — a unit's combat strength.
- **Marked Damage** — damage tracked on a unit; clears end of combat / end of turn.
- **Domain** — a card's color/faction; your Legend sets your Domain Identity.
- **Action / Reaction** — keywords that widen *when* you can play a card (Action = own turn timing windows; Reaction = even during Closed States / opponents' turns).
- **Triggered Ability** — fires automatically on a condition ("When…/At…"); always uses the Chain.
- **Signature** — a card tied to a specific champion tag; must match your Legend.
- **Showdown / Conquer / Hold** — the core battlefield-control loop that drives scoring.

For interaction-level keywords (Shield, Tank, Deflect, Hunt, Deathknell, Equip, Quick-Draw, Hidden, etc.) see `riftbound_keywords.md`.

---

*Riftbound is a trademark of Riot Games. This reference is a paraphrased study aid, not an official document. For binding rulings, use the Core Rules and Tournament Rules PDFs on the [official Rules Hub](https://playriftbound.com/en-us/rules-hub/).*
