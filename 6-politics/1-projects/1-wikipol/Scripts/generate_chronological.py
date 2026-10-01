#!/usr/bin/env python
"""
Génère le fichier chronologique d'ingestion pour une source WikiPol.

Liste chronologiquement les vidéos de la chaîne sur les N derniers mois,
regroupées en batches de 2 semaines ISO (~10 vidéos/batch).

Usage:
    python generate_chronological.py --source Sources/MaChaine
    python generate_chronological.py --source Sources/MaChaine --dry-run
    python generate_chronological.py --source Sources/MaChaine --force
    python generate_chronological.py --source Sources/MaChaine --months 12
"""
import sys
import os
import re
import subprocess
from datetime import datetime, timedelta
from collections import defaultdict

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from source_config import parse_source_arg, SourceConfig  # noqa: E402

if sys.platform == 'win32':
    sys.stdout.reconfigure(encoding='utf-8', errors='replace')
    sys.stderr.reconfigure(encoding='utf-8', errors='replace')

DEFAULT_MONTHS_BACK = 18
WARN_BATCH_SIZE     = 12
PLAYLIST_LIMIT      = 600


# =====================================================================
#  DÉCOUVERTE DES VIDÉOS
# =====================================================================

def discover_videos_with_dates(channel_url: str, limit: int = PLAYLIST_LIMIT) -> list[dict]:
    """Récupère les N dernières vidéos de la chaîne avec leurs dates de publication."""
    print(f"Récupération des {limit} dernières vidéos avec dates via yt-dlp...")
    print(f"(sans --flat-playlist pour avoir les dates réelles — peut prendre quelques minutes)")
    cmd = [
        sys.executable, "-m", "yt_dlp",
        "--playlist-end", str(limit),
        "--skip-download",
        "--print", "%(id)s\t%(title)s\t%(upload_date>%Y-%m-%d)s",
        "--no-warnings",
        "--extractor-args", "youtube:lang=fr",
        channel_url,
    ]
    try:
        result = subprocess.run(cmd, capture_output=True, text=True, timeout=900)
    except subprocess.TimeoutExpired:
        print("ERREUR : timeout lors de la récupération des vidéos.")
        return []

    if result.returncode != 0 and not result.stdout.strip():
        print(f"ERREUR yt-dlp : {result.stderr[:300]}")
        return []
    if result.returncode != 0:
        n_errors = result.stderr.count('ERROR:')
        if n_errors:
            print(f"  ⚠ {n_errors} vidéo(s) indisponible(s) ignorée(s)")

    videos = []
    for line in result.stdout.strip().split('\n'):
        if not line.strip():
            continue
        parts = line.split('\t')
        if len(parts) >= 3:
            videos.append({
                'video_id'   : parts[0],
                'title'      : parts[1],
                'upload_date': parts[2] if parts[2] != 'NA' else '',
            })
        elif len(parts) == 2:
            videos.append({
                'video_id'   : parts[0],
                'title'      : parts[1],
                'upload_date': '',
            })
    print(f"  → {len(videos)} vidéos récupérées")
    return videos


# =====================================================================
#  UTILITAIRES DATE
# =====================================================================

MONTHS_FR = {
    1: 'jan', 2: 'fév', 3: 'mar', 4: 'avr',
    5: 'mai', 6: 'jun', 7: 'jul', 8: 'aoû',
    9: 'sep', 10: 'oct', 11: 'nov', 12: 'déc',
}


def compute_cutoff_date(months: int):
    return datetime.now() - timedelta(days=int(months * 30.44))


def iso_week_to_monday(year, week):
    return datetime.fromisocalendar(year, week, 1)


def iso_week_to_sunday(year, week):
    return datetime.fromisocalendar(year, week, 7)


def format_date_fr(dt):
    return f"{dt.day} {MONTHS_FR[dt.month]} {dt.year}"


# =====================================================================
#  FILTRAGE ET GROUPEMENT
# =====================================================================

def filter_and_sort_videos(videos, cutoff):
    filtered = []
    skipped = 0
    for v in videos:
        date_str = v.get('upload_date', '')
        if not date_str or not re.match(r'\d{4}-\d{2}-\d{2}', date_str):
            skipped += 1
            continue
        try:
            date_obj = datetime.strptime(date_str, '%Y-%m-%d')
        except ValueError:
            skipped += 1
            continue
        if date_obj >= cutoff:
            v = dict(v)
            v['date_obj'] = date_obj
            filtered.append(v)
    if skipped:
        print(f"  ⚠ {skipped} vidéos ignorées (date manquante ou invalide)")
    filtered.sort(key=lambda v: v['date_obj'])
    return filtered


