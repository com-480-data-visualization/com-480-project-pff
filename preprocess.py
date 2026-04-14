"""
One-time preprocessing script.
Reads all NBA season CSVs and outputs compact JSON files for the website.
"""
import glob
import json
import math
import os

import numpy as np
import pandas as pd

DATA_DIR = "NBA_Shots_04_25"
OUT_DIR = "website/data"
os.makedirs(OUT_DIR, exist_ok=True)

PLAYERS = {
    "LeBron James":        2544,
    "Stephen Curry":       201939,
    "Victor Wembanyama":   1641705,
}

# ── Load ──────────────────────────────────────────────────────────────────────
print("Loading CSVs…")
csv_files = sorted(glob.glob(f"{DATA_DIR}/NBA_*_Shots.csv"))
df = pd.concat(
    (pd.read_csv(f, low_memory=False) for f in csv_files),
    ignore_index=True,
)
print(f"  {len(df):,} rows loaded")

# ── Clean ─────────────────────────────────────────────────────────────────────
df["SHOT_MADE"] = df["SHOT_MADE"].map(
    {True: 1, False: 0, "TRUE": 1, "FALSE": 0}
).astype("Int8")
df["LOC_X"] = pd.to_numeric(df["LOC_X"], errors="coerce")
df["LOC_Y"] = pd.to_numeric(df["LOC_Y"], errors="coerce")
df["SHOT_DISTANCE"] = pd.to_numeric(df["SHOT_DISTANCE"], errors="coerce")
df["SEASON_1"] = df["SEASON_1"].astype("int16")
df["IS_3PT"] = (df["SHOT_TYPE"] == "3PT Field Goal").astype("Int8")
df = df.dropna(subset=["LOC_X", "LOC_Y"]).reset_index(drop=True)
# Remove backcourt heaves (distance > 50 ft)
df = df[df["SHOT_DISTANCE"] <= 50].reset_index(drop=True)
print(f"  {len(df):,} rows after cleaning")

# ─────────────────────────────────────────────────────────────────────────────
# 1. HERO PARTICLES  (50k sampled shots)
# ─────────────────────────────────────────────────────────────────────────────
print("Generating hero_particles.json…")
sample = df.sample(n=50_000, random_state=42)[
    ["LOC_X", "LOC_Y", "SHOT_MADE", "SEASON_1"]
].copy()
sample.columns = ["x", "y", "made", "season"]
sample["x"] = sample["x"].round(2)
sample["y"] = sample["y"].round(2)
sample["made"] = sample["made"].astype(int)
sample["season"] = sample["season"].astype(int)

with open(f"{OUT_DIR}/hero_particles.json", "w") as f:
    json.dump(sample.to_dict(orient="list"), f, separators=(",", ":"))
print(f"  {len(sample):,} particles written")


# ─────────────────────────────────────────────────────────────────────────────
# 2. HEX BY SEASON  (hex-bin the court for each season)
# ─────────────────────────────────────────────────────────────────────────────
print("Generating hex_by_season.json…")

GRID = 25          # hex grid resolution (columns)
X_RANGE = (-25, 25)
Y_RANGE = (0, 42.5)

def hex_bin(sub, grid=GRID):
    """Return list of {q, r, cx, cy, count, made} dicts for one season."""
    # Use axial hex coords with flat-top hexagons
    hex_w = (X_RANGE[1] - X_RANGE[0]) / grid
    hex_h = hex_w * math.sqrt(3) / 2
    rows_n = int((Y_RANGE[1] - Y_RANGE[0]) / hex_h) + 1

    buckets: dict[tuple, list] = {}
    for _, row in sub.iterrows():
        q = int((row["LOC_X"] - X_RANGE[0]) / hex_w)
        r = int((row["LOC_Y"] - Y_RANGE[0]) / hex_h)
        key = (max(0, min(q, grid - 1)), max(0, min(r, rows_n - 1)))
        buckets.setdefault(key, [0, 0])
        buckets[key][0] += 1
        buckets[key][1] += int(row["SHOT_MADE"])

    result = []
    for (q, r), (count, made) in buckets.items():
        cx = round(X_RANGE[0] + (q + 0.5) * hex_w, 2)
        cy = round(Y_RANGE[0] + (r + 0.5) * hex_h, 2)
        result.append({
            "q": q, "r": r,
            "cx": cx, "cy": cy,
            "count": count,
            "fg": round(made / count, 4) if count > 0 else 0,
        })
    return result

