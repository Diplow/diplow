#!/usr/bin/env python3
"""
riftbound_format_generator.py
=============================
Génère une fiche de RÈGLES DE LÉGALITÉ pour un FORMAT Riftbound donné, à une DATE donnée.
 
Le "moteur" du jeu (tours, combat, scoring) ne change pas dans le temps : il vit dans
`riftbound_general_rules.md` et `riftbound_keywords.md`. CE script ne couvre que ce qui
DÉPEND du format et de l'instant T : construction de deck, sideboard, sets légaux
(rotation), et ban list en vigueur.
 
Usage :
    python riftbound_format_generator.py --format standard --date 2026-06-28
    python riftbound_format_generator.py --format casual_bo1 --date 2026-06-28 --out fiche.md
    python riftbound_format_generator.py --list                      # liste les formats connus
 
⚠️ MAINTENANCE : tout ce qui bouge est dans la section DONNÉES ci-dessous, à mettre à jour
quand Riot publie une nouvelle ban list, un nouveau set, ou une rotation. Les dates marquées
APPROX sont à confirmer sur les annonces officielles.
"""
 
from __future__ import annotations
import argparse
from dataclasses import dataclass, field
from datetime import date
from typing import Optional
 
# =============================================================================
# DONNÉES — à maintenir dans le temps
# =============================================================================
 
# --- Sets (du plus ancien au plus récent). 'release' APPROX, à confirmer. ---
SETS = [
    {"code": "OGN", "name": "Origins",     "release": date(2025, 11, 21)},  # APPROX
    {"code": "SFD", "name": "Spiritforged", "release": date(2026, 2, 13)},  # APPROX (sortie EN)
    {"code": "UNL", "name": "Unleashed",    "release": date(2026, 5, 29)},  # APPROX (late spring)
]
 
# --- Rotation : non encore active à la compilation (2026-06-28). ---
# Quand une rotation entrera en vigueur, ajouter ici des entrées {effective, retired_sets:[...]}.
ROTATIONS: list[dict] = [
    # {"effective": date(2027, X, X), "retired_sets": ["OGN"]},
]
 
# --- Ban lists datées, par format. La plus récente <= date s'applique. ---
# Chaque entrée : effective (date), cards (list), battlefields (list), note (str).
BAN_LISTS: dict[str, list[dict]] = {
    "standard": [
        {
            "effective": date(2026, 3, 30),
            "cards": ["Called Shot", "Draven (Vanquisher)", "Fight or Flight", "Scrapheap"],
            "battlefields": ["Dreaming Tree", "Obelisk of Power", "Reaver's Row"],
            "note": "Ban list 3/30/26 (telle que notée dans le Rules Reference du projet).",
        },
    ],
    # Les formats casual partagent par défaut la ban list 'standard' (voir résolution plus bas).
}
 
# --- Définition des formats ---
@dataclass
class Format:
    key: str
    label: str
    main_deck: int = 40
    max_copies: int = 3
    rune_deck: int = 12
    battlefields_brought: int = 3
    battlefield_selection: str = "choisi"     # "choisi" (Bo3) ou "aléatoire" (Bo1)
    match_structure: str = "Best-of-3"
    sideboard: Optional[int] = 8              # None = pas de sideboard
    sideboard_locked: tuple = ("Runes", "Legend", "Battlefields")  # non modifiables en SB
    swap_chosen_champion: bool = True         # changeable en sideboarding ?
    banlist_key: str = "standard"             # quelle ban list appliquer
    rotation_applies: bool = True
    notes: list = field(default_factory=list)
 
FORMATS: dict[str, Format] = {
    "standard": Format(
        key="standard", label="Standard 1v1 (compétitif)",
        battlefield_selection="choisi (1 par game, pas de réutilisation dans le match)",
        match_structure="Best-of-3 (2 games gagnants)",
        sideboard=8,
        notes=[
            "Même Main Deck + Chosen Champion au game 1 de chaque match.",
            "Sideboard de 0 ou 8 cartes exactement, soumis aux contraintes du Main Deck "
            "(2 couleurs, max 3 copies maindeck+side confondus).",
            "Échanges maindeck<->sideboard entre les games (2 et 3), 1-pour-1 (le Main Deck reste à 40).",
            "On peut changer le Chosen Champion (vers un compatible Légende) en sideboarding ; "
            "PAS les runes, la Légende ni les battlefields.",
        ],
    ),
    "casual_bo1": Format(
        key="casual_bo1", label="Casual 1v1 (Bo1 / Duel)",
        battlefield_selection="aléatoire (1 battlefield tiré au hasard)",
        match_structure="Best-of-1",
        sideboard=None,
        rotation_applies=True,
        notes=["Pas de sideboard. Battlefield tiré aléatoirement parmi les 3 apportés."],
    ),
    "sealed": Format(
        key="sealed", label="Limited — Sealed",
        main_deck=25,           # exactement 25 cartes (CR tournoi 602.1.c)
        max_copies=99,          # pas de limite de copies en Limited
        battlefield_selection="selon les cartes ouvertes",
        match_structure="variable",
        sideboard=None,
        rotation_applies=False,
        notes=[
            "Main Deck d'exactement 25 cartes, construit à partir de 6 boosters fournis.",
            "Identité de domaine = 3 domaines au choix (ou un domaine + ceux de la Champion Legend).",
            "Chosen Champion : n'importe quel Champion Unit dans l'identité de domaine, même sans tag correspondant.",
        ],
    ),
}
 
