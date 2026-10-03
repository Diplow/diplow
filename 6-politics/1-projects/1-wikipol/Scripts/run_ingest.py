#!/usr/bin/env python
"""
Runner d'ingestion chronologique pour une source WikiPol.

Lit le fichier de suivi chronologique d'une source, identifie les batches
non traités, et invoque `claude` pour chaque batch via la skill ingest-batch.
Pause automatique de 2h en cas de rate limit.

Usage:
    python run_ingest.py --source Sources/MaChaine                     # tous les batches ⏳
    python run_ingest.py --source Sources/MaChaine --dry-run           # affiche sans lancer
    python run_ingest.py --source Sources/MaChaine --from 5            # commence au batch 05
    python run_ingest.py --source Sources/MaChaine --batch 7           # un seul batch
    python run_ingest.py --source Sources/MaChaine --model opus        # surcharge le modèle
"""
import sys
import os
import re
import time
import subprocess
from datetime import datetime

# Résolution de l'import source_config (même dossier)
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from source_config import parse_source_arg, SourceConfig  # noqa: E402

if sys.platform == 'win32':
    sys.stdout.reconfigure(encoding='utf-8', errors='replace')
    sys.stderr.reconfigure(encoding='utf-8', errors='replace')

RATE_LIMIT_SLEEP  = 7200   # 2h
TIMEOUT_PER_BATCH = 10800  # 3h par batch
MAX_RETRIES       = 3
CLAUDE_CMD        = "claude"

RATE_LIMIT_SIGNALS = [
    "rate limit",
    "rate_limit",
    "429",
    "overloaded",
    "quota exceeded",
    "too many requests",
    "capacity",
]


# =====================================================================
#  LOGGING
# =====================================================================

def make_logger(log_path: str):
    def log(msg: str):
        ts   = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        line = f"[{ts}] {msg}"
        print(line)
        with open(log_path, 'a', encoding='utf-8') as f:
            f.write(line + "\n")
    return log


# =====================================================================
#  PARSING DU FICHIER DE SUIVI
# =====================================================================

BATCH_HEADER_RE = re.compile(r'^## Batch (\d+) —\s+(.+)$', re.MULTILINE)
STATUS_RE       = re.compile(r'^Statut\s*:\s*(.+)$', re.MULTILINE)
SLUG_RE         = re.compile(r'^Slug branche\s*:\s*(.+)$', re.MULTILINE)


def parse_batches(tracking_path: str) -> list[dict]:
    """Parse le fichier chronologique et retourne la liste des batches."""
    if not os.path.exists(tracking_path):
        print(f"ERREUR : fichier introuvable : {tracking_path}")
        print("Générer d'abord avec : python Scripts/generate_chronological.py --source <source>")
        sys.exit(1)

    with open(tracking_path, 'r', encoding='utf-8') as f:
        content = f.read()

    sections = re.split(r'\n(?=## Batch \d+)', content)
    batches = []
    for section in sections:
        hm = BATCH_HEADER_RE.search(section)
        if not hm:
            continue
        num   = int(hm.group(1))
        title = hm.group(2).strip()
        sm = STATUS_RE.search(section)
        status = sm.group(1).strip() if sm else ''
        slm = SLUG_RE.search(section)
        slug = slm.group(1).strip() if slm else ''
        batches.append({
            'num'   : num,
            'title' : title,
            'status': status,
            'slug'  : slug,
        })
    return sorted(batches, key=lambda b: b['num'])


def find_pending_batches(batches, start_from=None, single_batch=None):
    if single_batch is not None:
        return [b for b in batches if b['num'] == single_batch]
    pending = [
        b for b in batches
        if '⏳' in b['status'] or 'en attente' in b['status'].lower()
    ]
    if start_from is not None:
        pending = [b for b in pending if b['num'] >= start_from]
    return pending


# =====================================================================
#  DÉTECTION RATE LIMIT
# =====================================================================

def is_rate_limit_error(stdout: str, stderr: str) -> bool:
    combined = (stdout + stderr).lower()
    return any(s in combined for s in RATE_LIMIT_SIGNALS)


# =====================================================================
#  PAUSE AVEC PROGRESSION
# =====================================================================

def sleep_with_countdown(seconds: int, log):
    h = seconds // 3600
    m = (seconds % 3600) // 60
    log(f"Rate limit détecté. Pause de {h}h{m:02d}min...")
    intervals = seconds // 600
    for i in range(intervals):
        time.sleep(600)
        remaining = seconds - (i + 1) * 600
        log(f"  ...encore {remaining // 60} min")
    remaining_secs = seconds % 600
    if remaining_secs > 0:
        time.sleep(remaining_secs)
    log("Reprise après pause rate limit.")


# =====================================================================
#  INVOCATION CLAUDE
# =====================================================================

