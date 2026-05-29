# NBA Shots — 4.4 Million Stories

Interactive data-visualization project for **COM-480 (EPFL)** exploring how NBA shot selection evolved from 2003–04 to 2024–25 across the league, teams, and players.

**Repository:** [github.com/com-480-data-visualization/com-480-project-pff](https://github.com/com-480-data-visualization/com-480-project-pff)

---

## Quick start — run the website

The site is a **static** front end (`website/`). It loads JSON from `website/data/` and must be served over HTTP (opening `index.html` directly will block `fetch` / `d3.json`).

1. Clone the repository and go to the project root:

```bash
git clone https://github.com/com-480-data-visualization/com-480-project-pff.git
cd com-480-project-pff
```

2. Start a local server from the `website` folder:

```bash
cd website
python3 -m http.server 8000
```

3. Open [http://localhost:8000](http://localhost:8000) in a browser.

**Alternatives**

```bash
# Node (npx, no install)
npx --yes serve website

# PHP built-in server
cd website && php -S localhost:8000
```

No build step or package manager is required for the website. Dependencies (D3, Three.js, Google Fonts) are loaded from CDNs in `index.html`.

---

## Intended usage

The narrative scrolls through six analytical views:

| Section | What it shows |
|--------|----------------|
| **Hero** | 3D particle court — sample of shots over time |
| **Expected value** | Court heatmap: points per attempt, FG%, or volume |
| **League adaptation** | Season-by-season shot maps vs league average + trend lines |
| **Team DNA** | Zone profiles: team vs league vs champion |
| **Player fingerprint** | Radial chart of zone frequency and efficiency |
| **Player movement** | Stacked zone shares across team stints |
| **Clutch** | Last-5-seconds Q4 shot locations vs rest of game + player scatter |

**Interaction tips**

- Use toggles, sliders, and tabs in each section to filter seasons, players, or teams.
- Hover court cells on heatmaps for exact values (ratio, counts, FG%).
- Player headshots are loaded from `cdn.nba.com` (requires network).

**Audience:** basketball fans and anyone interested in spatial sports analytics, without requiring a statistics background.

---

## Technical setup

### Requirements

| Component | Version / notes |
|-----------|-----------------|
| **Browser** | Modern evergreen browser (Chrome, Firefox, Safari, Edge) |
| **Python** | 3.10+ — only needed to **regenerate** JSON from raw CSVs |
| **Local HTTP server** | Any static file server (see Quick start) |

### Regenerating `website/data` (optional)

Preprocessed JSON files are **committed** in `website/data/`, so you can run the site without raw CSVs. To rebuild them from source:

1. Download the raw shot data into `NBA_Shots_04_25/` (see [Data](#data)).

2. Install Python dependencies:

```bash
python3 -m venv .venv
source .venv/bin/activate   # Windows: .venv\Scripts\activate
pip install -r requirements.txt
```

3. Run preprocessing from the repository root:

```bash
python preprocess.py
```

This reads all `NBA_Shots_04_25/NBA_*_Shots.csv` files and writes aggregated JSON under `website/data/`. Expect several minutes and ~8 GB RAM for the full merge.

### Exploratory analysis

`eda.ipynb` documents early data exploration (pandas, matplotlib). Open with Jupyter:

```bash
pip install jupyter matplotlib
jupyter notebook eda.ipynb
```

---

## Repository structure

```
com-480-project-pff/
├── README.md                 # This file
├── requirements.txt          # Python deps for preprocess.py
├── preprocess.py             # CSV → website/data/*.json
├── eda.ipynb                 # Exploratory analysis notebook
├── NBA_Shots_04_25/          # Raw season CSVs (not in git — see Data)
└── website/                  # Static interactive site
    ├── index.html
    ├── style.css
    ├── js/                   # One module per visualization
    │   ├── court.js          # Shared court geometry & drawing
    │   ├── hero.js           # Three.js hero (ES module)
    │   ├── value.js
    │   ├── revolution.js
    │   ├── team.js
    │   ├── fingerprint.js
    │   ├── player-evolution.js
    │   ├── clutch.js
    │   └── main.js           # Scroll / nav behavior
    └── data/                 # Preprocessed JSON (committed)
```

### Front-end stack

- **HTML / CSS / vanilla JavaScript** — no bundler; each viz is an async IIFE in its own file.
- **[D3.js v7](https://d3js.org/)** — charts, scales, axes, transitions.
- **[Three.js r160](https://threejs.org/)** — hero court (ES modules via import map).
- **ES modules** only in `hero.js`; other scripts are classic scripts with global `Court` from `court.js`.

---

## Data

### Source dataset

We use [NBA_Shots_04_25](https://github.com/DomSamangy/NBA_Shots_04_25): NBA regular-season shot data from **2003–04 to 2024–25** (~4.4M attempts). Each row is one field-goal attempt with player, team, outcome, shot type, court coordinates, zone, and game-clock context.

### What is hosted on GitHub

| Path | In repository? | Description |
|------|----------------|-------------|
| `website/data/*.json` | Yes | Aggregated data used by the website |
| `NBA_Shots_04_25/*.csv` | **No** (gitignored) | Full raw CSVs (~GB) — clone separately |

To obtain raw CSVs:

```bash
git clone https://github.com/DomSamangy/NBA_Shots_04_25.git NBA_Shots_04_25
```

Place the folder at the repository root (next to `preprocess.py`). Season files must match `NBA_*_Shots.csv`.

### Preprocessing summary

`preprocess.py` merges seasons, normalizes coordinates (including 2020–22 compressed coords), bins shots on a hex grid, and exports compact JSON for expected value, seasonal heatmaps, team/player profiles, clutch comparison, and hero samples.
