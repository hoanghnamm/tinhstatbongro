# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

A **live basketball stats board** for one scorer keeping stats for **one team** on a phone
or tablet at courtside. It is a single screen; everything else is a modal panel over it.
The app lives in `livestats/` (Expo SDK 54, React Native 0.81, New Architecture, TypeScript
strict, Zustand, NativeWind v4).

Four constraints drive every decision:

- **Speed of entry beats completeness.** Every stat is 2–3 taps.
- **One team only.** The opponent is a single integer with three buttons.
- **The court is the primary input.** A tap on the floor starts a shot entry.
- **Nothing scrolls on the board.** The board is exactly one viewport. Only panels scroll.

## Commands

```
cd livestats
npm run check      # tsx lib/selfcheck.ts — the rules AND the styling guards
npm run typecheck  # tsc --noEmit; strict, and it must stay at zero
npm start          # expo start
npx expo-doctor    # after any dependency change
```

`npm run check` is the whole test suite: one assert-based script, no framework. It boots
the real `lib/` modules against a plain `GameState` and then greps the component tree.
**Run it after touching anything in `lib/`, `constants/` or `components/`.** There is no
per-file test and no runner — to check one thing, edit or comment out the block in
`lib/selfcheck.ts` and run it again.

**Never hand-pick a dependency version.** `npx expo install <pkg>` and
`npx expo install --fix` exist so the SDK 54 resolver picks them; `expo-doctor` catches the
peers a resolver cannot (`react-native-worklets` is a direct dependency for exactly that
reason). `babel-preset-expo` is also direct, which is unusual: NativeWind needs a
`babel.config.js`, and naming the preset there means it must resolve from the project root.

## Architecture

**Three stores, one job each.**

- `store/gameStore.ts` — the `GameState`, every action, undo, the options. Persisted to
  AsyncStorage.
- `store/uiStore.ts` — the in-flight entry (`mark`/`zone`/`side`/`shotType`/`what`/
  `shooter`/`foulKind`/`trip`/`note`), the panel router, the toast. Not persisted; a
  half-finished tap is not worth restoring.
- `store/layoutStore.ts` — rects measured via `onLayout` + `measureInWindow`. Only the
  board writes to it.

**The rules are plain functions, not store methods.** `lib/actions.ts` holds every mutation
as a function over a `GameState`; the store's only job is to snapshot, call one, and
publish. That split is why `npm run check` can exercise the whole rulebook without React,
Zustand or a device — keep new rules on that side of the line.

**Undo is snapshot-based, not inverse-op-based.** The store's `edit()` wrapper pushes a JSON
deep copy of `{score, oppScore, players, events}` before every mutation (capped at 80);
`undo()` restores it wholesale. A mutation that does not go through `edit()` is silently
skipped by undo. The stack lives at **module scope in `gameStore.ts`, not in the store** —
nothing on screen depends on it, and putting it in state would repaint the board eighty
times a game. A `denied` foul pops its own snapshot back off.

**`undo()` explicitly carries `secondsPlayed` forward.** Minutes come from the game clock,
not from the action being undone; rewinding a basket must not rewind time already played.

**Two parallel records per action.** Counters live on `player.stats`; a separate
append-only `state.events` array feeds the play-by-play. Every `record*` writes both — the
box score reads stats, the plays panel reads events. Event ids come off `events.length`, so
undo rewinds the sequence with the log.

**`GameEvent` is `EventMeta & EventBody`.** The split is not cosmetic: `Omit` over a union
keeps only the keys every member shares, so a single flat type would let `log()` accept a
shot with no `position`. Anything reading events must tolerate a **null `playerId`** (an
opponent point has no jersey) and must check `type` before reading `value` (on an
`oppPoint`, `value` is *their* points).

**`hooks/useFlow.ts` is the one place a pick is interpreted.** Panels stay dumb; the rules
stay in one file. Do not put recording logic in a panel component.

## Court geometry is a contract

Hardcoded to a 792 × 521 viewBox: basket at (396, 76), three-point arc r = 352, paint
`x ∈ [277,513] ∧ y ≤ 276`, corner cut-off `y ≤ 203.7 ∧ (x ≤ 68 ∨ x ≥ 724)`.

`lib/court.ts` owns all of it and returns one of seven `ZONES`. `shotTypeFor` is derived
from the zone through `THREES`, so the two can never disagree — **there is deliberately no
manual 2/3 override, and no zone label on the shot panel.** Both were built and cut. Do not
re-add either without being asked.

