# AGENTS.md

Guidance for Codex working in this repository.

**`docs/DECISIONS.md` is the long form of everything below, with the argument behind each rule.**
Read the relevant section there before changing a design decision, deleting something that looks
unused, or rebuilding something this file says was cut. This file is the rules; that one is the why.

## What this is

**HoopLog** — a live basketball stats board for one scorer keeping stats for **one team** on a phone
or tablet at courtside. The board is a single screen; everything else on it is a modal panel over it.
The app lives in `livestats/` (Expo SDK 57, RN 0.86, New Architecture, TypeScript strict, Zustand,
NativeWind v4, Expo Router). Bundle id `com.n2937.hooplog`, scheme `hooplog`.

Four constraints drive every decision **about the board**:

- Speed of entry beats completeness — every stat is 2–3 taps.
- One team only — the opponent is a single integer with three buttons.
- The court is the primary input — a tap on the floor starts a shot entry.
- Nothing scrolls on the board — exactly one viewport; only panels scroll.

The screens around it are ordinary responsive screens under ordinary rules; a `FlatList` that scrolls
there violates nothing.

## Commands

```
cd livestats
npm run check      # tsx lib/selfcheck.ts — the rules AND the styling guards
npm run typecheck  # tsc --noEmit; strict, must stay at zero
npm start          # expo start
npx expo-doctor    # after any dependency change
```

`npm run check` is the whole test suite: one assert-based script, no framework. It boots the real
`lib/` modules against a plain `GameState`, then greps `components/` **and** `app/`. **Run it after
touching `lib/`, `constants/`, `components/` or `app/`.**

**Never hand-pick a dependency version** — `npx expo install <pkg>` / `--fix`. `react-native-worklets`
and `babel-preset-expo` are direct dependencies on purpose. **Stop Metro before `npx expo install` on
Windows** — a running dev server holds `lightningcss.win32-x64-msvc.node` open and the install fails
EPERM (`npm ci` fails it *after* wiping `node_modules`). `newArchEnabled` is gone from `app.json`
deliberately; SDK 57 dropped the key. `livestats/AGENTS.md` points at the **v57** Expo docs.

## Routes

```
app/_layout.tsx        Stack + SafeAreaProvider + palette + fonts + the game clock
app/(tabs)/_layout.tsx the four tabs (index LOBBY, matches, season STATS, team)
app/intro.tsx          THE DOOR — four steps, once per install
app/start.tsx          NEW GAME picker
app/settings.tsx       GAME SETTINGS (a page, not a panel)
app/paywall.tsx        THE PAYWALL (a page)
app/game.tsx           THE BOARD
app/stats.tsx          one game in full — NO CALLER, left standing
app/history/[id].tsx   ONE SAVED GAME — box score + play log
app/competition.tsx / app/player/[id].tsx / app/analysis.tsx
```

- The board and the seven pushed pages are **outside the tab group**, each with a back button.
  `router.replace('/game')` out of the picker, never `push`.
- **Three of the four tabs mount their own `<PanelHost />`.** STATS has none and must not grow one.
- The shelf's room is MATCHES; the model is still a game (`GameState`, `GameSummary`). **TEAM is
  singular.** There is no `games.tsx`.
- **`app/_layout.tsx` starts the game clock**, deliberately not `game.tsx` — walking off to TEAM
  mid-quarter must not stop crediting minutes.
- **`<RotateGate />` is mounted inside `game.tsx`**, keyed on `portrait && min(w,h) < 700` — never on
  orientation alone, or an 820×1180 tablet in portrait would see it.

### The tab bar is two bars

iOS uses `expo-router/unstable-native-tabs` (glass); Android keeps the JS `<Tabs>`. Both come from ONE
`TABS` table in `app/(tabs)/_layout.tsx`; `components/nav/nativeTabs.ts` is the only module naming the
unstable import.

- **Neither bar carries a word** — `<Label hidden />` on iOS (omit it and the route title prints
  `index`), `tabBarShowLabel: false` on Android.
- **Glass is what you get by NOT asking for a background** — leave `backgroundColor` and `blurEffect`
  unset. `minimizeBehavior: 'never'`.
- **The JS bar is `bg`, not `surface`** (translucent surfaces sampled the wrong ground), and its
  height is stated: `BAR_ROW` (54) **plus the inset paid twice** — inside `height` and again as
  `paddingBottom`. The glass bar's height is UIKit's.
- Android's active state is a `surface2` pill behind the glyph.

### Light and dark

- **The board is the only screen light by default.** Every other route is near-black: the tab group
  off `ThemeProvider value={DARK}`, the seven pushed pages off `DarkRoom`. Shared components (`Card`,
  `Band`, `Btn`, `Crest`, `Seam`, `BoxTable`, `ClubCard`) follow the provider — **no `dark` prop
  anywhere**.