# Formats casual : pas de ban list dédiée -> on retombe sur 'standard'.
BANLIST_FALLBACK = {"casual_bo1": "standard"}
 
 
# =============================================================================
# LOGIQUE
# =============================================================================
 
def legal_sets(on: date) -> list[dict]:
    """Sets sortis (<= date) et non retirés par une rotation en vigueur."""
    released = [s for s in SETS if s["release"] <= on]
    retired: set[str] = set()
    for r in ROTATIONS:
        if r["effective"] <= on:
            retired.update(r.get("retired_sets", []))
    return [s for s in released if s["code"] not in retired]
 
 
def applicable_banlist(fmt: Format, on: date) -> Optional[dict]:
    """Ban list la plus récente <= date pour ce format (avec fallback casual->standard)."""
    key = fmt.banlist_key
    lists = BAN_LISTS.get(key)
    if lists is None and key in BANLIST_FALLBACK:
        lists = BAN_LISTS.get(BANLIST_FALLBACK[key])
    if not lists:
        return None
    eligible = [b for b in lists if b["effective"] <= on]
    return max(eligible, key=lambda b: b["effective"]) if eligible else None
 
 
def generate(fmt: Format, on: date) -> str:
    sets = legal_sets(on)
    ban = applicable_banlist(fmt, on)
    L: list[str] = []
    add = L.append
 
    add(f"# Riftbound — Fiche de format : {fmt.label}")
    add(f"\n> Format `{fmt.key}` — règles de légalité au **{on.isoformat()}**.")
    add("> Généré par `riftbound_format_generator.py`. Le moteur de jeu est dans les fichiers de règles.\n")
 
    add("## Construction du deck")
    add(f"- **Main Deck** : {fmt.main_deck} cartes"
        + ("" if fmt.max_copies >= 99 else f" — max **{fmt.max_copies}** copies par carte (maindeck + sideboard)."))
    add(f"- **Rune Deck** : {fmt.rune_deck} runes (dans les 2 couleurs de la Légende).")
    add(f"- **Battlefields** : {fmt.battlefields_brought} apportés — sélection : {fmt.battlefield_selection}.")
    add("- **Légende** : définit l'identité de domaine (2 couleurs). **Chosen Champion** matche la Légende.")
    add("- **Signatures** : partagent un Champion Tag avec la Légende ; 3 max par tag.")
 
    add("\n## Structure de match")
    add(f"- {fmt.match_structure}.")
    if fmt.sideboard:
        add(f"- **Sideboard** : {fmt.sideboard} cartes (ou 0).")
        add(f"- Non modifiables en sideboarding : {', '.join(fmt.sideboard_locked)}.")
        add(f"- Chosen Champion modifiable en sideboarding : {'oui' if fmt.swap_chosen_champion else 'non'}.")
    else:
        add("- Pas de sideboard.")
 
    add("\n## Sets légaux" + (" (rotation appliquée)" if fmt.rotation_applies and ROTATIONS else ""))
    if sets:
        for s in sets:
            add(f"- **{s['code']}** — {s['name']} (sortie ~{s['release'].isoformat()})")
    else:
        add("- *(aucun set sorti à cette date)*")
    if fmt.rotation_applies and not ROTATIONS:
        add("- *Rotation : aucune en vigueur à cette date.*")
 
    add("\n## Ban list en vigueur")
    if not fmt.rotation_applies and fmt.key == "sealed":
        add("- *Sans objet en Limited (jeu avec les cartes ouvertes).*")
    elif ban:
        add(f"*En vigueur depuis le {ban['effective'].isoformat()}.* {ban.get('note','')}")
        if ban.get("cards"):
            add("\n**Cartes bannies :**")
            for c in ban["cards"]:
                add(f"- {c}")
        if ban.get("battlefields"):
            add("\n**Battlefields bannis :**")
            for b in ban["battlefields"]:
                add(f"- {b}")
    else:
        add("- *Aucune ban list connue à cette date.*")
 
    if fmt.notes:
        add("\n## Notes du format")
        for n in fmt.notes:
            add(f"- {n}")
 
    add("\n---")
    add("> ⚠️ Ban lists et rotation évoluent. Recouper avec le Rules Hub officiel avant un événement. "
        "Dates de sortie marquées APPROX dans les données du script.")
    return "\n".join(L) + "\n"
 
 
# =============================================================================
# CLI
# =============================================================================
 
def main() -> None:
    p = argparse.ArgumentParser(description="Génère une fiche de format Riftbound à une date donnée.")
    p.add_argument("--format", default="standard", help="clé du format (voir --list)")
    p.add_argument("--date", default=date.today().isoformat(), help="date ISO YYYY-MM-DD (instant T)")
    p.add_argument("--out", default=None, help="fichier de sortie .md (sinon stdout)")
    p.add_argument("--list", action="store_true", help="liste les formats connus et quitte")
    args = p.parse_args()
 
    if args.list:
        print("Formats connus :")
        for k, f in FORMATS.items():
            print(f"  {k:12s} — {f.label}")
        return
 
    if args.format not in FORMATS:
        raise SystemExit(f"Format inconnu : {args.format}. Voir --list.")
    try:
        on = date.fromisoformat(args.date)
    except ValueError:
        raise SystemExit(f"Date invalide : {args.date} (attendu YYYY-MM-DD).")
 
    md = generate(FORMATS[args.format], on)
    if args.out:
        with open(args.out, "w", encoding="utf-8") as fh:
            fh.write(md)
        print(f"Écrit : {args.out}")
    else:
        print(md)
 
 
if __name__ == "__main__":
    main()
 