**Sectors are angular, the paint is not.** The sector is `atan2` out of the basket, cut at
22.5 / 67.5 / 112.5 / 157.5°, with `y` clamped to the rim line so a shot from behind the
backboard is a corner rather than a wing. Every sector is therefore a single wedge, which
is what lets the SVG draw it as one path.

`components/board/CourtSvg.tsx` is the same geometry written a second time: eleven zone
shapes (five sectors × 2PT/3PT, plus the paint), deliberately oversized and cut down by
`courtClip` and the `m2` / `m3` masks, which encode the arc and the corner boxes exactly as
`zoneFor` does. **`lib/court.ts` and those path strings change together or not at all.**
The zones are never hit-tested — the wrapper owns the pointer — and only the one matching
`ui.zone`/`ui.side` is lit. If `Mask` ever misbehaves on a platform, the fallback is to
render only the *one* hot wedge under a `ClipPath`.

Taps are normalised and **rounded to 3 dp** (`normalise`). Event payloads are stored and
compared; do not widen that.

**`FT_SPOT` is a mark, not a zone.** Free throws are logged at `(0.5, 0.53)` — the centre of
the free-throw line — so the chart can draw them, and with **`zone: null` always**. Running
`zoneFor` on it is the mistake: a free throw is not a field-goal attempt, so any zone it
answered would be a wrong attempt in the splits. (The answer is boundary noise anyway: the
spot IS the lane's top edge, and 0.53 sits a tenth of a unit outside `y ≤ 276`, so it reads
`top2` where 276 itself reads `paint`.) Free throws never touch `fgAttempted` /
`twoAttempted` / `threeAttempted` — only `ftAttempted` / `ftMade` / `ftTrips`.

**The chart marks shots and free throws, nothing else.** Fouls, rebounds and tallies leave
no mark. Free throws all land on one coordinate, so there is only ever **one** of them: a
`danger`-red dot, the same size as a shot's and built the same way, carrying **no label** —
the made-attempted split lives in the box score, not on the floor. A ring with the split
inside it was built and cut. It lights as soon as FT is pressed (`ui.what === 'ft'`, which
is why that flow does not `clear()`) and stays once an attempt is behind it; being derived
from `events` it follows undo with no special case.

## Styling: CSS is not React Native, and NativeWind bites

**Never pass a function to `style`.** Not on a `Pressable`, not anywhere. NativeWind's babel
transform wraps every `jsx` call, and its interop resolves props by walking a
`["style", …]` path through `assignToTarget`:

```js
if (typeof parent[prop] !== "object") parent[prop] = {}
```

A function is not an object, so **the entire style object is replaced with `{}`** and every
rule inside it — `flexDirection`, `alignItems`, `backgroundColor` — is dropped without a
warning. Object and array styles survive, which is why this failed as "half the board looks
right". Use `components/ui/Press`, which takes `style` and `pressedStyle` as plain objects
and tracks the press itself.

**Build on `components/ui/`, not on bare Views.** `Row` / `Col` / `Center` / `Fixed`,
`Press`, `Tile`, `Badge`, `Surface`. They exist because three CSS→RN default differences
were re-derived in every component and got re-derived wrong:

1. `display:flex` lays out a **row** in CSS and a **column** in RN. Any ported rule without
   `flex-direction:column` needs an explicit `flexDirection:'row'`.
2. A column container defaults to `alignItems:'stretch'`, so a fixed-size child fills the
   width. A circle, a badge or an icon needs explicit `width`/`height` and `flexShrink:0`.
3. Centering is never inherited. `align-items:center` **and** `justify-content:center` both
   have to be stated on the box.

Two more that cost real time: `flex:1` means `flexBasis:0`, so a `flex:1` child inside a
parent whose height comes from its content collapses to nothing. And `alignItems:'baseline'`
offsets children by their ascent, which in a short box goes **negative** and pushes content
out through the top edge.

**An inverted surface is a pair.** Every rule that sets a background *and* a colour must
carry both across; keeping the ink and losing the fill is how MADE and SUBSTITUTE became
dark-on-dark. `npm run check` greps for all three — function styles, raw `Pressable`
imports outside `components/ui/`, and a fill without its matching ink.

**The tile grid's 1px divider IS the gap:** a rule-coloured parent showing through 1px
seams. Tiles must be opaque and carry no border and no radius, or the seam disappears.

## Theme and sizing

`theme/tokens.ts` is two layers: a palette (the only place a hex is written) and semantic
names aliased onto it. **A skin is a palette swap and nothing more.**

NativeWind resolves colours through CSS variables rather than literals: the root view
writes the live palette with `vars()`, so a `bg-surface` class and a `useTheme()` read can
never disagree. `global.css` carries the light values as the fallback only. **Sizes are
deliberately absent from `tailwind.config.js`** — every one is a `clamp()` off the window
height, which a static class cannot express.

