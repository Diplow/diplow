#!/usr/bin/env python3
"""
build_pool.py — Build a focused Riftbound card pool from multiple set files,
filtered to a Legend's colors (domain identity).

Feed it the per-set JSON files (from riftbound_cards.py) and the colors you're
building around. It merges them, keeps only cards that are legal in that color
identity, drops alternate-art duplicates, and writes one combined JSON pool.

Deckbuilding rule used: a card is kept if ALL of its (non-colorless) domains
fit inside your chosen colors — i.e. card.domains ⊆ chosen colors. Colorless
cards are included by default (they go in any deck).

Examples:
    # Pool for a Fury/Order legend, across all three sets
    python build_pool.py --colors fury order --out fury_order.json

    # Derive colors automatically from a Legend's card
    python build_pool.py --legend "Master Yi" --out yi_pool.json

    # Only deck-buildable card types, energy 0-3, no colorless, slim fields
    python build_pool.py -c mind calm --types unit spell gear --max-energy 3 \
        --no-colorless --slim --out tempo.json

    # See what legends are available (and their colors)
    python build_pool.py --list-legends

Reads local JSON only — no network needed.
"""
import argparse
import glob
import json
import os
import re
import sys
from collections import Counter

DOMAINS = {"Fury", "Calm", "Mind", "Body", "Chaos", "Order"}
COLORLESS = "Colorless"
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DEFAULT_INPUTS = [os.path.join(ROOT, "sets", "*", "source.json")]


# ---------- loading ----------------------------------------------------------

def load_cards(patterns):
    files = []
    for p in patterns:
        hits = glob.glob(p)
        files.extend(hits if hits else ([p] if os.path.exists(p) else []))
    if not files:
        sys.exit(f"No input files found from: {patterns}\n"
                 f"(Expected sets/<SET>/source.json, or pass --input.)")
    cards = []
    for f in sorted(set(files)):
        with open(f, encoding="utf-8") as fh:
            data = json.load(fh)
        cards.extend(data if isinstance(data, list) else data.get("items", []))
    return cards


def domains_of(card):
    ds = card.get("classification", {}).get("domain") or []
    if isinstance(ds, str):
        ds = [ds]
    return set(ds)


def type_of(card):
    return (card.get("classification", {}).get("type") or "").lower()


def energy_of(card):
    return card.get("attributes", {}).get("energy")


# ---------- legend lookup ----------------------------------------------------

def base_name(name):
    """Strip trailing variant tags like '(Signature)' / '(Overnumbered)'."""
    return re.sub(r"\s*\([^)]*\)\s*$", "", name or "").strip()


def find_legends(cards, name=None):
    legends = [c for c in cards if type_of(c) == "legend"]
    if name:
        n = name.lower()
        legends = [c for c in legends if n in base_name(c.get("name", "")).lower()]
    return legends


def unique_legends(cards, name=None):
    """One entry per distinct base legend (collapses art/printing variants)."""
    uniq = {}
    for c in find_legends(cards, name):
        uniq.setdefault(base_name(c.get("name", "")), c)
    return uniq


def colors_from_legend(cards, name):
    uniq = unique_legends(cards, name)
    if not uniq:
        sys.exit(f"No Legend matched '{name}'. Try --list-legends.")
    # Genuinely distinct legends only if their color identities differ.
    by_colors = {frozenset(domains_of(c) - {COLORLESS}): c for c in uniq.values()}
    if len(uniq) > 1 and len(by_colors) > 1:
        print(f"'{name}' matched multiple legends — be more specific:",
              file=sys.stderr)
        for nm, c in sorted(uniq.items()):
            print(f"   - {nm}  [{', '.join(sorted(domains_of(c) - {COLORLESS}))}]",
                  file=sys.stderr)
        sys.exit(1)
    legend = next(iter(uniq.values()))
    colors = domains_of(legend) - {COLORLESS}
    print(f"Legend: {base_name(legend['name'])}  ->  "
          f"colors: {', '.join(sorted(colors))}")
    return colors


# ---------- filtering --------------------------------------------------------

def normalize_colors(raw):
    """Accept space- or comma-separated, case-insensitive color names."""
    out = set()
    for token in raw:
        for part in token.replace(",", " ").split():
            key = part.strip().capitalize()
            if key not in DOMAINS:
                sys.exit(f"Unknown color '{part}'. Valid: {', '.join(sorted(DOMAINS))}")
            out.add(key)
    return out


def card_matches(card, colors, include_colorless):
    ds = domains_of(card)
    is_colorless = (not ds) or ds == {COLORLESS}
    if is_colorless:
        return include_colorless
    # Subset rule: every non-colorless domain must be in the chosen colors.
    return (ds - {COLORLESS}) <= colors


def dedupe_variants(cards):
    """Keep one printing per (set, collector_number); prefer non-alternate art."""
    best = {}
    for c in cards:
        key = (c.get("set", {}).get("set_id"), c.get("collector_number"))
        alt = bool(c.get("metadata", {}).get("alternate_art"))
        if key not in best:
            best[key] = c
        else:
            prev_alt = bool(best[key].get("metadata", {}).get("alternate_art"))
            if prev_alt and not alt:  # replace an alternate with the base print
                best[key] = c
    # preserve original order
    seen = set()
    out = []
    for c in cards:
        key = (c.get("set", {}).get("set_id"), c.get("collector_number"))
        if key in seen:
            continue
        seen.add(key)
        out.append(best[key])
    return out