- `options.board` may turn the board down; it takes the palette and the status bar and NOT the bloom.
- **`DarkRoom` is the palette and the status bar together.** It flips the bar on FOCUS
  (`useFocusEffect` + `setStatusBarStyle`), not with a mounted `<StatusBar>` — a stack keeps lower
  screens mounted and the last mounted wins. `RotateGate` wraps only over a LIGHT board; nesting two
  strands the bar.
- **Glass is the lobby's CARDS and nothing else.** `expo-blur` is spent there alone.

## Theme and sizing

`theme/tokens.ts` is a palette (the only place a hex is written) plus semantic aliases. **It may not
import `react-native`** — `lib/pdf.ts` imports `PALETTE` and `npm run check` runs under plain node, so
the platform comes off `process.env.EXPO_OS`.

**Two palettes, no skin switcher, no `auto`.** A SUBTREE declares its palette through
`theme/useTheme.ts`; two do — the tab group always, `app/game.tsx` when the setting says so. Doing it
in `useTheme()` is what keeps the shared components shared.

**`DARK`'s surfaces are TRANSLUCENT** (`surface`, `surface2`, `rule`, `line`, `press` carry alpha) —
safe only because every consumer draws on the near-black `bg`. **Do not reuse this palette over a
light ground.** Four views must ask `isTranslucent(p)`: `Card`'s shadow wrapper, the competition
card's, `PanelHost`'s frame (which must be OPAQUE whatever the palette says), and the TEAM tab's
`InputAccessoryView`. `danger` and `live` deliberately LIFT on `DARK`. **An inverted pair must survive
both palettes** — `Crest`'s monogram is `bg`, the one token opposite `ink` in each.

