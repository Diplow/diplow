#!/usr/bin/env python3
"""
Gestion complète des transcripts et de l'inventaire d'une source WikiPol.

Toutes les commandes prennent `--source <chemin>` (auto-détecté depuis cwd sinon).

Modes d'utilisation :
    python batch_transcripts.py --source Sources/X                     # Extrait les transcripts manquants
    python batch_transcripts.py --source Sources/X --dry-run            # Montre ce qui serait fait
    python batch_transcripts.py --source Sources/X --discover          # Découvre les nouvelles vidéos
    python batch_transcripts.py --source Sources/X --last 5             # 5 dernières vidéos sans transcript
    python batch_transcripts.py --source Sources/X --recent 3           # 3 plus récentes de la chaîne
    python batch_transcripts.py --source Sources/X --fix                # Corrige l'inventaire
    python batch_transcripts.py --source Sources/X --full               # discover + fix + extraction
    python batch_transcripts.py --source Sources/X --enrich-fiches      # youtube_id + dates dans Videos/
    python batch_transcripts.py --source Sources/X --fix-fiche-dates    # corrige dates partielles
    python batch_transcripts.py --source Sources/X --enrich-transcripts # youtube_id dans Transcripts/

Sécurités :
- Pause de 8s entre chaque vidéo (anti-ban YouTube)
- Stop après 3 échecs consécutifs
- Ne ré-extrait pas les transcripts déjà existants
"""
import subprocess
import os
import re
import sys
import json
import time
import shutil
from datetime import datetime, timedelta
from difflib import SequenceMatcher

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from source_config import parse_source_arg, SourceConfig  # noqa: E402

if sys.platform == 'win32':
    sys.stdout.reconfigure(encoding='utf-8', errors='replace')
    sys.stderr.reconfigure(encoding='utf-8', errors='replace')

PAUSE_SECONDS         = 8
MAX_CONSECUTIVE_FAILS = 3
INTERVAL_S            = 30  # regrouper le texte par blocs de ~30s


# =====================================================================
#  PARSING DES SOUS-TITRES
# =====================================================================

def parse_json3(filepath):
    with open(filepath, 'r', encoding='utf-8') as f:
        data = json.load(f)
    segments = []
    for event in data.get('events', []):
        if 'segs' not in event:
            continue
        start_ms = event.get('tStartMs', 0)
        text = ''.join(seg.get('utf8', '') for seg in event['segs']).strip()
        text = text.replace('\n', ' ')
        if text:
            segments.append((start_ms, text))
    return segments


def parse_vtt(filepath):
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()
    segments = []
    blocks = re.split(r'\n\n+', content)
    for block in blocks:
        lines = block.strip().split('\n')
        for i, line in enumerate(lines):
            match = re.match(r'(\d+):(\d+):(\d+)\.(\d+)\s*-->', line)
            if match:
                h, m, s, ms = int(match.group(1)), int(match.group(2)), int(match.group(3)), int(match.group(4))
                start_ms = (h * 3600 + m * 60 + s) * 1000 + ms
                text = ' '.join(lines[i+1:]).strip()
                text = re.sub(r'<[^>]+>', '', text)
                if text:
                    segments.append((start_ms, text))
    return segments


def ms_to_timestamp(ms):
    total_s = ms // 1000
    h = total_s // 3600
    m = (total_s % 3600) // 60
    s = total_s % 60
    return f"{h}:{m:02d}:{s:02d}" if h > 0 else f"{m}:{s:02d}"


def build_markdown(segments):
    if not segments:
        return ''
    lines = []
    current_block_start = segments[0][0]
    current_texts = []
    for start_ms, text in segments:
        if start_ms - current_block_start >= INTERVAL_S * 1000 and current_texts:
            ts = ms_to_timestamp(current_block_start)
            lines.append(f"\n{ts}\n")
            lines.append(' '.join(current_texts) + '\n')
            current_block_start = start_ms
            current_texts = []
        current_texts.append(text)
    if current_texts:
        ts = ms_to_timestamp(current_block_start)
        lines.append(f"\n{ts}\n")
        lines.append(' '.join(current_texts) + '\n')
    return '\n'.join(lines)


# =====================================================================
#  UTILITAIRES
# =====================================================================

def make_filename(title):
    slug = title.replace('\\', '').replace('/', '').replace(':', '').replace('*', '')
    slug = slug.replace('?', '').replace('"', '').replace('<', '').replace('>', '').replace('|', '')
    slug = slug.strip()
    if len(slug) > 120:
        slug = slug[:120].strip()
    return slug + '.md'


def get_existing_transcripts(cfg: SourceConfig):
    existing = set()
    td = cfg.transcripts_dir
    if not os.path.isdir(td):
        return existing
    for f in os.listdir(td):
        if f.endswith('.md') and not f.startswith('_'):
            existing.add(f[:-3])
    return existing


def fuzzy_match(s1, s2, threshold=0.70):
    def norm(s):
        s = s.lower()
        s = re.sub(r'[^\w\s]', '', s)
        s = re.sub(r'\s+', ' ', s).strip()
        return s
    return SequenceMatcher(None, norm(s1), norm(s2)).ratio() >= threshold


def norm_title(t):
    t = t.lower()
    t = re.sub(r'[^\w\s]', '', t)
    t = re.sub(r'\s+', ' ', t).strip()
    return t


