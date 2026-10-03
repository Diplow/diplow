#!/usr/bin/env python3
"""Generate one Obsidian note per card + a Bases gallery file.

Output:
    sets/{SET}/cards/oracle/{Card Name}.md   -- one note per card (frontmatter + big image + text)
    Riftbound Cards.base         -- Obsidian Bases file: filterable table + card gallery

Why notes (not just the PNGs): with a note named exactly like the card, a plain
ctrl+hover on [[Irelia, Fervent]] anywhere in the vault pops the rich preview
(image en grand + stats + texte). The .base file then turns every `sets/*/cards/oracle/`
folder into a gallery you can filter by set / domain / type / cost -- "tout le
set d'un coup".

Filenames use the same ' - ' -> ', ' mapping as the PNGs, so [[Card Name]]
(note) and [[Card Name.png]] (raw image) both resolve.

Usage:
    python scripts/build_card_notes.py                 # all sets
    python scripts/build_card_notes.py --sets OGN
    python scripts/build_card_notes.py --no-base       # notes only
"""
from __future__ import annotations

import argparse
import json
import os
import re

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SETS_DIR = os.path.join(ROOT, "sets")
DEFAULT_SETS = ["OGN", "SFD", "UNL"]
_ILLEGAL = '<>:"/\\|?*'

# Readable rendering of Riftcodex inline shortcodes for the note body.
_RUNE = {"fury": "Fury", "calm": "Calm", "mind": "Mind", "body": "Body",
         "chaos": "Chaos", "order": "Order", "rainbow": "Any"}


def card_filename(name: str) -> str:
    stem = name.replace(" - ", ", ")
    for ch in _ILLEGAL:
        stem = stem.replace(ch, "-")
    return stem.strip()


def humanize(text: str | None) -> str:
    if not text:
        return ""
    def rune(m):
        return "{" + _RUNE.get(m.group(1), m.group(1).title()) + "}"
    text = re.sub(r":rb_rune_([a-z]+):", rune, text)
    text = re.sub(r":rb_energy_(\d+):", lambda m: "{" + m.group(1) + "}", text)
    text = text.replace(":rb_might:", "Might")
    text = text.replace(":rb_exhaust:", "{Exhaust}")
    text = re.sub(r":rb_([a-z0-9_]+):", lambda m: "{" + m.group(1) + "}", text)
    return text.strip()


def yaml_str(s: str) -> str:
    return '"' + s.replace("\\", "\\\\").replace('"', '\\"') + '"'


def yaml_list(items) -> str:
    return "[" + ", ".join(yaml_str(str(i)) for i in items) + "]"


def frontmatter(card: dict, set_id: str, stem: str) -> str:
    cls = card.get("classification") or {}
    attr = card.get("attributes") or {}
    lines = ["---"]
    lines.append(f"name: {yaml_str(card.get('name', stem))}")
    lines.append(f"set: {yaml_str(set_id)}")
    lines.append(f"type: {yaml_str(cls.get('type') or '')}")
    if cls.get("supertype"):
        lines.append(f"supertype: {yaml_str(cls['supertype'])}")
    domain = cls.get("domain") or []
    if domain:
        lines.append(f"domain: {yaml_list(domain)}")
    for key, prop in (("energy", "energy"), ("might", "might"), ("power", "power")):
        val = attr.get(key)
        if val is not None:
            lines.append(f"{prop}: {val}")
    if cls.get("rarity"):
        lines.append(f"rarity: {yaml_str(cls['rarity'])}")
    if card.get("tags"):
        lines.append(f"card_tags: {yaml_list(card['tags'])}")
    if card.get("collector_number") is not None:
        lines.append(f"number: {card['collector_number']}")
    if card.get("riftbound_id"):
        lines.append(f"riftbound_id: {yaml_str(card['riftbound_id'])}")
    lines.append(f"image: {yaml_str('[[' + stem + '.png]]')}")
    lines.append("---")
    return "\n".join(lines)


def note_body(card: dict, stem: str) -> str:
    text = card.get("text") or {}
    parts = [f"![[{stem}.png]]", ""]
    plain = humanize(text.get("plain"))
    if plain:
        parts.append("> " + plain.replace("\n", "\n> "))
        parts.append("")
    equipped = text.get("equipped") or {}
    eq_plain = humanize(equipped.get("plain"))
    if eq_plain:
        might = equipped.get("might")
        bonus = f" (+{might} Might)" if might else ""
        parts.append(f"**Équipé{bonus} :** {eq_plain}")
        parts.append("")
    flav = (text.get("flavour") or "").strip()
    if flav:
        parts.append(f"*{flav}*")
        parts.append("")
    return "\n".join(parts)


BASE_CONTENT = """filters:
  and:
    - file.inFolder("3-games/1-riftbound/sets")
    - file.folder.endsWith("cards/oracle")
    - file.ext == "md"
properties:
  note.name:
    displayName: Card
  note.set:
    displayName: Set
  note.type:
    displayName: Type
  note.domain:
    displayName: Domain
  note.energy:
    displayName: Energy
  note.might:
    displayName: Might
  note.power:
    displayName: Power
  note.rarity:
    displayName: Rarity
views:
  - type: cards
    name: Gallery
    image: note.image
    imageAspectRatio: 0.72
    imageFit: contain
    order:
      - note.set
      - note.energy
      - note.name
  - type: table
    name: Table
    order:
      - note.name
      - note.set
      - note.type
      - note.domain
      - note.energy
      - note.might
      - note.power
      - note.rarity
    sort:
      - property: note.set
        direction: ASC
      - property: note.energy
        direction: ASC
"""


def main(argv=None):
    ap = argparse.ArgumentParser(description=__doc__,
                                 formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--sets", nargs="+", default=DEFAULT_SETS)
    ap.add_argument("--no-base", action="store_true", help="Skip writing the .base file")
    ap.add_argument("--force", action="store_true",
                    help="Rewrite existing notes (default: overwrite anyway)")
    args = ap.parse_args(argv)

    written = 0
    for sid in args.sets:
        with open(os.path.join(SETS_DIR, sid, "source.json"), encoding="utf-8") as fh:
            cards = json.load(fh)
        out_dir = os.path.join(SETS_DIR, sid, "cards", "oracle")
        os.makedirs(out_dir, exist_ok=True)
        for c in cards:
            stem = card_filename(c.get("name", ""))
            if not stem:
                continue
            content = frontmatter(c, sid, stem) + "\n\n" + note_body(c, stem)
            with open(os.path.join(out_dir, stem + ".md"), "w", encoding="utf-8") as fh:
                fh.write(content)
            written += 1
        print(f"  {sid}: {len(cards)} notes")

    if not args.no_base:
        with open(os.path.join(ROOT, "Riftbound Cards.base"), "w", encoding="utf-8") as fh:
            fh.write(BASE_CONTENT)
        print("  wrote Riftbound Cards.base")

    print(f"Done. {written} card notes.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