**The panels are inline-styled, all of them** — a NativeWind class resolves through the variables the
ROOT pushes down (the LIGHT palette's), whatever subtree the panel is in.

### Four hues, four jobs, no trading

| hue | means |
|---|---|
| `accent` orange `#E2571F` | OURS — primary action, our score, a made shot, the active tab |
| `live` blue | NOW — in progress: the running clock, the court's tap mark |
| `danger` red | destroys / has stopped / went the wrong way — plus two stated departures: the `L` on a finished match, the worse half of a CHANGE |
| `good` green | BETTER THAN BEFORE — `CompareTable` and `WhatChanged` only. **Ink only; there is no `goodInk`.** |

`live` is the retired accent, not a fourth hue; `mark` aliases the same raw, and must not be orange
(two dots away orange means MADE). **`accent2` is the pressed accent and it is DARKER, never
fainter** — one caller, a filled accent button. The chart's three dots are the one place a scorer may
override a hue (`DotHue` / `dotColor`; TEAL is raw `#0E8FA3`, and `selfcheck` asserts no two swatches
draw one colour). The ink ramp is anchored on near-black `#0A0604` and every grey is warm; **the court
is the one surface left slightly cool.**

### The bloom, the glow, depth

**`components/ui/Bloom.tsx` is the accent at 34% falling to nothing, and it is the only ground.** Its
stops live in `theme/tokens.ts` (`BLOOM_START` / `BLOOM_END` / `BLOOM_STOPS` / `BLOOM_HEIGHT`,
`bloomWash`). **Two rules, both of which have bitten:** FIRST child of the screen's root view, OUTSIDE
the padded flow; `pointerEvents="none"`. It lands on eleven routes — **`app/game.tsx` is the
exception.** There is no pinstripe and no monogram anywhere.

**`components/ui/GlowText.tsx` is the only thing that lights orange ink.** It is a MASK, so **it may
not use alpha** — both stops solid, `orangeHot` (`#FF7038`) settling into the accent, two stops not
three. **The rule is the INK, not the call site**: it renders a plain `Text` unless the colour handed
to it IS the accent, so swapping `Text` for `GlowText` is always safe. Layout goes in
`containerStyle`, not `style`. The board is not in it; web falls back to flat.

**Cards and panels float; the board does not.** `ELEV_CARD` / `ELEV_LIFT` / `ELEV_PANEL` are the ramp.
**A shadow and a clip cannot share a view** — `Card` is TWO views (outer: fill, radius, elevation;
inner: same radius + clip), and Android's `elevation` needs an opaque `backgroundColor` on the same
view. Write both platforms out every time.

### Ramps, faces, tracking

**Sizes are deliberately absent from `tailwind.config.js`** — every one is a `clamp()` off the window
height. `darkMode: 'class'` because the preset's `media` default crashes the web runtime; **do not
simplify it back.** `theme/metrics.ts` is one fluid ramp, recomputed on rotation; anything that must
not scale comes off `s1`…`s6` (4/8/12/16/24/32). **Nothing interactive may compute below `tap` (48).
Never introduce a bare pixel size; add to the ramp.** Two steps are decided by WIDTH: `fsFtr` and the
paywall's `headFs`.

**The body face is the system's** — `'System'` + a real `fontWeight` on iOS, Inter on Android. `fNum`
and `fUi` differ in default weight and tracking, not family. **A face is a STYLE FRAGMENT, so spread
it**: `...fUi(500)`, never `fontFamily: fUi(500)`. Tabular numerals wherever a number can change.

**`fDisplay` (Anton, bundled, Vietnamese subset) is spent on exactly three things**: the `hooplog`
wordmark, the `Crest` monogram, and the club's name in `ClubMark`. Everywhere else **user text is body
text, always.** The wordmark is lowercase, leans by `WORDMARK_SLANT` (`-12deg`) applied as a SKEW on a
**`View` that sizes to the type** (a `transform` on `<Text>` silently draws nothing under the New
Architecture), and its line box is 1.3 — **`fDisplay` may not go under about 1.15, anywhere.**

**Nothing in this app shouts.** Sentence case throughout; a typed name is printed exactly as typed.
Caps are for abbreviations only (PTS, REB, MIN, FG, 3PT, FT, OR, DR, TOT, AS, TO, ST, BS, PF, FD, EF,
the board's PF / FT / RB keys, OPP, the W/L letter, DNP, Q1 / H1 / OT).

Six tracking tokens, and every `letterSpacing` comes off one: `LS_CAPS` 0.02 (abbreviations — the only
positive step), `LS_MICRO` −0.0025, `LS_LABEL` −0.0075, `LS_BTN` −0.01, `LS_TITLE` −0.015, `LS_TIGHT`
−0.02 (numbers). **Numerals never go positive.** A value and its caption are two weights apart:
`fNum(700)` in `ink` over `fUi(400)` in `ink2` at `LS_MICRO`. **`fs2xs` is for strings that are not on
the board.**

## Styling: CSS is not React Native, and NativeWind bites

**Never pass a function to `style`.** NativeWind's interop does
`if (typeof parent[prop] !== "object") parent[prop] = {}`, so a function **replaces the entire style
object with `{}`**, silently. Use `components/ui/Press`, which takes `style` and `pressedStyle` as
plain objects.

**Build on `components/ui/`, not bare Views** — `Row` / `Col` / `Center` / `Fixed`, `Press`, `Tile`,
`Badge`, `Surface`, `Jersey`. They exist because these got re-derived wrong:

1. `display:flex` is a row in CSS, a column in RN — state `flexDirection:'row'`.
2. A column container is `alignItems:'stretch'`, so a fixed-size child needs explicit
   `width`/`height` and `flexShrink:0`.
3. Centering is never inherited — `alignItems` **and** `justifyContent`.
4. `flex:1` means `flexBasis:0`, so a `flex:1` child of a content-height parent collapses to nothing.
5. `alignItems:'baseline'` goes negative in a short box and pushes content out the top.

**An inverted surface is a pair** — every rule setting a background *and* a colour carries both.
`npm run check` greps for all three: function styles, raw `Pressable` imports outside
`components/ui/`, and a fill without its matching ink.

**`Jersey` is the plate and there is exactly one of it.** A rectangle, not a bubble; resting pair is
`court` fill / `courtLine` ink, and `selected` / `out` are inversions written as pairs. Both
dimensions are the caller's. `blank` (+ exported `plateFs` / `plateInk`) has one caller, the TEAM tab's
typed overlay. The resting plate is dressed with `plateWash` and a 2px accent edge down the left,
**both the RESTING plate's alone**; no monogram on it, ever.

**`Btn` has eight variants:** `accent` > `solid` > `surface` > `plain`, plus `danger`, `made`, and the
two dressed ones — `bloom` (the two buttons that START something; `bloomFill` 0.82 → 0.56 → 0.30, all
one orange through `withAlpha`) and `plate` (the lobby's `+`; no border, and the fill holds still under
the thumb). An `icon` REPLACES the label; `label` stays required for the screen reader.

**A press on the board LIGHTS the cell, and `t.press` is the only fill that does it** (on the light
palette `press` IS the canvas). Panels and `Tile` press on `surface2`. **The light is HELD until the
panel it opened closes** — `lib/lit.ts` answers which control that is, as a function because step 2 is
shared and one tap can open a chain. `rects.lit` is ONE slot, measured on the OFF→ON edge with
`onLayout` kept as a rotation backstop; `useLitRect` clears on cleanup. **A tile grid's 1px divider IS
the gap** — tiles must be opaque, with no border and no radius.

## Layout

**Two layouts, keyed on ORIENTATION, never on a width threshold.** Landscape: board top-left, footer
under it, rail down the right edge. Portrait: court, the PF/FT/RB + OPP bar, the rail (still a column),
the footer. The score is a footer cell.

**The court is sized by arithmetic, not by the layout engine** — `computeMetrics` subtracts the rail,
the action column, the OPP column, the insets and the five gaps, then aspect-locks. A wrong term does
not throw; it silently shrinks the court. **Changing a row means changing the matching subtraction.**

**Horizontal safe insets are capped at `SIDE_INSET` (24)** and `computeMetrics` returns the capped box
as `m.safe`; `Board` reads that, never `useSafeAreaInsets`. **The two flanking columns are one width**
(`oppw = side`). **`compact` is `height ≤ 560`**; the tap floor on rail rows is released in landscape
only.

## Court geometry is a contract

792 × 521 viewBox: basket (396, 76), arc r = 352, paint `x ∈ [277,513] ∧ y ≤ 276`, corner cut-off
`y ≤ 203.7 ∧ (x ≤ 68 ∨ x ≥ 724)`. `lib/court.ts` owns all of it and returns one of seven `ZONES`;
`shotTypeFor` derives from the zone through `THREES`, so **there is no manual 2/3 override and no zone
label on the shot panel.**

**The drawing is the contract** — every cut is a line `CourtSvg.tsx` actually paints:

| line, as drawn | separates |
|---|---|
| the lane, `x = 277 / 513`, `y = 276` | the paint |
| `y = 101`, lane edge → three-point line | `corner2` \| `wing2` |
| `y = 203.7`, three-point line → sideline | `corner3` \| `wing3` |
| the three-point line, `x = 68 / 724` + the arc | 2PT \| 3PT |
| lane extensions `(310,276)→(187,521)`, `(480,276)→(603,521)` | `wing` \| `top` |

**Sectors are NOT angular** — an `atan2` fan is what this used to do and the floor has no line for any
of those rays. **The two corner cuts are at different heights on purpose** and the boundary *steps* at
`x = 68 / 724`. **The two sides are not mirrors**: extensions are symmetric about 395, the arc about
396; the two solved vertices are `(540.6904, 396.8874)` and `(249.6808, 396.1479)`.

**`ZONE_PATHS` carries the same partition a second time as eleven closed paths, beside `zoneFor`.
The two change together or not at all** — `selfcheck` rasterises the real `d` strings (read out of the
SOURCE, not imported) and asserts all 412,632 cells agree, plus that each of the nine bounding lines is
still drawn.

Zones are never hit-tested; taps are normalised and **rounded to 3 dp**, and payloads are compared, so
do not widen that. **`FT_SPOT` is a mark, not a zone** — free throws log at `(0.5, 0.53)` with
`zone: null` always and never touch `fgAttempted` / `twoAttempted` / `threeAttempted`. **The chart
marks shots and free throws, nothing else**, and the single FT dot carries no label.

## Architecture

**Nine stores, one job each:** `teamStore` (the club: name, crest, coaches), `rosterStore` (20 max,
**persist version 2** — `migrateRoster` lives in `lib/roster.ts` so `npm run check` runs the real one),
`historyStore`, `gameStore` (state, actions, undo, options; debounced persist), `uiStore` (in-flight
entry, panel router, toast; not persisted), `layoutStore` (rects; only the board writes),
`billingStore`, `introStore`, `tutorialStore`. `billingStore` and `introStore` are separate **because
they outlive every game** — `startGame` clears `gameStore`.

**The roster is not the game.** `Player extends Omit<RosterPlayer, 'position' | 'available'>`, and
**`buildPlayers` is the only crossing for people** — once, at tip-off, field by field, with a **fresh
`zeroStats()` per player**. `startGame` does not go through `edit()` and clears the undo stack.

**The rules are plain functions, not store methods.** `lib/actions.ts` holds every mutation over a
`GameState`; the store snapshots, calls one, publishes. **Keep new rules on that side of the line** —
as `box`, `season`, `history`, `billing`, `analysis`, `tutorial`, `court`, `pdf` are — so
`npm run check` can exercise them without React, Zustand or a device.

**Undo is snapshot-based.** `edit()` pushes a JSON deep copy of
`{score, oppScore, possessions, players, events}` (capped 80); `undo()` restores wholesale, so a
mutation that skips `edit()` is invisible to it. **The stack is at module scope in `gameStore.ts`, not
in the store.** `undo()` carries `secondsPlayed` forward. **END QUARTER is the only undoable clock
action**, so `Snapshot` carries `period`/`remaining` OPTIONALLY via `edit(fn, true)` — one caller — and
`undo()` restores a clock only when it finds one, always `running: false`. The clock's `tick` is the
one action that does **not** deep-copy.

**Two parallel records per action** — counters on `player.stats`, an append-only `state.events` for the
play-by-play; every `record*` writes both, and event ids come off `events.length`.

**`GameEvent` is `EventMeta & EventBody`** — not cosmetic: `Omit` over a union would let `log()` accept
a shot with no `position`. Readers must tolerate a **null `playerId`** and check `type` before reading
`value` (on an `oppPoint` it is *their* points).

**`hooks/useFlow.ts` is the one place a pick is interpreted.** Panels stay dumb.

## Panels

Three modes in `MODE`, in `components/panels/placement.ts` (**not** in `PanelHost` — the footer needs
the same answer). Ask `isDocked()`; never keep a second list.

| mode | where | scrim |
|---|---|---|
| `dock` | the columns right of the court, full rail height | **clear** |
| `court` | the court's footprint, top edge to footer | dimmed |
| `center` | a centred dialog | dimmed |

- **`PanelHost`'s switch is exhaustive** — a new `Panel` member without a branch is a compile error.
- **Every panel is dismissible by scrim and hardware back except `fouledOut`** while a sub is owed;
  `Scrim`'s `onPress` is nullable for it, and the `close` label goes with the handler.
- **A dimmed scrim is FOUR bands with the lit control cut out, and they must not overlap** (two 45%
  sheets crossing draw a seam). `dock` never cuts a hole.
- **A `court` panel is TALLER than the court** — measure with `useCourtBox()`, never `m.court.h`.
- **`dock` gives the footer back exactly the overlap** (`dockFooterOverlap`).
- **The FT flow does not `clear()` on the way in** (the court mark must stay visible under the dock);
  PF and RB do. `FTDockPanel` stays open for a whole trip.
- **A `Tile`'s `tone` is INK ONLY** — never a fill; the 1px seam is what the grid is made of.
- **`gridFor` never hardcodes five.**
- Court flows close on the final tap and toast; `say()` is the only confirmation. Back rules, in
  order: mid-trip → trip size; shooter in an FT flow → step 2; rebound kind → step 1 with the tile
  still selected; otherwise a full reset. Hardware back is Escape and calls `reset()`.
- **Five panel kinds live off the board** (`newGame`, `setNumber`, `removePlayer`, `removeGame`,
  `resumeTutorial`), all `center`. **There is no FORM among them** — the TEAM tab edits in place.
- **Two places have a `TextInput`** — the TEAM tab and the new-game screen — and the board is never
  one. Only the new-game screen avoids the keyboard: it is a FORM, the TEAM tab is a LIST.
- **The quarter panel is two rows of THIRDS** (−1s / +1s / SET; EXIT / END QUARTER / END GAME), a
  severity ramp left to right, in the foul panel's shell. **EXIT leaves the game standing** — no tone,
  no confirm, no toast, the clock NOT stopped, `reset()` before the route changes, and the destination
  stated as `replace('/')`. `SetClockPanel` is three rows with the readout in the header, fills mm:ss
  LEFT TO RIGHT, and `pushClockDigit` **refuses** a tens digit over 5 rather than clamping after.

## Screens: the load-bearing bits

Full reasoning in `docs/DECISIONS.md`; these are the invariants.

**Lobby.** Two blocks and the verbs — a poster, not a dashboard. **Do not put a third block back.**
Capped and centred on 700, keyed on WIDTH; every piece is a module-level component. LEAGUE (the
current competition, `competitions()[0]`) above MVP (per-game points leader over official games,
averaged over games APPEARED in). Both cost every saved game off disk via `useSavedGames`, memoised.
CONTINUE GAME takes the primary slot while a game is on; NEW GAME steps down to `surface` behind a
confirm. Last row is four-to-one with the gear fifth, weights on WRAPPER views (`Btn` is `flex:1`).
`HeaderArt` is faded by GRADIENTS, never `opacity`.

**TEAM tab.** The row IS the form: plate (0–99, `danger` ring on collision, ring OUTSIDE the plate),
name, `Dot`. **Every field commits as typed with the text held locally; blur re-seeds from the store**
(`cleanName` trims, so a round trip per keystroke eats spaces). The club card is the LIST HEADER,
passed as an ELEMENT so instances survive. **No `KeyboardAvoidingView`** — the keyboard sits over the
list, the CONTENT carries `tail = max(bar, keyboard) + m.s6`, and the focused ROW is lifted by the
overlap measured against **the list's own FRAME, never the window**. Bar height is
`hooks/useTabInset.ts`, never `safe.bottom`. iOS jersey fields share one `InputAccessoryView`
(`NUM_DONE`). `+ ADD PLAYER` writes a blank row; at `ROSTER_CAP` the button is GONE, not disabled.

**New game.** Wears the TEAM tab's layout. It cannot edit the team **except the jersey number**.
`setNumber` is a KEYPAD, not a field. The page scrolls and the list does not. PRACTICE OR OFFICIAL is
the first question, opening on OFFICIAL, and **START GAME stays dark until one of the two is
answered**; the LEAGUE field is DRAWN ONLY for an official game. Competition chips come off the INDEX;
`competitionKey` folds case and spacing and nothing else.

**The match labels.** `startGame` takes `opponent` / `note` / `kind` / `competition` as ONE `MatchInfo`.
**The kind is read for exactly one thing: the season is the OFFICIAL games** (`officialIn`). A game
from before the two kinds is OFFICIAL, groups under `''` and prints as **Unfiled**. Those three keys
are OPTIONAL on the index — read the kind through **`summaryKind`**, never raw. Dates are digits only
(`numDateLabel`, `dayMonthLabel`), locale-free.

**The shelf.** TWO storage keys: an index of summaries (all the lobby and MATCHES read) and each full
game under `gameKey(id)`. Cap 30, and **`pushSummary` returns the summary it drops** so the caller can
delete its row. Flat list, one row shape for both kinds, **type and space instead of containers**: text
column left (`flex: 1`, `minWidth: 0`), a three-cell score grid right (cells `fs2xl * 1.7`,
`flexShrink: 0`), **the dash a separate cell at `fsMd`** (an em dash inline drew a rule as long as the
digits were tall). The 1px `ItemSeparatorComponent` must never be confusable with it. `accent` marks
OUR score; `W`/`L` rides the date line (`danger` for a loss). `outcomeOf` is three-way. Delete is a
long press with a confirm. `ClubMark` heads the room at `fsXl`.

**Saved game.** `history/[id]` reuses `TeamTab` / `PlayersTab` / `ZonesTab` / `PlaysList` and writes no
table of its own. END GAME saves, then **`replace`s the board with `history/[id]`** on the id
`saveGame` returned (and `saveGame` keeps that game in memory, because the write is fire-and-forget).

**Stats screen.** Two `Seg` strips (TEAM / PLAYERS / ZONES × ALL / periods). `lib/box.ts` is the whole
derivation. **`split` null does not re-derive** — it returns `g.players`, which is what `undo()` keeps
correct; a period rebuilds the floor from `starter` + `substitution`/`foulOut`, and the minutes from
the gaps between events (so quarters sum to the whole game — `selfcheck` asserts it). **A gap spanning
a period end is credited as if the period ran out**; that approximation is stated in the code and the
note. **Never print POINTS FROM TURNOVERS / SECOND CHANCE / FAST BREAK without their note.** POINTS PER
POSSESSION is whole-game only. `scoreline()` is built once and read six ways. Both charts take ONE
measured, aspect-locked width — never `m.court`. Zone heat starts at 0.18, not 0. `ZonesTab` is on
`selfcheck`'s `NO_TEXT_INSIDE` list.

**Season tab.** Reads the full games (`useSavedGames`), filters with `officialIn` **at the screen**,
not inside `season()`. Identity is the ROSTER ID; **PER GAME divides by games APPEARED in**
(`appeared()`). Order is the hierarchy: club + record, last-game comparison, competitions, players.
**No team headline figures, no TOTALS / PER GAME strip (the list is per game, always), no twenty-column
table** — `PlayerList` is name + PTS/REB/AST, with G on the row. Rows have no fill, edge or chevron and
the jersey is a plain figure, not a plate. **A headline card is always TOTALS.** Competition cards show
AVERAGES, press on OPACITY, and `competitions()` hands each group back **with its games still whole**.
`app/competition.tsx` is addressed by the FOLDED KEY as a query param.

**Analysis.** `lib/analysis.ts` is the rulebook. **The average does not include the last game.** Window
`AVG_WINDOW` (5). **`riseIsGood` is held per stat in `TEAM_STATS`.** FG% is POOLED where every other row
is meaned — **do not drop that note.** An average of zero has no ratio (and can never be a highlight).
One game is not nothing: `—` in Average and Change, never a fabricated average. A player's window is the
games THEY appeared in. "What changed?" ranks on the relative move with TWO guards (`MIN_RATIO` 0.1 and
a per-stat `floor`), at most three, deliberately not balanced. `Compare.tsx` is one table with two
callers; the CHANGE is two cells, not one string, and the colour is on the change and nowhere else.

**Export.** `lib/pdf.ts` is a PURE FUNCTION over a `GameState` returning HTML — no file, no store, no
React. `ExportButton` is the phone half. Button lives on **TEAM / ALL only** (ALL is the only slice
built). **No floor, no play log** (`selfcheck` asserts no `<svg>`, no `<path>`, no play line); the zone
table survives. Numbers are the screen's own `report(g, null)`. **Every typed string is escaped.** The
file is renamed before sharing with diacritics FOLDED.

**The club.** `teamStore` + `lib/team.ts`; **nothing in `lib/` touches a file.** Only the NAME crosses
into a game. The picker's cache URI is never stored — `setLogo` copies into `Paths.document/team/` and
**the file is STAMPED `crest-<base36>.jpg`** (RN caches `<Image>` by URI); the old file is deleted after
the new one lands. The path is re-checked on rehydrate. `Crest` is one component for crest and
monogram. **The crest is applied on PICK, not on SAVE. The picker is opened without asking for a
permission — do not put the request back.** The name is required; the coaches are not.

**Launch and the door.** `Launch.tsx` is mounted by the ROOT LAYOUT over the navigator — a launch
screen is a place you are shown, never a place you go. It covers a DECISION (has this install seen the
door), gated on `introStore` alone, with `MIN_MS` (700) as a floor beside it; plain `Animated`; it
declares `DARK` directly rather than wearing `DarkRoom`. `app/intro.tsx` is ONE route with `step` in
component state — four steps, two asking then two telling, no back button, hardware back let through on
step one. It writes through `teamStore.setProfile` / `rosterStore.add` and **does not touch
`gameStore`**. The roster step IS `components/team/RosterRow.tsx` (shared with the TEAM tab). It leaves
by `replace` to `/start`, which is why `start.tsx`'s back is `canGoBack() ? back() : replace('/')`.
**The door spends the launch paywall** (`markLaunchShown()`; `useLaunchPaywall(hold)`).
`constants/intro.ts` is the copy as a table; `MiniBoard` declares `PALETTE` inside the dark room and
draws the floor straight, not through `CourtSvg`. **`SEED_ROSTER` is five blank shirts numbered 1–5**,
ids `p${number}`; `npm run check` uses its own `squad()` fixture.

**The paywall.** `lib/billing.ts` is the rulebook, `billingStore` two booleans, `hooks/useGate.ts` the
join — **no screen reads `entitled` directly.** The trial is ONE SAVED game, spent in `EndGamePanel`
beside `saveGame` (its one call site); the abandon loophole is accepted. Four gates: `newGame` (**the
only one the trial moves**, and `selfcheck` asserts that), `season`, `export`, `deepStats`. MATCHES,
TEAM and GAME SETTINGS are deliberately ungated, and **the quarter strip is never gated.** Fired from
the LOBBY by `useLaunchPaywall()` with a MODULE-SCOPE once-per-process flag. **Always closable**, and
`close()` is `back()`. `GATE_PITCH` prints only when a tap opened it. The headline is one big lit verb
on one line and **does not change per gate** (that is `Locked.tsx`'s job); `headFs` is the measure over
`HEAD_EM` (9) capped at `fs2xl`. Selection is an accent EDGE, one badge, and the per-month figure is
DERIVED (`vnd()` groups from the RIGHT). `buy()` is the ONE seam for StoreKit / Play Billing.

**The walkthrough.** `components/tutorial/` over the REAL board and a throwaway game; **nothing is
mimed and nothing is gated on completion.** The row is dark while a game is standing. `tutorialStore`
stashes the real board as JSON at module scope and `pausePersist(true)` keeps `gameStore` off the disk
(**a paused write is DROPPED, not queued**); `installGame` is deliberately not on the `GameStore`
interface. `tutorialGame` builds through `buildPlayers` and **the disqualified player must be a
STARTER**. It opens at ZERO. `constants/tutorial.ts` is the script as data; completion compares two
snapshots of four facts against the STEP'S START (`uiStore.opens` exists for this; UNDO is watched on
the log AND the possession count). Three settings branch the script and the inapplicable step is
DROPPED. **Z-order: board, `PanelHost` 40, tour 50, `Toast` 60**, and **the tour's root is
`pointerEvents="box-none"`** or the cut-out is dead — any full-window layer over this board takes
`box-none`. Boxes come off `layoutStore` and `hooks/useTutorialTarget.ts` (a second hook, not a widened
`RectKey`). `spotFor` puts the finger on the SPOT for court steps. `Spotlight` is ONE evenodd path,
`pointerEvents="none"`, with four transparent blocking bands, and paints nothing when the target is an
open panel. **The card is a title and nothing else**, and **no two steps share a title** (`npm run
check` holds them apart); a multi-tap flow is a step per tap. Reduced motion gets a static ring.

## Options

`constants/options.ts` holds eleven switches — `periods`, `periodLen`, `ft`, `tap`, `assist`, `bar`,
`labels`, `dotMade` / `dotMiss` / `dotFt`, `board` — in `gameStore`, persisted. **All are exposed in
exactly one place, `app/settings.tsx`** (a PAGE, which is why there is no gear on the board).
`setOption` is the only writer, and `onRehydrateStorage` rebuilds `options` from the surviving names so
stray keys drop and new ones fall back.

- **`periods` and `periodLen` are STAMPED onto the game at tip-off** and read off `GameState` for ever
  after; every other option is read LIVE. A quarter split is arithmetic over the length, so a live read
  would re-slice saved games. The page says `FROM THE NEXT GAME ON`.
- **A game from before them was 4 × 10:00** — `REG_PERIODS` / `PERIOD_LEN` in `constants/game.ts` are
  that fallback and nothing else, spent through `lib/box.ts`'s **`lenOf(g)`**.
- **`lib/format.ts` owns what a period is called** — `periodLabel` (`Q3`, `H1`, `OT2`) and `periodName`
  (`1st quarter`). **The regulation count is always the GAME's, never the live setting's.**
- **`board` is not `skin` coming back** — it repaints ONE route, palette and all, and **takes no
  `Bloom`.**
- **The dot hues are accessibility, not a theme.** `hooks/useDots.ts` is the one reader (three
  callers). Zone heat is not in it.
- **`labels` reaches the PANELS and nothing else**; the board's PF / FT / RB keys stay abbreviations.
  `lib/labels.ts`'s `tileWords` is the whole rule and `StatTile` its ONE reader; the screen reader
  always hears the full word. `Tile`'s `word` prop switches the FACE as well as the size.

## Rules that look arbitrary and are not

- **A roster edit is not a game edit** — `undo()` does not reach it, and the game holds copies.
- **`position` is a LABEL and nothing writes it**; the key survives for migration. **`available` does
  exactly one thing** — `availableIn` filters the starter picker. Neither crosses into a `Player`, and
  `selfcheck` asserts `buildPlayers` leaves both behind. `Dot` is its own file so the inverted-surface
  guard can exempt it by name.
- **The starter picker ignores a sixth tap** rather than guessing who to drop.
- **PF and FT are deliberately not connected. Do not add a PF→FT bridge.**
- **`FOUL_KINDS` holds five, `FOUL_MENU` offers four** (`personal` is labelled DF). Add a kind to both
  or to neither. Only `dq: true` kinds count toward `FOULS`; **technical is excluded (NBA-style)** and
  that one flag switches ruleset.
- **`recordFoul` returns `'ok' | 'out' | 'denied'` and the caller must branch.** `'out'` removes the
  player from `onCourt` and `onBench` permanently, and `substitute` refuses to bring them back
  (`false`) — the rule lives in `lib/actions.ts`, not in a panel. A refusal changes nothing, so the
  store pops its snapshot.
- **A player who is OUT may not be left in the five.** The fifth foul opens `FouledOutPanel` from
  `useFlow`, and while `owesSub(g)` is true it is **the one panel a scorer cannot walk away from**.
  Three ways out: pick the replacement; CLOSE when the bench is empty; UNDO THE FOUL, drawn **only when
  `Panel.fresh`**. `owesSub` asks the GAME, not a player.
- **The rail always renders five rows** — the disqualified fill the gap (`OUT`, dimmed) and tapping one
  reopens the locked question; past that it pads with empty rows.
- **The footer is 1 / 2 / 1: UNDO | score · clock · quarter | POSS**, every cell off `flexBasis:0`,
  the middle split 1.25 / 0.95 / 0.80. **The score is READ and nothing else** — `ScoreCell` is a plain
  `View`. **The clock's state is ink, not fill**: `live` running, `danger` stopped (the base state),
  and it stands down to `ink2` while a panel is open. POSS took END's cell; ending lives on the quarter
  panel behind its confirm.
- **`possessions` is a plain integer** — no event, no player stat — but it IS in the undo `Snapshot`.
- **Minutes are clock-driven**; `setInterval` is only a repaint tick, elapsed time comes off a
  wall-clock stamp, and background time is credited on `AppState` → `active`. Persist is debounced 2s
  and flushed on background.
- **The opponent is a single number** — no roster, no chart, no fouls. The plus-minus still has both
  halves (`creditOnCourt` / `debitOnCourt`), guarded with `?? 0`. **`ptsOffSteals()` is partial** —
  never print it without its note.
- The team name is `DEFAULT_TEAM.name`; `SEED_ROSTER` seeds `rosterStore` once and is never read again.
  Every store persists to AsyncStorage, the crest as a file beside them; nothing syncs anywhere.

## Cut, and not to be rebuilt without being asked

`docs/DECISIONS.md` has the argument for each.

- `Pinstripe.tsx` (+ `STRIPE_PITCH`, `STRIPE_W`, `stripeInk`) — and any weave, grid, noise field or
  monogram behind a screen or on the jersey plate.
- `Tagline` in `Wordmark.tsx`; the club lockup on the LOBBY (it heads MATCHES and STATS instead); the
  lobby's third block and every cut preview.
- `Headline` / `Figure`; the season tab's TOTALS / PER GAME strip, its counts and `BY COMPETITION`
  heading, and `BoxTable` on that tab.
- `groupByDay` / `dayHeading` / `dayKey` and the shelf's date headings and result badge; `dateLabel` /
  `yearLabel` / `timeLabel` / `periodsLabel`.
- `BoxScore`, `TotalsPanel`, `PlaysPanel`, `ShotsTab.tsx`, the board's `totals` panel.
- The `editPlayer` and `editTeam` panels; the roster row's accent mark and `×`; a captain, a starting
  five or an arm strip on the TEAM tab; club colours.
- The manual 2/3 override and the shot panel's zone label; zone numbers on the floor; the FT dock's
  made-attempted chip; the free-throw dot's label.
- The quarter panel's FULL RESET tile; the clock keypad's right-to-left shift; a BACK on
  `SetClockPanel`.
- The skin switcher, `auto`, the frosted palettes; `clockRun` / `clockStop` / `clockInk`; END's arming;
  the score cell's press.
- The intro's rules step (`RULE_ECHOES`, `RuleEcho`, `Echo`, `Seams`) and its `Pointer` chip.
- The walkthrough's meaning line, nudge and SHOW ME (`Show`, `useShowRunner`, `NUDGE_MS`, `SHOW_MS`,
  `TUTORIAL_COPY.showMe`, the overlay's `Phase`).
- The paywall's FREE TRIAL card and toggle; a RESTORE PURCHASE button; the media-library permission
  request before the crest picker.
- `assets/hero-ball.png`.

**Left standing with NO CALLER, deliberately**, so the gesture that reaches them next can be chosen
rather than restored: `app/stats.tsx`, `resultOf` (held to `>=` by `selfcheck`), `shapeLabel`,
`RemovePlayerPanel` + the `removePlayer` kind, `resetClock`, `Slug.tsx`, `hooks/useLastGame.ts`.
**Nothing removes a player from the app today.**
