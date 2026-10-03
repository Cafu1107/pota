---
name: Pota
description: Live basketball scores and stats across 18 leagues, in Turkish and English.
colors:
  rim-orange: "#ea580c"
  rim-orange-ink: "#c2410c"
  rim-orange-wash: "#fff1e8"
  live-red: "#dc2626"
  live-wash: "#fdecec"
  win-green: "#15803d"
  win-wash: "#e8f5ec"
  series-blue: "#2a78d6"
  series-orange: "#eb6834"
  ground-gray: "#f1f3f6"
  surface-white: "#ffffff"
  surface-mist: "#f7f8fa"
  surface-fog: "#eef0f3"
  hairline: "#e4e7ec"
  hairline-strong: "#d2d6dd"
  ink: "#12151a"
  ink-muted: "#5b6370"
  ink-faint: "#6b7380"
  graphite-ground: "#0f1115"
  graphite-surface: "#171a20"
  graphite-raised: "#22272f"
  graphite-line: "#262b33"
  frost-ink: "#eceef1"
  frost-ink-muted: "#a3aab5"
  rim-orange-glow: "#ff7a2f"
  live-red-glow: "#f87171"
  series-blue-dark: "#3987e5"
  series-orange-dark: "#d95926"
typography:
  display:
    fontFamily: "Archivo Variable, Archivo, system-ui, sans-serif"
    fontSize: "3.25rem"
    fontWeight: 800
    lineHeight: 1
    letterSpacing: "-0.01em"
    fontVariation: "'wdth' 78"
  headline:
    fontFamily: "Archivo Variable, Archivo, system-ui, sans-serif"
    fontSize: "2rem"
    fontWeight: 800
    lineHeight: 1.1
    letterSpacing: "-0.01em"
    fontVariation: "'wdth' 90"
  title:
    fontFamily: "Archivo Variable, Archivo, system-ui, sans-serif"
    fontSize: "1rem"
    fontWeight: 700
    lineHeight: 1.3
  body:
    fontFamily: "Archivo Variable, Archivo, system-ui, sans-serif"
    fontSize: "0.875rem"
    fontWeight: 400
    lineHeight: 1.45
  label:
    fontFamily: "Archivo Variable, Archivo, system-ui, sans-serif"
    fontSize: "0.75rem"
    fontWeight: 600
    lineHeight: 1.3
    fontFeature: "'tnum' 1"
  micro:
    fontFamily: "Archivo Variable, Archivo, system-ui, sans-serif"
    fontSize: "0.6875rem"
    fontWeight: 650
    lineHeight: 1.3
    fontFeature: "'tnum' 1"
rounded:
  hair: "2px"
  xs: "4px"
  sm: "6px"
  md: "10px"
  lg: "14px"
  pill: "999px"
spacing:
  xs: "4px"
  sm: "8px"
  md: "12px"
  lg: "16px"
  xl: "24px"
components:
  button-primary:
    backgroundColor: "{colors.rim-orange-ink}"
    textColor: "{colors.surface-white}"
    rounded: "{rounded.pill}"
    padding: "0 16px"
    height: "36px"
  button-secondary:
    backgroundColor: "{colors.surface-white}"
    textColor: "{colors.ink}"
    rounded: "{rounded.pill}"
    padding: "0 16px"
    height: "36px"
  segment:
    backgroundColor: "{colors.surface-fog}"
    textColor: "{colors.ink-muted}"
    rounded: "{rounded.pill}"
    padding: "0 13px"
    height: "30px"
  segment-active:
    backgroundColor: "{colors.surface-white}"
    textColor: "{colors.ink}"
    rounded: "{rounded.pill}"
  card:
    backgroundColor: "{colors.surface-white}"
    rounded: "{rounded.md}"
  game-row:
    backgroundColor: "{colors.surface-white}"
    textColor: "{colors.ink}"
    padding: "9px 14px 9px 10px"
    height: "62px"
  live-badge:
    backgroundColor: "{colors.live-wash}"
    textColor: "{colors.live-red}"
    rounded: "{rounded.pill}"
    padding: "2px 8px"
  form-chip-win:
    backgroundColor: "{colors.win-wash}"
    textColor: "{colors.win-green}"
    rounded: "{rounded.xs}"
    size: "19px"
  form-chip-loss:
    backgroundColor: "{colors.surface-fog}"
    textColor: "{colors.ink-muted}"
    rounded: "{rounded.xs}"
    size: "19px"