`tailwind.config.js` sets `darkMode: 'class'`. Nothing uses a `dark:` variant; it is
`class` because the preset's `media` default crashes the web runtime —
`react-native-css-interop` reads the flag off a MutationObserver on `<head>`, then calls
`colorScheme.set()` with it, and `set()` throws on `media`. Do not simplify it back.

`theme/metrics.ts` is one fluid ramp: every size is `clamp(floor, N vh, ceiling)` off the
window height, recomputed on rotation. Anything that must *not* scale comes off the fixed
step scale `s1`…`s6` (4/8/12/16/24/32). **Nothing interactive may compute below `tap` (48).**
Never introduce a bare pixel size in a layout; add to the ramp.

**`fsFtr` is the one step a WIDTH decides**, and it is the exception that proves the rule.
The footer's middle block carries three numbers side by side, so its type is capped by
`(half − 34) / 5.9` — roughly what `12 : 8`, `07:24` and the quarter come to in Chakra Petch
with their rules and padding. Since the block went from a third of the row to a half the vh
term wins very nearly everywhere; the cap stays because `fsNav` grows with the window height
while the block does not, and the day that crosses over the clock reads `07:2…` rather than
throwing.

Custom fonts have no numeric weight axis in RN, so a weight is a family name — `fNum()` /
`fUi()` are the only place that mapping lives. **Tabular numerals everywhere a number can
change**, so a tick never shifts the layout.

## Layout

**Two layouts, keyed on ORIENTATION, never on a width threshold.** A 667×320 phone in
landscape is narrow but must not stack; an 820×1180 tablet in portrait is wide but must.

Landscape is two columns and two rows: the board top-left, the footer under it, and the
rail down the whole right edge — so the footer stops at the rail rather than running under
it. Portrait is one column: court, the bar PF/FT/RB shares with the three OPP buttons, then
the rail, then the footer. **The score is a footer cell, not a strip** — it used to be a
full-width row of its own between the court and the bar, and in landscape it headed the OPP
column above +1/+2/+3. **The rail keeps its column form** in
portrait rather than lying down as a strip: an aspect-locked court on a narrow phone is
never much more than a third of the screen tall, so a strip left 200–350px of dead space.

**The court is sized by arithmetic, not by the layout engine.** `computeMetrics` subtracts
the rail, the action column, the OPP column, the safe-area insets and the five gaps, then
aspect-locks what is left. A wrong term does not throw — it silently shrinks the court to
nothing. **Changing a row in either layout means changing the matching subtraction**: moving
the score into the footer took a term *and* a gap out of the portrait sum, and leaving them
would have cost the court 35–58px it is now owed.

**Horizontal safe insets are capped at `SIDE_INSET` (24).** iOS hands a landscape phone
44pt on *both* edges for a cutout that bites the middle third of one of them; honouring
both cost a court's worth of width in black bars. `computeMetrics` clamps `left`/`right`
and **returns the capped box as `m.safe`** — `Board` reads that, never `useSafeAreaInsets`
directly, so the shell padding and the court arithmetic cannot disagree. `top`/`bottom` are
untouched: the status bar and the home indicator really do own their full strip.

**The two flanking columns are one width.** `side` (PF/FT/RB) and `oppw` (score + OPP) come
off a single ramp — `oppw = side` — because both carry `flexGrow:1` off their basis, so any
difference in basis is a permanent visible offset between two columns that read as a pair.
Widening them is a straight trade against court width; check both on a tablet, where there
is no inset to reclaim.

**`compact` is `height ≤ 560`.** Panels tighten and layout blocks narrow in both
orientations; the tap floor on the rail rows is released only in **landscape**, because a
330×490 phone is compact too and must keep the portrait stack.

## Panels

Three placement modes, in the `MODE` map — which lives in `components/panels/placement.ts`,
**not** in `PanelHost`, because the footer needs the same answer and importing `PanelHost`
there would drag every panel in with it. Ask `isDocked()`; never keep a second list.

| mode | where | scrim |
|---|---|---|
| `dock` | the columns right of the court, the rail's full height | **clear** |
| `court` | the court's own footprint, top edge to footer | dimmed |
| `center` / `wide` | a centred dialog | dimmed |

**A `court` panel is TALLER than the court.** `courtBox` runs the board's full top-to-bottom,
and the court is aspect-locked and centred inside it, so the slack above and below the floor
belongs to the panel. Sizing a panel against `m.court.h` under-counts it badly — on a 667×320
phone the court is 221 tall and the box is 249; on a 330×490 phone in portrait the court is
116 and the box is 204. **Measure with `useCourtBox()`, never with the court metric.**

