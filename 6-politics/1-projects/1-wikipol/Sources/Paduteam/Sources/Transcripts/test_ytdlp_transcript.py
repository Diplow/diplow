#!/usr/bin/env python3
"""
Test : extraire le transcript d'UNE vidéo PaduTeam via yt-dlp
et comparer avec le transcript existant (extrait via Chrome).

Usage :
    pip install yt-dlp   (si pas déjà installé)
    python test_ytdlp_transcript.py

Le script :
1. Télécharge les sous-titres auto-générés FR de la vidéo test
2. Convertit en .md avec le même format que la skill Chrome
3. Affiche les stats de comparaison avec le fichier existant
"""
import subprocess
import os
import re
import sys
import difflib

# --- Configuration ---
VIDEO_ID = "JDf6IuE2dVA"
VIDEO_URL = f"https://www.youtube.com/watch?v={VIDEO_ID}"
VIDEO_TITLE = "SONDAGE MÉLENCHON - BARDELLA C\u2019EST PIRE QUE CE QUE VOUS CROYEZ !!"

# Dossier de ce script = dossier Transcripts
SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
EXISTING_FILE = os.path.join(SCRIPT_DIR, f"{VIDEO_TITLE}.md")
OUTPUT_FILE = os.path.join(SCRIPT_DIR, f"_TEST_ytdlp_{VIDEO_ID}.md")
TEMP_DIR = os.path.join(SCRIPT_DIR, "_temp_ytdlp")

def extract_via_ytdlp():
    """Télécharge les sous-titres via yt-dlp."""
    os.makedirs(TEMP_DIR, exist_ok=True)

    # Essayer d'abord les sous-titres manuels FR, sinon auto-générés
    cmd = [
        sys.executable, "-m", "yt_dlp",
        "--write-sub",
        "--write-auto-sub",
        "--sub-lang", "fr",
        "--sub-format", "json3",
        "--skip-download",
        "--no-warnings",
        "-o", os.path.join(TEMP_DIR, "%(id)s.%(ext)s"),
        VIDEO_URL
    ]

    print(f"[1/3] Téléchargement des sous-titres de : {VIDEO_TITLE}")
    print(f"      URL: {VIDEO_URL}")
    result = subprocess.run(cmd, capture_output=True, text=True)

    if result.returncode != 0:
        print(f"ERREUR yt-dlp: {result.stderr}")
        return None

    # Chercher le fichier JSON3 généré
    sub_file = None
    for f in os.listdir(TEMP_DIR):
        if f.endswith(".json3") and VIDEO_ID in f:
            sub_file = os.path.join(TEMP_DIR, f)
            break

    # Si pas de json3, essayer vtt ou srv3
    if not sub_file:
        # Réessayer en vtt
        cmd2 = [
            sys.executable, "-m", "yt_dlp",
            "--write-sub",
            "--write-auto-sub",
            "--sub-lang", "fr",
            "--sub-format", "vtt",
            "--skip-download",
            "--no-warnings",
            "-o", os.path.join(TEMP_DIR, "%(id)s.%(ext)s"),
            VIDEO_URL
        ]
        subprocess.run(cmd2, capture_output=True, text=True)
        for f in os.listdir(TEMP_DIR):
            if VIDEO_ID in f and (f.endswith(".vtt") or f.endswith(".srt")):
                sub_file = os.path.join(TEMP_DIR, f)
                break

    if not sub_file:
        print("ERREUR: Aucun fichier de sous-titres trouvé")
        print(f"Fichiers dans {TEMP_DIR}: {os.listdir(TEMP_DIR)}")
        return None

    print(f"      Fichier trouvé: {os.path.basename(sub_file)}")
    return sub_file


def parse_json3(filepath):
    """Parse un fichier json3 YouTube en segments (timestamp, texte)."""
    import json
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
    """Parse un fichier VTT en segments (timestamp_ms, texte)."""
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()

    segments = []
    # Pattern: 00:00:00.000 --> 00:00:05.000\nTexte
    blocks = re.split(r'\n\n+', content)
    for block in blocks:
        lines = block.strip().split('\n')
        for i, line in enumerate(lines):
            match = re.match(r'(\d+):(\d+):(\d+)\.(\d+)\s*-->', line)
            if match:
                h, m, s, ms = int(match.group(1)), int(match.group(2)), int(match.group(3)), int(match.group(4))
                start_ms = (h * 3600 + m * 60 + s) * 1000 + ms
                text = ' '.join(lines[i+1:]).strip()
                # Retirer les tags HTML
                text = re.sub(r'<[^>]+>', '', text)
                if text:
                    segments.append((start_ms, text))

    return segments