def relative_date_to_absolute(date_str, ref_date=None):
    if ref_date is None:
        ref_date = datetime.now()
    s = date_str.strip().lower()
    if re.match(r'\d{4}-\d{2}-\d{2}', s):
        return date_str.strip()
    m = re.match(r'début\s+(\d{4})', s)
    if m:
        return f'{m.group(1)}-01-15'
    if re.search(r'il y a \d+\s*(minute|heure)', s):
        return ref_date.strftime('%Y-%m-%d')
    m = re.search(r'il y a (\d+)\s*jour', s)
    if m:
        return (ref_date - timedelta(days=int(m.group(1)))).strftime('%Y-%m-%d')
    m = re.search(r'il y a (\d+)\s*semaine', s)
    if m:
        return (ref_date - timedelta(weeks=int(m.group(1)))).strftime('%Y-%m-%d')
    m = re.search(r'il y a (\d+)\s*mois', s)
    if m:
        months = int(m.group(1))
        d = ref_date
        for _ in range(months):
            d = d.replace(day=1) - timedelta(days=1)
        return d.strftime('%Y-%m-%d')
    m = re.search(r'il y a (\d+)\s*an', s)
    if m:
        years = int(m.group(1))
        try:
            return ref_date.replace(year=ref_date.year - years).strftime('%Y-%m-%d')
        except ValueError:
            return (ref_date - timedelta(days=years * 365)).strftime('%Y-%m-%d')
    return date_str.strip()


# =====================================================================
#  PARSING DE L'INVENTAIRE
# =====================================================================

INVENTORY_LINE_RE = re.compile(
    r'^\|\s*(.+?)\s*\|\s*\[YouTube\]\((.+?)\)\s*\|\s*(.+?)\s*\|\s*(.*?)\s*\|\s*(.*?)\s*\|$'
)


def parse_inventaire(path):
    """Lit l'inventaire. Si absent, retourne un squelette vide."""
    if not os.path.exists(path):
        return _empty_inventaire_header(), []

    with open(path, 'r', encoding='utf-8') as f:
        lines = f.read().split('\n')

    header_lines = []
    entries = []
    in_table = False

    for line in lines:
        match = INVENTORY_LINE_RE.match(line)
        if not match:
            header_lines.append(line)
            continue
        title = match.group(1).strip()
        if title == 'Titre':
            header_lines.append(line)
            in_table = True
            continue
        url = match.group(2).strip()
        date_col = match.group(3).strip()
        transcript_col = match.group(4).strip()
        fiche_col = match.group(5).strip()
        vid_match = re.search(r'watch\?v=([a-zA-Z0-9_-]+)', url)
        video_id = vid_match.group(1) if vid_match else None
        entries.append({
            'title': title,
            'url': url,
            'video_id': video_id,
            'date': date_col,
            'transcript': transcript_col,
            'fiche': fiche_col,
        })

    return header_lines, entries


def _empty_inventaire_header():
    return [
        "# Inventaire",
        "",
        "> 0 vidéos extraites",
        "> Dernière mise à jour : " + datetime.now().strftime("%Y-%m-%d"),
        "",
        "| Titre | URL | Date | Transcript | Fiche |",
        "| ----- | --- | ---- | ---------- | ----- |",
    ]


def write_inventaire(cfg: SourceConfig, path, header_lines, entries):
    lines = list(header_lines)
    while lines and lines[-1].strip() == '':
        lines.pop()

    for e in entries:
        url = e['url']
        transcript = e.get('transcript', '')
        fiche = e.get('fiche', '')
        lines.append(
            f"| {e['title']:<100} "
            f"| [YouTube]({url}) "
            f"| {e['date']:<17} "
            f"| {transcript:<102} "
            f"| {fiche:<54} |"
        )

    total = len(entries)
    handle_label = cfg.channel_handle or cfg.name
    for i, l in enumerate(lines):
        if 'vidéos extraites' in l:
            lines[i] = f'> {total} vidéos extraites depuis la page YouTube [{handle_label}]({cfg.channel_url})'
        if 'Dernière mise à jour' in l:
            lines[i] = f'> Dernière mise à jour : {datetime.now().strftime("%Y-%m-%d")}'

    with open(path, 'w', encoding='utf-8') as f:
        f.write('\n'.join(lines))
    return total


# =====================================================================
#  DÉCOUVERTE DE NOUVELLES VIDÉOS
# =====================================================================

def discover_channel_videos(cfg: SourceConfig):
    print("Récupération de la liste des vidéos de la chaîne via yt-dlp...")
    cmd = [
        sys.executable, "-m", "yt_dlp",
        "--flat-playlist",
        "--print", "%(id)s\t%(title)s\t%(upload_date>%Y-%m-%d)s",
        "--no-warnings",
        "--extractor-args", "youtube:lang=fr",
        cfg.channel_url,
    ]
    try:
        result = subprocess.run(cmd, capture_output=True, text=True, timeout=120)
    except subprocess.TimeoutExpired:
        print("ERREUR: Timeout lors de la récupération.")
        return []
    if result.returncode != 0:
        print(f"ERREUR yt-dlp: {result.stderr[:300]}")
        return []

    videos = []
    for line in result.stdout.strip().split('\n'):
        if not line.strip():
            continue
        parts = line.split('\t')
        if len(parts) >= 3:
            videos.append({
                'video_id': parts[0],
                'title': parts[1],
                'upload_date': parts[2] if parts[2] != 'NA' else '',
            })
        elif len(parts) == 2:
            videos.append({'video_id': parts[0], 'title': parts[1], 'upload_date': ''})
    print(f"  → {len(videos)} vidéos trouvées sur la chaîne")
    return videos