seasons = sorted(df["SEASON_1"].unique().tolist())
hex_data = {}

# Also compute league averages per cell across all seasons (for relative coloring)
all_hex = hex_bin(df)
league_avg_count = {(h["q"], h["r"]): h["count"] / len(seasons) for h in all_hex}
max_avg = max(league_avg_count.values()) if league_avg_count else 1

for season in seasons:
    sub = df[df["SEASON_1"] == season]
    bins = hex_bin(sub)
    season_total = len(sub)
    for h in bins:
        avg = league_avg_count.get((h["q"], h["r"]), 1)
        h["rel"] = round(h["count"] / max(avg, 1), 3)  # relative to league avg cell
    hex_data[int(season)] = bins

with open(f"{OUT_DIR}/hex_by_season.json", "w") as f:
    json.dump({"seasons": [int(s) for s in seasons], "data": hex_data}, f, separators=(",", ":"))
print(f"  {len(seasons)} seasons written")


# ─────────────────────────────────────────────────────────────────────────────
# 3. PLAYER FINGERPRINTS
# ─────────────────────────────────────────────────────────────────────────────
print("Generating players_fingerprint.json…")

ZONES = [
    "Restricted Area",
    "In The Paint (Non-RA)",
    "Mid-Range",
    "Left Corner 3",
    "Right Corner 3",
    "Above the Break 3",
    "Backcourt",
]

fingerprint_data = {}
for name, pid in PLAYERS.items():
    sub = df[df["PLAYER_ID"] == pid]
    if sub.empty:
        print(f"  WARNING: {name} not found")
        continue

    by_zone = (
        sub.groupby("BASIC_ZONE", observed=True)
        .agg(count=("SHOT_MADE", "count"), made=("SHOT_MADE", "sum"))
        .reindex(ZONES, fill_value=0)
        .reset_index()
    )
    total = by_zone["count"].sum()
    by_zone["freq"] = (by_zone["count"] / max(total, 1)).round(4)
    by_zone["fg"] = (by_zone["made"] / by_zone["count"].replace(0, np.nan)).round(4).fillna(0)

    # Season-by-season 3PT rate (for sparkline)
    seasons_3pt = (
        sub.groupby("SEASON_1")
        .apply(lambda g: round(g["IS_3PT"].mean(), 4))
        .reset_index()
    )
    seasons_3pt.columns = ["season", "three_rate"]

    fingerprint_data[name] = {
        "player_id": pid,
        "total_shots": int(total),
        "overall_fg": round(float(sub["SHOT_MADE"].mean()), 4),
        "zones": by_zone[["BASIC_ZONE", "count", "freq", "fg"]].rename(
            columns={"BASIC_ZONE": "zone", "count": "n"}
        ).to_dict(orient="records"),
        "seasons_3pt": seasons_3pt.to_dict(orient="records"),
    }
    print(f"  {name}: {int(total):,} shots")

with open(f"{OUT_DIR}/players_fingerprint.json", "w") as f:
    json.dump(fingerprint_data, f, separators=(",", ":"), default=str)


# ─────────────────────────────────────────────────────────────────────────────
# 4. EXPECTED VALUE GRID
# ─────────────────────────────────────────────────────────────────────────────
print("Generating expected_value.json…")

EV_GRID = 50   # finer grid for smooth heat map
ev_x = np.linspace(X_RANGE[0], X_RANGE[1], EV_GRID)
ev_y = np.linspace(Y_RANGE[0], Y_RANGE[1], EV_GRID)
cell_w = ev_x[1] - ev_x[0]
cell_h = ev_y[1] - ev_y[0]