def ms_to_timestamp(ms):
    """Convertit millisecondes en format m:ss ou h:mm:ss."""
    total_s = ms // 1000
    h = total_s // 3600
    m = (total_s % 3600) // 60
    s = total_s % 60
    if h > 0:
        return f"{h}:{m:02d}:{s:02d}"
    else:
        return f"{m}:{s:02d}"


def build_markdown(segments, title, url, interval_s=30):
    """Construit le fichier .md en regroupant le texte par blocs de ~interval_s secondes."""
    if not segments:
        return ''

    lines = []
    current_block_start = segments[0][0]
    current_texts = []

    for start_ms, text in segments:
        # Si on dépasse l'intervalle, on flush le bloc
        if start_ms - current_block_start >= interval_s * 1000 and current_texts:
            ts = ms_to_timestamp(current_block_start)
            lines.append(f"\n{ts}\n")
            lines.append(' '.join(current_texts) + '\n')
            current_block_start = start_ms
            current_texts = []

        current_texts.append(text)

    # Dernier bloc
    if current_texts:
        ts = ms_to_timestamp(current_block_start)
        lines.append(f"\n{ts}\n")
        lines.append(' '.join(current_texts) + '\n')

    return '\n'.join(lines)


def compare_transcripts(existing_path, new_content):
    """Compare le transcript existant avec le nouveau."""
    print(f"\n[3/3] Comparaison avec le transcript existant")

    if not os.path.exists(existing_path):
        print(f"      Fichier existant introuvable: {existing_path}")
        return

    with open(existing_path, 'r', encoding='utf-8') as f:
        existing = f.read()

    # Extraire juste le texte brut (sans timestamps ni lignes vides)
    def extract_text(content):
        lines = content.split('\n')
        text_lines = []
        for line in lines:
            line = line.strip()
            # Ignorer timestamps (0:00, 1:23, etc.), lignes vides, et "X secondes"
            if not line:
                continue
            if re.match(r'^\d+:\d+', line):
                continue
            if re.match(r'^\d+\s+secondes?$', line):
                continue
            if line.startswith('---'):
                continue
            text_lines.append(line)
        return ' '.join(text_lines)

    existing_text = extract_text(existing)
    new_text = extract_text(new_content)

    print(f"      Transcript Chrome : {len(existing_text)} caractères de texte brut")
    print(f"      Transcript yt-dlp : {len(new_text)} caractères de texte brut")

    # Similarité via SequenceMatcher
    ratio = difflib.SequenceMatcher(None, existing_text[:5000], new_text[:5000]).ratio()
    print(f"      Similarité (5000 premiers chars) : {ratio:.1%}")

    # Afficher les 200 premiers caractères de chaque
    print(f"\n      --- Début Chrome (200 chars) ---")
    print(f"      {existing_text[:200]}")
    print(f"\n      --- Début yt-dlp (200 chars) ---")
    print(f"      {new_text[:200]}")


def main():
    # Étape 1 : Extraire via yt-dlp
    sub_file = extract_via_ytdlp()
    if not sub_file:
        print("\nÉCHEC : impossible d'extraire les sous-titres.")
        print("Vérifie que yt-dlp est installé : pip install yt-dlp")
        sys.exit(1)

    # Étape 2 : Parser et convertir en markdown
    print(f"\n[2/3] Conversion en markdown...")
    if sub_file.endswith('.json3'):
        segments = parse_json3(sub_file)
    else:
        segments = parse_vtt(sub_file)

    print(f"      {len(segments)} segments extraits")

    md_content = build_markdown(segments, VIDEO_TITLE, VIDEO_URL)

    with open(OUTPUT_FILE, 'w', encoding='utf-8') as f:
        f.write(md_content)
    print(f"      Écrit dans : {os.path.basename(OUTPUT_FILE)}")

    # Étape 3 : Comparer
    compare_transcripts(EXISTING_FILE, md_content)

    # Nettoyage temp
    import shutil
    shutil.rmtree(TEMP_DIR, ignore_errors=True)

    print(f"\n{'='*60}")
    print(f"RÉSULTAT : Fichier de test créé → {os.path.basename(OUTPUT_FILE)}")
    print(f"Compare-le visuellement avec le fichier existant dans Obsidian.")
    print(f"Si c'est satisfaisant, on passe au script batch pour toutes les vidéos.")


if __name__ == '__main__':
    main()