def get_iso_week_key(date_obj):
    cal = date_obj.isocalendar()
    return (cal[0], cal[1])


def group_into_week_pairs(videos):
    by_week = defaultdict(list)
    for v in videos:
        key = get_iso_week_key(v['date_obj'])
        by_week[key].append(v)
    all_weeks = sorted(by_week.keys())
    batches = []
    batch_num = 1
    i = 0
    while i < len(all_weeks):
        w1 = all_weeks[i]
        w2 = all_weeks[i + 1] if i + 1 < len(all_weeks) else w1
        batch_videos = list(by_week[w1])
        if w2 != w1:
            batch_videos += list(by_week[w2])
        batch_videos.sort(key=lambda v: v['date_obj'])
        if batch_videos:
            batches.append({
                'batch_num'       : batch_num,
                'week_start'      : w1,
                'week_end'        : w2,
                'date_range_start': iso_week_to_monday(*w1),
                'date_range_end'  : iso_week_to_sunday(*w2),
                'videos'          : batch_videos,
            })
            batch_num += 1
        i += 2
    return batches


# =====================================================================
#  GÉNÉRATION DU SLUG DE BRANCHE
# =====================================================================

def make_branch_slug(cfg: SourceConfig, week_start, week_end) -> str:
    """Slug de branche : {prefix}{source-slug}-YYYY-wNN-wMM."""
    y1, w1 = week_start
    y2, w2 = week_end
    prefix = cfg.ingest_branch_prefix  # "ingest-batch/" par défaut
    src = cfg.slug
    if week_start == week_end:
        return f"{prefix}{src}-{y1}-w{w1:02d}"
    elif y1 == y2:
        return f"{prefix}{src}-{y1}-w{w1:02d}-w{w2:02d}"
    else:
        return f"{prefix}{src}-{y1}-w{w1:02d}-{y2}-w{w2:02d}"


# =====================================================================
#  FORMATAGE DU FICHIER
# =====================================================================

def format_week_range_title(week_start, week_end, date_start, date_end):
    y1, w1 = week_start
    y2, w2 = week_end
    ds = format_date_fr(date_start)
    de = format_date_fr(date_end)
    if week_start == week_end:
        return f"Semaine {y1}-W{w1:02d} ({ds})"
    return f"Semaines {y1}-W{w1:02d} à {y2}-W{w2:02d} ({ds} – {de})"


def format_batch_section(cfg: SourceConfig, batch):
    num   = batch['batch_num']
    slug  = make_branch_slug(cfg, batch['week_start'], batch['week_end'])
    title = format_week_range_title(
        batch['week_start'], batch['week_end'],
        batch['date_range_start'], batch['date_range_end']
    )
    videos = batch['videos']
    dense_warning = f"<!-- ⚠ batch dense : {len(videos)} vidéos -->\n" if len(videos) > WARN_BATCH_SIZE else ""
    lines = []
    lines.append(f"## Batch {num:02d} — {title}")
    lines.append("")
    if dense_warning:
        lines.append(dense_warning.strip())
    lines.append(f"Statut : ⏳ en attente")
    lines.append(f"Slug branche : {slug}")
    lines.append("")
    for v in videos:
        lines.append(f"- [ ] {v['title']}")
    lines.append("")
    lines.append("---")
    lines.append("")
    return '\n'.join(lines)


def generate_header(cfg: SourceConfig, total_videos, total_batches, cutoff, today):
    cutoff_str = cutoff.strftime('%Y-%m-%d')
    today_str  = today.strftime('%Y-%m-%d')
    return f"""---
generated: {today_str}
period: {cutoff_str} → {today_str}
total_videos: {total_videos}
total_batches: {total_batches}
source: {cfg.name}
---

# {cfg.name} — Ingestion chronologique

Fichier de suivi pour l'ingestion chronologique des vidéos de {cfg.name}
de {format_date_fr(cutoff)} à {format_date_fr(today)}.
Batches de 2 semaines ISO (~10 vidéos/batch), du plus ancien au plus récent.

Généré par `Scripts/generate_chronological.py`.
Pour lancer l'ingestion : `python Scripts/run_ingest.py --source {os.path.relpath(cfg.source_root)}`

---

"""