def get_video_upload_date(video_id):
    cmd = [
        sys.executable, "-m", "yt_dlp",
        "--print", "%(upload_date>%Y-%m-%d)s",
        "--skip-download",
        "--no-warnings",
        "--extractor-args", "youtube:lang=fr",
        f"https://www.youtube.com/watch?v={video_id}",
    ]
    try:
        result = subprocess.run(cmd, capture_output=True, text=True, timeout=30)
        if result.returncode == 0:
            date = result.stdout.strip()
            if re.match(r'\d{4}-\d{2}-\d{2}', date):
                return date
    except (subprocess.TimeoutExpired, Exception):
        pass
    return None


# =====================================================================
#  CORRECTIONS
# =====================================================================

def fix_broken_urls(cfg: SourceConfig, entries, channel_videos=None):
    """Corrige les URLs de type '<handle>/videos' en watch?v=..."""
    if not channel_videos:
        channel_videos = discover_channel_videos(cfg)
    if not channel_videos:
        print("Impossible de corriger les URLs sans données de la chaîne.")
        return 0

    channel_map = {norm_title(cv['title']): cv for cv in channel_videos}

    # Détecter les URLs cassées : celles qui ne contiennent pas watch?v=
    fixed = 0
    for e in entries:
        if 'watch?v=' in e['url']:
            continue
        nt = norm_title(e['title'])
        cv = channel_map.get(nt)
        if not cv:
            for ckey, candidate in channel_map.items():
                if fuzzy_match(e['title'], candidate['title'], 0.7):
                    cv = candidate
                    break
        if cv:
            e['url'] = f"https://www.youtube.com/watch?v={cv['video_id']}"
            e['video_id'] = cv['video_id']
            if cv.get('upload_date') and not re.match(r'\d{4}-\d{2}-\d{2}', e['date']):
                e['date'] = cv['upload_date']
            fixed += 1
    return fixed


def fix_relative_dates(entries):
    now = datetime.now()
    fixed = 0
    for e in entries:
        new_date = relative_date_to_absolute(e['date'], now)
        if new_date != e['date']:
            e['date'] = new_date
            fixed += 1
    return fixed


def link_existing_transcripts(cfg: SourceConfig, entries):
    existing = get_existing_transcripts(cfg)
    linked = 0
    for e in entries:
        if e['transcript'] and '[[' in e['transcript']:
            continue
        expected = make_filename(e['title'])[:-3]
        if expected in existing:
            e['transcript'] = f'[[{expected}]]'
            linked += 1
            continue
        best_score = 0
        best_name = None
        for t in existing:
            score = SequenceMatcher(None, expected.lower(), t.lower()).ratio()
            if score > best_score:
                best_score = score
                best_name = t
        if best_score >= 0.70 and best_name:
            e['transcript'] = f'[[{best_name}]]'
            linked += 1
    return linked


# =====================================================================
#  EXTRACTION D'UN TRANSCRIPT
# =====================================================================

def extract_one(cfg: SourceConfig, video_id):
    temp_dir = os.path.join(cfg.transcripts_dir, "_temp_ytdlp")
    os.makedirs(temp_dir, exist_ok=True)
    url = f"https://www.youtube.com/watch?v={video_id}"
    cmd = [
        sys.executable, "-m", "yt_dlp",
        "--write-sub",
        "--write-auto-sub",
        "--sub-lang", "fr",
        "--sub-format", "json3",
        "--skip-download",
        "--no-warnings",
        "--extractor-args", "youtube:lang=fr",
        "-o", os.path.join(temp_dir, "%(id)s.%(ext)s"),
        url,
    ]
    result = subprocess.run(cmd, capture_output=True, text=True, timeout=60)
    if result.returncode != 0:
        return None

    sub_file = None
    for f in os.listdir(temp_dir):
        if video_id in f and f.endswith('.json3'):
            sub_file = os.path.join(temp_dir, f)
            break
    if not sub_file:
        cmd[6] = "vtt"
        subprocess.run(cmd, capture_output=True, text=True, timeout=60)
        for f in os.listdir(temp_dir):
            if video_id in f and (f.endswith('.vtt') or f.endswith('.srt')):
                sub_file = os.path.join(temp_dir, f)
                break
    if not sub_file:
        return None

    segments = parse_json3(sub_file) if sub_file.endswith('.json3') else parse_vtt(sub_file)
    if not segments:
        return None
    return build_markdown(segments)


def cleanup_temp(cfg: SourceConfig):
    temp_dir = os.path.join(cfg.transcripts_dir, "_temp_ytdlp")
    if os.path.exists(temp_dir):
        shutil.rmtree(temp_dir, ignore_errors=True)


# =====================================================================
#  COMMANDES PRINCIPALES
# =====================================================================

