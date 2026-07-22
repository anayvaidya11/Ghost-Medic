#!/usr/bin/env python3
"""Renders the website's three chart plates from the CSVs in this folder.

The data comes from the shipping code (see trace_driver.c and
debounce_data.mjs). This script only draws it.

Style: single green data series, gray reference lines, transparent background
so the plate sits on the site's paper panel. Text is embedded as paths, so the
SVGs render identically with no fonts installed.

Run (matplotlib needed, any venv):  python3 make_charts.py
Outputs land in ../../site/assets/charts/.
"""

import csv
import pathlib

import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt

OUT = pathlib.Path(__file__).resolve().parents[2] / "site" / "assets" / "charts"
OUT.mkdir(parents=True, exist_ok=True)

# Site palette. Series green validated for lightness, chroma and contrast
# against the paper surface (dataviz six-checks validator).
GREEN = "#55884D"
INK = "#1F241D"
INK2 = "#5D655B"
INK3 = "#8A9086"
LINE = "#D6CFC0"
LINE2 = "#BFB7A4"
CLAY = "#9C4F28"

plt.rcParams.update({
    "font.family": "monospace",
    "font.size": 9.5,
    "svg.fonttype": "path",       # glyphs as outlines: no font dependency
    "figure.facecolor": "none",
    "axes.facecolor": "none",
    "savefig.facecolor": "none",
    "savefig.transparent": True,
    "axes.edgecolor": LINE2,
    "axes.labelcolor": INK2,
    "xtick.color": INK3,
    "ytick.color": INK3,
    "axes.grid": True,
    "grid.color": LINE,
    "grid.linewidth": 0.6,
    "axes.axisbelow": True,
})


def read(name):
    with open(pathlib.Path(__file__).parent / name) as f:
        rows = list(csv.DictReader(f))
    return {k: [float(r[k]) for r in rows] for k in rows[0]}


def frame(ax):
    ax.spines["top"].set_visible(False)
    ax.spines["right"].set_visible(False)
    ax.tick_params(length=3, width=0.8)


# ── 1. fall signature ────────────────────────────────────────────────────────
d = read("fall_trace.csv")
fig, ax = plt.subplots(figsize=(7.6, 3.1))
frame(ax)

ax.axhline(0.35, color=INK3, lw=1.1, ls=(0, (4, 3)))
ax.axhline(2.5, color=INK3, lw=1.1, ls=(0, (4, 3)))
ax.text(0.08, 0.35, "free-fall threshold 0.35 g", color=INK2, va="bottom", fontsize=8.5)
ax.text(0.08, 2.5, "impact threshold 2.5 g", color=INK2, va="bottom", fontsize=8.5)

# the 400 ms watch window the state machine opens at the free-fall dip
ax.axvspan(2.0, 2.4, color=GREEN, alpha=0.10, lw=0)
ax.text(2.2, 2.95, "400 ms window", color=INK2, ha="center", fontsize=8.5)

ax.plot(d["t_s"], d["mag_g"], color=GREEN, lw=2, solid_capstyle="round")

flag_i = d["fall_flagged"].index(1.0)
fx, fy = d["t_s"][flag_i], d["mag_g"][flag_i]
ax.plot([fx], [fy], "o", ms=8, color=CLAY, mec="#F4F1E9", mew=1.5, zorder=5)
ax.annotate("fall flagged here", (fx, fy), xytext=(fx + 0.55, fy + 0.12),
            color=CLAY, fontsize=9, fontweight="bold")

ax.set_xlabel("time (s)")
ax.set_ylabel("acceleration (g)")
ax.set_xlim(0, 4)
ax.set_ylim(0, 3.2)
fig.tight_layout(pad=0.4)
fig.savefig(OUT / "fall-signature.svg")
plt.close(fig)

# ── 2. altitude curve ────────────────────────────────────────────────────────
d = read("altitude_curve.csv")
kpa = [p / 1000 for p in d["pressure_pa"]]
fig, ax = plt.subplots(figsize=(7.6, 3.1))
frame(ax)

ax.plot(kpa, d["altitude_m"], color=GREEN, lw=2)

for px, py, label, tx, ty in [(101.325, 0.0, "sea level: 0 m", 100.6, 700),
                              (89.875, 1000.1, "test point: 1000.1 m", 89.2, 1700)]:
    ax.plot([px], [py], "o", ms=7, color=INK2, mec="#F4F1E9", mew=1.5, zorder=5)
    ax.annotate(label, (px, py), xytext=(tx, ty),
                color=INK2, fontsize=9, ha="right",
                arrowprops=dict(arrowstyle="-", color=LINE2, lw=0.8))

ax.set_xlabel("air pressure (kPa)")
ax.set_ylabel("computed altitude (m)")
ax.set_xlim(55, 103)
fig.tight_layout(pad=0.4)
fig.savefig(OUT / "altitude-curve.svg")
plt.close(fig)

# ── 3. debounce ──────────────────────────────────────────────────────────────
d = read("debounce.csv")
fig, ax = plt.subplots(figsize=(7.6, 3.1))
frame(ax)

ax.step(d["t_s"], d["naive_calls"], where="post", color=INK3, lw=1.6, ls=(0, (4, 3)))
ax.step(d["t_s"], d["actual_calls"], where="post", color=GREEN, lw=2.2)

ax.text(20, 112, "one call per fall reading: 150",
        color=INK2, ha="left", fontsize=9)
ax.text(59, d["actual_calls"][-1] + 7, "the shipping trigger: 2",
        color=GREEN, ha="right", fontsize=9, fontweight="bold")

ax.set_xlabel("time replaying the fall loop (s)")
ax.set_ylabel("model calls")
ax.set_xlim(0, 60)
ax.set_ylim(0, 160)
fig.tight_layout(pad=0.4)
fig.savefig(OUT / "debounce.svg")
plt.close(fig)

print("wrote", *[p.name for p in sorted(OUT.glob("*.svg"))])