def write_chronologique(cfg: SourceConfig, batches, cutoff, today):
    total_videos = sum(len(b['videos']) for b in batches)
    content = generate_header(cfg, total_videos, len(batches), cutoff, today)
    for batch in batches:
        content += format_batch_section(cfg, batch)
    with open(cfg.tracking_file, 'w', encoding='utf-8') as f:
        f.write(content)


# =====================================================================
#  GUARD
# =====================================================================

def check_existing_file(tracking_file, force):
    if not os.path.exists(tracking_file):
        return True
    with open(tracking_file, 'r', encoding='utf-8') as f:
        content = f.read()
    if '✅ fait' in content or '✅' in content:
        if not force:
            print(f"ERREUR : {tracking_file} existe et contient des batches ✅ déjà traités.")
            print("La progression serait perdue. Options :")
            print("  --force    : écrase et perd la progression")
            print("  --dry-run  : voir les nouvelles vidéos sans écraser")
            return False
        print(f"⚠ --force : écrasement d'un fichier avec progression existante.")
    return True


# =====================================================================
#  MAIN
# =====================================================================

def parse_int_arg(args, flag, default):
    if flag not in args:
        return default
    idx = args.index(flag)
    if idx + 1 >= len(args):
        print(f"ERREUR : {flag} attend un entier.")
        sys.exit(1)
    try:
        return int(args[idx + 1])
    except ValueError:
        print(f"ERREUR : {flag} attend un entier, reçu '{args[idx + 1]}'.")
        sys.exit(1)


def main():
    args     = sys.argv[1:]
    dry_run  = '--dry-run' in args
    force    = '--force' in args
    months   = parse_int_arg(args, '--months', DEFAULT_MONTHS_BACK)

    cfg = parse_source_arg(args)

    if not cfg.channel_url:
        print(f"ERREUR : youtube.channel_url non défini dans {cfg.source_root}/source.yaml")
        sys.exit(1)

    if not dry_run and not check_existing_file(cfg.tracking_file, force):
        sys.exit(1)

    today  = datetime.now()
    cutoff = compute_cutoff_date(months)
    print(f"Source : {cfg.name} ({cfg.channel_url})")
    print(f"Période : {format_date_fr(cutoff)} → {format_date_fr(today)}")

    videos   = discover_videos_with_dates(cfg.channel_url)
    filtered = filter_and_sort_videos(videos, cutoff)
    batches  = group_into_week_pairs(filtered)
    total_videos = sum(len(b['videos']) for b in batches)

    print(f"\n{'='*60}")
    print(f"RÉSUMÉ")
    print(f"{'='*60}")
    print(f"Vidéos sur la chaîne      : {len(videos)}")
    print(f"Dans la période           : {len(filtered)}")
    print(f"Batches de 2 semaines     : {len(batches)}")

    if dry_run:
        print(f"\n--- DRY RUN ---")
        for b in batches:
            n = len(b['videos'])
            warn = f"  ⚠ batch dense" if n > WARN_BATCH_SIZE else ""
            slug = make_branch_slug(cfg, b['week_start'], b['week_end'])
            print(f"  Batch {b['batch_num']:02d} : {b['date_range_start'].strftime('%Y-%m-%d')} → "
                  f"{b['date_range_end'].strftime('%Y-%m-%d')}  ({n} vidéos){warn}")
        print(f"\nTotal : {total_videos} vidéos en {len(batches)} batches")
        print(f"Relancer sans --dry-run pour générer {cfg.tracking_file}")
        return

    write_chronologique(cfg, batches, cutoff, today)
    print(f"\n✓ Généré : {cfg.tracking_file}")
    print(f"  {total_videos} vidéos en {len(batches)} batches")
    print(f"\nProchaines étapes :")
    rel = os.path.relpath(cfg.source_root)
    print(f"  python Scripts/run_ingest.py --source {rel} --dry-run")
    print(f"  python Scripts/run_ingest.py --source {rel} --batch 1")
    print(f"  python Scripts/run_ingest.py --source {rel}")


if __name__ == '__main__':
    main()