def cmd_discover(cfg: SourceConfig, dry_run=False):
    inv_path = cfg.inventaire_path
    os.makedirs(os.path.dirname(inv_path), exist_ok=True)
    header_lines, entries = parse_inventaire(inv_path)

    known_ids = {e['video_id'] for e in entries if e['video_id']}
    known_titles = {norm_title(e['title']) for e in entries}

    channel_videos = discover_channel_videos(cfg)
    if not channel_videos:
        print("Impossible de récupérer les vidéos de la chaîne.")
        return

    new_videos = []
    for cv in channel_videos:
        if cv['video_id'] in known_ids:
            continue
        if norm_title(cv['title']) in known_titles:
            continue
        if any(fuzzy_match(e['title'], cv['title'], 0.75) for e in entries):
            continue
        new_videos.append(cv)

    print(f"\n{'='*60}")
    print(f"DÉCOUVERTE — {cfg.name}")
    print(f"{'='*60}")
    print(f"Vidéos sur la chaîne   : {len(channel_videos)}")
    print(f"Déjà dans l'inventaire : {len(entries)}")
    print(f"Nouvelles à ajouter    : {len(new_videos)}")

    if not new_videos:
        print("Rien de nouveau.")
        return

    if dry_run:
        print(f"\n--- DRY RUN ---")
        for i, cv in enumerate(new_videos):
            print(f"  {i+1}. {cv['title'][:70]}  ({cv['video_id']})  [{cv.get('upload_date', '?')}]")
        return

    existing_transcripts = get_existing_transcripts(cfg)
    for cv in new_videos:
        url = f"https://www.youtube.com/watch?v={cv['video_id']}"
        date = cv.get('upload_date') or get_video_upload_date(cv['video_id']) or ''
        transcript = ''
        expected = make_filename(cv['title'])[:-3]
        if expected in existing_transcripts:
            transcript = f'[[{expected}]]'
        else:
            for t in existing_transcripts:
                if fuzzy_match(cv['title'], t, 0.7):
                    transcript = f'[[{t}]]'
                    break
        entries.insert(0, {
            'title': cv['title'], 'url': url, 'video_id': cv['video_id'],
            'date': date, 'transcript': transcript, 'fiche': '',
        })
        print(f"  + {cv['title'][:60]}  ({cv['video_id']})")

    def sort_key(e):
        d = e.get('date', '')
        return d if re.match(r'\d{4}-\d{2}-\d{2}', d) else '0000-00-00'
    entries.sort(key=sort_key, reverse=True)

    fixed_urls = fix_broken_urls(cfg, entries, channel_videos)
    fixed_dates = fix_relative_dates(entries)
    linked = link_existing_transcripts(cfg, entries)

    total = write_inventaire(cfg, inv_path, header_lines, entries)
    print(f"\n  URLs corrigées       : {fixed_urls}")
    print(f"  Dates converties     : {fixed_dates}")
    print(f"  Transcripts liés     : {linked}")
    print(f"  Total dans inventaire: {total}")


def cmd_fix(cfg: SourceConfig):
    inv_path = cfg.inventaire_path
    header_lines, entries = parse_inventaire(inv_path)

    print(f"\n{'='*60}")
    print(f"CORRECTION DE L'INVENTAIRE — {cfg.name}")
    print(f"{'='*60}")

    fixed_dates = fix_relative_dates(entries)
    print(f"  Dates converties     : {fixed_dates}")

    broken = sum(1 for e in entries if 'watch?v=' not in e['url'])
    if broken > 0:
        print(f"  URLs cassées         : {broken}")
        fixed_urls = fix_broken_urls(cfg, entries)
        print(f"  URLs corrigées       : {fixed_urls}")
    else:
        print(f"  URLs : toutes OK")

    linked = link_existing_transcripts(cfg, entries)
    print(f"  Transcripts liés     : {linked}")

    total = write_inventaire(cfg, inv_path, header_lines, entries)
    print(f"  Total dans inventaire: {total}")


