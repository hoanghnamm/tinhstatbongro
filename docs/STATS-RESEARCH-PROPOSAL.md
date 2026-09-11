# Basketball stats: research and proposed screen

> **APPLIED — 8 September 2026.** All five steps of the delivery sequence shipped. `lib/flow.ts`,
> `lib/observe.ts`, `components/stats/GameFlow.tsx`, `components/stats/Standouts.tsx` and
> `components/stats/PlayerSummary.tsx` are new; `TeamTab`, `PlayersTab`, `ZonesTab`, `lib/analysis.ts`,
> `lib/stats.ts`, `lib/pdf.ts`, `app/stats.tsx` and `app/history/[id]` changed. `docs/DECISIONS.md`
> carries the argument and `CLAUDE.md` the rules. Five deliberate departures from the text below:
>
> 1. **No note, caption or footnote anywhere on these screens.** `Note` renders `null` and stays that
>    way. The caveat this proposal wanted restored under the derived scoring rows is instead IN THE
>    ROW LABEL — `Points off our steals`, `After our offensive rebounds`, `Fast break, within 7s`,
>    `Points per possession, whole game` — on the screen and on the PDF, where the number is read.
>    The PDF keeps its own legend paragraph, because paper has room and no filter.
> 2. **No tooltip on eFG%.** This app has none anywhere. The full name is `Effective FG%` in the
>    Shooting table directly below the tile, and no second reading rides under the tile's caption.
> 3. **No eFG-versus-previous-games sentence on the game screen.** That comparison already exists,
>    pooled, in `CompareTable` on the season screen; what it was missing was the sparse guard, which
>    it now has (`MIN_ATTEMPTS`, both samples). Duplicating it here would be a second answer.
> 4. **`-` rather than `—` for an empty percentage**, matching `pct` / `pct1` everywhere else on
>    these screens. A mixed dash style would read worse than the wrong dash.
> 5. **Turnovers carry no "3 this quarter" sub-caption.** The tiles are already per-slice, and the
>    quarter table under the flow chart is where a period's numbers live.

8 September 2026. Research and proposal only, as requested. No runtime changes. The live scoring board remains outside scope; “dashboard” below means the read-only stats overview.

## Recommendation

Lead with score/context, then shooting efficiency, turnovers, offensive rebounds and free throws. Follow with a game-flow chart and at most two factual observations. Keep the full box score and shot map one tab away.

This is a product recommendation informed by basketball analytics, not a research claim that one screen order is universally best. Test whether a scorer can identify the score, main issue and relevant player within a short timeout.

## Research that informs the design

The Four Factors organize performance around shooting, turnovers, rebounding and free throws. FIBA's BCL analysis describes their approximate historical weighting, but also questions portability between competitions. Use the categories, not fixed weights or NBA targets, for HoopRec. eFG% accounts for the extra value of threes; shot location should be read alongside attempt volume. A high percentage on a few attempts does not establish a dependable strength. [FIBA: Play-Offs Preview — Shooting](https://www.fiba.basketball/en/news/bcl-18-19-news-play-offs-preview-part-1-shooting)