**The quarter panel wears the foul panel's shell.** `endQuarter` is a `court`
panel — header, 1px seams, code-over-caption tiles — because it is the same kind
of decision as a foul kind: one tap out of a short list, made with the game in
front of you. Its title is the quarter being played.

**Its two rows are written out, not chunked**, which is what `PRows` is for:
−1s / +1s / SET take a third of the top each, END QUARTER and END GAME take half
the bottom each, so the row you must not mis-tap is the biggest target on the
panel. A third of the smallest court (276×182, a 667×320 phone) is about four
characters of code and ten of caption, and that is the budget the top row's
labels are cut to. ±1s lands immediately and leaves the panel open; a clock is
rarely corrected in one tap. **A FULL RESET tile was built and cut** to give the
bottom row its halves — `nextQuarter` puts a whole period back anyway, and SET
reaches 10:00 like any other time, so `resetClock` survives with no caller.

**A `Tile`'s `tone` is INK ONLY** — `danger` for END GAME, `accent` for SET on
the clock pad, and it colours the code *and* the caption, never a fill. A tile
keeps its opaque surface whatever it does, because the 1px seam is what the grid
is made of; a filled tile eats its own seam. It also sidesteps the
inverted-surface trap, since there is no background here to lose its ink.

**`dock` belongs to the two panels whose point is seeing the floor while you tap** — step 1
of a shot (the spot you just marked) and the free-throw result (the aggregated mark on the
line ticking up). It must neither cover the court nor dim it. It runs the full height of
the column, which is over END, so **the footer gives back exactly the overlap**
(`dockFooterOverlap`) and the nav's four cells re-centre in what is left.

**The FT flow deliberately does not `clear()` on the way in.** `Board`'s `start('ft')` skips
it precisely so the court mark stays visible under the dock; PF and RB still clear, because
neither has a court spot. `FTDockPanel` is one tap per attempt and **stays open** so a two-
or three-shot trip is tapped straight through, and only X closes it. Its header is the
title and the X and **nothing else** — a running made-attempted chip was built and cut, the
same call as the dot's missing label. `TripSizePanel` / `TripShotsPanel` stay centred: they
are a form, not a two-way choice, and do not fit the dock's one-column shape.

**`SetClockPanel` is a `court` panel like the menu it is tapped next to, and its header is
the quarter, the entry and the X.** Everything about it is the foul panel: `PHead`, the seam
grid, `Tile`. **Three rows, and the readout in the header, is the layout constraint** — the
tightest box is a 330×490 phone in portrait at 321×204, so after the header there are 156px:
three tap-sized rows at 52 each, where a fourth would put every one of them at 39. A readout
band of its own would eat one of the three, so the entry sits beside the title instead,
dimmed while it still shows the live clock and solid once the first digit lands. Twelve cells
in 4×3 — the familiar 3×3 of digits with DEL / 0 / SET down the right. The title says
`1ST QT` rather than naming the action a second time, and there is **no BACK button** —
CANCEL covers getting one wrong, exactly as it does everywhere else.

**The keypad fills mm:ss LEFT TO RIGHT and SET stays dark until all four slots are down.**
Shifting digits in from the right was built and cut: it reaches 0:45 in two taps instead of
four, but it moves every digit already on screen with each keystroke. `pushClockDigit`
**refuses** a tens-of-seconds digit over 5 rather than clamping it afterwards — that is the
one rule keeping the readout honest at every point in the entry, because a clamp puts a time
on screen that SET does not apply. A typed time stops the clock; ±1s does not.

**`court` panels are measured, not calculated.** `courtBox()` reads real rects off
`layoutStore`. The layout arithmetic already lives in `metrics.ts` and in the flex tree; a
third copy is how the three drift apart.

**`PanelHost`'s switch is exhaustive.** A `Panel` member added without a branch is a
compile error rather than a blank overlay — that is why the typed union replaced the web
build's `data-*` dispatcher.

**`gridFor` never hardcodes five.** Every column count yields cells of the same area, so the
only thing to choose between them is shape — it takes the count whose smallest side is
largest. On an 852×360 phone that is 3×2 at five players, 4×2 at eight, 6×2 at twelve.

**The court flows close on the final tap, so they toast.** `say()` is the only confirmation
an entry landed, and it is where a foul-out surfaces. Back rules, in order: mid free-throw
trip → trip size; a shooter chosen in an FT flow → step 2; a rebound kind → step 1 **with
the tile still selected**; otherwise a full reset. **Only the rebound flow gets a tappable
back chip** — CANCEL already covers getting one wrong.