def cmd_extract(cfg: SourceConfig, dry_run=False, last_n=None):
    inv_path = cfg.inventaire_path
    if not os.path.exists(inv_path):
        print(f"ERREUR: Inventaire introuvable à {inv_path}")
        print(f"       Lancer d'abord : python Scripts/batch_transcripts.py --source {os.path.relpath(cfg.source_root)} --discover")
        sys.exit(1)

    header_lines, entries = parse_inventaire(inv_path)
    existing = get_existing_transcripts(cfg)

    to_process = []
    for e in entries:
        if not e['video_id']:
            continue
        if e['transcript'] and '[[' in e['transcript']:
            continue
        if make_filename(e['title'])[:-3] in existing:
            continue
        to_process.append(e)

    total_missing = len(to_process)
    if last_n is not None:
        to_process = to_process[:last_n]

    print(f"{'='*60}")
    print(f"BATCH TRANSCRIPTS — {cfg.name}")
    print(f"{'='*60}")
    print(f"Vidéos dans l'inventaire : {len(entries)}")
    print(f"Avec video ID valide     : {sum(1 for e in entries if e['video_id'])}")
    print(f"Transcripts déjà faits   : {sum(1 for e in entries if e['transcript'] and '[[' in e['transcript'])} (inventaire) + {len(existing)} (fichiers)")
    print(f"Sans transcript          : {total_missing}")
    print(f"À extraire               : {len(to_process)}{f' (limité aux {last_n} premières)' if last_n else ''}")
    print(f"Pause entre chaque       : {PAUSE_SECONDS}s")
    print(f"Stop après               : {MAX_CONSECUTIVE_FAILS} échecs consécutifs")

    if dry_run:
        print(f"\n--- DRY RUN ---")
        for i, e in enumerate(to_process):
            print(f"  {i+1}. {e['title'][:70]}  ({e['video_id']})")
        return

    if not to_process:
        print("\nRien à extraire.")
        return

    print(f"\nDémarrage dans 3 secondes...")
    time.sleep(3)

    success_count = 0
    fail_count = 0
    consecutive_fails = 0

    for i, e in enumerate(to_process):
        print(f"\n[{i+1}/{len(to_process)}] {e['title'][:70]}")
        print(f"           ID: {e['video_id']}")
        try:
            md_content = extract_one(cfg, e['video_id'])
        except Exception as ex:
            print(f"           ERREUR: {ex}")
            md_content = None

        if md_content:
            filename = make_filename(e['title'])
            filepath = os.path.join(cfg.transcripts_dir, filename)
            with open(filepath, 'w', encoding='utf-8') as f:
                f.write(md_content)
            e['transcript'] = f'[[{filename[:-3]}]]'
            print(f"           OK → {filename} ({len(md_content)} chars)")
            success_count += 1
            consecutive_fails = 0
        else:
            print(f"           ÉCHEC (pas de sous-titres FR disponibles ?)")
            fail_count += 1
            consecutive_fails += 1
            if consecutive_fails >= MAX_CONSECUTIVE_FAILS:
                print(f"\n{'!'*60}\nSTOP : {MAX_CONSECUTIVE_FAILS} échecs consécutifs.\n{'!'*60}")
                break

        cleanup_temp(cfg)
        if i < len(to_process) - 1:
            print(f"           Pause {PAUSE_SECONDS}s...")
            time.sleep(PAUSE_SECONDS)

    write_inventaire(cfg, inv_path, header_lines, entries)
    print(f"\n{'='*60}")
    print(f"TERMINÉ")
    print(f"  Succès   : {success_count}")
    print(f"  Échecs   : {fail_count}")
    print(f"{'='*60}")


def cmd_recent(cfg: SourceConfig, n, dry_run=False):
    print(f"Récupération des {n} dernières vidéos de la chaîne...")
    cmd = [
        sys.executable, "-m", "yt_dlp",
        "--flat-playlist",
        "--playlist-end", str(n),
        "--print", "%(id)s\t%(title)s\t%(upload_date>%Y-%m-%d)s",
        "--no-warnings",
        "--extractor-args", "youtube:lang=fr",
        cfg.channel_url,
    ]
    try:
        result = subprocess.run(cmd, capture_output=True, text=True, timeout=60)
    except subprocess.TimeoutExpired:
        print("ERREUR: Timeout.")
        return
    if result.returncode != 0:
        print(f"ERREUR yt-dlp: {result.stderr[:300]}")
        return

    videos = []
    for line in result.stdout.strip().split('\n'):
        if not line.strip():
            continue
        parts = line.split('\t')
        if len(parts) >= 2:
            videos.append({
                'video_id': parts[0], 'title': parts[1],
                'upload_date': parts[2] if len(parts) >= 3 and parts[2] != 'NA' else '',
            })

    print(f"  → {len(videos)} vidéos récupérées")

    inv_path = cfg.inventaire_path
    header_lines, entries = parse_inventaire(inv_path)
    existing = get_existing_transcripts(cfg)
    known_ids = {e['video_id'] for e in entries if e['video_id']}

    to_process = []
    to_add = []
    for v in videos:
        has_transcript = any(
            e['video_id'] == v['video_id'] and e['transcript'] and '[[' in e['transcript']
            for e in entries
        )
        if not has_transcript and make_filename(v['title'])[:-3] in existing:
            has_transcript = True
        if not has_transcript:
            to_process.append(v)
        if v['video_id'] not in known_ids:
            to_add.append(v)

    print(f"\n{'='*60}")
    print(f"RECENT — {n} dernières")
    print(f"{'='*60}")
    print(f"Récupérées                   : {len(videos)}")
    print(f"Nouvelles (hors inventaire)  : {len(to_add)}")
    print(f"Sans transcript              : {len(to_process)}")

    if not to_process:
        print("\nToutes ces vidéos ont déjà un transcript.")
        if to_add and not dry_run:
            for v in to_add:
                expected = make_filename(v['title'])[:-3]
                transcript = f'[[{expected}]]' if expected in existing else ''
                entries.insert(0, {
                    'title': v['title'],
                    'url': f"https://www.youtube.com/watch?v={v['video_id']}",
                    'video_id': v['video_id'],
                    'date': v.get('upload_date', ''),
                    'transcript': transcript, 'fiche': '',
                })
            write_inventaire(cfg, inv_path, header_lines, entries)
            print(f"  {len(to_add)} vidéos ajoutées à l'inventaire")
        return

    if dry_run:
        print(f"\n--- DRY RUN ---")
        for i, v in enumerate(to_process):
            print(f"  {i+1}. {v['title'][:70]}  ({v['video_id']})  [{v.get('upload_date', '?')}]")
        return

    print(f"\nExtraction...")
    success_count = 0
    fail_count = 0
    for i, v in enumerate(to_process):
        print(f"\n[{i+1}/{len(to_process)}] {v['title'][:70]}")
        try:
            md_content = extract_one(cfg, v['video_id'])
        except Exception as ex:
            print(f"           ERREUR: {ex}")
            md_content = None
        if md_content:
            filename = make_filename(v['title'])
            filepath = os.path.join(cfg.transcripts_dir, filename)
            with open(filepath, 'w', encoding='utf-8') as f:
                f.write(md_content)
            print(f"           OK → {filename} ({len(md_content)} chars)")
            success_count += 1
        else:
            print(f"           ÉCHEC")
            fail_count += 1
        cleanup_temp(cfg)
        if i < len(to_process) - 1:
            time.sleep(PAUSE_SECONDS)

    # Mettre à jour l'inventaire
    existing = get_existing_transcripts(cfg)
    for v in to_add:
        expected = make_filename(v['title'])[:-3]
        transcript = f'[[{expected}]]' if expected in existing else ''
        entries.insert(0, {
            'title': v['title'],
            'url': f"https://www.youtube.com/watch?v={v['video_id']}",
            'video_id': v['video_id'],
            'date': v.get('upload_date', ''),
            'transcript': transcript, 'fiche': '',
        })
    link_existing_transcripts(cfg, entries)
    write_inventaire(cfg, inv_path, header_lines, entries)

    print(f"\n  Succès : {success_count}")
    print(f"  Échecs : {fail_count}")