SLIM_FIELDS = ("name", "riftbound_id", "collector_number")

def slim(card):
    cl = card.get("classification", {})
    at = card.get("attributes", {})
    out = {
        "name": card.get("name"),
        "riftbound_id": card.get("riftbound_id"),
        "set": card.get("set", {}).get("set_id"),
        "type": cl.get("type"),
        "supertype": cl.get("supertype"),
        "rarity": cl.get("rarity"),
        "domain": cl.get("domain"),
        "energy": at.get("energy"),
        "might": at.get("might"),
        "power": at.get("power"),
        "text": card.get("text", {}).get("plain"),
        "image_url": card.get("media", {}).get("image_url"),
    }
    # Equipment: surface the attachment-frame effect (rules + might modifier the
    # carrier gains) so a pool exposes what the equipped unit actually receives.
    equipped = card.get("text", {}).get("equipped")
    if equipped:
        out["equipped"] = equipped
    return out


# ---------- main -------------------------------------------------------------

def main():
    ap = argparse.ArgumentParser(
        description="Build a color-filtered Riftbound card pool from multiple sets.")
    ap.add_argument("--input", "-i", nargs="+", default=DEFAULT_INPUTS,
                    help=f"Set JSON files or globs (default: {' '.join(DEFAULT_INPUTS)})")
    ap.add_argument("--colors", "-c", nargs="+",
                    help="Colors / domain identity, e.g. -c fury order")
    ap.add_argument("--legend", "-l", help="Derive colors from this Legend's card")
    ap.add_argument("--list-legends", action="store_true",
                    help="List available Legends and their colors, then exit")
    ap.add_argument("--types", "-t", nargs="+",
                    help="Keep only these card types (e.g. unit spell gear)")
    ap.add_argument("--exclude-types", nargs="+",
                    help="Drop these card types (e.g. legend battlefield rune)")
    ap.add_argument("--no-colorless", action="store_true",
                    help="Exclude colorless/neutral cards")
    ap.add_argument("--keep-variants", action="store_true",
                    help="Keep alternate-art duplicates (default: dedupe)")
    ap.add_argument("--min-energy", type=int, help="Minimum energy cost")
    ap.add_argument("--max-energy", type=int, help="Maximum energy cost")
    ap.add_argument("--rarity", nargs="+", help="Keep only these rarities")
    ap.add_argument("--slim", action="store_true",
                    help="Output reduced fields instead of full card objects")
    ap.add_argument("--out", "-o", default="pool.json", help="Output JSON path")
    args = ap.parse_args()

    cards = load_cards(args.input)

    if args.list_legends:
        for nm, c in sorted(unique_legends(cards).items()):
            cols = ", ".join(sorted(domains_of(c) - {COLORLESS})) or "Colorless"
            print(f"{nm:35} [{cols}]  ({c.get('set',{}).get('set_id')})")
        return

    # Determine colors
    if args.legend:
        colors = colors_from_legend(cards, args.legend)
    elif args.colors:
        colors = normalize_colors(args.colors)
    else:
        sys.exit("Specify --colors (e.g. -c fury order) or --legend NAME.")
    if len(colors) > 2:
        print(f"Note: {len(colors)} colors selected; standard legends use 2.",
              file=sys.stderr)

    include_colorless = not args.no_colorless
    keep_types = {t.lower() for t in args.types} if args.types else None
    drop_types = {t.lower() for t in args.exclude_types} if args.exclude_types else set()
    keep_rarity = {r.lower() for r in args.rarity} if args.rarity else None

    pool = []
    for c in cards:
        if not card_matches(c, colors, include_colorless):
            continue
        t = type_of(c)
        if keep_types and t not in keep_types:
            continue
        if t in drop_types:
            continue
        if keep_rarity and (c.get("classification", {}).get("rarity", "").lower()
                            not in keep_rarity):
            continue
        e = energy_of(c)
        if args.min_energy is not None and (e is None or e < args.min_energy):
            continue
        if args.max_energy is not None and (e is None or e > args.max_energy):
            continue
        pool.append(c)

    if not args.keep_variants:
        pool = dedupe_variants(pool)

    out_cards = [slim(c) for c in pool] if args.slim else pool
    with open(args.out, "w", encoding="utf-8") as f:
        json.dump(out_cards, f, ensure_ascii=False, indent=2)

    # Summary
    by_set = Counter(c.get("set", {}).get("set_id") for c in pool)
    by_type = Counter((c.get("classification", {}).get("type") or "?") for c in pool)
    print(f"\nPool: {len(pool)} cards  ->  {args.out}")
    print(f"  colors:    {', '.join(sorted(colors))}"
          f"{' + Colorless' if include_colorless else ''}")
    print(f"  by set:    {dict(by_set)}")
    print(f"  by type:   {dict(by_type)}")


if __name__ == "__main__":
    main()