def run_batch(batch, cfg: SourceConfig, log, dry_run=False, model=None):
    """Invoque claude pour un batch. Retourne (success, status_str)."""
    tracking_name = os.path.basename(cfg.tracking_file)
    prompt = (
        f"Ingère le batch {batch['num']:02d} "
        f"({batch['title']}) "
        f"de {tracking_name} "
        f"(mode automatique)"
    )
    active_model = model or cfg.default_model

    if dry_run:
        log(f"[DRY RUN] Batch {batch['num']:02d} — {batch['title']} [modèle: {active_model}]")
        log(f"[DRY RUN] Prompt : {prompt}")
        log(f"[DRY RUN] cwd : {cfg.source_root}")
        return True, 'dry_run'

    cmd = [CLAUDE_CMD, "--dangerously-skip-permissions", "--model", active_model, "-p", prompt]
    log(f"Lancement : {' '.join(cmd[:3])} \"...\"")

    try:
        result = subprocess.run(
            cmd,
            capture_output=True,
            text=True,
            encoding='utf-8',
            errors='replace',
            timeout=TIMEOUT_PER_BATCH,
            cwd=cfg.source_root,
        )
    except subprocess.TimeoutExpired:
        log(f"TIMEOUT ({TIMEOUT_PER_BATCH}s) — batch {batch['num']:02d}")
        return False, 'timeout'
    except FileNotFoundError:
        log(f"ERREUR : commande '{CLAUDE_CMD}' introuvable. Vérifier que claude CLI est installé.")
        sys.exit(1)

    for line in (result.stdout or "").splitlines():
        log(f"  stdout: {line}")
    if result.stderr and result.stderr.strip():
        for line in result.stderr.splitlines():
            log(f"  stderr: {line}")

    if result.returncode == 0:
        return True, 'ok'
    if is_rate_limit_error(result.stdout, result.stderr):
        return False, 'rate_limit'
    log(f"ÉCHEC (code {result.returncode}) — batch {batch['num']:02d}")
    return False, 'error'


# =====================================================================
#  BOUCLE PRINCIPALE
# =====================================================================

def run_all(cfg: SourceConfig, dry_run=False, start_from=None, single_batch=None, model=None):
    log_path = os.path.join(cfg.source_root, "run_ingest.log")
    log = make_logger(log_path)

    batches = parse_batches(cfg.tracking_file)
    pending = find_pending_batches(batches, start_from=start_from, single_batch=single_batch)

    total     = len(batches)
    n_done    = sum(1 for b in batches if '✅' in b['status'])
    n_pending = len(pending)

    log(f"{'='*60}")
    log(f"INGESTION CHRONOLOGIQUE — {cfg.name}")
    log(f"{'='*60}")
    log(f"Source           : {cfg.source_root}")
    log(f"Tracking file    : {cfg.tracking_file}")
    log(f"Batches total    : {total}")
    log(f"Déjà traités     : {n_done}")
    log(f"À traiter        : {n_pending}")
    log(f"Modèle           : {model or cfg.default_model}")
    if dry_run:
        log(f"Mode             : DRY RUN")

    if not pending:
        log("Rien à faire — tous les batches sont ✅ traités.")
        return

    success_count = 0
    fail_count    = 0

    for i, batch in enumerate(pending):
        log(f"\n{'='*60}")
        log(f"[{i+1}/{n_pending}] Batch {batch['num']:02d} — {batch['title']}")
        log(f"  Slug : {batch['slug']}")
        log(f"{'='*60}")

        attempts = 0
        while attempts < MAX_RETRIES:
            attempts += 1
            success, status = run_batch(batch, cfg, log, dry_run=dry_run, model=model)

            if success or status == 'dry_run':
                log(f"✓ Batch {batch['num']:02d} terminé avec succès.")
                success_count += 1
                break

            if status == 'rate_limit':
                if attempts < MAX_RETRIES:
                    log(f"Tentative {attempts}/{MAX_RETRIES} échouée (rate limit).")
                    sleep_with_countdown(RATE_LIMIT_SLEEP, log)
                else:
                    log(f"Rate limit persistant après {MAX_RETRIES} tentatives — abandon du batch {batch['num']:02d}.")
                    fail_count += 1
            elif status == 'timeout':
                log(f"Timeout sur batch {batch['num']:02d} — passage au suivant.")
                fail_count += 1
                break
            else:
                log(f"Échec (non rate-limit) sur batch {batch['num']:02d} — passage au suivant.")
                fail_count += 1
                break

    log(f"\n{'='*60}")
    log(f"TERMINÉ")
    log(f"  Succès : {success_count}")
    log(f"  Échecs : {fail_count}")
    log(f"{'='*60}")


# =====================================================================
#  MAIN
# =====================================================================

def parse_int_arg(args, flag):
    if flag not in args:
        return None
    idx = args.index(flag)
    if idx + 1 >= len(args):
        print(f"ERREUR : {flag} attend un nombre entier.")
        sys.exit(1)
    try:
        return int(args[idx + 1])
    except ValueError:
        print(f"ERREUR : {flag} attend un entier, reçu '{args[idx + 1]}'.")
        sys.exit(1)


def parse_str_arg(args, flag, default=None):
    if flag not in args:
        return default
    idx = args.index(flag)
    if idx + 1 >= len(args):
        print(f"ERREUR : {flag} attend une valeur.")
        sys.exit(1)
    return args[idx + 1]


def main():
    args         = sys.argv[1:]
    dry_run      = '--dry-run' in args
    start_from   = parse_int_arg(args, '--from')
    single_batch = parse_int_arg(args, '--batch')
    model        = parse_str_arg(args, '--model', default=None)

    cfg = parse_source_arg(args)

    run_all(
        cfg,
        dry_run=dry_run,
        start_from=start_from,
        single_batch=single_batch,
        model=model,
    )


if __name__ == '__main__':
    main()