# =====================================================================
#  ENRICHISSEMENT DES FICHES VIDEOS/
# =====================================================================

def extract_youtube_id_from_frontmatter(fm):
    m = re.search(r'^youtube_id\s*:\s*["\']?([a-zA-Z0-9_-]{8,})["\']?', fm, re.MULTILINE)
    if m:
        return m.group(1)
    m = re.search(r'^date\s*:\s*youtube_id\s*:\s*([a-zA-Z0-9_-]{8,})', fm, re.MULTILINE)
    if m:
        return m.group(1)
    return None


def get_transcript_title_from_fiche(fiche_path):
    try:
        with open(fiche_path, 'r', encoding='utf-8') as f:
            content = f.read()
    except Exception:
        return None
    m = re.search(r'##\s+Transcript\s*\n\[\[([^\]]+)\]\]', content)
    if not m:
        return None
    link = m.group(1).strip()
    return link.split('/')[-1]


def read_fiche_frontmatter_fields(fiche_path):
    result = {'youtube_id': None, 'date': None}
    try:
        with open(fiche_path, 'r', encoding='utf-8') as f:
            content = f.read()
    except Exception:
        return result
    if not content.startswith('---'):
        return result
    end = content.find('\n---', 3)
    if end == -1:
        return result
    fm = content[3:end]
    for line in fm.splitlines():
        m = re.match(r'^youtube_id\s*:\s*["\']?([a-zA-Z0-9_-]+)["\']?\s*$', line)
        if m:
            result['youtube_id'] = m.group(1)
        m = re.match(r'^date\s*:\s*(\S+)\s*$', line)
        if m:
            result['date'] = m.group(1)
    return result


def update_fiche_frontmatter(fiche_path, youtube_id=None, date=None, dry_run=False):
    try:
        with open(fiche_path, 'r', encoding='utf-8') as f:
            content = f.read()
    except Exception:
        return False
    if not content.startswith('---'):
        return False
    end = content.find('\n---', 3)
    if end == -1:
        return False

    fm = content[3:end]
    body = content[end:]
    original_fm = fm
    changes = []

    if date:
        date_m = re.search(r'^(date\s*:)\s*(\S+)\s*$', fm, re.MULTILINE)
        if date_m:
            existing = date_m.group(2)
            if not re.match(r'\d{4}-\d{2}-\d{2}', existing):
                fm = fm[:date_m.start(2)] + date + fm[date_m.end(2):]
                changes.append(f"date: {existing} → {date}")
        else:
            type_m = re.search(r'^(type\s*:.*)$', fm, re.MULTILINE)
            if type_m:
                insert_pos = type_m.end()
                fm = fm[:insert_pos] + f"\ndate: {date}" + fm[insert_pos:]
            else:
                fm = fm.rstrip() + f"\ndate: {date}"
            changes.append(f"date: (absent) → {date}")

    if youtube_id and not re.search(r'^youtube_id\s*:', fm, re.MULTILINE):
        date_line = re.search(r'^(date\s*:.*)$', fm, re.MULTILINE)
        if date_line:
            insert_pos = date_line.end()
            fm = fm[:insert_pos] + f"\nyoutube_id: {youtube_id}" + fm[insert_pos:]
        else:
            type_m = re.search(r'^(type\s*:.*)$', fm, re.MULTILINE)
            if type_m:
                insert_pos = type_m.end()
                fm = fm[:insert_pos] + f"\nyoutube_id: {youtube_id}" + fm[insert_pos:]
            else:
                fm = fm.rstrip() + f"\nyoutube_id: {youtube_id}"
        changes.append(f"youtube_id: {youtube_id}")

    if not changes or fm == original_fm:
        return False
    if dry_run:
        print(f"    [dry-run] {os.path.basename(fiche_path)} : {', '.join(changes)}")
        return True
    new_content = '---' + fm + body
    with open(fiche_path, 'w', encoding='utf-8') as f:
        f.write(new_content)
    return True