Hardware back is this platform's Escape and calls `reset()`.

## Rules that look arbitrary and are not

**PF and FT are deliberately not connected.** Only one team is tracked, so a foul you log
was committed *by* your player and sends the *opponent* to the line, while a free throw you
log is taken *by* your player off a foul by the opponent. Do not add a PF→FT bridge.

**`FOUL_KINDS` holds five, `FOUL_MENU` offers four.** The keys are what the event log and
`selfcheck` speak; the menu is OF / DF / TF / FL, where `personal` is the one labelled DF.
Add a kind to both or to neither. Only kinds with `dq: true` count toward `FOULS`;
**technical is excluded (NBA-style)** and flipping that one flag switches ruleset.

**`recordFoul` returns `'ok' | 'out' | 'denied'` and the caller must branch on it.** `'out'`
sets `status: 'out'`, which removes the player from both `onCourt` and `onBench`
permanently; `substitute` refuses to send them back to the bench.

**The rail always renders five rows.** If fouling out has left fewer than five active, the
disqualified fill the gap (shown `OUT`, dimmed) so the column keeps its rhythm and the
player stays reachable; past that it pads with empty rows.

**The footer is four parts, 1 / 2 / 1: UNDO | score · clock · quarter | POSS.** Every cell
grows off a `flexBasis:0`, so nothing sizes to its own text and nothing bunches at the left.
**The readout takes the middle and takes double**: it is three numbers where either flank is
one word, so an even quarter each starved it, and the middle is where the eye goes — the
right place for the only part of the row that is read rather than pressed. The two verbs keep
the corners, as far apart as the row allows.

**Inside the middle the split is weighted, not equal** — 1.25 / 1.05 / 0.70, summing to 3 so
the block itself does not move. `108 : 99` is six digits, `07:24` is four and `1ST` is three
at a smaller step; an even split starves the score and wastes half the quarter's cell.

**The clock and the quarter are two cells with a rule between them.** They are two different
controls and were once told apart only by sharing a tint. There is still no PLAY button and
no CLOCK button — the time IS the clock control — but **its state is carried by the ink, not
by a fill**: the red/green gradient behind the pair is gone, a running clock reads accent and
a stopped one reads danger. Stopped is still the base state, so a board nobody has touched
still reads red — which is true. `clockRun` / `clockStop` / `clockInk` went with the
gradient; the palette has no dead entries.

**POSS took END's cell, and END's arming went with it.** Ending a game is a once-a-night
decision and now lives on the quarter panel next to the other thing that ends; the confirm
panel is what makes a mis-tap there survivable. A possession is tapped dozens of times, so
it belongs on the board: one tap is +1, the running count sits in the cell, and it goes
through `edit()` like every stat, so UNDO takes one back.

**`possessions` is a plain integer on `GameState` and nothing else.** No event, no player
stat — a possession belongs to the team and the board cannot know whose it was. It IS in the
undo `Snapshot`, which is the only list that has to be kept in step.

**Minutes are clock-driven**, and the clock's `tick` is the one action that does **not**
deep-copy — `secondsPlayed` changes 600 times a quarter, and a new roster identity each
second would repaint the rail for a number it does not show. Persist writes are debounced
2s and flushed on background. `setInterval` is only a repaint tick: elapsed time is derived
from a wall-clock stamp, and whatever the app missed while backgrounded is credited on
`AppState` → `active`.

## Options, and what is deliberately absent

`constants/options.ts` holds five switches (`ft`, `tap`, `assist`, `bar`, `skin`), stored in
`gameStore` and persisted. **There is no settings UI** — the defaults ship and `setOption`
is the single place a future settings panel would write. Roster editing, box-score export
and a configurable period length were all declined.

The roster, team name and period length are hardcoded in `constants/game.ts`. The game
persists to AsyncStorage and survives a kill; nothing syncs anywhere.

**The opponent is a single number.** `oppScore` and nothing else: no opponent roster, no
opponent shot chart, no opponent fouls.

**Two metrics are deliberately partial**, because only our roster is tracked:
`onCourtPoints` (shown as **ON**) is the "for" half of a plus-minus with no "against" half
available, and `ptsOffSteals()` can read high if an opponent rebound goes unlogged. Do not
relabel either as `+/-` or "points off turnovers".

`livestats/AGENTS.md` (loaded via `livestats/CLAUDE.md`) points at the versioned Expo docs —
note it currently names v57 while the project is on **SDK 54**.