df["ev_col"] = ((df["LOC_X"] - X_RANGE[0]) / cell_w).clip(0, EV_GRID - 1).astype(int)
df["ev_row"] = ((df["LOC_Y"] - Y_RANGE[0]) / cell_h).clip(0, EV_GRID - 1).astype(int)
df["pt_value"] = df["IS_3PT"].map({1: 3, 0: 2}).astype(int)

ev_grid = (
    df.groupby(["ev_col", "ev_row"])
    .agg(
        count=("SHOT_MADE", "count"),
        made=("SHOT_MADE", "sum"),
        pts=("pt_value", "mean"),
    )
    .reset_index()
)
ev_grid["fg"] = (ev_grid["made"] / ev_grid["count"]).round(4)
ev_grid["ev"] = (ev_grid["fg"] * ev_grid["pts"]).round(4)
ev_grid["cx"] = (ev_x[ev_grid["ev_col"].values] + cell_w / 2).round(2)
ev_grid["cy"] = (ev_y[ev_grid["ev_row"].values] + cell_h / 2).round(2)

# Keep cells with at least 30 shots for reliability
ev_grid = ev_grid[ev_grid["count"] >= 30]

ev_records = ev_grid[["cx", "cy", "count", "fg", "ev", "pts"]].to_dict(orient="records")
for r in ev_records:
    for k in ["count"]:
        r[k] = int(r[k])

with open(f"{OUT_DIR}/expected_value.json", "w") as f:
    json.dump(ev_records, f, separators=(",", ":"))
print(f"  {len(ev_records):,} EV cells written")


# ─────────────────────────────────────────────────────────────────────────────
# 5. CLUTCH SHOTS
# ─────────────────────────────────────────────────────────────────────────────
print("Generating clutch_shots.json…")

# Q4 only (last 5 seconds): most dramatic clutch moments
clutch = df[
    (df["MINS_LEFT"] == 0) &
    (df["SECS_LEFT"] <= 5) &
    (df["QUARTER"] == 4)
].copy()

# Build lookup tables for strings to minimise JSON size
players_lu = sorted(clutch["PLAYER_NAME"].unique().tolist())
teams_lu   = sorted(clutch["TEAM_NAME"].unique().tolist())
p_idx = {v: i for i, v in enumerate(players_lu)}
t_idx = {v: i for i, v in enumerate(teams_lu)}

shots_compact = []
for _, row in clutch.iterrows():
    shots_compact.append([
        round(float(row["LOC_X"]), 1),
        round(float(row["LOC_Y"]), 1),
        int(row["SHOT_MADE"]),
        int(row["SEASON_1"]),
        p_idx[row["PLAYER_NAME"]],
        t_idx[row["TEAM_NAME"]],
        int(row["SECS_LEFT"]),
        1 if row["SHOT_TYPE"] == "3PT Field Goal" else 0,
    ])

# Top teams and players by clutch attempts (for filter dropdowns)
top_teams   = clutch["TEAM_NAME"].value_counts().head(32).index.tolist()
top_players = clutch["PLAYER_NAME"].value_counts().head(50).index.tolist()

with open(f"{OUT_DIR}/clutch_shots.json", "w") as f:
    json.dump({
        "fields": ["x","y","made","season","player_idx","team_idx","secs","is3"],
        "players": players_lu,
        "teams": teams_lu,
        "top_teams": top_teams,
        "top_players": top_players,
        "shots": shots_compact,
    }, f, separators=(",", ":"))
print(f"  {len(shots_compact):,} Q4-clutch shots written")

print("\nAll JSON files generated successfully.")
print(f"Output directory: {OUT_DIR}/")
for fname in sorted(os.listdir(OUT_DIR)):
    size = os.path.getsize(f"{OUT_DIR}/{fname}") / 1024
    print(f"  {fname:40s} {size:8.1f} KB")