def cmd_enrich_fiches(cfg: SourceConfig, dry_run=False):
    videos_dir = os.path.join(cfg.source_root, "Videos")
    print(f"\n{'='*60}")
    print(f"ENRICHISSEMENT DES FICHES VIDEOS/ — {cfg.name}")
    print(f"{'='*60}")
    if not os.path.isdir(videos_dir):
        print(f"ERREUR: dossier Videos/ introuvable : {videos_dir}")
        return

    channel_videos = discover_channel_videos(cfg)
    if not channel_videos:
        return
    channel_map = {norm_title(cv['title']): cv for cv in channel_videos}

    fiche_files = [
        os.path.join(videos_dir, f)
        for f in os.listdir(videos_dir)
        if f.endswith('.md') and not f.startswith('_') and f != 'CLAUDE.md'
    ]
    print(f"  Fiches trouvées   : {len(fiche_files)}")
    print(f"  Vidéos chaîne     : {len(channel_videos)}")

    updated = 0
    skipped = 0
    no_match = 0
    no_match_list = []

    for fiche_path in sorted(fiche_files):
        fields = read_fiche_frontmatter_fields(fiche_path)
        has_id = bool(fields['youtube_id'])
        date_complete = bool(fields['date'] and re.match(r'\d{4}-\d{2}-\d{2}', fields['date']))
        if has_id and date_complete:
            skipped += 1
            continue

        fiche_name = os.path.splitext(os.path.basename(fiche_path))[0]
        transcript_title = get_transcript_title_from_fiche(fiche_path)
        cv_match = None
        for candidate in [transcript_title, fiche_name]:
            if not candidate:
                continue
            key = norm_title(candidate)
            if key in channel_map:
                cv_match = channel_map[key]
                break
            best_score, best_cv = 0, None
            for ckey, cv in channel_map.items():
                score = SequenceMatcher(None, key, ckey).ratio()
                if score > best_score:
                    best_score, best_cv = score, cv
            if best_score >= 0.75:
                cv_match = best_cv
                break

        if not cv_match:
            no_match += 1
            no_match_list.append(fiche_name)
            continue

        new_id = cv_match['video_id'] if not has_id else None
        new_date = cv_match.get('upload_date') if not date_complete else None
        if new_date and not re.match(r'\d{4}-\d{2}-\d{2}', new_date):
            new_date = None
        if not new_id and not new_date:
            skipped += 1
            continue
        if update_fiche_frontmatter(fiche_path, youtube_id=new_id, date=new_date, dry_run=dry_run):
            updated += 1
            if not dry_run:
                print(f"  ✓ {fiche_name[:70]}")

    print(f"\n  Mises à jour : {updated}")
    print(f"  Déjà OK      : {skipped}")
    print(f"  Non matchées : {no_match}")


def cmd_fix_fiche_dates(cfg: SourceConfig, dry_run=False):
    videos_dir = os.path.join(cfg.source_root, "Videos")
    if not os.path.isdir(videos_dir):
        print(f"ERREUR: dossier Videos/ introuvable : {videos_dir}")
        return

    fiche_files = sorted([
        os.path.join(videos_dir, f)
        for f in os.listdir(videos_dir)
        if f.endswith('.md') and not f.startswith('_') and f != 'CLAUDE.md'
    ])
    to_fix = []
    for fiche_path in fiche_files:
        try:
            with open(fiche_path, 'r', encoding='utf-8') as f:
                content = f.read()
        except Exception:
            continue
        if not content.startswith('---'):
            continue
        end = content.find('\n---', 3)
        if end == -1:
            continue
        fm = content[3:end]
        yt_id = extract_youtube_id_from_frontmatter(fm)
        if not yt_id:
            continue
        date_m = re.search(r'^date\s*:\s*(\S+)', fm, re.MULTILINE)
        date_val = date_m.group(1) if date_m else None
        need_fix = (
            (date_val and date_val.startswith('youtube_id')) or
            (not date_val) or
            (date_val and not re.match(r'\d{4}-\d{2}-\d{2}$', date_val))
        )
        if need_fix:
            to_fix.append((fiche_path, yt_id, date_val))

    print(f"  Fiches à corriger : {len(to_fix)}")
    if dry_run:
        for path, yt_id, old_date in to_fix:
            print(f"  [dry-run] {os.path.basename(path)[:70]} | date={old_date} | yt={yt_id}")
        return

    for i, (fiche_path, yt_id, old_date) in enumerate(to_fix):
        print(f"\n[{i+1}/{len(to_fix)}] {os.path.basename(fiche_path)[:70]}")
        new_date = get_video_upload_date(yt_id)
        if new_date:
            print(f"    → {new_date}")
            update_fiche_frontmatter(fiche_path, youtube_id=yt_id, date=new_date, dry_run=False)
        else:
            print(f"    ÉCHEC : date introuvable")
        if i < len(to_fix) - 1:
            time.sleep(5)