---

# Design System: Pota

## Overview

**Creative North Star: "The Courtside Ledger"**

Pota reads like the scorer's table that records every game at once: a quiet, cool-neutral ledger where the data does the talking and only two things are ever loud — a game that is live and a team's own colors. The world is the category standard played straight (the user chose it over themed directions) and judged against NBA App / ESPN, Sofascore and Mackolik: dense, league-grouped lists, broadcast-grade game headers, and every statistic one tap away.

Density is a feature, not a compromise. Rows are compact (62px two-line game rows, 40px table rows), separated by hairlines rather than boxes, and grouped into cards per league. Numbers are set in one variable family, Archivo, whose width axis gives scores a condensed broadcast voice without a second typeface.

Motion is reserved for the live moment: a score that changes rolls into place, its row flashes once, and new shots drop onto the court. Everything else moves only as fast state feedback.

**Key Characteristics:**
- Cool light-gray ground with white cards; graphite in dark mode, chosen from the system setting or the viewer's toggle.
- One brand accent (rim orange) for selection and identity; live red belongs to live state alone.
- Team colors appear only inside team-owned regions, after a contrast and distinctness check.
- Tabular figures in every column of numbers; condensed heavy figures for scores.
- Hairline structure, 10px cards, pill controls.

## Colors

A restrained, cool-neutral palette with one warm brand accent and one reserved state color.

