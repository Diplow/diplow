---
date created: Tuesday, March 31st 2026, 11:20:04 am
date modified: Wednesday, April 15th 2026, 1:40:01 pm
---
# Inventaire vidéos PaduTeam

> Vue dynamique — source : `Sources/Transcripts/` × `Videos/`. Mise à jour automatique.

```dataviewjs
// Normalise un nom de fichier : minuscules, sans accents, sans ponctuation
function norm(s) {
    return s.toLowerCase()
        .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
        .replace(/[^a-z0-9]/g, " ")
        .replace(/\s+/g, " ").trim()
}

const videoPages = dv.pages('"Videos"').array()

// Index 1 — youtube_id : matching prioritaire si transcript et fiche partagent le même ID
const ficheByYtId = new Map()
for (const fiche of videoPages) {
    if (fiche.youtube_id) ficheByYtId.set(String(fiche.youtube_id), fiche)
}

// Index 2 — outlinks : chaque fiche contient [[nom exact du transcript]]
// Le path Dataview inclut ".md" → on le retire avant de stocker la clé
const ficheByOutlink = new Map()
for (const fiche of videoPages) {
    for (const link of (fiche.file.outlinks ?? [])) {
        let basename = link.path.split("/").pop()
        if (basename?.endsWith(".md")) basename = basename.slice(0, -3)
        if (basename) ficheByOutlink.set(basename, fiche)
    }
}

// Index 3 — norm() : fallback quand le nom de fiche ≈ nom de transcript
const ficheByNorm = new Map()
for (const fiche of videoPages) {
    ficheByNorm.set(norm(fiche.file.name), fiche)
}

// Tous les transcripts (exclure fichiers système _*) — tableau JS natif
const transcripts = dv.pages('"Sources/Transcripts"')
    .where(p => !p.file.name.startsWith("_"))
    .array()

// date Dataview = objet Luxon DateTime → convertir en string YYYY-MM-DD
function dateStr(d) {
    if (!d) return ""
    if (typeof d === "string") return d.substring(0, 10)
    if (d.toFormat) return d.toFormat("yyyy-MM-dd")
    return String(d).substring(0, 10)
}

// Construire les lignes — stocker chemins et noms bruts (pas d'objets Dataview Link)
const rows = transcripts.map(t => {
    const ytId = t.youtube_id ? String(t.youtube_id) : null
    const fiche = (ytId ? ficheByYtId.get(ytId) : null)
               ?? ficheByOutlink.get(t.file.name)
               ?? ficheByNorm.get(norm(t.file.name))
    return {
        transcriptName: t.file.name,
        transcriptPath: t.file.path,
        fichePath: fiche ? fiche.file.path : null,
        date: dateStr(fiche?.date),
        enjeux: Array.isArray(fiche?.enjeux) ? fiche.enjeux.join(", ") : (fiche?.enjeux ?? "")
    }
})

// Helper : créer un lien interne Obsidian sans passer par dv.renderValue
function internalLink(td, path, text) {
    const a = td.createEl("a", { text, cls: "internal-link" })
    a.setAttribute("data-href", path)
    a.setAttribute("href", path)
}

// --- UI interactive ---
const { container } = this
let dateAsc = false
let enjeuFilter = ""
let ficheFilter = "all" // "all" | "avec" | "sans"

const controls = container.createEl("div")
controls.style.cssText = "display:flex; gap:8px; align-items:center; margin-bottom:10px; flex-wrap:wrap;"

const input = controls.createEl("input", { type: "text", placeholder: "Filtrer par enjeu…" })
input.style.cssText = "padding:4px 8px; border-radius:4px; border:1px solid var(--background-modifier-border); width:220px;"

const ficheSelect = controls.createEl("select")
ficheSelect.style.cssText = "padding:4px 8px; border-radius:4px; border:1px solid var(--background-modifier-border); cursor:pointer;"
for (const [val, label] of [["all", "Toutes"], ["avec", "Avec fiche"], ["sans", "Sans fiche"]]) {
    const opt = ficheSelect.createEl("option", { text: label })
    opt.value = val
}

const sortBtn = controls.createEl("button", { text: "Date ↓" })
sortBtn.style.cssText = "padding:4px 8px; border-radius:4px; cursor:pointer;"

const countEl = controls.createEl("span")
countEl.style.cssText = "color:var(--text-muted); font-size:0.85em;"

const tableDiv = container.createEl("div")

function render() {
    tableDiv.empty()

    let filtered = enjeuFilter
        ? rows.filter(r => norm(r.enjeux).includes(enjeuFilter))
        : rows

    if (ficheFilter === "avec") filtered = filtered.filter(r => r.fichePath)
    else if (ficheFilter === "sans") filtered = filtered.filter(r => !r.fichePath)

    const sorted = [...filtered].sort((a, b) => {
        if (a.date && b.date) return dateAsc
            ? a.date.localeCompare(b.date)
            : b.date.localeCompare(a.date)
        if (a.date) return -1
        if (b.date) return 1
        return a.transcriptName.localeCompare(b.transcriptName)
    })

    countEl.setText(`${sorted.length} vidéos`)

    const table = tableDiv.createEl("table", { cls: "dataview table-view-table" })
    const thead = table.createEl("thead")
    const hr = thead.createEl("tr")
    for (const h of ["Transcript", "Fiche", "Date", "Enjeux"]) {
        hr.createEl("th", { text: h })
    }
    const tbody = table.createEl("tbody")
    for (const r of sorted) {
        const tr = tbody.createEl("tr")
        internalLink(tr.createEl("td"), r.transcriptPath, r.transcriptName)
        if (r.fichePath) internalLink(tr.createEl("td"), r.fichePath, "↗")
        else tr.createEl("td")
        tr.createEl("td", { text: r.date })
        tr.createEl("td", { text: r.enjeux })
    }
}

input.addEventListener("input", () => { enjeuFilter = norm(input.value); render() })
ficheSelect.addEventListener("change", () => { ficheFilter = ficheSelect.value; render() })
sortBtn.addEventListener("click", () => {
    dateAsc = !dateAsc
    sortBtn.setText(dateAsc ? "Date ↑" : "Date ↓")
    render()
})

render()
```
| LA CHUTE DE CNEWS et PASCAL PRAUD                                                                    | [YouTube](https://www.youtube.com/watch?v=0ohw7XlMsXo) |                   | [[LA CHUTE DE CNEWS et PASCAL PRAUD]]                                                                  |                                                        |
| PS : VIRAGE A GAUCHE DANS LEUR NOUVEAU PROGRAMME, ARNAQUE OU BANGER ?                                | [YouTube](https://www.youtube.com/watch?v=8xR1hWvsDaQ) |                   | [[PS  VIRAGE A GAUCHE DANS LEUR NOUVEAU PROGRAMME, ARNAQUE OU BANGER]]                                 |                                                        |
| TRUMP, MELONI, MILEI : LA FIN DE L'INTERNATIONALE RÉACTIONNAIRE ?                                    | [YouTube](https://www.youtube.com/watch?v=V-HmXl_Jrz4) |                   | [[TRUMP, MELONI, MILEI  LA FIN DE L'INTERNATIONALE RÉACTIONNAIRE]]                                     |                                                        |
| RUFFIN LANCE SA CAMPAGNE NATIONALE-SOCIALISTE !                                                      | [YouTube](https://www.youtube.com/watch?v=Z1K5VWA_Zos) |                   | [[RUFFIN LANCE SA CAMPAGNE NATIONALE-SOCIALISTE !]]                                                    |                                                        |
| ACTION, LIDL, AMAZON : L'EXPLOITATION 2.0 !                                                          | [YouTube](https://www.youtube.com/watch?v=xV_j5TCoMig) |                   | [[ACTION, LIDL, AMAZON  L'EXPLOITATION 2.0 !]]                                                         |                                                        |
| MATHIEU PIGASSE : L’ULTRA RICHE QUI VEUT SAUVER LA GAUCHE                                            | [YouTube](https://www.youtube.com/watch?v=dWvjdxOb53A) |                   | [[MATHIEU PIGASSE  L’ULTRA RICHE QUI VEUT SAUVER LA GAUCHE]]                                           |                                                        |
| LA PRIMAIRE des NOISETTES EN ROUTE pour la CATASTROPHE (épisode 263)                                 | [YouTube](https://www.youtube.com/watch?v=AMR2w32OkmU) |                   | [[LA PRIMAIRE des NOISETTES EN ROUTE pour la CATASTROPHE (épisode 263)]]                               |                                                        |
| BARDELLA VS LE PEN : GUERRE AU RN ET CHANGEMENT DE LIGNE ?                                           | [YouTube](https://www.youtube.com/watch?v=XCVIN2-MAww) |                   | [[BARDELLA VS LE PEN  GUERRE AU RN ET CHANGEMENT DE LIGNE]]                                            |                                                        |
| L'ANGLE MORT DE LA FRANCE INSOUMISE : LE PATRONAT !                                                  | [YouTube](https://www.youtube.com/watch?v=-LxOG_3Mvm0) |                   | [[L'ANGLE MORT DE LA FRANCE INSOUMISE  LE PATRONAT !]]                                                 |                                                        |
| PHILIPPE, RETAILLEAU, ZEMMOUR : LA GUERRE DES NOISETTES DE DROITE A DÉMARRÉ !                        | [YouTube](https://www.youtube.com/watch?v=ns7qtJdHAm4) |                   | [[PHILIPPE, RETAILLEAU, ZEMMOUR  LA GUERRE DES NOISETTES DE DROITE A DÉMARRÉ !]]                       |                                                        |
| DELCY RODRIGUEZ A-T-ELLE TRAHI CHAVEZ ET MADURO ?                                                    | [YouTube](https://www.youtube.com/watch?v=Wlh1GgHrlhM) |                   | [[DELCY RODRIGUEZ A-T-ELLE TRAHI CHAVEZ ET MADURO]]                                                    |                                                        |