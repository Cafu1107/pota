# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Stack

delegated: Vite + React + TypeScript single-page app, TanStack Query for fetching/caching/live polling, CSS Modules on design tokens, vite-plugin-pwa. A small zero-dependency Node server serves the build and proxies the upstream APIs (CORS + short-TTL caching); the same proxy runs inside the Vite dev server. Chosen because the product is a many-route, data-heavy app with live polling and offline install; the user left the choice to Claude. Runs locally with `npm run serve`, and since 2026-10-03 as a public demo on GitHub Pages with the same proxy rules in a Cloudflare Worker (`deploy/worker`) for the TBF and FIBA LiveStats sources.

## Users

- General basketball followers, Turkish-speaking first and English-speaking second, who follow several competitions at once: Turkish leagues, EuroLeague/EuroCup and the NBA. They check scores at a glance, follow live games as a second screen next to the TV broadcast, and dig into box scores, standings, rosters and player numbers.
- Portfolio visitors on GitHub judging the craft and technical quality of the project.

Used equally on phones (live games, on the move) and desktops (wide, many-column reading).

## Product Purpose

A Mackolik-style basketball hub: every league that has free data, in one place, in Turkish and English. Live and today's games; match detail with quarter scores, team comparison, box score, play-by-play and shot chart; standings and stat leaders; team pages with roster and schedule; player pages with bio, averages, game log and career; favorites; side-by-side comparison; installable as an app.

Success, in the user's words, is all four at once: a live-game experience that feels alive, data depth (every stat), visual polish with its own character, and speed (pages open instantly, nothing stutters).

## Positioning

Turkish domestic leagues with real-time FIBA LiveStats data, sitting next to EuroLeague, EuroCup and the American leagues in one Turkish-language product, with a shot chart for every game that has coordinates. No ads, no betting odds, open source.

## Operating Context

- Live windows that matter: EuroLeague/EuroCup weeknights (roughly 18:00–22:45 Turkey time), BSL weekends and some weeknights, NBA games overnight in Turkey and read as results the next morning.
- Several games run at once; users jump between them and come back to the list.
- A second screen beside the TV broadcast, often on a phone held in one hand.

## Capabilities and Constraints

Data sources (verified 2026-10-02):
- TBF web API (`miniappapi.tbf.org.tr/webapi-service`): 9 Turkish leagues: BSL, KBSL, TBL, TKBL, TB2L, BGL, BGLK, EBBL, KBBL. Provides daily matches, standings, weeks, teams with colors, rosters, player profile and career, leaders, and match header, summary, box score, play-by-play and shot chart. Its REST scores lag during live games, and its CORS only allows tbf.org.tr and localhost.
- FIBA LiveStats (`fibalivestats.dcd.shared.geniussports.com/data/<geniusId>/data.json`): the real-time feed for TBF games (clock, period, box score, play-by-play, shots with coordinates). It sends no CORS headers, so it must be proxied.
- EuroLeague API (`api-live.euroleague.net` v2/v3, `live.euroleague.net/api`): EuroLeague and EuroCup games, rounds, standings, clubs, rosters, people, stats, leaders, live header, box score, play-by-play and shot coordinates. The national leagues it lists carry no game data.
- ESPN public API (`site.api.espn.com`, `site.web.api.espn.com`): NBA, WNBA, G League, NCAA men and women, NBL, FIBA. Provides scoreboards, summaries (box score, plays with shot coordinates, leaders, season series), standings, rosters with headshots, athlete bio, game log and stats. It is unofficial, and some endpoints (teams) lack CORS.

Constraints:
- Two sources are unofficial (TBF web API, ESPN), so either may change. Each source sits behind its own adapter.
- Polling must be polite: proxy cache TTLs, and only live games poll.
- Coverage differs per league and per game. The UI shows what exists and says plainly when something is unavailable.
- Times are stored in UTC and shown in the viewer's timezone.

Undecided: public deployment and its proxy host; final product name (working name "Pota", Turkish for the hoop).

## Brand Commitments

- Bilingual: Turkish default, English toggle.
- No betting odds or gambling framing, even where a source provides odds.
- Visual direction (user decision, 2026-10-02): the category standard for sports score apps, played straight, at the craft level of NBA App / ESPN, Sofascore and Mackolik. The user picked this over themed directions (taktik tahtası, arena skorbordu, kalkış panosu), so the result should sit next to those apps, without quirks smuggled in.

## Evidence on Hand

All content is live data from the sources above; nothing is fabricated. There are no testimonials, user counts or press, and none may be invented. Team crests, player photos and league logos come from the sources' CDNs.

## Product Principles

1. Live first: the state of any game (upcoming, live with period and clock, final) reads in a glance, and a score change is felt.
2. Depth on demand: the summary comes first, and every stat is one tap away.
3. Every league is first-class: a Turkish regional league gets the same care as the NBA, and missing data degrades gracefully.
4. Speed is a feature: instant navigation, cached data, layout that never jumps.
5. Truthful data: never invent or estimate a number; show source and freshness.

## Accessibility & Inclusion

WCAG 2.2 AA contrast in both themes; full keyboard navigation; respects reduced motion; tabular numerals for all stats; win, loss and live states are never signalled by color alone.
