"""
Cleanup script for Graphiked vault YAML frontmatter.

Changes:
1. Remove `format:` from Videos/
2. Remove `intervenants:` from Videos/
3. Remove `statut:` from Videos/, Individus/, Organisations/, Concepts/, Enjeux/
4. Remove `quadrant_graphique:` from Individus/, Organisations/
5. Remove `## Position dans le [[Saint Graphique]]` section from Individus/
"""

import os
import re
from pathlib import Path

BASE = Path(r"C:\Users\uboil\Documents\Obsidian\Graphiked")

SKIP_FILES = {"CLAUDE.md", "_index.md", "_index.base"}

changes_log = []


def get_md_files(directory: Path):
    """Get all .md files in a directory, excluding CLAUDE.md and _index.md."""
    if not directory.exists():
        return []
    return [
        f for f in directory.iterdir()
        if f.suffix == ".md" and f.name not in SKIP_FILES
    ]


def remove_frontmatter_field(content: str, field_name: str) -> tuple[str, bool]:
    """Remove a YAML frontmatter field (single or multi-line) from content."""
    lines = content.split("\n")

    # Find frontmatter boundaries
    fm_start = None
    fm_end = None
    for i, line in enumerate(lines):
        if line.strip() == "---":
            if fm_start is None:
                fm_start = i
            else:
                fm_end = i
                break

    if fm_start is None or fm_end is None:
        return content, False

    # Process frontmatter lines
    new_lines = lines[:fm_start + 1]  # include opening ---
    removed = False
    i = fm_start + 1
    while i < fm_end:
        line = lines[i]
        # Check if this line starts the target field
        if re.match(rf'^{re.escape(field_name)}:', line):
            removed = True
            i += 1
            # Skip continuation lines (indented lines that are part of this field)
            while i < fm_end and lines[i].startswith("  "):
                i += 1
            continue
        new_lines.append(line)
        i += 1

    new_lines.append("---")  # closing ---
    new_lines.extend(lines[fm_end + 1:])  # rest of file

    return "\n".join(new_lines), removed


def remove_section(content: str, heading_pattern: str) -> tuple[str, bool]:
    """Remove a markdown section (heading + content until next same-level heading)."""
    lines = content.split("\n")
    new_lines = []
    removing = False
    removed = False

    for line in lines:
        if removing:
            # Stop removing when we hit the next ## heading
            if re.match(r'^## ', line):
                removing = False
                new_lines.append(line)
            # else: skip this line (still in removed section)
            continue

        if re.match(heading_pattern, line):
            removing = True
            removed = True
            # Also remove blank line before the heading if present
            if new_lines and new_lines[-1].strip() == "":
                new_lines.pop()
            continue

        new_lines.append(line)

    return "\n".join(new_lines), removed


def process_file(filepath: Path, operations: list[str]) -> list[str]:
    """Process a single file with the given operations. Returns list of changes made."""
    content = filepath.read_text(encoding="utf-8")
    original = content
    file_changes = []

    for op in operations:
        if op == "remove_format":
            content, changed = remove_frontmatter_field(content, "format")
            if changed:
                file_changes.append("removed format:")
        elif op == "remove_intervenants":
            content, changed = remove_frontmatter_field(content, "intervenants")
            if changed:
                file_changes.append("removed intervenants:")
        elif op == "remove_statut":
            content, changed = remove_frontmatter_field(content, "statut")
            if changed:
                file_changes.append("removed statut:")
        elif op == "remove_quadrant_graphique":
            content, changed = remove_frontmatter_field(content, "quadrant_graphique")
            if changed:
                file_changes.append("removed quadrant_graphique:")
        elif op == "remove_saint_graphique_section":
            content, changed = remove_section(
                content, r'^## Position dans le \[\[Saint Graphique\]\]'
            )
            if changed:
                file_changes.append("removed ## Position dans le [[Saint Graphique]] section")

    if content != original:
        filepath.write_text(content, encoding="utf-8")

    return file_changes


def main():
    total_files = 0
    total_changes = 0

    # Videos/: remove format, intervenants, statut
    print("=== Processing Videos/ ===")
    for f in get_md_files(BASE / "Videos"):
        changes = process_file(f, ["remove_format", "remove_intervenants", "remove_statut"])
        if changes:
            total_files += 1
            total_changes += len(changes)
            print(f"  {f.name}: {', '.join(changes)}")

    # Individus/: remove statut, quadrant_graphique, Saint Graphique section
    print("\n=== Processing Individus/ ===")
    for f in get_md_files(BASE / "Individus"):
        changes = process_file(f, [
            "remove_statut", "remove_quadrant_graphique", "remove_saint_graphique_section"
        ])
        if changes:
            total_files += 1
            total_changes += len(changes)
            print(f"  {f.name}: {', '.join(changes)}")

    # Organisations/: remove statut, quadrant_graphique
    print("\n=== Processing Organisations/ ===")
    for f in get_md_files(BASE / "Organisations"):
        changes = process_file(f, ["remove_statut", "remove_quadrant_graphique"])
        if changes:
            total_files += 1
            total_changes += len(changes)
            print(f"  {f.name}: {', '.join(changes)}")

    # Concepts/: remove statut
    print("\n=== Processing Concepts/ ===")
    for f in get_md_files(BASE / "Concepts"):
        changes = process_file(f, ["remove_statut"])
        if changes:
            total_files += 1
            total_changes += len(changes)
            print(f"  {f.name}: {', '.join(changes)}")

    # Enjeux/: remove statut
    print("\n=== Processing Enjeux/ ===")
    for f in get_md_files(BASE / "Enjeux"):
        changes = process_file(f, ["remove_statut"])
        if changes:
            total_files += 1
            total_changes += len(changes)
            print(f"  {f.name}: {', '.join(changes)}")

    print(f"\n=== SUMMARY ===")
    print(f"Files modified: {total_files}")
    print(f"Total field removals: {total_changes}")


if __name__ == "__main__":
    main()