eFG% = 100 × (FGM + 0.5 × 3PM) / FGA. [NBA statistical glossary](https://www.nba.com/stats/help/glossary)

An offensive rebound continues a possession. FIBA's fast-break definition includes both speed and whether the defense is set; time alone cannot identify it. Points off turnovers require opponent turnover information. [FIBA Statisticians' Manual 2024](https://assets.fiba.basketball/image/upload/documents-corporate-fiba-statisticians-manual-2024.pdf)

Plus/minus records the scoring change while a player is on the floor. [Jr. NBA: Plus/Minus](https://jr.nba.com/plusminus/) For this app, show it beside minutes as descriptive context, not as an automatic best-player or best-lineup verdict.

## What the app can actually support

The audit read `lib/box.ts`, `lib/stats.ts`, `lib/analysis.ts`, the Team/Players/Zones components, `/stats` and `/history/[id]`.

| Data | Availability | Design consequence |
|---|---|---|
| Our shots, makes, threes, free throws, rebounds, assists, turnovers, fouls | Recorded | Useful primary measures, subject to recording completeness |
| Shot locations and seven zones | Recorded | Show distribution and conversion; do not invent rim, contested or shot-quality categories |
| Both teams' scoring events and clock stamps | Recorded | Score progression and quarter scoring; timing accuracy depends on clock use |
| Substitutions, starters and player minutes | Recorded/reconstructed | Player context and later lineup stints; show minutes and timing limitations |
| Our possessions | Manually adjusted scalar, not timestamped events | PPP only for All, and only when count is known complete; positive alone is not validation |
| Opponent shots, rebounds, turnovers, free throws, possessions | Not comprehensively recorded | No reliable ORB%, DRB%, defensive rating or complete two-team Four Factors comparison |
| Defensive setup, shot contest and play type | Not recorded | No true shot-quality, transition or tactical diagnosis |

The ordinary saved-game destination is `/history/[id]`, which reuses TeamTab, PlayersTab and ZonesTab. `/stats` currently has no caller. A future implementation must update shared read-only views and the real saved-game route, not just the unused page. Season is a separate aggregate screen and should retain its own hierarchy.

## First screen: precise order

Keep the existing Team / Players / Zones navigation (Plays remains available on saved games). Team opens by default. Keep All / quarter filters and clearly distinguish the match score from the selected-quarter score.

1. **Game context:** team names, score, margin, period and remaining time or Final. The score appears once prominently, rather than again as a headline tile.
2. **Four compact measures:** eFG%, turnovers, offensive rebounds and FT made/attempted. At phone width these are a two-by-two group, with readable captions and no horizontal scroll.
3. **Game flow:** a compact score-margin step chart, with an accessible quarter-score table as its textual equivalent.
4. **What stands out:** zero to two evidence-backed observations; no filler when the sample is insufficient.
5. **Shooting breakdown:** 2PT, 3PT, FT made/attempted and percentage. Then ordinary rebounds/assists/steals/blocks/fouls and optional advanced detail.

| Priority measure | Suggested display | Interpretation and limits |
|---|---|---|
| eFG% | `47.9%` / `20/48 FG · 6 threes` | Efficiency including the extra point from threes. Tooltip explains abbreviation. Not capped at 100% in calculations |
| Turnovers | `9` / `3 this quarter` when meaningful | Recorded losses of possession. Whole-game count cannot prove improvement over a faster/slower game |
| Offensive rebounds | `8` / `Offensive rebounds` | Retained opportunities. This is a count, not rebound rate; do not label it “winning the boards” |
| Free throws | `12/18` / `66.7% · Free throws` | Show both conversion and opportunities. Put FTA/FGA in detail with that exact label |

The example shooting line is internally consistent: 14 two-point makes plus 6 threes gives 20 FGM, 46 field-goal points and 47.9% eFG on 48 attempts; 12 free throws gives 58 total points. These are illustrative values, not an actual HoopRec game.

PPP can become a primary figure later if possession completeness is explicitly established. Do not auto-promote an unreliable manually incremented count. Do not derive quarter PPP from the whole-game scalar. Estimated possessions using a free-throw coefficient belong in labeled advanced detail, if introduced at all.

## Charts worth building

| Chart | Question answered | Encoding and behavior |
|---|---|---|
| Score-margin step chart | When did the lead change? | Elapsed game time on x, our score minus theirs on y, visible zero line and quarter boundaries. Orange identifies our lead, neutral opponent lead; labels also carry sign. Tap a point for exact score/time. No smoothed curve or “momentum probability” |
| Zone attempt-share bars | Where did we shoot? | Seven fixed zone rows, horizontal bars for share of FGA, adjacent made/attempted and FG%. Keep the same order between filters; do not rank tiny samples as hot zones |
| Shot map, existing Zones tab | Which attempts made up those totals? | Preserve made/missed symbols and current court geometry. Player and period filters later. Free throws remain separate from field-goal zones |
| Quarter comparison table/bars | Which periods changed the result? | Us/them points per period, exact numbers always visible. Counts for turnovers/ORB alongside if useful. An unfinished quarter is labeled in progress |

Build the margin chart first and the zone bars second. Avoid radar charts, percentage donuts, dual axes and a dashboard full of unrelated miniature charts. Paint/bench/second-chance/transition categories overlap: never place them in a pie or stacked bar that implies they sum to total points.

Clock-based charts must preserve event order for identical timestamps and distinguish score corrections from actual scoring runs. Reconcile their final score with the stored scoreboard. If timing is unusable, fall back to quarter scores or event order rather than displaying false time precision.

## Effective analysis copy

Every statement should expose its evidence, period and comparison. The following are independent synthetic examples, not claims about user games:

| Observation | Useful follow-up | Avoid |
|---|---|---|
| `5 of 9 turnovers came in Q3.` | Open Q3 player turnover rows or play log | `Bad passing cost the game` — turnover type and causality are not established |
| `Three-pointers: 2/12; two-pointers: 14/24.` | Review attempt locations and players | `Stop shooting threes` based on one small sample |
| `Free throws: 10/18, with 8 misses.` | Open player FT lines | `Those misses lost the game` or assuming every miss could have been recovered |
| `The opponent scored 9 unanswered points in Q3.` | Jump to the run in the scoring log | `The timeout failed` or claiming a lineup caused the run |
| `eFG rose from 45.0% to 51.0%: +6.0 percentage points.` | Show pooled makes/attempts from the previous official games | `Up 6%` or averaging game percentages without attempt weights |

Use deterministic rules over real data rather than generated tactical speculation. Cap at two statements; expose the contributing events. Percentage deltas use percentage points. Do not silently compare a partial live game with full-game totals. For live play, use in-game periods/windows or validated rates; for postgame, compare against prior official games, excluding the current game.

Preserve the existing previous-five-game window for continuity, show how many prior games exist, and pool shooting numerators/denominators. Do not treat higher raw points, rebounds or assists as proof of better performance without pace/context. In particular, the current `Ball moved better` wording overstates what an assist count alone proves; prefer `Assists increased`.

Sparse-sample policy: always show attempts; show `—` when no opportunities exist. As a provisional product guard, do not nominate a “best zone” below 10 attempts and do not generate percentage-change highlights without 10 attempts in both compared samples. Ten is a review threshold, not statistical significance. All counts remain visible. Validate these choices with real scorers before fixing them as defaults.

## Player and season priorities

Players: prioritize name/number, minutes, PTS, shooting made/attempted, REB, AST, TO and PF. Keep the mobile summary compact with an expandable full box score. Show foul counts prominently in a live review; avoid a hardcoded five-foul warning if game rules vary. Plus/minus, TS% and efficiency sit in detail with explanations and sample context.

Season: keep club/record → last-game comparison → competitions → players. Improve the existing comparison's evidence and language rather than adding a second top-level dashboard. Retain per-game player statistics divided by games appeared in. Shooting percentages are pooled; games and attempts remain visible.

## Accuracy work before analytical headlines

The current “Points from turnovers” calculation opens on our steals, not every opponent turnover. Fast-break points use a seven-second window after a steal or defensive rebound; that is not the full FIBA definition. Second-chance windows cannot observe every opponent possession change. Keep these out of primary tiles and label them explicitly as estimates or narrower event-derived measures after auditing their edge cases.

TeamTab's comments mention an explanatory note, but its current rendered scoring section contains no note prop or explanatory text. Restore a visible limitation beside these derived values before emphasizing them. Also review multi-free-throw trips, unlogged opponent rebounds, period boundaries and stopped clocks; labels alone do not repair a calculation.

## Proposed delivery sequence

1. Validate definitions and edge cases in pure functions; add meaningful fixtures for denominators, period filters, scoring corrections, overtime and sparse samples.
2. Reorder the shared Team overview and clarify captions, counts and approximations. Preserve gates, navigation, board and export boundaries.
3. Add the score-margin chart with quarter-table fallback, using the existing scoring event derivation.
4. Add two traceable observation rules, then zone-volume bars and a compact player summary.
5. Review on 320/390 dp phones, tablet, large text, live partial games, empty games and long names. Check that changing filters updates every relevant label and denominator. Run selfcheck/typecheck during implementation.

No application files were changed for this research proposal. (Superseded — see the note at the top.)