### Primary
- **Rim Orange** (#ea580c): the brand mark, active navigation underline, focus rings, selected states and the progress line. Never a large fill.
- **Rim Orange Ink** (#c2410c): accent text and filled primary buttons with white text (5.2:1).
- **Rim Orange Wash** (#fff1e8): selected chips, highlighted standings rows, the score-change flash.

### Secondary
- **Live Red** (#dc2626) with **Live Wash** (#fdecec): live status text, the pulsing live dot and live count badges. Always paired with a label (period, clock, "CANLI") and the pulse.
- **Win Green** (#15803d) with **Win Wash** (#e8f5ec): win markers in form strips and game logs, always with the letter G/W.

### Tertiary
- **Series Blue** (#2a78d6) and **Series Orange** (#eb6834): the validated two-series pair for comparisons and the fallback team colors (ΔE 33.6 normal, 24.7 CVD; ≥3:1 on white). Dark steps: #3987e5 and #d95926.

### Neutral
- **Ground Gray** (#f1f3f6): the app background behind cards.
- **Surface White** (#ffffff), **Surface Mist** (#f7f8fa), **Surface Fog** (#eef0f3): cards, group headers and tracks, segmented controls and skeletons.
- **Hairline** (#e4e7ec) and **Hairline Strong** (#d2d6dd): row separators, table rules, control borders.
- **Ink** (#12151a), **Ink Muted** (#5b6370, 6.1:1), **Ink Faint** (#6b7380, 4.8:1): primary text, secondary text, meta and table headers.
- Dark mode: **Graphite Ground** (#0f1115), **Graphite Surface** (#171a20), **Graphite Raised** (#22272f), **Graphite Line** (#262b33), **Frost Ink** (#eceef1), **Frost Ink Muted** (#a3aab5); accents lift to #ff7a2f and live to #f87171.

### Named Rules
**The Reserved Red Rule.** Red means live and nothing else in the interface. Losses are gray, errors are neutral, and a team whose own color is red keeps it only inside its team-owned regions.

**The Earned Team Color Rule.** A team color is used only if it reaches 3:1 on the current surface, has enough chroma to read as a hue, and stays ΔE ≥ 15 from the opponent; otherwise the validated series pair stands in.

## Typography

**Display Font:** Archivo Variable (with system-ui)
**Body Font:** Archivo Variable (with system-ui)

**Character:** One grotesque family stretched along its width axis: condensed and heavy for scores, slightly narrow for page titles, normal width for reading and tables.

### Hierarchy
- **Display** (800, 2.5–3.25rem, line-height 1, width 78%): live and final scores in game headers and featured cards.
- **Headline** (800, 1.75–2rem, line-height 1.1, width 90%): page titles for leagues, teams and players.
- **Title** (700, 1rem, line-height 1.3): card and section titles.
- **Body** (400–600, 0.875rem, line-height 1.45): rows, names, descriptions.
- **Label** (600, 0.75rem): table headers, meta lines, statuses; tabular figures.
- **Micro** (650, 0.6875rem): chart axes, count badges, form-chip letters and table subtitles; never for running text.

### Named Rules
**The Column Rule.** Any number that sits in a column uses tabular figures; standalone stat-tile values stay proportional.

## Layout

Content sits in a 1380px container with a 16px gutter on phones and 24px from 768px. The scores page is a three-column grid at 1180px and up (252px league rail, fluid list, 352px aside), two columns from 900px, one column below. Detail pages cap at 1180px. Phones get a sticky date strip under the 56px top bar, a swipeable live strip, and a 60px bottom tab bar. Tables scroll sideways inside their card with a sticky name column, and never push the page wider than the viewport.

## Elevation & Depth

Flat and tonal. Cards lift from the gray ground with a barely-there shadow in light mode and a hairline border in dark mode; nothing else casts a shadow except popovers and dialogs.

### Shadow Vocabulary
- **Control** (`box-shadow: 0 1px 2px rgba(15,23,42,0.12), 0 1px 1px rgba(15,23,42,0.06)`; dark `0 1px 2px rgba(0,0,0,0.45)`): the selected segment of a segmented control and the active language pill.
- **Card** (`box-shadow: 0 1px 2px rgba(15,23,42,0.05), 0 1px 1px rgba(15,23,42,0.03)`): every card at rest.
- **Pop** (`box-shadow: 0 18px 40px -12px rgba(15,23,42,0.28), 0 6px 14px -6px rgba(15,23,42,0.14)`): settings panel, search dialog, chart tooltips.
- **Bar** (`box-shadow: 0 -1px 0 var(--line), 0 -8px 24px -12px rgba(15,23,42,0.18)`): the mobile bottom tab bar.

### Named Rules
**The Flat Rest Rule.** Surfaces are flat at rest; depth appears only for things that float above the page.

## Shapes

Gently rounded containers (10px cards, 14px hero cards and dialogs), pill-shaped controls (segmented filters, chips, buttons, live badges), 6px for league tiles and rank badges, 4px for form chips and the rounded ends of thin bars, a 2px hairline radius for flags and indicator caps, circles for crests and player photos. Bars in charts carry 4px rounded data ends and square baselines. No decorative clipping.

## Components

### Buttons
- **Shape:** pill (999px), 36px tall.
- **Primary:** Rim Orange Ink fill with white text (install, rare primary actions).
- **Secondary:** white with a Hairline Strong border; hover shifts to the hover surface.

### Chips
- **Style:** segmented filters sit in a Surface Fog track; the selected segment lifts to white with a small shadow. Counts ride in small tabular badges.
- **State:** a live option carries the pulsing red dot.

### Cards / Containers
- **Corner Style:** 10px (14px for page heroes and the game header).
- **Background:** Surface White / Graphite Surface.
- **Shadow Strategy:** Card shadow in light, hairline border in dark.
- **Internal Padding:** 16px; card headers 12px 16px 8px.

### Inputs / Fields
- **Style:** pill search field on Surface Fog in the top bar; 44px rounded fields elsewhere.
- **Focus:** Rim Orange border with a soft orange ring; caret in Rim Orange.

### Navigation
- **Top bar:** 56px, white, hairline bottom; active item gets a 2px Rim Orange underline on the bar edge; TR/EN pill and theme toggle on desktop.
- **Tabs:** route-backed underline tabs, Ink Muted → Ink with a 2px orange underline that scales in.
- **Bottom bar (phones):** four icon + label items; active in Rim Orange Ink.

### Game Row
The signature list item: a 56px status column (time, "MS", or live period and clock in red with the pulse), two team lines with 20px crests, optional period scores when the row is wide enough (container query at 600px), and right-aligned tabular scores. On a live score change the number rolls up and the row flashes Rim Orange Wash once.

### Broadcast Header
Game, team and player heroes wash their team colors (14–20% alpha) across the card from either side, with a 3px split color bar beneath the scoreboard.

## Do's and Don'ts

### Do:
- **Do** keep red for live state, with a label and the pulsing dot.
- **Do** run team colors through the contrast and distinctness check before using them.
- **Do** use tabular figures in tables, lists and live scores.
- **Do** show what a source lacks with an empty state that says so, never with invented numbers.

### Don't:
- **Don't** use a kicker or eyebrow label above a heading; meta goes below the title.
- **Don't** use gradient text, glass panels or colored side stripes on cards and rows.
- **Don't** fill large areas with Rim Orange; it marks selection and identity only.
- **Don't** animate layout properties; bars scale with transforms.
