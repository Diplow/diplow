#!/usr/bin/env python3
"""Download a per-card preview PNG for every card in sets/*/source.json.

Output: sets/{SET}/cards/images/{card_name}.png  (one file per card)

The filename uses the *human* form of the card name (champion epithet
separator ' - ' rewritten to ', ') so that Obsidian ctrl+hover on a wikilink
written the way the guides reference cards -- e.g. [[Irelia, Fervent.png]] --
resolves to the image. Previews are pulled at a reduced width straight from the
Sanity CDN (no local image library needed -> stdlib only).

Resumable: existing non-empty files are skipped. Run again any time to backfill.

Usage:
    python scripts/build_card_images.py                 # all sets, w=300
    python scripts/build_card_images.py --width 250
    python scripts/build_card_images.py --sets OGN SFD
"""
from __future__ import annotations

import argparse
import json
import os
import sys
import urllib.request
from concurrent.futures import ThreadPoolExecutor, as_completed

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SETS_DIR = os.path.join(ROOT, "sets")
DEFAULT_SETS = ["OGN", "SFD", "UNL"]
UA = {"User-Agent": "Mozilla/5.0 (riftbound card-image fetch)"}
# Windows-illegal filename characters (we keep commas / apostrophes / parens).
_ILLEGAL = '<>:"/\\|?*'


def card_filename(name: str) -> str:
    """Map a raw set card name to its preview filename stem.

    ' - ' (champion epithet separator) -> ', ' so the file matches how decks
    and guides spell the card. '/' (token split cards) -> '-'.
    """
    stem = name.replace(" - ", ", ")
    for ch in _ILLEGAL:
        stem = stem.replace(ch, "-")
    return stem.strip()


def preview_url(image_url: str, width: int, quality: int) -> str:
    """Append Sanity CDN resize params, preserving any existing query."""
    sep = "&" if "?" in image_url else "?"
    return f"{image_url}{sep}w={width}&q={quality}&fm=png"


def fetch(card: dict, set_id: str, width: int, quality: int, force: bool):
    url = (card.get("media") or {}).get("image_url")
    name = card.get("name", "")
    if not url:
        return ("skip-nourl", name)
    out_dir = os.path.join(SETS_DIR, set_id, "cards", "images")
    out_path = os.path.join(out_dir, card_filename(name) + ".png")
    if not force and os.path.exists(out_path) and os.path.getsize(out_path) > 0:
        return ("exists", name)
    os.makedirs(out_dir, exist_ok=True)
    req = urllib.request.Request(preview_url(url, width, quality), headers=UA)
    try:
        with urllib.request.urlopen(req, timeout=60) as resp:
            data = resp.read()
    except Exception as exc:  # noqa: BLE001 - report and continue
        return ("error", f"{name}: {exc}")
    if not data.startswith(b"\x89PNG"):
        return ("error", f"{name}: not a PNG response")
    tmp = out_path + ".part"
    with open(tmp, "wb") as fh:
        fh.write(data)
    os.replace(tmp, out_path)
    return ("ok", name)


def main(argv=None):
    ap = argparse.ArgumentParser(description=__doc__,
                                 formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--sets", nargs="+", default=DEFAULT_SETS,
                    help="Set ids to process (default: OGN SFD UNL)")
    ap.add_argument("--width", type=int, default=300, help="Preview width in px")
    ap.add_argument("--quality", type=int, default=70, help="JPEG-equiv quality 1-100")
    ap.add_argument("--workers", type=int, default=12, help="Concurrent downloads")
    ap.add_argument("--force", action="store_true", help="Re-download existing files")
    args = ap.parse_args(argv)

    cards = []
    for sid in args.sets:
        path = os.path.join(SETS_DIR, sid, "source.json")
        with open(path, encoding="utf-8") as fh:
            for c in json.load(fh):
                cards.append((c, sid))

    counts = {"ok": 0, "exists": 0, "error": 0, "skip-nourl": 0}
    errors = []
    total = len(cards)
    done = 0
    with ThreadPoolExecutor(max_workers=args.workers) as pool:
        futs = [pool.submit(fetch, c, sid, args.width, args.quality, args.force)
                for c, sid in cards]
        for fut in as_completed(futs):
            status, info = fut.result()
            counts[status] = counts.get(status, 0) + 1
            if status == "error":
                errors.append(info)
            done += 1
            if done % 50 == 0 or done == total:
                print(f"  {done}/{total}  ok={counts['ok']} "
                      f"exists={counts['exists']} err={counts['error']}",
                      file=sys.stderr)

    print(f"Done. downloaded={counts['ok']} skipped(existing)={counts['exists']} "
          f"no-url={counts['skip-nourl']} errors={counts['error']}")
    for e in errors[:20]:
        print("  ERROR:", e, file=sys.stderr)
    return 1 if counts["error"] else 0


if __name__ == "__main__":
    raise SystemExit(main())
