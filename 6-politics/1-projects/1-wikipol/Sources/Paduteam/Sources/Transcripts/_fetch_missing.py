#!/usr/bin/env python3
"""
Script ciblé pour télécharger les transcripts des 8 vidéos manquantes.
Usage: python _fetch_missing.py [--dry-run]
"""
import sys
import os
import re
import subprocess
import time
import json
import shutil

if sys.platform == 'win32':
    sys.stdout.reconfigure(encoding='utf-8', errors='replace')
    sys.stderr.reconfigure(encoding='utf-8', errors='replace')

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
CHANNEL_URL = "https://www.youtube.com/@PaduTeam/videos"
INTERVAL_S = 30
PAUSE_SECONDS = 8

MISSING_TITLES = [
    "CHARLIE HEBDO EST-IL RÉACTIONNAIRE ?",
    "THAÏS : les VSS l'ont rendue NAZIE",
    "Les CHÔMEURS sont-ils VRAIMENT des ASSISTÉS",
    "MÉLENCHON AFFRONTE une HORDE DE BOURGEOIS aux GRANDES GUEULES",
    "LA GUERRE AU RN EST DÉCLARÉE",
    "MACRON VA PARTIR ! LES BANQUIERS VONT LE DÉGAGER",
    "SONDAGE ANTI-MÉLENCHON : LES MENSONGES DE L'IFOP VS LA VÉRITÉ DU SAINT GRAPHIQUE",
    "BÉGAUDEAU se RIDICULISE sur le DÉTERMINISME et le MARXISME",
]


def norm(s):
    s = s.lower().strip()
    s = s.replace('é', 'e').replace('è', 'e').replace('ê', 'e').replace('ë', 'e')
    s = s.replace('à', 'a').replace('â', 'a').replace('î', 'i').replace('ï', 'i')
    s = s.replace('ô', 'o').replace('ù', 'u').replace('û', 'u').replace('ç', 'c')
    s = re.sub(r'[^\w\s]', ' ', s)
    s = re.sub(r'\s+', ' ', s).strip()
    return s


def fuzzy_match(a, b, threshold=0.6):
    from difflib import SequenceMatcher
    na, nb = norm(a), norm(b)
    # Check if one contains the other
    if na in nb or nb in na:
        return True
    ratio = SequenceMatcher(None, na, nb).ratio()
    return ratio >= threshold


def discover_channel_videos():
    print("Récupération de la liste des vidéos de la chaîne via yt-dlp...")
    cmd = [
        sys.executable, "-m", "yt_dlp",
        "--flat-playlist",
        "--print", "%(id)s\t%(title)s",
        "--no-warnings",
        "--extractor-args", "youtube:lang=fr",
        CHANNEL_URL
    ]
    try:
        result = subprocess.run(cmd, capture_output=True, text=True, timeout=180)
    except subprocess.TimeoutExpired:
        print("ERREUR: Timeout")
        return []
    if result.returncode != 0:
        print(f"ERREUR yt-dlp: {result.stderr[:300]}")
        return []
    videos = []
    for line in result.stdout.strip().split('\n'):
        if not line.strip():
            continue
        parts = line.split('\t')
        if len(parts) >= 2:
            videos.append({'video_id': parts[0], 'title': parts[1]})
    print(f"  → {len(videos)} vidéos trouvées")
    return videos


def make_filename(title):
    """Génère le nom de fichier .md depuis le titre (même logique que batch_transcripts.py)."""
    clean = re.sub(r'[\\/:*?"<>|]', '', title)
    clean = re.sub(r'\s+', ' ', clean).strip()
    # Limite à 180 chars
    if len(clean) > 180:
        clean = clean[:180].rstrip()
    return clean + ".md"


def parse_json3(filepath):
    with open(filepath, 'r', encoding='utf-8') as f:
        data = json.load(f)
    segments = []
    for event in data.get('events', []):
        if 'segs' not in event:
            continue
        start_ms = event.get('tStartMs', 0)
        text = ''.join(seg.get('utf8', '') for seg in event['segs']).strip().replace('\n', ' ')
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


def segments_to_markdown(segments, title, video_id):
    """Convertit les segments en markdown avec horodatages."""
    if not segments:
        return None
    lines = [f"# {title}", f"\nhttps://www.youtube.com/watch?v={video_id}", ""]
    current_block = []
    block_start_ms = segments[0][0] if segments else 0

    for start_ms, text in segments:
        if start_ms - block_start_ms >= INTERVAL_S * 1000 and current_block:
            ts_s = int(block_start_ms / 1000)
            m, s = divmod(ts_s, 60)
            link = f"[{m:02d}:{s:02d}](https://www.youtube.com/watch?v={video_id}&t={ts_s})"
            lines.append(f"\n**{link}**")
            lines.append(' '.join(current_block))
            current_block = [text]
            block_start_ms = start_ms
        else:
            current_block.append(text)

    if current_block:
        ts_s = int(block_start_ms / 1000)
        m, s = divmod(ts_s, 60)
        link = f"[{m:02d}:{s:02d}](https://www.youtube.com/watch?v={video_id}&t={ts_s})"
        lines.append(f"\n**{link}**")
        lines.append(' '.join(current_block))

    return '\n'.join(lines)


