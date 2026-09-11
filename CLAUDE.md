# CLAUDE.md

Guidance for Claude Code working in this repository.

**`docs/DECISIONS.md` is the long form of everything below, with the argument behind each rule.**
Read the relevant section there before changing a design decision, deleting something that looks
unused, or rebuilding something this file says was cut. This file is the rules; that one is the why.

## What this is

**HoopRec** — a live basketball stats board for one scorer keeping stats for **one club** on a phone
or tablet at courtside. A club runs up to **three teams** off one player pool, and every screen away
from the board is about ONE of them — the strip under the club card on the TEAM tab is what says
which. The board itself still knows exactly one team, which is the team that is playing. The board is a single screen; everything else on it is a modal panel over it.
The app lives in `livestats/` (Expo SDK 57, RN 0.86, New Architecture, TypeScript strict, Zustand,
NativeWind v4, Expo Router). Bundle id `com.n2937.hooplog` and scheme `hooplog` keep the old
spelling deliberately — they are identifiers, not the brand, and the storage keys go with them.

Four constraints drive every decision **about the board**:

- Speed of entry beats completeness — every stat is 2–3 taps.
- One team on the floor — the opponent is a single integer with three buttons.
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
app/competition.tsx / app/player/[id].tsx / app/comparison.tsx
```

- The board and the seven pushed pages are **outside the tab group**, each with a back button.
  `router.replace('/game')` out of the picker, never `push`.
- **Three of the four tabs mount their own `<PanelHost />`.** STATS has none and must not grow one.
- The shelf's room is MATCHES; the model is still a game (`GameState`, `GameSummary`). There is no
  `games.tsx`. **TEAM IS SINGULAR NO LONGER, AND THE SWITCHER IT PROMISED IS THE STRIP** — the tab
  is still one room, but it shows ONE of the club's teams and the chips under the club card change
  which. There is no `teams.tsx` either: a team is a name and a selection, not a page.
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
| `good` green | BETTER THAN BEFORE — the comparison's tables only (`CompareTable`, `WhatChanged`, `PlayerImpact`). **Ink only; there is no `goodInk`.** |

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

**A numeric column's width is MEASURED, not judged by eye** — `theme/figures.ts` is Inter's own
advances in em, and it imports nothing so `npm run check` can hold the columns to them. Size against
INTER on both platforms: SF is narrower at every glyph here, so what fits in one fits in the other.
**Inter's `%` is a FULL EM**, half again a digit, which is the whole reason this file exists — every
percentage cell on the stats screens was sized as if `100%` were as wide as `12.5` and printed `100…`.
A cell with a stated width is checked by `selfcheck` against the widest string it can hold; a cell
with NO stated width — `Tile`, whose width is a share of the room — measures itself and takes the
biggest step off the ramp that fits (`figFit`, `fsXl` → `fsLg` → `fsMd` → `fsSm`). **Nothing may
clip a figure to an ellipsis.**

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

**Ten stores, one job each:** `teamStore` (the club: name, crest, coaches), `rosterStore` (THE POOL,
`ROSTER_CAP` 36, **persist version 2** — `migrateRoster` lives in `lib/roster.ts` so `npm run check`
runs the real one), `squadStore` (the club's teams, `SQUAD_CAP` 3),
`historyStore`, `gameStore` (state, actions, undo, options; debounced persist), `uiStore` (in-flight
entry, panel router, toast; not persisted), `layoutStore` (rects; only the board writes),
`billingStore`, `introStore`, `tutorialStore`. `billingStore` and `introStore` are separate **because
they outlive every game** — `startGame` clears `gameStore`.

**THE CLUB, THE POOL AND THE TEAMS ARE THREE THINGS.** `teamStore` is the club (one name, one crest,
two coaches). `rosterStore` is the POOL — every player the club has, `ROSTER_CAP` 36, still one flat
list. `squadStore` is up to `SQUAD_CAP` (3) TEAMS, each a name and a list of POOL IDS: a team owns no
players, it REFERS to them, so fixing a spelling once fixes it everywhere and **a player may be on
several teams at once**. That is why membership is a list on the team and never a `squadId` on the
player, and why the tag a row shows is DERIVED (`tagsFor`). `lib/squads.ts` is the whole rule set.

- **A club with no teams saved HAS ONE.** `squadsIn` supplies `Team 1` holding the whole pool, under
  the fixed id `FIRST_SQUAD` (`sq1`). There is no migration, no first-run branch and no rehydration
  race between two stores; the store materialises that derived team on the first write.
- **A game is STAMPED with its team at tip-off** — `squadId` / `squadName` on `GameState`, `squadId`
  on `GameSummary` — beside the club name and the rules of the night, and read off the game ever
  after. A row with no id is the FIRST team's: read it through **`squadIdOf`**, never raw, the same
  way `kind` is read through `summaryKind`.
- **The filter is applied AT THE SCREEN** (`squadIn` / `squadIdOf`), like `officialIn` — the lobby,
  MATCHES, SEASON, one competition and the comparison each apply it before their own.
- **`SQUAD_SIZE` is 15 and the cap REFUSES rather than clamps** — `toggleDraft` hands back an
  unchanged list and the panel says so, the same trade `recordFoul` makes on a sixth foul.
- **A team can only be removed when nothing on the shelf was played by it** (`canRemoveSquad`, which
  also refuses the last one). Its games carry its id and nothing else does. The control is GONE, not
  disabled.

**The roster is not the game.** `Player extends Omit<RosterPlayer, 'position' | 'available'>`, and
**`buildPlayers` is the only crossing for people** — once, at tip-off, field by field, with a **fresh
`zeroStats()` per player**. `startGame` does not go through `edit()` and clears the undo stack.

**The rules are plain functions, not store methods.** `lib/actions.ts` holds every mutation over a
`GameState`; the store snapshots, calls one, publishes. **Keep new rules on that side of the line** —
as `box`, `flow`, `observe`, `season`, `history`, `billing`, `analysis`, `tutorial`, `court`, `pdf`,
`fault`, `backup` are — so `npm run check` can exercise them without React, Zustand or a device.

**Undo is snapshot-based.** `edit()` pushes a JSON deep copy of
`{score, oppScore, possessions, timeouts, players, events}` (capped 80); `undo()` restores wholesale,
so a mutation that skips `edit()` is invisible to it. **The stack is at module scope in `gameStore.ts`, not
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
  PF and RB do.
- **EVERY ENTRY ENDS ITS OWN PANEL.** The two sheets that used to stay up — a player's tiles and
  `FTDockPanel` — now LIGHT the tapped control and close behind it, on `hooks/useLitClose.ts`
  (`LIT_MS` 240). The close is guarded on `uiStore.opens`, not on the panel's kind: the next player's
  tiles are the same kind, and anything opening in the meantime cancels the close.
- **A `Tile`'s `tone` is INK ONLY** — never a fill; the 1px seam is what the grid is made of.
- **`gridFor` never hardcodes five.**
- All flows close on the final tap and toast; `say()` is the only confirmation. Back rules, in
  order: mid-trip → trip size; shooter in an FT flow → step 2; rebound kind → step 1 with the tile
  still selected; otherwise a full reset. Hardware back is Escape and calls `reset()`.
- **Seven panel kinds live off the board** (`newGame`, `setNumber`, `removePlayer`, `removeGame`,
  `resumeTutorial`, `draft`, `removeSquad`), all `center`. **There is still no FORM among them** —
  `draft` is a LIST of toggles and `removeSquad` is a confirm; the TEAM tab edits in place, and a
  team is renamed on its own chip rather than in a panel.
- **`draft` carries no id** — it is always about the ACTIVE team, whose chip is the control directly
  above the button that opens it. It is the ONE place membership is written, in both directions,
  which is why nothing on a roster row removes anybody.
- **`removeSquad` does NOT use `PSubject`** — that block is a match (a line, a tail, a scoreline) and
  a team has no score to put in it. The name rides in `PTitle`'s pill instead.
- **The two game confirms DRAW the game rather than describing it.** `newGame` and `removeGame` each
  carried a grey paragraph, and `removeGame` repeated the scoreline in a filled lozenge beside its
  title on top of that. Both now print `shell.tsx`'s **`PSubject`** — the MATCHES row, between two
  hairlines: who or what, a muted tail (competition · date, or the period), the `W`/`L` at the end of
  that line, and the score with **OURS in accent**. No prose, no second container.
- **`ink` inverts to `bg`, never to `surface`.** `PTitle`'s `ink` tone and `Btn`'s `solid` both paired
  a near-white fill with `surface` ink, which is a 5% white on `DARK` — invisible on the two dark-room
  confirms, and on a board turned down by `options.board`.
- **Two places have a `TextInput`** — the TEAM tab and the new-game screen — and the board is never
  one. Only the new-game screen avoids the keyboard: it is a FORM, the TEAM tab is a LIST.
- **The quarter panel is two rows of THIRDS** (−1s / +1s / SET; EXIT / END QUARTER / END GAME), a
  severity ramp left to right, in the foul panel's shell. **EXIT leaves the game standing** — no tone,
  no confirm, no toast, the clock NOT stopped, `reset()` before the route changes, and the destination
  stated as `replace('/')`. `SetClockPanel` is three rows with the readout in the header, fills mm:ss
  LEFT TO RIGHT, and `pushClockDigit` **refuses** a tens digit over 5 rather than clamping after.

## Screens: the load-bearing bits

Full reasoning in `docs/DECISIONS.md`; these are the invariants.

**Lobby.** **It is ONE TEAM'S lobby** — LEAGUE and MVP are questions about a squad, and pooling
three teams would give a record nobody has. Two blocks and the verbs — a poster, not a dashboard. **Do not put a third block back.**
Capped and centred on 700, keyed on WIDTH; every piece is a module-level component. LEAGUE (the
current competition, `competitions()[0]`) above MVP (per-game points leader over official games,
averaged over games APPEARED in). Both cost every saved game off disk via `useSavedGames`, memoised.
CONTINUE GAME takes the primary slot while a game is on; NEW GAME steps down to `surface` behind a
confirm. Last row is four-to-one with the gear fifth, weights on WRAPPER views (`Btn` is `flex:1`).
`HeaderArt` is faded by GRADIENTS, never `opacity`.

**TEAM tab.** **The list is ONE TEAM'S SHEET, not the pool** — `SquadStrip` sits directly under the
club card (club, then which of its teams), the active chip is the accent, and **a second tap on the
active chip turns it into the name field**; one tap switches, so switching never puts a keyboard up.
The `+` is gone at `SQUAD_CAP`. Two verbs under the list and they are not the same one: `+ ADD PLAYER`
makes a new person in the pool AND drafts them onto this sheet (which is what a scorer looking at
Team 2 meant), `DRAFT FROM POOL` opens the pool panel. `rosterStore.add` returns the new id so the
second half of that is not a lookup by jersey number. The row IS the form: plate (0–99, `danger` ring
on collision, ring OUTSIDE the plate), name, `Dot`. **Every field commits as typed with the text held locally; blur re-seeds from the store**
(`cleanName` trims, so a round trip per keystroke eats spaces). The club card is the LIST HEADER,
passed as an ELEMENT so instances survive. **No `KeyboardAvoidingView`** — the keyboard sits over the
list, the CONTENT carries `tail = max(bar, keyboard) + m.s6`, and the focused ROW is lifted by the
overlap measured against **the list's own FRAME, never the window**. Bar height is
`hooks/useTabInset.ts`, never `safe.bottom`. iOS jersey fields share one `InputAccessoryView`
(`NUM_DONE`). `+ ADD PLAYER` writes a blank row; at `ROSTER_CAP` the button is GONE, not disabled.

**New game.** Wears the TEAM tab's layout, and **offers the ACTIVE team's members only** — the
other teams' players cannot take the floor tonight. The team's name is PRINTED beside `Starting
five` and is not switchable here: the switcher is one control and it is on the TEAM tab. It cannot
edit the team **except the jersey number**.
`setNumber` is a KEYPAD, not a field. The page scrolls and the list does not. PRACTICE OR OFFICIAL is
the first question, opening on OFFICIAL, and **START GAME stays dark until one of the two is
answered**; the LEAGUE field is DRAWN ONLY for an official game. Competition chips come off the INDEX;
`competitionKey` folds case and spacing and nothing else.

**The match labels.** `startGame` takes `opponent` / `note` / `kind` / `competition` as ONE `MatchInfo`.
**The kind is read for exactly one thing: the season is the OFFICIAL games** (`officialIn`). A game
from before the two kinds is OFFICIAL, groups under `''` and prints as **Unfiled**. Those three keys
are OPTIONAL on the index — read the kind through **`summaryKind`**, never raw. Dates are digits only
(`numDateLabel`, `dayMonthLabel`), locale-free.

**The shelf.** **It is one team's shelf** — `squadIn` first, then the strip's own practice/official
slice. `ClubMark` heads MATCHES and STATS with the club in `fDisplay` and **the team's name on a
second line in body type, drawn only when the club has more than one team**. TWO storage keys: an index of summaries (all the lobby and MATCHES read) and each full
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
a period end is credited as if the period ran out**; that approximation is stated in the code.
`scoreline()` is built once and read seven ways. Both charts take ONE measured, aspect-locked width —
never `m.court`. Zone heat starts at 0.18, not 0. `ZonesTab` is on `selfcheck`'s `NO_TEXT_INSIDE` list.

**TEAM's order is the reading order**: the four factors, the game flow, what stands out, then the four
tables. **The four tiles are eFG% / turnovers / offensive rebounds / free throws** — categories, never
targets; no league average and no weighting is printed beside them. **The score is not a tile** — it is
in the page header, once; a slice's own points are the `Points` row and the quarter table. The strip is
**two by two under `TWO_UP`**, because three of the four captions are words.

**THERE IS NO NOTE UNDER ANYTHING. `Note` in `components/stats/parts.tsx` renders `null` and stays
that way** — a caveat that matters goes in the ROW LABEL, where the number is read. That is why the
three derived rows are called `After our offensive rebounds`, ``Fast break, within ${BREAK_WINDOW}s``
and `Points off our steals`, and why PPP is `Points per possession, whole game` (`possessions` is a
scalar with no event behind it, so no quarter can claim a share). The two paragraphs of real body text
that DO render — the pooling note under `CompareTable` and the window note under the timeout block —
are sentences under a table, not captions beside a field, and they stay.

**Game flow is `lib/flow.ts` + `components/stats/GameFlow.tsx`.** The margin as a STEP, never a smooth
curve; one `Rect` per run, accent for our lead and neutral for theirs. **The quarter table is not a
fallback** — it prints under every chart as its textual equivalent, and is what is left when the chart
is dropped. **The chart is dropped, not faked, in two cases**: `timed` false (no score carries a clock
the axis could tell from the tip) and `reconciled` false (the running total does not meet the board's
own score). **Stamps are clamped FORWARD** so a hand-corrected clock cannot rewind the walk, and
`stampOf` treats `p * len` as that period's BUZZER. `periodScores` has ONE owner here — `lib/pdf.ts`
used to carry a character-for-character copy and now imports it.

**What stands out is `lib/observe.ts`**: at most `OBS_MAX` (2) sentences, each a count with its
denominator, **and zero is a real answer**. No causes, no advice, no verdicts. **The order is a fixed
list, not a score** — opponent run, turnover concentration, free throws, the two shooting splits, our
run — because there is no common unit to rank a run against a free-throw line in. Both shooting rules
are gated on `MIN_ATTEMPTS`. **The sentences are the WHOLE GAME's and do not change with the filter**;
one that names a period presses to move the filter there, and stops being pressable once it has.

**PLAYERS opens on the compact summary** (`PlayerSummary`: number, name, minutes, points, then FG /
REB / AST / TO / PF on a caption line) with `BoxTable`'s twenty columns behind a button — a button and
not a third `Seg`, because the two strips change what the numbers MEAN and this changes how they are
drawn. **PF turns `danger` only when the player is actually `out`** — never on a count of five, which
is the ruleset's business and `lib/actions.ts`'s. A DNP row says DNP, off `appeared()`.

**ZONES carries an attempt-share bar per zone**, over the seven zones in `ZONES` order, **the same
order under every filter and nothing ranked** — a 3-for-4 corner is not a strength. The bar's
denominator is the ZONES' own attempt total, not `T.fga`.

**Season tab.** **A season belongs to a TEAM, not to a club.** Reads the full games
(`useSavedRows`) and applies TWO filters at the screen — `squadIdOf` then official — never inside
`season()`. Identity is the ROSTER ID; **PER GAME divides by games APPEARED in**
(`appeared()`). Order is the hierarchy: club + record, last-game comparison, competitions, players.
**No team headline figures, no TOTALS / PER GAME strip (the list is per game, always), no twenty-column
table** — `PlayerList` is name + PTS/REB/AST, with G on the row. Rows have no fill, edge or chevron and
the jersey is a plain figure, not a plate. **A headline card is always TOTALS.** Competition cards show
AVERAGES, press on OPACITY, and `competitions()` hands each group back **with its games still whole**.
`app/competition.tsx` is addressed by the FOLDED KEY as a query param.

**Comparison.** `app/comparison.tsx` — ONE GAME against a baseline; `lib/analysis.ts` is the rulebook.
**The baseline does not include the subject**, and `teamComparison` drops it out itself rather than
trusting the caller. **The baseline is every other official game OF THIS TEAM** — measuring the first team against the
second team's average is two samples in one column, not a comparison. Otherwise: **the baseline is
every OTHER official game** — there is no five-game window any
more (`AVG_WINDOW` is gone): the subject is any game on the shelf, so "the five before it" was a window
nobody asked for. **A baseline of ONE GAME is the same arithmetic**, which is what the second field
offers — average, or that game. Two fields, no panel: choosing is a STATE of the page (the blocks stand
down and the list IS the page), because the STATS tab it opens from mounts no `<PanelHost />`.
**Rows are GROUPED into eight areas** (`TEAM_GROUPS`: scoring, shooting, shot volume, ball movement,
ball security, rebounding, defence, discipline) plus points by period, plus the players table.
**`polarity` is held per stat and has THREE values** — `up`, `down`, and `none` for the four SHOT-VOLUME
rows, which have no favourable direction: a volume row is never coloured and can never be a highlight.
**Every rate is POOLED where every count is meaned** — **do not drop that note**; it prints ONCE, under
SHOOTING, and not at all when the baseline is a single game. **There is no opponent FG%** — the opponent
is one number, so defence is STEALS / BLOCKS / POINTS ALLOWED and says so. **Points by period is
DROPPED, not faked, against a game of a different shape** (an `H1` is not a `Q1`), and a period the
baseline never reached prints `—`. **The players table measures every player against THEMSELVES**, in
the game's own order, **nothing ranked**, and a player with no other appearance keeps their row.
A zero baseline has no ratio (and can never be a highlight). One game is not nothing: `—` in the
baseline and Change columns, never a fabricated average. A player's baseline is the games THEY appeared
in. "What changed?" ranks on the relative move with THREE guards (`MIN_RATIO` 0.1, a per-stat `floor`,
and `MIN_ATTEMPTS` 10 on the rate rows — carried on the row as `subjectDen` / `baseDen`, and it must
clear in BOTH samples), **at most three and at most ONE PER AREA** (three rebounding rows are one piece
of news), deliberately not balanced. **Ten is a review threshold, not significance**, and it is the same
number `lib/observe.ts` gates on. The assist highlight says `Assists increased`, not `Ball moved better`
— an assist count does not establish that the ball moved better. `Compare.tsx`'s `CompareTable` takes
ROWS and not a `Comparison`, because the page draws eight of them; the CHANGE is two cells, not one
string, and the colour is on the change and nowhere else.
**A PERCENTAGE IS A WHOLE NUMBER IN THIS TABLE** (`44%`, `+5 pts`) and it is the one place in the app
that is — `lib/stats.ts` keeps its tenth for `eFG%` and true shooting, which are read one at a time in
a tile. Five columns beside a label on a phone was over-subscribed by a fifth of the screen and the
tenth was the cheapest thing in the row to spend. **The ratio cell gives up past three figures**
(`RATIO_MAX` 999) and prints empty, the same answer it gives when there is no ratio: a baseline near
zero throws ratios in the thousands, which is not a reading anybody can use and was the widest string
the cell would ever hold. The four column widths are measured against `theme/figures.ts` and
`selfcheck` holds them there — **the label takes the slack, as it always has.**
**AFTER TIMEOUTS is the one block that compares the game with ITSELF** — net points per minute (ours
minus theirs) over `AFTER_TIMEOUT` (120s) of game clock after each timeout, against every other minute.
`timeoutRun` is the whole rule: windows are **cut at their own period's buzzer**, overlapping ones are
MERGED so shared seconds count once, and the timeout's own second belongs to the play BEFORE it. It
answers `null` when the game stamped no timeout, and the screen tells a game with none apart from a
game saved before the mark existed by reading `g.timeouts`. **Never print the rates without their note.**

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
component state — four steps, no back button, hardware back let through on step one. **The third step
IS THE WALKTHROUGH** — it was a page describing the board and it is now the invitation to the tour: the
miniature as a picture, SHOW ME THE BOARD, and SKIP FOR NOW under it. It `push`es `/game` with
`begin(undefined, 'back')` and STAYS MOUNTED underneath, so the tour pops back onto the trial step; the
step advances on the RETURN (`useFocusEffect` behind a ref), never on the way out. It writes through
`teamStore.setProfile` / `rosterStore.add` and **builds no game** — `begin` is the one thing that
reaches `gameStore`, through the stash and the paused writer. The roster step IS
`components/team/RosterRow.tsx` (shared with the TEAM tab). It leaves by `replace` to `/start`, which
is why `start.tsx`'s back is `canGoBack() ? back() : replace('/')`.
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
mimed and nothing is gated on completion.** **Two ways in — the lobby's permanent row and the door's
third step** — differing only in `TourExit`, stamped at `begin` and never persisted: `lobby` is a
STATED `replace('/')`, `back` is the door's alone. **`components/tutorial/leave.ts` holds both lines
and has two callers**, the overlay and the quarter panel's EXIT (the tour opens that sheet and every
tile on it is inside the cut-out, so EXIT must END the tour rather than walk off it and leave
`pausePersist` holding the next real game off the disk). The row is dark while a game is standing.
`tutorialStore` stashes the real board as JSON at module scope and `pausePersist(true)` keeps `gameStore` off the disk
(**a paused write is DROPPED, not queued**); `installGame` is deliberately not on the `GameStore`
interface. `tutorialGame` builds through `buildPlayers` and **the disqualified player must be a
STARTER**. It opens at ZERO. `constants/tutorial.ts` is the script as data; completion compares two
snapshots of five facts against the STEP'S START (`uiStore.opens` exists for this; UNDO is watched on
the log AND both footer counters). FOUR settings branch the script and the inapplicable step is
DROPPED — every branch drops exactly one of a PAIR, which is what holds the tour to one length.
**Z-order: board, `PanelHost` 40, tour 50, `Toast` 60**, and **the tour's root is
`pointerEvents="box-none"`** or the cut-out is dead — any full-window layer over this board takes
`box-none`. Boxes come off `layoutStore` and `hooks/useTutorialTarget.ts` (a second hook, not a widened
`RectKey`). `spotFor` puts the finger on the SPOT for court steps. `Spotlight` is ONE evenodd path,
`pointerEvents="none"`, with four transparent blocking bands, and paints nothing when the target is an
open panel. **The card is a title and nothing else**, and **no two steps share a title** (`npm run
check` holds them apart); a multi-tap flow is a step per tap. Reduced motion gets a static ring.

## Storage, faults and the backup

**No store imports `AsyncStorage`. `platform/storage.ts` is the one door** — a thin wrapper on
native, so the App Store path is unchanged, and **`platform/storage.web.ts` is IndexedDB**, resolved
by Metro's platform extension. `AsyncStorage`'s web build IS `localStorage` (about 5MB for the whole
origin, against thirty games plus a crest `WEB_LOGO_MAX_LENGTH` lets reach 1.6MB in UTF-16), so it
could not stay. **No library** — raw `IDBRequest`, forty lines. The migration runs inside
`onupgradeneeded`, the one place a synchronous `localStorage` read and an IDB write share a
transaction; **old keys are dropped only after that transaction commits**, never before. If the
database will not open, `localStorage` stands in. **The connection is not cached across `onclose` /
`onversionchange`** or a tab hands out a dead handle for ever.

- **`setItem` reports a fault and NEVER rejects; `write` reports AND rejects.** Two methods on
  purpose: persistence is fire-and-forget (zustand drops the promise, `gameStore` says `void`), so
  handing it something that can reject is an unhandled rejection and nothing else. `write` has one
  caller — `teamStore.setLogo`, which will not replace a crest until it knows the new one landed —
  plus `applyBackup`, where a silent half-restore is the whole thing being prevented.
- **A removal that fails is not a fault.** It makes room rather than taking it.
- **`lib/fault.ts` publishes the EDGE, not the repetition.** A full disk fails every write; a
  listener called on each one toasts every two seconds for a whole game. `classify` folds the three
  spellings of out-of-room (`QuotaExceededError`, code 22, `NS_ERROR_DOM_QUOTA_REACHED`, 1014) onto
  `full`; everything else is `blocked`. `FAULT_NOTE` is the copy, beside the type, the way
  `GATE_PITCH` sits beside `Gate`. **`hooks/useStorageFault.ts` is the ONE reader**, mounted by
  `app/_layout.tsx` beside the game clock — a full disk does not un-fill because a scorer walked off
  the board.

**`lib/backup.ts` is a KEY DUMP, not a model.** The raw rows exactly as the stores wrote them,
restored by writing them back, so a file lands through each store's own migration. Modelling it would
be a third copy of every store's shape.

- **Four keys travel: the club, the pool, THE TEAMS (`hooplog-squads`), the index, and each
  `hooplog-game:` row.** The teams travel with the pool they point at, or a restore would collapse
  three sheets back into one.
  **`hooplog-billing` never does — at write time AND at read time**, because only one of those is
  still ours once the file is on somebody's disk; `selfcheck` asserts both. `livestats-game`,
  `hooplog-tutorial` and `hooplog-intro` do not travel either.
- **Restore REPLACES, never merges** — the same game on two devices has two ids, and a merge makes
  duplicates it cannot detect.
- **`applyBackup` writes before it deletes.** Clearing first loses BOTH seasons if the disk fills
  half way through, which is the exact condition somebody reaches for a backup in. The sweep of
  unreachable game rows is not optional — that is the leak `historyStore` already guards past
  `HISTORY_CAP`.
- **Stores are rehydrated (`persist.rehydrate`), not the app reloaded** — there is no reload on a
  phone.
- **A bad file is refused whole.** `readBackup` checks everything before returning anything; half a
  season beside a roster that does not match it is a state no migration straightens out.
- **`components/settings/Backup.tsx` is the FIFTH block on GAME SETTINGS**, last because it is
  touched least. Save is one press, restore is two, and step two **DRAWS the backup rather than
  describing it** (`PSubject`'s argument). **No explanatory line under either button** — the page
  carries none and this is not an exception; `say()` reports what happened. The one sentence that
  renders is a standing storage fault, which is an alarm and not a hint under a field.

## Options

`constants/options.ts` holds twelve switches — `periods`, `periodLen`, `ft`, `tap`, `assist`, `bar`,
`labels`, `dotMade` / `dotMiss` / `dotFt`, `poss`, `board` — in `gameStore`, persisted. **All are
exposed in exactly one place, `app/settings.tsx`** (a PAGE, which is why there is no gear on the
board).
`setOption` is the only writer, and `onRehydrateStorage` rebuilds `options` from the surviving names so
stray keys drop and new ones fall back.

- **`periods` and `periodLen` are STAMPED onto the game at tip-off** and read off `GameState` for ever
  after; every other option is read LIVE. A quarter split is arithmetic over the length, so a live read
  would re-slice saved games. **The page carries no explanatory lines** — every row is a
  label and its control, and every hint under a field or under a title is gone app-wide.
- **A game from before them was 4 × 10:00** — `REG_PERIODS` / `PERIOD_LEN` in `constants/game.ts` are
  that fallback and nothing else, spent through `lib/box.ts`'s **`lenOf(g)`**.
- **`lib/format.ts` owns what a period is called** — `periodLabel` (`Q3`, `H1`, `OT2`) and `periodName`
  (`1st quarter`). **The regulation count is always the GAME's, never the live setting's.**
- **`poss` ADDS a control rather than changing one** — the footer's fourth cell is the TIMEOUT count
  on every board, and `poss: 'on'` splits it into two stacked halves, POSS over TIMEOUT. It is the one
  setting that reaches the footer, read LIVE, and it hides a count the game goes on holding. The split
  is STACKED and not side by side: the cell keeps its quarter of the row, because a word needs width
  and this row has height to spare. The tour's footer step is a PAIR keyed on it (`poss` / `timeout`).
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
- **The footer is 1 / 2 / 1: UNDO | score · clock · quarter | TIMEOUT**, every cell off `flexBasis:0`,
  the middle split 1.25 / 0.95 / 0.80. **The score is READ and nothing else** — `ScoreCell` is a plain
  `View`. **The clock's state is ink, not fill**: `live` running, `danger` stopped (the base state),
  and it stands down to `ink2` while a panel is open. The counted cell took END's cell; ending lives on
  the quarter panel behind its confirm. **`CountCell` is that cell and there is one of it** — the whole
  cell, or either stacked half under `options.poss`; `half` is a SIZE, not a layout.
- **`possessions` and `timeouts` are plain integers** — no player stat and no roster — but both ARE in
  the undo `Snapshot`. **The timeout count is not optional and the possession count is**; a game from
  before timeouts were counted took none.
- **A timeout ALSO logs a `timeout` event and a possession does not**, and the mark is for exactly one
  reader: `timeoutRun` needs a period and a clock to ask what happened after it. `playerId` is null,
  nothing is credited, no box score moves, and it is logged only when the count actually rose. The play
  log prints it with a DASH where a jersey goes — `Opp` over a timeout would read as theirs. **A game
  saved before the mark has the count and no marks**, and the analysis says so rather than guessing.
- **Minutes are clock-driven**; `setInterval` is only a repaint tick, elapsed time comes off a
  wall-clock stamp, and background time is credited on `AppState` → `active`. Persist is debounced 2s
  and flushed on background.
- **The opponent is a single number** — no roster, no chart, no fouls. The plus-minus still has both
  halves (`creditOnCourt` / `debitOnCourt`), guarded with `?? 0`. **`ptsOffSteals()` is partial**, and what
  makes printing it honest is its LABEL: `Points off our steals`, on the screen and on the sheet.
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
- The intro's rules step (`RULE_ECHOES`, `RuleEcho`, `Echo`, `Seams`) and its `Pointer` chip; the
  door's page ABOUT the board — `BOARD_STEPS`, `BoardLine`, `Badge`, `Taps` and the miniature's
  numbered chips — which the walkthrough replaced.
- The walkthrough's meaning line, nudge and SHOW ME (`Show`, `useShowRunner`, `NUDGE_MS`, `SHOW_MS`,
  `TUTORIAL_COPY.showMe`, the overlay's `Phase`).
- The paywall's FREE TRIAL card and toggle; a RESTORE PURCHASE button; the media-library permission
  request before the crest picker.
- `assets/hero-ball.png`.

**Left standing with NO CALLER, deliberately**, so the gesture that reaches them next can be chosen
rather than restored: `app/stats.tsx`, `resultOf` (held to `>=` by `selfcheck`), `shapeLabel`,
`RemovePlayerPanel` + the `removePlayer` kind, `resetClock`, `Slug.tsx`, `hooks/useLastGame.ts`.
**Nothing removes a player from the app today.**

## Update — 2026-09-10

These changes supersede earlier PDF rules above:
- Player PDF: season totals and per-game averages, with the latest appeared game's shot chart; no game log or side notes. `lib/playerPdf.ts` builds it.
- Match PDF: matching minimal A4 styling across two pages, with the team shot chart beside zones. The old abbreviation/methodology notes block is removed; no play log.
- Both exports share `lib/pdfChart.ts` and `PdfExportButton`; the export gate still applies.
- Portrait board/chart dots and the live marker are 30% smaller through `theme/metrics.ts`; landscape and touch targets are unchanged.
- Player Total-chart keys include the game index because event IDs repeat across games.
- PDF layouts visually verified; `npm run check` and `npm run typecheck` passed.

## RevenueCat integration — 2026-09-10

Native iOS/Android billing now uses `platform/purchases.ts` and `hooks/usePurchases.ts`, with store prices, purchase/restore actions, entitlement updates and foreground refresh. Only `trialUsed` persists; RevenueCat replaces legacy local unlock flags. The launch paywall waits for initial billing loading. Expo Go/web checkout is disabled. Configuration and real sandbox purchases are still pending; see `docs/REVENUECAT.md` and `livestats/.env.example`. `development-device` supports physical iPhone builds.
