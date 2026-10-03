#!/usr/bin/env python3
"""
riftbound_cards.py — Fetch Riftbound card data by set (extension).

Data source: Riftcodex API (https://api.riftcodex.com) — a free, open,
no-auth, JSON REST API. Unofficial fan project, not affiliated with Riot.

Examples:
    python riftbound_cards.py --list-sets
    python riftbound_cards.py --set ogn                 # -> ogn.json
    python riftbound_cards.py --set sfd --out spirit.json
    python riftbound_cards.py --all                     # -> ./cards/<SET>.json
    python riftbound_cards.py --set unl --images ./img  # also pull card images

Stdlib only — no pip install required. Works on Python 3.8+.
"""
import argparse
import json
import os
import sys
import time
import urllib.request
import urllib.error
import urllib.parse

API = "https://api.riftcodex.com"
PAGE_SIZE = 100  # API maximum


def _get(path, params=None, retries=3):
    url = f"{API}{path}"
    if params:
        url += "?" + urllib.parse.urlencode(params)
    last_err = None
    for attempt in range(retries):
        try:
            req = urllib.request.Request(
                url, headers={"User-Agent": "riftbound-fetcher/1.0"}
            )
            with urllib.request.urlopen(req, timeout=30) as r:
                return json.loads(r.read().decode("utf-8"))
        except (urllib.error.URLError, urllib.error.HTTPError) as e:
            last_err = e
            time.sleep(1.5 * (attempt + 1))
    raise SystemExit(f"Request failed after {retries} tries: {url}\n{last_err}")


def list_sets():
    return _get("/sets", {"size": 100})["items"]


def fetch_set(set_id):
    """Return every card in a set, following pagination."""
    cards, page = [], 1
    while True:
        data = _get(
            "/cards",
            {
                "set_id": set_id,
                "size": PAGE_SIZE,
                "page": page,
                "sort": "collector_number",
            },
        )
        cards.extend(data["items"])
        if page >= data.get("pages", 1):
            break
        page += 1
        time.sleep(0.2)  # be polite to the API
    return cards


def download_images(cards, folder):
    os.makedirs(folder, exist_ok=True)
    for c in cards:
        url = (c.get("media") or {}).get("image_url")
        if not url:
            continue
        fn = os.path.join(folder, f"{c.get('riftbound_id', c['id'])}.png")
        if os.path.exists(fn):
            continue
        try:
            urllib.request.urlretrieve(url, fn)
            time.sleep(0.1)
        except Exception as e:  # noqa: BLE001
            print(f"  ! image failed for {c.get('riftbound_id')}: {e}", file=sys.stderr)


def main():
    ap = argparse.ArgumentParser(
        description="Fetch Riftbound cards by set from the Riftcodex API."
    )
    g = ap.add_mutually_exclusive_group(required=True)
    g.add_argument("--set", help="Set id, e.g. ogn, sfd, unl (case-insensitive)")
    g.add_argument("--all", action="store_true", help="Fetch every set")
    g.add_argument("--list-sets", action="store_true", help="List sets and exit")
    ap.add_argument("--out", help="Output file (single) or folder (--all)")
    ap.add_argument("--images", metavar="DIR", help="Also download card images into DIR")
    args = ap.parse_args()

    if args.list_sets:
        for s in sorted(list_sets(), key=lambda s: s["published_on"]):
            print(
                f"{s['set_id']:5} {s['name']:45} "
                f"{s['card_count']:>4} cards  ({s['published_on'][:10]})"
            )
        return

    if args.all:
        out_dir = args.out or "./cards"
        os.makedirs(out_dir, exist_ok=True)
        for s in list_sets():
            sid = s["set_id"]
            print(f"Fetching {sid} ({s['name']})…")
            cards = fetch_set(sid)
            path = os.path.join(out_dir, f"{sid}.json")
            with open(path, "w", encoding="utf-8") as f:
                json.dump(cards, f, ensure_ascii=False, indent=2)
            print(f"  -> {len(cards)} cards -> {path}")
            if args.images:
                download_images(cards, os.path.join(args.images, sid))
        return

    sid = args.set
    print(f"Fetching {sid}…")
    cards = fetch_set(sid)
    out = args.out or f"{sid.lower()}.json"
    with open(out, "w", encoding="utf-8") as f:
        json.dump(cards, f, ensure_ascii=False, indent=2)
    print(f"-> {len(cards)} cards -> {out}")
    if args.images:
        download_images(cards, args.images)


if __name__ == "__main__":
    main()