def add_youtube_id_to_transcript(transcript_path, youtube_id, dry_run=False):
    try:
        with open(transcript_path, 'r', encoding='utf-8') as f:
            content = f.read()
    except Exception:
        return False
    if not content.startswith('---'):
        if dry_run:
            return True
        with open(transcript_path, 'w', encoding='utf-8') as f:
            f.write(f'---\nyoutube_id: {youtube_id}\n---\n' + content)
        return True
    end = content.find('\n---', 3)
    if end == -1:
        return False
    fm = content[3:end]
    if re.search(r'^youtube_id\s*:', fm, re.MULTILINE):
        return False
    fm = fm.rstrip() + f'\nyoutube_id: {youtube_id}\n'
    if dry_run:
        return True
    with open(transcript_path, 'w', encoding='utf-8') as f:
        f.write('---' + fm + content[end:])
    return True


def cmd_enrich_transcripts(cfg: SourceConfig, dry_run=False):
    videos_dir = os.path.join(cfg.source_root, "Videos")
    if not os.path.isdir(videos_dir):
        print(f"ERREUR: dossier Videos/ introuvable : {videos_dir}")
        return

    transcript_to_id = {}
    for f in sorted(os.listdir(videos_dir)):
        if not f.endswith('.md') or f.startswith('_') or f == 'CLAUDE.md':
            continue
        fiche_path = os.path.join(videos_dir, f)
        fields = read_fiche_frontmatter_fields(fiche_path)
        yt_id = fields['youtube_id']
        if not yt_id:
            continue
        transcript_name = get_transcript_title_from_fiche(fiche_path)
        if transcript_name:
            transcript_to_id[transcript_name] = yt_id

    td = cfg.transcripts_dir
    if not os.path.isdir(td):
        print(f"ERREUR: {td} introuvable")
        return
    transcript_files = sorted([f for f in os.listdir(td) if f.endswith('.md') and not f.startswith('_')])
    names_without_ext = [f[:-3] for f in transcript_files]
    uncovered = [n for n in names_without_ext if n not in transcript_to_id]

    print(f"  Transcripts total    : {len(transcript_files)}")
    print(f"  Couverts par fiches  : {len(transcript_to_id)}")
    print(f"  À matcher via yt-dlp : {len(uncovered)}")

    if uncovered:
        channel_videos = discover_channel_videos(cfg)
        if channel_videos:
            channel_map = {norm_title(cv['title']): cv for cv in channel_videos}
            fuzzy_matched = 0
            for name in uncovered:
                key = norm_title(name)
                cv = channel_map.get(key)
                if not cv:
                    best_score, best_cv = 0, None
                    for ckey, cv_item in channel_map.items():
                        score = SequenceMatcher(None, key, ckey).ratio()
                        if score > best_score:
                            best_score, best_cv = score, cv_item
                    if best_score >= 0.75:
                        cv = best_cv
                if cv:
                    transcript_to_id[name] = cv['video_id']
                    fuzzy_matched += 1
            print(f"  Matchés via yt-dlp   : {fuzzy_matched}")

    updated = 0
    skipped = 0
    no_match = 0
    for transcript_file in transcript_files:
        name = transcript_file[:-3]
        transcript_path = os.path.join(td, transcript_file)
        yt_id = transcript_to_id.get(name)
        if not yt_id:
            no_match += 1
            continue
        if dry_run:
            try:
                with open(transcript_path, 'r', encoding='utf-8') as fh:
                    head = fh.read(300)
                if 'youtube_id' in head:
                    skipped += 1
                    continue
            except Exception:
                pass
            print(f"  [dry-run] {transcript_file[:70]} → {yt_id}")
            updated += 1
        else:
            if add_youtube_id_to_transcript(transcript_path, yt_id, dry_run=False):
                updated += 1
            else:
                skipped += 1

    print(f"\n  Mis à jour  : {updated}")
    print(f"  Déjà OK     : {skipped}")
    print(f"  Sans match  : {no_match}")


# =====================================================================
#  MAIN
# =====================================================================

def parse_int_arg(args, flag):
    if flag not in args:
        return None
    idx = args.index(flag)
    if idx + 1 < len(args):
        try:
            return int(args[idx + 1])
        except ValueError:
            print(f"ERREUR: {flag} attend un nombre.")
            sys.exit(1)
    print(f"ERREUR: {flag} attend un nombre.")
    sys.exit(1)


def main():
    args = sys.argv[1:]
    dry_run = '--dry-run' in args
    last_n = parse_int_arg(args, '--last')
    recent_n = parse_int_arg(args, '--recent')
    cfg = parse_source_arg(args)

    if not cfg.channel_url:
        print(f"ERREUR: youtube.channel_url non défini dans {cfg.source_root}/source.yaml")
        sys.exit(1)

    if recent_n is not None:
        cmd_recent(cfg, recent_n, dry_run=dry_run)
    elif '--full' in args:
        cmd_discover(cfg, dry_run=dry_run)
        if not dry_run:
            cmd_extract(cfg, dry_run=False, last_n=last_n)
    elif '--discover' in args:
        cmd_discover(cfg, dry_run=dry_run)
    elif '--fix' in args:
        cmd_fix(cfg)
    elif '--enrich-fiches' in args:
        cmd_enrich_fiches(cfg, dry_run=dry_run)
    elif '--fix-fiche-dates' in args:
        cmd_fix_fiche_dates(cfg, dry_run=dry_run)
    elif '--enrich-transcripts' in args:
        cmd_enrich_transcripts(cfg, dry_run=dry_run)
    else:
        cmd_extract(cfg, dry_run=dry_run, last_n=last_n)


if __name__ == '__main__':
    main()