def extract_transcript(video_id, title, dry_run=False):
    """Télécharge le transcript d'une vidéo YouTube."""
    filename = make_filename(title)
    out_path = os.path.join(SCRIPT_DIR, filename)

    if os.path.exists(out_path):
        print(f"  ✓ Déjà existant : {filename[:60]}")
        return True

    if dry_run:
        print(f"  [DRY-RUN] Téléchargerait : {filename[:60]}")
        return True

    temp_dir = os.path.join(SCRIPT_DIR, "_temp_fetch_missing")
    os.makedirs(temp_dir, exist_ok=True)

    url = f"https://www.youtube.com/watch?v={video_id}"
    cmd = [
        sys.executable, "-m", "yt_dlp",
        "--write-sub", "--write-auto-sub",
        "--sub-lang", "fr",
        "--sub-format", "json3/vtt",
        "--skip-download",
        "--no-warnings",
        "-o", os.path.join(temp_dir, "%(id)s.%(ext)s"),
        url
    ]

    try:
        result = subprocess.run(cmd, capture_output=True, text=True, timeout=60)
    except subprocess.TimeoutExpired:
        print(f"  ✗ Timeout : {title[:60]}")
        return False

    # Chercher les fichiers générés
    sub_files = [f for f in os.listdir(temp_dir) if video_id in f and (f.endswith('.json3') or f.endswith('.vtt'))]
    if not sub_files:
        print(f"  ✗ Pas de sous-titres disponibles : {title[:60]}")
        # Nettoyer
        shutil.rmtree(temp_dir, ignore_errors=True)
        return False

    # Parser le meilleur fichier (préférer json3)
    sub_files.sort(key=lambda f: (0 if f.endswith('.json3') else 1))
    sub_path = os.path.join(temp_dir, sub_files[0])

    try:
        if sub_path.endswith('.json3'):
            segments = parse_json3(sub_path)
        else:
            segments = parse_vtt(sub_path)
    except Exception as e:
        print(f"  ✗ Erreur parsing : {e}")
        shutil.rmtree(temp_dir, ignore_errors=True)
        return False

    content = segments_to_markdown(segments, title, video_id)
    if not content:
        print(f"  ✗ Transcript vide : {title[:60]}")
        shutil.rmtree(temp_dir, ignore_errors=True)
        return False

    with open(out_path, 'w', encoding='utf-8') as f:
        f.write(content)

    print(f"  ✓ Transcript créé : {filename[:60]} ({len(segments)} segments)")
    shutil.rmtree(temp_dir, ignore_errors=True)
    return True


def main():
    dry_run = '--dry-run' in sys.argv

    print("=" * 60)
    print("FETCH MISSING TRANSCRIPTS")
    print("=" * 60)

    # 1. Récupérer la liste de la chaîne
    channel_videos = discover_channel_videos()
    if not channel_videos:
        print("Impossible de récupérer la liste des vidéos.")
        return

    # 2. Trouver les correspondances pour les 8 titres manquants
    print(f"\nRecherche des {len(MISSING_TITLES)} titres manquants...")
    found = []
    for target in MISSING_TITLES:
        best_match = None
        best_ratio = 0
        from difflib import SequenceMatcher
        for cv in channel_videos:
            nt = norm(target)
            nc = norm(cv['title'])
            if nt in nc or nc in nt:
                ratio = 1.0
            else:
                ratio = SequenceMatcher(None, nt, nc).ratio()
            if ratio > best_ratio:
                best_ratio = ratio
                best_match = cv
        if best_match and best_ratio >= 0.5:
            print(f"  ✓ [{best_ratio:.2f}] {target[:50]}")
            print(f"       → {best_match['title'][:60]} ({best_match['video_id']})")
            found.append((target, best_match['video_id'], best_match['title']))
        else:
            print(f"  ✗ Non trouvé : {target[:60]}")
            if best_match:
                print(f"       Meilleur match [{best_ratio:.2f}]: {best_match['title'][:60]}")

    print(f"\n{len(found)}/{len(MISSING_TITLES)} vidéos trouvées sur la chaîne")

    # 3. Télécharger les transcripts
    print(f"\n{'[DRY-RUN] ' if dry_run else ''}Téléchargement des transcripts...")
    success = 0
    for original_title, video_id, channel_title in found:
        print(f"\n  → {channel_title[:60]} ({video_id})")
        # Utiliser le titre de la chaîne (plus fidèle)
        ok = extract_transcript(video_id, channel_title, dry_run=dry_run)
        if ok:
            success += 1
        if not dry_run and len(found) > 1:
            time.sleep(PAUSE_SECONDS)

    print(f"\n{'=' * 60}")
    print(f"RÉSULTAT: {success}/{len(found)} transcripts {'(simulés)' if dry_run else 'téléchargés'}")


if __name__ == "__main__":
    main()
