#!/usr/bin/env python3
"""Generate a visual list.md next to every list.json.

For each deck workspace (decks/.../list.json) this renders a single Markdown
page of card image previews (the PNGs produced by build_card_images.py), laid
out as a grid sized so the whole list fits on one page in Obsidian.

Images are referenced as Obsidian embeds -- ![[Card Name.png|width]] -- which
resolve by basename across the vault, so the file only needs to exist somewhere
under sets/.

Usage:
    python scripts/build_list_md.py                 # all decks/**/list.json
    python scripts/build_list_md.py decks/irelia_blade_dancer/voltron_equipment
    python scripts/build_list_md.py --width 110     # force a fixed cell width
"""
from __future__ import annotations

import argparse
import glob
import json
import math
import os

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SETS_DIR = os.path.join(ROOT, "sets")
_ILLEGAL = '<>:"/\\|?*'


def card_filename(name: str) -> str:
    """Same mapping as build_card_images.card_filename (kept in sync)."""
    stem = name.replace(" - ", ", ")
    for ch in _ILLEGAL:
        stem = stem.replace(ch, "-")
    return stem.strip()


def build_index() -> dict[str, str]:
    """basename(without .png) -> True, for every preview under sets/."""
    idx = {}
    for path in glob.glob(os.path.join(SETS_DIR, "*", "cards", "images", "*.png")):
        stem = os.path.splitext(os.path.basename(path))[0]
        idx[stem] = path
    return idx


def resolve(name: str, index: dict[str, str]) -> str | None:
    """Find the preview stem for a deck card name."""
    for cand in (card_filename(name), name):
        if cand in index:
            return cand
    # tolerate comma/dash spelling differences either way
    alt = name.replace(", ", " - ")
    if card_filename(alt) in index:
        return card_filename(alt)
    return None


def auto_width(n_images: int) -> int:
    """Pick a cell width (px) so n_images fit a single ~760px-wide page.

    Cards are tall (744x1039 ~ 0.72 w/h); favour more columns so rows stay low.
    """
    if n_images <= 0:
        return 120
    columns = max(1, math.ceil(math.sqrt(n_images * 1.4)))
    page_w = 760
    width = (page_w - (columns - 1) * 6) // columns
    return max(60, min(150, width))


def grid(names_counts, index, width, missing):
    """Render a flowing grid: each distinct card once, repeated `count` times."""
    cells = []
    for name, count in names_counts:
        stem = resolve(name, index)
        if stem is None:
            missing.append(name)
            cells.append(f"`{name}` ×{count}")
            continue
        for _ in range(count):
            cells.append(f"![[{stem}.png|{width}]]")
    return " ".join(cells)


def section(lines, title, names_counts, index, width, missing):
    if not names_counts:
        return
    total = sum(c for _, c in names_counts)
    lines.append(f"### {title} ({total})")
    lines.append("")
    lines.append(grid(names_counts, index, width, missing))
    lines.append("")


def render(list_path: str, index: dict[str, str], forced_width: int | None):
    with open(list_path, encoding="utf-8") as fh:
        data = json.load(fh)

    main = [(c["name"], c["count"]) for c in data.get("main_deck", [])]
    side = [(c["name"], c["count"]) for c in data.get("sideboard", [])]
    bf = [(b, 1) for b in data.get("battlefields", [])]
    champ = data.get("chosen_champion")
    legend = data.get("legend")
    champ_cards = []
    if legend:
        champ_cards.append((legend, 1))
    if champ and champ != legend:
        champ_cards.append((champ, 1))

    total_imgs = (sum(c for _, c in main) + sum(c for _, c in side)
                  + len(bf) + len(champ_cards))
    width = forced_width or auto_width(total_imgs)

    missing: list[str] = []
    lines = [f"# {legend or os.path.basename(os.path.dirname(list_path))} — visual list",
             ""]
    runes = data.get("runes")
    if runes:
        lines.append("**Runes :** " + ", ".join(f"{k} ×{v}" for k, v in runes.items()))
        lines.append("")

    section(lines, "Légende / Champion", champ_cards, index, width, missing)
    section(lines, "Main deck", main, index, width, missing)
    section(lines, "Sideboard", side, index, width, missing)
    section(lines, "Battlefields", bf, index, width, missing)

    lines.append("---")
    lines.append(f"<sub>Généré par `scripts/build_list_md.py` — "
                 f"largeur de preview {width}px, {total_imgs} images.</sub>")
    lines.append("")

    out_path = os.path.join(os.path.dirname(list_path), "list.md")
    with open(out_path, "w", encoding="utf-8") as fh:
        fh.write("\n".join(lines))
    return out_path, missing, total_imgs, width


def main(argv=None):
    ap = argparse.ArgumentParser(description=__doc__,
                                 formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("decks", nargs="*",
                    help="Deck dir(s) containing list.json (default: all under decks/)")
    ap.add_argument("--width", type=int, default=None,
                    help="Force a fixed cell width in px (default: auto-fit)")
    args = ap.parse_args(argv)

    if args.decks:
        list_paths = [os.path.join(d, "list.json") for d in args.decks]
    else:
        list_paths = glob.glob(os.path.join(ROOT, "decks", "**", "list.json"),
                               recursive=True)

    index = build_index()
    if not index:
        print("WARNING: no PNG previews found under sets/ — run "
              "build_card_images.py first.")

    for lp in list_paths:
        if not os.path.exists(lp):
            print(f"skip (no list.json): {lp}")
            continue
        out, missing, n, width = render(lp, index, args.width)
        rel = os.path.relpath(out, ROOT)
        print(f"wrote {rel}  ({n} images @ {width}px)")
        if missing:
            print(f"  MISSING previews for: {', '.join(missing)}")


if __name__ == "__main__":
    raise SystemExit(main())
