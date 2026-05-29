# NBA Shots — 4.4 Million Stories

Interactive data-visualization project for **COM-480 (EPFL)** exploring how NBA shot selection evolved from 2003–04 to 2024–25 across the league, teams, and players.

**Repository:** [github.com/com-480-data-visualization/com-480-project-pff](https://github.com/com-480-data-visualization/com-480-project-pff)

---

## Quick start — run the website

The site is a **static** front end in `website/`. It loads JSON via `fetch` / `d3.json`, so serve it over HTTP (a `file://` URL will not work).

```bash
git clone https://github.com/com-480-data-visualization/com-480-project-pff.git
cd com-480-project-pff/website
python3 -m http.server 8000
```

Then open [http://localhost:8000](http://localhost:8000).

No build step. D3, Three.js, and fonts are loaded from CDNs in `index.html`.

### GitHub Pages

Live site: [com-480-data-visualization.github.io/com-480-project-pff](https://com-480-data-visualization.github.io/com-480-project-pff/)

---

## Intended usage

The narrative scrolls through six analytical views:


| Section                | What it shows                                                     |
| ---------------------- | ----------------------------------------------------------------- |
| **Hero**               | 3D particle court — sample of shots over time                     |
| **Expected value**     | Court heatmap: points per attempt, FG%, or volume                 |
| **League adaptation**  | Season-by-season shot maps vs league average + trend lines        |
| **Team DNA**           | Zone profiles: team vs league vs champion                         |
| **Player fingerprint** | Radial chart of zone frequency and efficiency                     |
| **Player movement**    | Stacked zone shares across team stints                            |
| **Clutch**             | Last-5-seconds Q4 shot locations vs rest of game + player scatter |


**Interaction tips**

- Use toggles, sliders, and tabs in each section to filter seasons, players, or teams.
- Hover court cells on heatmaps for exact values (ratio, counts, FG%).

**Audience:** basketball fans and anyone interested in spatial sports analytics, without requiring a statistics background.

---

## Technical setup

**Website**: static HTML/CSS/JS in `website/`. One shared module (`court.js`) plus one file per visualization. D3 v7 for charts; Three.js (ES module) for the hero section only.

**Data pipeline**: `preprocess.py` (Python 3.10+, `numpy`, `pandas` in `requirements.txt`) reads raw season CSVs and writes JSON to `website/data/`. Those JSON files are committed, so the site runs without reprocessing.

To regenerate data:

1. Clone [NBA_Shots_04_25](https://github.com/DomSamangy/NBA_Shots_04_25) into `NBA_Shots_04_25/` at the repo root (`NBA_*_Shots.csv`).
2. Install deps and run:

```bash
python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
python preprocess.py
```

Expect several minutes and ~8 GB RAM for the full merge.

---

## Repository structure

```
com-480-project-pff/
├── README.md
├── requirements.txt
├── preprocess.py
├── eda.ipynb
├── NBA_Shots_04_25/          # Raw CSVs (gitignored)
└── website/
    ├── index.html
    ├── style.css
    ├── js/
    │   ├── court.js          # Shared court geometry, pct(), shortTeam()
    │   ├── hero.js           # Three.js (ES module)
    │   ├── value.js
    │   ├── revolution.js
    │   ├── team.js
    │   ├── fingerprint.js
    │   ├── player-evolution.js
    │   ├── clutch.js
    │   └── main.js
    └── data/                 # Preprocessed JSON (committed)
```

---

## Data

### Source dataset

[NBA_Shots_04_25](https://github.com/DomSamangy/NBA_Shots_04_25): NBA regular-season shot data from **2003–04 to 2024–25** (~4.4M attempts). Each row is one field-goal attempt with player, team, outcome, shot type, court coordinates, zone, and game-clock context.

### What is hosted on GitHub


| Path                    | In repository?  | Description                         |
| ----------------------- | --------------- | ----------------------------------- |
| `website/data/*.json`   | Yes             | Aggregated data used by the website |
| `NBA_Shots_04_25/*.csv` | No (gitignored) | Raw season CSVs — clone separately  |


```bash
git clone https://github.com/DomSamangy/NBA_Shots_04_25.git NBA_Shots_04_25
```

### Preprocessing

`preprocess.py` merges seasons, normalizes coordinates (including 2020-22 compressed coords), bins shots on a hex grid, and exports JSON for expected value, seasonal heatmaps, team/player profiles, clutch comparison, and hero samples.