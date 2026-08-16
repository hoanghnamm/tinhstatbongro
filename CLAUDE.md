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

Custom fonts have no numeric weight axis in RN, so a weight is a family name — `fNum()` /
`fUi()` are the only place that mapping lives. **Tabular numerals everywhere a number can
change**, so a tick never shifts the layout.

## Layout

**Two layouts, keyed on ORIENTATION, never on a width threshold.** A 667×320 phone in
landscape is narrow but must not stack; an 820×1180 tablet in portrait is wide but must.

Landscape is two columns and two rows: the board top-left, the footer under it, and the
rail down the whole right edge — so the footer stops at the rail rather than running under
it. Portrait is one column: court, full-width score strip, the bar PF/FT/RB shares with the
three OPP buttons, then the rail, then the footer. **The rail keeps its column form** in
portrait rather than lying down as a strip: an aspect-locked court on a narrow phone is
never much more than a third of the screen tall, so a strip left 200–350px of dead space.

**The court is sized by arithmetic, not by the layout engine.** `computeMetrics` subtracts
the rail, the action column, the OPP column, the safe-area insets and the five gaps, then
aspect-locks what is left. A wrong term does not throw — it silently shrinks the court to
nothing. Changing a row in either layout means changing the matching subtraction.

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
orientations; the tap floor on the rail rows and score cell is released only in
**landscape**, because a 330×490 phone is compact too and must keep the portrait stack.

## Panels

Three placement modes, in `PanelHost`'s `MODE` map:

| mode | where | scrim |
|---|---|---|
| `dock` | the columns right of the court, the rail's full height | **clear** |
| `court` | the court's own footprint, top edge to footer | dimmed |
| `center` / `wide` | a centred dialog | dimmed |

**`dock` belongs to exactly one panel — step 1 of a shot.** The point of tapping a spot is
seeing the spot, so it must neither cover the court nor dim it. It runs the full height of
the column, which is over END, so **the footer gives back exactly the overlap**
(`dockFooterOverlap`) and the nav's four cells re-centre in what is left.

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

**The footer is UNDO / clock / period / END.** There is no PLAY button and no CLOCK button:
the time IS the clock control. It carries its state as colour, and stopped is the base
state, so a board nobody has touched reads red — which is true. UNDO and END take `flex:1`;
the time and period size to their own text and never shrink.

**END is armed before it fires.** The first tap swaps the label to CONFIRM END for 4
seconds; the second opens the confirm panel.

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
