# HoopLog — the decisions

The long form of every rule in `CLAUDE.md`, with the argument behind it. Read the relevant section
before changing a design decision, deleting something that looks unused, or rebuilding something the
root file says was cut.

## What this is

**HoopLog** — a live basketball stats board for one scorer keeping stats for **one team** on a
phone or tablet at courtside. The board is a single screen; everything else on it is a modal panel
over it. The app lives in `livestats/` (Expo SDK 57, RN 0.86, New Architecture, TypeScript strict,
Zustand, NativeWind v4, Expo Router). Bundle id `com.n2937.hooplog`, scheme `hooplog`.

Four constraints drive every decision **about the board**:

- Speed of entry beats completeness — every stat is 2–3 taps.
- One team only — the opponent is a single integer with three buttons.
- The court is the primary input — a tap on the floor starts a shot entry.
- Nothing scrolls on the board — exactly one viewport; only panels scroll.

The screens around it (the tabs, the pickers, the stats screens) are ordinary responsive screens
under ordinary rules; a `FlatList` that scrolls there violates nothing.

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
touching `lib/`, `constants/`, `components/` or `app/`.** To check one thing, comment out the block.

**Never hand-pick a dependency version** — `npx expo install <pkg>` / `--fix` lets the SDK 57
resolver choose. `react-native-worklets` and `babel-preset-expo` are direct dependencies on purpose
(peers `expo-doctor` cannot fix; NativeWind needs the preset to resolve from the project root).
**Stop Metro before `npx expo install` on Windows** — a running dev server holds
`lightningcss.win32-x64-msvc.node` open and the install fails EPERM (and `npm ci` fails it *after*
wiping `node_modules`).

`livestats/AGENTS.md` (via `livestats/CLAUDE.md`) points at the versioned Expo docs for **v57**.
**`newArchEnabled` is gone from `app.json` deliberately** — SDK 57 dropped the key from the schema.

## Routing

Expo Router — a stack with a tab group inside it, headers hidden:

```
app/_layout.tsx        Stack + SafeAreaProvider + palette + fonts + the game clock
app/(tabs)/_layout.tsx the four tabs
  (tabs)/index.tsx     LOBBY
  (tabs)/matches.tsx   MATCHES — the shelf of finished games
  (tabs)/season.tsx    STATS — every saved official game added up
  (tabs)/team.tsx      TEAM — the durable roster
app/intro.tsx          THE DOOR — four steps, once per install
app/start.tsx          NEW GAME picker
app/settings.tsx       GAME SETTINGS (a page, not a panel)
app/paywall.tsx        THE PAYWALL (a page)
app/game.tsx           THE BOARD
app/stats.tsx          one game in full — NO CALLER, left standing
app/history/[id].tsx   ONE SAVED GAME — box score + play log
app/competition.tsx    ONE COMPETITION
app/player/[id].tsx    ONE PLAYER
app/analysis.tsx       THE LAST GAME vs the run behind it
```

- **The shelf's room is MATCHES; the model is still a game** (`GameState`, `historyStore`,
  `GameSummary`). There is no `games.tsx`. **TEAM is singular** — a plural label promises a switcher
  that does not exist.
- **The board is outside the tab group, and that is the point of the group** — a tab bar under it
  would steal court height and put navigation beside UNDO and the footer's counted cell. The seven pushed pages are
  outside it too: each is a place you go INTO and come back out of, so each gets a back button.
- `router.replace('/game')` out of the picker, never `push` — back off the board goes home.
- **Three of the four tabs mount their own `<PanelHost />`.** STATS has none and must not grow one.

### The tab bar is two bars, split by platform

iOS renders the real UIKit bar via `expo-router/unstable-native-tabs` (Liquid Glass on iOS 26);
Android keeps the JS `<Tabs>`. Both are built from ONE `TABS` table in `app/(tabs)/_layout.tsx`.

- **Neither bar carries a word.** Four glyphs, no labels. The two bars take the word away
  differently and neither is an omission: `<Label hidden />` on iOS (a `NativeTabs.Trigger` with no
  `<Label>` falls back to the route's own title and prints `index`), `tabBarShowLabel: false` on
  Android. `TABS` carries no `title`; no type token reaches either bar.
- **Glass is what you get by NOT asking for a background** — `backgroundColor` and `blurEffect` stay
  unset; either replaces the system appearance. Tint is the one colour that bar sets.
  `minimizeBehavior: 'never'` — a bar that shrinks on scroll is a control that is not where it was.
- **The JS bar is `bg`, not `surface`, and the tab scene is painted too** — this palette's surfaces
  are translucent and the root paints the LIGHT canvas behind the navigator, so a 5% white bar
  sampled the wrong ground and came out grey. 1px seam along its top edge.
- **The JS bar's height is stated and only its can be.** `BAR_ROW` (54) is the strip above the inset,
  and the inset is paid TWICE: inside `height` (which is the whole bar including padding) and again
  as `paddingBottom`. Miss the second and the glyphs sit under system navigation; miss the first and
  the bar grows by the inset. It stays 54 with the label gone — what is left is the tap target. The
  glass bar is untouched; UIKit owns its height.
- **The Android active state is a `surface2` pill behind the glyph** — the same 9% white every other
  raised cell uses, and not a second thing accent means.
- **`components/nav/nativeTabs.ts` is the only module naming `unstable-native-tabs`**, and it unpacks
  `Icon` / `Label` / `VectorIcon` off `NativeTabs.Trigger`. Needs a dev build and Xcode 26.

### Light and dark

- **The board is the only screen light by default, and it is not in the tab group.** Every other
  route wears the same near-black: the four rooms off `ThemeProvider value={DARK}`, the seven pushed
  pages off `DarkRoom`. Shared components (`Card`, `Band`, `Btn`, `Crest`, `Seam`, `BoxTable`,
  `ClubCard`) follow the provider with **no `dark` prop anywhere**.
- **The board is also the one route a SETTING can turn down** (`options.board`). It takes the palette
  and the status bar and NOT the bloom.
- **Glass is the lobby's CARDS and nothing else** — not the board, rail, footer, score cell or any
  panel. The board is read at arm's length in gym lighting, and the `dock` panel exists precisely so
  the court stays visible behind it. `expo-blur` is spent on the lobby alone.
- **`components/ui/DarkRoom.tsx` is the palette and the status bar together** — a dark screen under a
  dark status bar loses the clock and the battery, and that is a bug you only see on a device. Ten
  callers: the tab group, the seven pushed pages, `<RotateGate />`, and `app/game.tsx` when asked.
- **The gate does not wrap itself over a dark board** — nesting two strands the status bar (the inner
  cleanup hands it to the root's `dark` and the outer provider has no effect left to re-run). It asks
  the palette it is in and wraps only over a LIGHT board.
- **The bar is flipped on FOCUS, not by a mounted `<StatusBar>`** — a stack keeps lower screens
  mounted and the last mounted wins. `useFocusEffect` + `setStatusBarStyle`; cleanup restores the
  root's `dark`, and React runs every cleanup before any effect, so dark→dark sets `dark` then
  `light`.
- The line is what a screen is FOR: every screen a game is READ on is dark, the one it is PLAYED on
  is light.

### `app/_layout.tsx`

Writes the palette with `vars()`, sets the status bar and **starts the game clock**. Deliberately not
`game.tsx` — a running clock is a fact about the game, not about which screen is showing, and walking
off to TEAM mid-quarter must not stop crediting minutes.

### `<RotateGate />`

Mounted inside `game.tsx`, not at the root (there it would cover the portrait screens). The board and
its panels stay mounted underneath, so turning back restores the exact state. Keyed on
`portrait && min(w,h) < 700`, never on orientation alone — **an 820×1180 tablet in portrait is a
designed layout and never sees it.** Wears `DarkRoom` and `Bloom`. `RotateGate` is the test and the
wrapper; `Gate` is the gate itself, mounted only while blocked.

## Theme and sizing

`theme/tokens.ts` is two layers: a palette (the only place a hex is written) and semantic aliases.
**It may not import `react-native`** — `lib/pdf.ts` imports `PALETTE` and `npm run check` runs it
under plain node, so the platform is read off `process.env.EXPO_OS`.

**Two palettes, no skin switcher.** `DARK` is the tab group's, and the board may be asked for it.
There is no `auto`, nothing is detected. A SUBTREE declares its palette through the context in
`theme/useTheme.ts`; two subtrees use it — `app/(tabs)/_layout.tsx` always, `app/game.tsx` when
`options.board` says so. Doing it in `useTheme()` is what keeps the shared components shared, with no
prop threaded down and no second copy of any of them.

**`DARK`'s surfaces are TRANSLUCENT** (`surface`, `surface2`, `rule`, `line`, `press` all carry
alpha) — that is what makes the glass work, and it is safe only because every consumer draws on the
near-black `bg`. **Do not reuse this palette over a light ground.** Four views must ask
`isTranslucent(p)` — `Card`'s shadow wrapper, the competition card's (both would otherwise composite
5% white twice into an opaque slab in front of the bloom), `PanelHost`'s frame (which must be OPAQUE
whatever the palette says — a 5% white over a scrim is a paler hole, not a sheet), and the TEAM tab's
`InputAccessoryView` (takes `bg` outright). Two `DARK` tokens deliberately LIFT rather than match the
light values: `danger` and `live`.

**An inverted pair must survive BOTH palettes** — `Crest`'s monogram is `bg`, the one token that is
the opposite of `ink` in both. `selfcheck`'s fill-without-ink grep checks a pair EXISTS, not that it
inverts.

**The panels are inline-styled, all of them.** A NativeWind class resolves through the CSS variables
the ROOT pushes down — the LIGHT palette's, whatever subtree the panel is drawn in.

### The skin

Orange, warm greys. `accent` is `#E2571F`; the ink ramp is anchored on near-black `#0A0604` and every
grey above it carries warmth (a cool ramp under a saturated orange reads as two palettes sharing a
screen). **The court is the one surface left slightly cool** — it is the backdrop the orange marks
are read against. The skin is sampled off the lobby's hero photograph: `live` IS the infield blue,
the near-black carries a trace of the rust. The photograph's yellow was deliberately not taken — it
is the mark the eye goes to, which is `accent`'s job.

| hue | means | where |
|---|---|---|
| `accent` orange | OURS — primary action, our score, a made shot, the active tab | |
| `live` blue | NOW — in progress, unresolved | the running clock, the court's tap mark |
| `danger` red | destroys something, has stopped, or went the wrong way | destructive verbs, the stopped clock, an unavailable player, and the two stated departures: the `L` on a finished match and the worse half of a CHANGE |
| `good` green | BETTER THAN BEFORE | the better half of a change, and nothing else |

- **`good` is INK ONLY — there is no `goodInk`.** It lifts on `DARK` exactly as `danger` does and by
  the same amount, because the two are read side by side in one column. Its only readers are
  `CompareTable` and `WhatChanged`; do not spend it on a verb, a state or a tab.
- **`live` is the retired accent, not a fourth hue.** `mark` aliases the same raw — a tap not yet
  resolved must NOT be orange, because two dots away orange means MADE.
- **The chart's three dots are the one place a scorer may override a hue.** `DotHue` / `dotColor`:
  eight named marks, three of them palette tokens. **TEAL is raw** (`#0E8FA3`) — it used to resolve
  through `live`, and `live` is now the photograph's blue, so the swatch labelled TEAL drew a blue
  beside BLUE. `selfcheck` asserts no two swatches draw one colour.
- **`accent2` is the pressed accent and it is DARKER, never fainter** — `opacity` fades orange toward
  a warm canvas of nearly the same hue. One caller: a filled accent button.

### The bloom

**`components/ui/Bloom.tsx` is the accent at 34% falling to nothing before the fold, and it is the
only ground.** Stops, axis and height live in `theme/tokens.ts` (`BLOOM_START` / `BLOOM_END` /
`BLOOM_STOPS` / `BLOOM_HEIGHT`, `bloomWash`), because a gradient is a raw value like a hex. One
component for all eleven routes — a copy per caller is a chance for one screen to sit at a different
angle to the light, which is what the eye catches moving between two tabs.

**Two rules, both of which have bitten:** it is the FIRST child of the screen's root view, OUTSIDE
the padded flow so it runs under the safe-area inset (a gradient starting below the status bar draws
a line across the top of the screen), and it is `pointerEvents="none"`.

**Eleven routes**: the four tabs, the two doors, `player/[id]`, `competition`, `history/[id]`,
`stats`, `analysis`. **`app/game.tsx` is the exception** — a light court read at arm's length spends
every gram of contrast on the marks. `<RotateGate />` is mounted on that route but is not the board.

**There is no pinstripe and no monogram anywhere.** A weave, grid, noise field or monogram behind
these screens is not to be rebuilt without being asked — the mark has been tried on the jersey plate
and in the rooms and cut from both.

### `GlowText`

**Orange ink is lit, and `components/ui/GlowText.tsx` is the only thing that lights it** — every
accent letter and number in the dark rooms (the mark's `log`, a winning score, a starter's name, a
hero tile, a plus-minus, a jersey number, a play's points).

- **It is the one ramp that may not use alpha** — this is a MASK, where a transparent stop erases the
  end of a glyph. Both stops are solid and what varies is DEPTH: `orangeHot` (`#FF7038`, the accent's
  own hue taken up in lightness) settling into the accent. Two stops, not three — `BLOOM_STOPS`'s
  0.45 midpoint would spend the whole move inside two glyphs of a five-character score.
- **The rule is the INK, not the call site** — it renders a plain `Text` unless the colour handed to
  it IS the accent, so `won ? t.accent : t.ink` stays one line. Swapping `Text` for `GlowText` is
  always safe.
- **Layout goes in `containerStyle`, not `style`** — the mask is a View wrapping two copies of the
  type, so a `flex` on the inner `Text` sizes a child of the thing it was meant to size.
- **The board is not in it** — by which components import it, not by a palette check. The native tab
  bar cannot be (a UIKit tint, no glyph of ours to mask), and **web falls back to flat**:
  `react-native-web` has no honest mask, and an empty rectangle is worse than solid orange.
- It costs `@react-native-masked-view/masked-view` + `expo-linear-gradient` and a rebuild; two views
  and two copies of the string per lit item. Worth checking on `PlaysList`, which is not virtualised.

### Depth

**Cards and panels float; the board does not.** `ELEV_CARD` / `ELEV_LIFT` / `ELEV_PANEL` are the
whole ramp, in `tokens.ts` because a shadow is a raw value like a hex. The court, the rail, the
footer and every tile grid stay flat — the 1px seam that divides a tile grid IS the grid, and a tile
that lifts casts onto its neighbour and eats the seam.

**A shadow and a clip cannot share a view.** `overflow:'hidden'` is `clipsToBounds` on iOS, so a card
clipping its children to its radius clips its own shadow with them. `Card` is TWO views (outer: fill,
radius, elevation; inner: same radius + clip); `season.tsx`'s competition card wraps its `Press` the
same way. Android's half: `elevation` draws nothing without an opaque `backgroundColor` on the same
view. **Write both platforms out every time.** `PanelHost` is the one deliberate exception — every
mode but `dock` sits on a scrim, which does the separating a shadow would.

### Ramps, faces, tracking

NativeWind resolves colours through CSS variables the root writes with `vars()`, so a `bg-surface`
class and a `useTheme()` read can never disagree; `global.css` carries the same values as fallback
only. **Sizes are deliberately absent from `tailwind.config.js`** — every one is a `clamp()` off the
window height, which a static class cannot express. `darkMode: 'class'` because the preset's `media`
default crashes the web runtime (`react-native-css-interop` calls `colorScheme.set()`, which throws);
**do not simplify it back.**

`theme/metrics.ts` is one fluid ramp: `clamp(floor, N vh, ceiling)`, recomputed on rotation. Anything
that must not scale comes off the fixed step scale `s1`…`s6` (4/8/12/16/24/32). **Nothing interactive
may compute below `tap` (48).** Never introduce a bare pixel size in a layout; add to the ramp.

**Two steps are decided by WIDTH as well as height**, because a string of known length must fit a box
of known width: `fsFtr` (the footer's middle block carries three numbers side by side, capped at
`(half − 34) / 7.76`; the vh term wins on every screen the board runs on, but the cap keeps `07:24`
from becoming `07:2…`) and the paywall's `headFs`.

**The body face is the system's** — `fontFamily: 'System'` plus a real `fontWeight` on iOS (SF is not
addressable by PostScript name), Inter as a family name on Android. `fNum` and `fUi` differ in
DEFAULT WEIGHT and tracking, not family. **A face is a STYLE FRAGMENT, so every call site spreads
it**: `...fUi(500)`, never `fontFamily: fUi(500)`. Tabular numerals everywhere a number can change.

**`fDisplay` is Anton, bundled, one weight, Vietnamese subset.** Spent on exactly three things: the
`hooplog` wordmark, the monogram inside a `Crest`, and the club's name in `ClubMark` — the one stated
exception, because that name stands in for the wordmark in the two rooms the wordmark does not reach.
Everywhere else **user text is body text, always**: never a number, never a label, never a button,
never a string the app did not write itself.

**Nothing in this app shouts.** Sentence case throughout — *New game*, *No official game yet* — and a
name a scorer typed is printed exactly as they typed it. What stays in caps is abbreviations only:
PTS, REB, MIN, FG, 3PT, FT, OR, DR, TOT, AS, TO, ST, BS, PF, FD, EF, the board's PF / FT / RB keys,
OPP, the W/L letter, DNP, and Q1 / H1 / OT. Those are CODES.

Six tracking tokens, and every `letterSpacing` in the app comes off one of them:

| token | em | where |
|---|---|---|
| `LS_CAPS` | 0.02 | the abbreviations — the only positive step left |
| `LS_MICRO` | −0.0025 | the smallest captions |
| `LS_LABEL` | −0.0075 | an ordinary label |
| `LS_BTN` | −0.01 | a verb on a button |
| `LS_TITLE` | −0.015 | a screen's own name at display size |
| `LS_TIGHT` | −0.02 | the NUMBERS: a score, a tile's value, a jersey plate, the footer's block |

Mixed case is hurt by wide tracking. The ramp was halved and then SHIFTED (−0.01em on the whole
ladder): halving alone walks toward zero, which is the face's own spacing, so a converging ramp can
never set tighter than the font draws. The shift keeps the SHAPE. Done at the six constants and
nowhere else. **Numerals never go positive.** The size ramp came down with the caps, hardest at the
big steps (`fs4xl` 34–72, `fs2xl` 23–44, `fsXs` 11–13).

**A value and its caption are two weights apart, not one**: the number is `fNum(700)` in `ink`, the
caption is `fUi(400)` — Regular, not Medium — in `ink2` at `LS_MICRO`. The ink stays `ink2` and does
not fall to `ink3`, because these cells are drawn on the light palette too.

**`fs2xs` is for strings that are not on the BOARD** (the paywall's small print, `MiniBoard`'s
captions). Do not spend it on a label, a caption, or anything the board draws.

## Styling: CSS is not React Native, and NativeWind bites

**Never pass a function to `style`.** NativeWind's interop resolves props by walking a `["style", …]`
path through `assignToTarget`, where `if (typeof parent[prop] !== "object") parent[prop] = {}` — a
function is not an object, so **the entire style object is replaced with `{}`** and every rule is
dropped without a warning. Object and array styles survive, which is why this failed as "half the
board looks right". Use `components/ui/Press`, which takes `style` and `pressedStyle` as plain
objects and tracks the press itself.

**Build on `components/ui/`, not on bare Views** — `Row` / `Col` / `Center` / `Fixed`, `Press`,
`Tile`, `Badge`, `Surface`, `Jersey`. They exist because three CSS→RN default differences were
re-derived in every component and got re-derived wrong:

1. `display:flex` lays out a **row** in CSS and a **column** in RN — any ported rule without
   `flex-direction:column` needs an explicit `flexDirection:'row'`.
2. A column container defaults to `alignItems:'stretch'`, so a fixed-size child fills the width. A
   circle, badge or icon needs explicit `width`/`height` and `flexShrink:0`.
3. Centering is never inherited — `alignItems` **and** `justifyContent` both have to be stated.

Two more that cost real time: `flex:1` means `flexBasis:0`, so a `flex:1` child inside a parent whose
height comes from its content collapses to nothing; and `alignItems:'baseline'` offsets children by
their ascent, which in a short box goes negative and pushes content out the top.

**An inverted surface is a pair.** Every rule that sets a background *and* a colour must carry both
across. `npm run check` greps for all three — function styles, raw `Pressable` imports outside
`components/ui/`, and a fill without its matching ink.

### `Jersey`

**The plate, and there is exactly one of it.** A rectangle, not a bubble — the number gets the whole
height of the box. Its resting pair is the FLOOR (`court` fill, `courtLine` ink); `selected` and
`out` are inversions written as pairs. **Both dimensions are the caller's** (the rail measures its
row; the two team screens take a size off the ramp). Do not build a second one for a fourth caller.

**It takes a `blank`, which draws the plate and not the number** — one caller, the TEAM tab, where
the jersey is TYPED. `plateFs` and `plateInk` are exported for exactly that overlay.

**The resting plate is DRESSED — two layers under the number, and both are ground**: the corner bloom
(`plateWash`, on the same stops, so a plate is lit from the same corner as the room) and a 2px accent
edge down the left, the one solid thing in the set — a wash with no hard edge reads as a smudge.
`plateWash` is pinned between the other two weights (0.30 → 0.09 → nothing). Neither layer counts
against what accent means, and **both are the RESTING plate's alone** — `selected` and `out` are
states, and a state is the whole of what that plate is saying. **No monogram on the plate.**

### `Btn`

**Eight variants, and the ladder is deliberate:** `accent` (primary) > `solid` (ink) > `surface`
(filled, 1px `rule`) > `plain` (transparent, 2px `line`), plus `danger` and `made`, plus the two
DRESSED ones — `bloom` and `plate` — which are not steps on that ladder. `surface` exists for the
home screen and only for it: three stacked buttons need three weights.

**`bloom` is the background made into a button** — the room's near-black `bg` as the fill, the accent
washing across it on the bloom's own axis (`bloomFill`), the edge in accent because a near-black fill
draws no edge against a near-black room. Denser than the wash and softer than the raw accent:
**0.82 → 0.56 → 0.30**, every stop that one orange through `withAlpha` — no new hex. Pressed, the ramp
steps to `accent2` and only the edge is left for `pressedStyle`. It is a seventh variant rather than a
change to `accent` because every other accent button sits on a panel over a light court, where a fill
falling to near-black would be a hole. Its callers are the two buttons that START something.

**`plate` is the jersey plate made into a button**, one caller (the lobby's `+`): the same three
layers in the same order, glyph in `courtLine`, **no border** (a plate's edge is a rule down ONE side,
not a ring). Under the thumb the warm fill holds still while the wash and that rule step to `accent2`.

**`Btn` takes an `icon`, and it REPLACES the label rather than joining it** — a glyph plus a word is a
label with decoration on it. `label` stays REQUIRED either way; it is what the screen reader says.
The family is the tab bar's `MaterialCommunityIcons`; those are the only two places a glyph stands in
for a word.

### The board's press, and held light

**A press on the board LIGHTS the cell, and `t.press` is the only fill that does it** — the clock, the
quarter, the counted cell, UNDO, a player row and PF/FT/RB. It is a step *away* from `surface`; `surface2` is the
canvas, so using it there read as the cell dimming at the moment it is looked at. A brightness, not a
hue. On the light palette `press` IS the canvas, because down is the only direction with contrast
left. Panels and `Tile` still press on `surface2` — they sit on a scrim, not on the board.

**And the light is HELD until the panel it opened closes.** `lib/lit.ts` answers which control that
is, and it is a function rather than a second `Record<Panel['kind'], …>` because **step 2 is shared**
(`who` serves PF, FT, RB, a tally and a shot, so only the in-flight `what` says whose flow it is) and
**a tap can open a chain** (the quarter cell owns `endQuarter`, `setClock` and `endGame` alike).
`litPlayerId` is the rail's half — the row whose own panel is open, which is **not** `ui.shooter` and
does not outrank it. UNDO, the counted cell and the clock open nothing and are deliberately absent.

**`rects.lit` is one slot, not a key per control**, because two are never lit at once. It is measured
on the OFF→ON edge rather than in `onLayout` (becoming lit is not a layout change), with `onLayout`
kept as well so a rotation mid-panel does not strand the hole. `useLitRect` clears the slot on
cleanup, and React runs every cleanup before any effect, so a control going dark cannot wipe the slot
of the one lighting up beside it.

**The tile grid's 1px divider IS the gap:** a rule-coloured parent showing through 1px seams. Tiles
must be opaque and carry no border and no radius, or the seam disappears.

## Layout

**Two layouts, keyed on ORIENTATION, never on a width threshold.** A 667×320 phone in landscape is
narrow but must not stack; an 820×1180 tablet in portrait is wide but must.

Landscape is two columns and two rows: board top-left, footer under it, rail down the whole right
edge — so the footer stops at the rail. Portrait is one column: court, the bar PF/FT/RB shares with
the three OPP buttons, then the rail, then the footer. **The score is a footer cell, not a strip.**
**The rail keeps its column form** in portrait rather than lying down as a strip: an aspect-locked
court on a narrow phone is never much more than a third of the screen tall.

**The court is sized by arithmetic, not by the layout engine.** `computeMetrics` subtracts the rail,
the action column, the OPP column, the safe-area insets and the five gaps, then aspect-locks what is
left. A wrong term does not throw — it silently shrinks the court to nothing. **Changing a row in
either layout means changing the matching subtraction.**

**Horizontal safe insets are capped at `SIDE_INSET` (24)** — iOS hands a landscape phone 44pt on both
edges for a cutout biting one. `computeMetrics` clamps `left`/`right` and **returns the capped box as
`m.safe`**; `Board` reads that, never `useSafeAreaInsets` directly. `top`/`bottom` are untouched.

**The two flanking columns are one width** — `oppw = side`, off a single ramp, because both carry
`flexGrow:1` off their basis and any difference in basis is a permanent visible offset between two
columns that read as a pair. Widening them trades straight against court width.

**`compact` is `height ≤ 560`.** Panels tighten and blocks narrow in both orientations; the tap floor
on the rail rows is released only in **landscape**, because a 330×490 phone is compact too and must
keep the portrait stack.

## Court geometry is a contract

Hardcoded to a 792 × 521 viewBox: basket at (396, 76), three-point arc r = 352, paint
`x ∈ [277,513] ∧ y ≤ 276`, corner cut-off `y ≤ 203.7 ∧ (x ≤ 68 ∨ x ≥ 724)`.

`lib/court.ts` owns all of it and returns one of seven `ZONES`. `shotTypeFor` is derived from the
zone through `THREES`, so the two can never disagree — **there is deliberately no manual 2/3 override
and no zone label on the shot panel.**

**The drawing is the contract.** Every cut `zoneFor` makes is a line actually painted by
`CourtSvg.tsx`, and every line that bounds a region is a zone edge:

| line, as drawn | separates |
|---|---|
| the lane, `x = 277 / 513`, `y = 276` | the paint |
| `y = 101`, lane edge → three-point line | `corner2` \| `wing2` |
| `y = 203.7`, three-point line → sideline | `corner3` \| `wing3` |
| the three-point line, `x = 68 / 724` + the arc | 2PT \| 3PT |
| the lane extensions, `(310,276)→(187,521)` and `(480,276)→(603,521)` | `wing` \| `top` |

The backboard, the rim and the free-throw circle bound nothing. **Sectors are NOT angular** — an
`atan2` fan is what `zoneFor` used to do, and the floor has no line for any of those rays, so the lit
fill and the paint disagreed by whole slabs. **The two corner cuts are at different heights on
purpose**: inside the arc the corner ends at the free-throw line extended (101), outside it at the
stub the three-point line turns on (203.7) — the boundary *steps* at `x = 68 / 724`.

**`ZONE_PATHS` carries the same partition a second time, as eleven exact closed paths**, in
`lib/court.ts` beside `zoneFor` with `COURT_LINES` and `RIM` — the stats screen draws the same floor.
The only two vertices not read straight off the drawing are where each lane extension crosses the arc
— `(540.6904, 396.8874)` and `(249.6808, 396.1479)` — and they are solved, not eyeballed. **The two
sides are not mirrors:** the extensions are symmetric about the lane's centre 395, the arc about the
basket at 396.

**`zoneFor` and those path strings change together or not at all**, and `selfcheck` enforces it two
ways: it rasterises the real `d` strings and asserts all 412,632 cells resolve to the zone `zoneFor`
names, and it asserts each of the nine bounding lines is still drawn. It samples at
`(px + 0.31, py + 0.27)` rather than the pixel centre, because every boundary is an integer, `203.7`,
or a slope of `123/245`. **The strings are read out of the SOURCE rather than imported.**

Zones are never hit-tested — the wrapper owns the pointer — and only the one matching
`ui.zone`/`ui.side` is rendered. Taps are normalised and **rounded to 3 dp** (`normalise`); event
payloads are stored and compared, so do not widen that.

**`FT_SPOT` is a mark, not a zone.** Free throws are logged at `(0.5, 0.53)` with **`zone: null`
always** — they never touch `fgAttempted` / `twoAttempted` / `threeAttempted`, only `ftAttempted` /
`ftMade` / `ftTrips`.

**The chart marks shots and free throws, nothing else.** Fouls, rebounds and tallies leave no mark.
Free throws all land on one coordinate, so there is only ever **one** of them: a `danger` dot the size
of a shot's, carrying **no label**. It lights as soon as FT is pressed (`ui.what === 'ft'`, which is
why that flow does not `clear()`) and, being derived from `events`, follows undo with no special case.

## Architecture

**Nine stores, one job each.**

- `store/teamStore.ts` — the **club**: name, crest, head coach, assistant.
- `store/rosterStore.ts` — the **team**: `{id, number, name, position?, available}` × 20 max.
  Persisted plainly. **Persist version 2**: `available` arrived after builds shipped, `undefined` is
  falsy, and a rehydrate without the migration is an empty starter picker at tip-off. `migrateRoster`
  lives in `lib/roster.ts` so `npm run check` runs the real one.
- `store/historyStore.ts` — the games that are **over**.
- `store/gameStore.ts` — the `GameState`, every action, undo, the options. Persisted to AsyncStorage
  through a debounced writer.
- `store/uiStore.ts` — the in-flight entry (`mark`/`zone`/`side`/`shotType`/`what`/`shooter`/
  `foulKind`/`trip`/`note`), the panel router, the toast. Not persisted.
- `store/layoutStore.ts` — rects measured via `onLayout` + `measureInWindow`. Only the board writes.
- `store/billingStore.ts` — **two booleans**, `entitled` and `trialUsed`. Its own store because it
  OUTLIVES every game (`startGame` clears `gameStore`).
- `store/introStore.ts` — one persisted boolean `seen`, plus an unpersisted `hydrated`, which is the
  whole reason anything reads the store rather than a constant.
- `store/tutorialStore.ts` — the walkthrough session (unpersisted) and three remembered facts
  (`completed`, `lastStep`, `outroShown`) that **nothing is gated on**. It also owns the throwaway
  game's two seams: the stashed board and `pausePersist`.

**The club is not the roster, and they are two stores.** `rosterStore` is a list with a cap and a
duplicate rule; `teamStore` is a record with a FILE attached. Both outlive every game.

**The roster is not the game, and that split is the point.** `Player extends Omit<RosterPlayer,
'position' | 'available'>`, and `lib/roster.ts`'s **`buildPlayers` is the only crossing for people**.
It runs once, at tip-off, from `gameStore.startGame(roster, starterIds, teamName)`, copying field by
field with a **fresh `zeroStats()` per player**, so editing the team after tip-off cannot reach the
game and no two players can share a counter. `npm run check` asserts both by renaming, renumbering and
deleting a roster entry mid-game. `startGame` deliberately does **not** go through `edit()` and clears
the undo stack outright.

**The rules are plain functions, not store methods.** `lib/actions.ts` holds every mutation as a
function over a `GameState`; the store snapshots, calls one, and publishes. That is why `npm run
check` can exercise the whole rulebook without React, Zustand or a device — **keep new rules on that
side of the line** (as `box.ts`, `season.ts`, `history.ts`, `billing.ts`, `analysis.ts`, `tutorial.ts`
and `pdf.ts` are).

**Undo is snapshot-based, not inverse-op-based.** `edit()` pushes a JSON deep copy of
`{score, oppScore, possessions, timeouts, players, events}` before every mutation (capped at 80); `undo()`
restores it wholesale. A mutation that does not go through `edit()` is silently skipped by undo. The
stack lives at **module scope in `gameStore.ts`, not in the store** — nothing on screen depends on it,
and state would repaint the board eighty times a game. A `denied` foul pops its own snapshot back off.
**`undo()` explicitly carries `secondsPlayed` forward**: rewinding a basket must not rewind time.

**END QUARTER is undoable, and it is the only clock action that is** — it sits next to END GAME and a
mis-tap costs a whole period, where SET can put 10:00 back. So `Snapshot` carries `period` and
`remaining` OPTIONALLY and `edit(fn, true)` puts them there (one caller): a snapshot pushed by a
basket must not carry a time. `undo()` restores the clock only when it finds one, and always
`running: false`. `lib/actions.ts`'s `nextPeriod` is the mutation, so `npm run check` asserts both
halves — the buzzer logs no event and credits no minute.

**Two parallel records per action.** Counters live on `player.stats`; an append-only `state.events`
feeds the play-by-play. Every `record*` writes both. Event ids come off `events.length`, so undo
rewinds the sequence with the log.

**`GameEvent` is `EventMeta & EventBody`.** The split is not cosmetic: `Omit` over a union keeps only
shared keys, so a flat type would let `log()` accept a shot with no `position`. Readers must tolerate
a **null `playerId`** and must check `type` before reading `value` (on an `oppPoint`, `value` is
*their* points).

**`hooks/useFlow.ts` is the one place a pick is interpreted.** Panels stay dumb — do not put recording
logic in a panel component.

## Panels

Three placement modes, in the `MODE` map in `components/panels/placement.ts` — **not** in `PanelHost`,
because the footer needs the same answer. Ask `isDocked()`; never keep a second list.

| mode | where | scrim |
|---|---|---|
| `dock` | the columns right of the court, the rail's full height | **clear** |
| `court` | the court's own footprint, top edge to footer | dimmed |
| `center` | a centred dialog | dimmed |

**Every panel is dismissible by its scrim and by hardware back, except one** — `fouledOut`, while a
substitution is owed. `Scrim`'s `onPress` is `(() => void) | null` for it, and the `close` label goes
with the handler.

**Five panel kinds live off the board** — `newGame`, `setNumber`, `removePlayer`, `removeGame`,
`resumeTutorial` — and all five are `center`. They ride the same `Panel` union and the same exhaustive
switch. **There is no FORM among them**, and that is the pattern: the TEAM tab edits a player on its
row and the club on its card, in place.

**`PanelHost`'s switch is exhaustive** — a `Panel` member added without a branch is a compile error
rather than a blank overlay.

**A dimmed scrim is FOUR bands with the lit control cut out of them, not one sheet.** The button that
opened the panel must not be dimmed, and no fill can achieve that; nor can the cell be lifted over the
top, because RN's `zIndex` orders siblings and every board control is a grandchild of `PanelHost`'s
sibling. `Scrim` tiles the window around `rects.lit` — **the bands must not overlap**, or two 45%
sheets crossing draw a darker seam. `dock` never cuts a hole.

**A `court` panel is TALLER than the court.** `courtBox` runs the board's full top-to-bottom and the
court is aspect-locked and centred inside it. **Measure with `useCourtBox()`, never with `m.court.h`**
— `courtBox()` reads real rects off `layoutStore`, because the arithmetic already lives in
`metrics.ts` and in the flex tree.

**The quarter panel wears the foul panel's shell** — header, 1px seams, code-over-caption tiles. Its
title is the quarter being played. **Its two rows are written out, not chunked (`PRows`), and both are
THIRDS**: −1s / +1s / SET across the top, EXIT / END QUARTER / END GAME across the bottom. A third of
the smallest court (276×182) is about four characters of code and ten of caption, which is the budget
EVERY label on the panel is cut to. ±1s lands immediately and leaves the panel open. The bottom row is
a **severity ramp left to right** — leave and come back, end a period (undoable), end the game
(confirmed) — which keeps the two `End` tiles adjacent and the destructive one at the far edge.

**EXIT LEAVES THE GAME STANDING, and that is its whole difference from the red tile beside it.**
Nothing is ended, filed or cleared; the lobby's CONTINUE GAME is the way back. So it takes **no
`tone`, no confirm and no toast**. **The clock is deliberately NOT stopped** — leaving the board
credits minutes exactly as walking off to TEAM does. **`reset()` runs BEFORE the route changes**: a
panel left open in `uiStore` would draw itself on the lobby over a court that is not there. **The
destination is STATED (`replace('/')`) rather than `back()`**, because the board is reached by
`replace`, by `push` and by a deep link with no stack at all. It does not reach a board with no events
— the lobby's `inProgress` is `events.length > 0`.

**END GAME's confirm wears the rebound panel's shell, over the court**: `PHead` + two big tiles, KEEP
/ PLAYING beside END / SAVE + STATS. The header carries the SCORELINE instead of prose.

**A `Tile`'s `tone` is INK ONLY** — `danger` for END GAME, `accent` for SET — colouring the code *and*
the caption, never a fill. A tile keeps its opaque surface whatever it does, because the 1px seam is
what the grid is made of, and there is no background to lose its ink.

**`dock` belongs to the two panels whose point is seeing the floor while you tap** — step 1 of a shot
and the free-throw result. It must neither cover the court nor dim it. It runs the full height of the
column, which is over END, so **the footer gives back exactly the overlap** (`dockFooterOverlap`).

**The FT flow deliberately does not `clear()` on the way in** so the court mark stays visible under
the dock; PF and RB still clear. `FTDockPanel` is one tap per attempt and **the tap ends the flow**:
the tile lights and the dock goes. Its header is the title and the X and **nothing else**. `TripSizePanel` / `TripShotsPanel` stay centred — a form, not a two-way choice.

**`SetClockPanel` is a `court` panel and its header is the quarter, the entry and the X.** Three rows,
with the readout in the header, is the layout constraint: the tightest box is 321×204, so after the
header there are 156px — three tap-sized rows at 52, where a fourth would put every one at 39. The
entry sits beside the title, dimmed while it shows the live clock and solid once the first digit
lands. Twelve cells in 4×3: the familiar 3×3 with DEL / 0 / SET down the right. **No BACK button** —
CANCEL covers getting one wrong. **The keypad fills mm:ss LEFT TO RIGHT and SET stays dark until all
four slots are down**; `pushClockDigit` **refuses** a tens-of-seconds digit over 5 rather than clamping
afterwards. A typed time stops the clock; ±1s does not.

**`gridFor` never hardcodes five.** Every column count yields cells of the same area, so it takes the
count whose smallest side is largest — 3×2 at five players on an 852×360 phone, 4×2 at eight, 6×2 at
twelve.

**EVERY FLOW CLOSES ON THE FINAL TAP, SO THEY ALL TOAST.** `say()` is the only confirmation an entry
landed, and where a foul-out surfaces.

**THE TWO SHEETS THAT USED TO STAY UP DO NOT ANY MORE**, and they are the exception this rule was
written around. A player's tiles reopened themselves after every tally so a block and the steal that
followed it were one sequence; the free-throw dock stayed up so a two- or three-shot trip was tapped
straight through. Both bought the RARE case with the common one. A scorer logging a single stat had to
dismiss a sheet they were finished with — every time, on a board whose whole claim is 2–3 taps — and a
run of two is two taps on the rail rather than one. The trip has its own setting: `ft: 'trip'` is the
board for a scorer who wanted that, and the dock is the QUICK one, where every attempt is already its
own trip logged on its own.

So both now do what the court does: **record, LIGHT, close.** `hooks/useLitClose.ts` is that rule, and
the light is the point of it — a sheet that vanished on the same frame as the tap would leave nothing
behind but a number that moved somewhere off it. `LIT_MS` (240) is a flash, not an animation: long
enough to read as *that one landed*, short enough that nobody waits on it. A player's tiles light
through the `bumped` reopen they already had, so the ring and the badge that moved are drawn together;
the dock's two tiles take the same overlay ring `Tile` draws, in whatever colour their own fill is
NOT — an accent ring on MADE would be invisible, and MADE is the tile most often tapped.

**THE CLOSE IS GUARDED ON `uiStore.opens`, NOT ON THE PANEL'S KIND.** Between the tap and the hold
running out a scorer can open something else, and the next player's tiles are the SAME kind — closing
those would take the tap that opened them with it. The counter answers "has anything opened since",
which is the question actually being asked, and it is the second reader that counter has. Back rules, in order: mid free-throw trip → trip size; a shooter
chosen in an FT flow → step 2; a rebound kind → step 1 **with the tile still selected**; otherwise a
full reset. **Only the rebound flow gets a tappable back TITLE**, and it is a title, not a chip —
`Chip` RENDERS `PTitleText`. The `←` is the whole affordance, and the press is an OPACITY.

Hardware back is this platform's Escape and calls `reset()`.

**Two places have a `TextInput`** — the TEAM tab (roster rows and club card) and the new-game screen's
two match fields — and the board is never one of them. **Only one avoids the keyboard**: the new-game
screen is a FORM; the TEAM tab is a LIST. `SetNumberPanel` is a keypad precisely so it does not have
to be; its number field is held as TEXT, because an empty field and a typed `0` are different states
and `Number('')` is `0`. The duplicate error **names the holder** and SAVE stays dark until both
fields are good.

## The lobby

**Two blocks and the verbs — a POSTER, not a dashboard.** The lockup and the club over the track;
then the LEAGUE; then the MVP; then ONE ROW with NEW GAME and the gear. **It was five blocks — every
number the app knows, stacked, none of them the reason anybody opens the app. Do not put a third
block back.**

**Everything is capped and centred on 700**, header included. Layout here is keyed on WIDTH, not
orientation. **Every piece is a module-level component**; declared inside `LobbyScreen` they would be
a new type on every render.

### The header

`hooplog` at `fs2xl` in `fDisplay` — `hoop` in ink, `log` in accent — then the crest and the club's
name.

- **The mark is lowercase, and it is the only display type in the app that is** (the crest's monogram
  is initials, and initials are a mark). Anton in caps is a poster shouting; lowercase it is a
  logotype.
- **The wordmark's line box is 1.3 and may not go tighter** — Anton is tall and condensed, and
  lowercase `p`/`g` descend, so a caps-height box cuts the tails off. **`fDisplay` may not go under
  about 1.15, anywhere.**
- **The wordmark leans, carries no full stop, and the lean is a SKEW.** Anton ships no italic, so
  `fontStyle: 'italic'` gives an Android oblique and an upright iOS mark. `WORDMARK_SLANT` (`-12deg`)
  states the synthesis once. It is the only leaning type in the app.
- **The skew is on a `View`, not on the `Text`** — a `transform` on a `<Text>` is a prop the New
  Architecture's paragraph node does not reliably carry; it typechecked, shipped and drew nothing.
  The wrapper must SIZE TO THE TYPE and must not be the row, because a skew is applied about the
  box's own centre. The accent half sits inside that one wrapper, or `log` leans at a different angle.
- **`fDisplay` is the wordmark's alone here** — the MVP's name is BODY face at `fsXl`. SIZE says which
  name the screen is about. No text shadow; there is still none in the app.

### The two blocks

Block one is the LEAGUE, block two the MVP — how the season is going is what a scorer opens the app
asking. They are `leagueBlock` and `mvpBlock` in the file (numbered names would have to be renumbered).

- **THE MVP is the per-game points leader over the season's official games**, averaged over the games
  each player APPEARED in. Ties break on efficiency then games played. Jersey left, name right,
  POINTS / ASSISTS / REBOUNDS across the foot, per game, ONE DECIMAL. Routes to `player/[id]`, handing
  the official games over in the route as the STATS tab does.
- **THE LEAGUE is the CURRENT competition, not the season** — `competitions()` hands groups back
  newest first, so `[0]` is the one being played. Points left at `fs4xl`, RECORD and GAMES right,
  shooting under them as a PILL (the split and the percentage are two readings of one fact, and the
  pill keeps the right column two rows, which is what lets the points run at `fs4xl`). Routes to
  `app/competition.tsx` on the folded key.
- **Both blocks cost the lobby every saved game off disk** — one pass on mount through
  `useSavedGames`, off the render path, both derivations memoised. Neither draws until it lands.
- **ONE empty card stands in for both**: `NO GAME YET` on a fresh install, `NO OFFICIAL GAME YET` on a
  shelf of practices — the season rule is why the screen is empty, so the screen says so.

### The verbs

**No LIVE hero, so the way back into a running game is the FOOT of the screen.** CONTINUE GAME takes
the primary slot while a game is on and NEW GAME steps down under it at `surface`, behind the confirm
panel. The verbs STACK.

**The last row is split four to one, gear in the fifth**, on the RIGHT where nothing that starts a
game has ever been. The weights sit on WRAPPER views, not on the buttons: `Btn` is `flex:1` inside
whatever it is handed and every other caller relies on that.

**NEW GAME is a `plus`** — the one control here that MAKES something — and **the RATIO says which is
primary**, not the presence of a word: four fifths in `plate` against a fifth of `plain`. CONTINUE
GAME keeps its WORD; coming back to a game is not an act of creation. START GAME and NEW GAME are the
two `bloom` buttons in the app because they are the two that start something.

**It fits in one window down to the verbs.** What survives of the cut previews is the WARNING `NEED AT
LEAST 5 AVAILABLE PLAYERS`, because that is why NEW GAME is dark. The `ScrollView` is the small-window
safety net, not the design.

### The floor and the accent

`HeaderArt` obeys the bloom's two rules. **It is faded by two gradients, not by `opacity`** — a flat
opacity lifts the whole photograph toward the room's ground and reads as a dull rectangle. The washes
run the room's own `bg` back OVER the picture, solid at the left edge and the bottom, clear at the
top-right corner, and **the bloom is drawn after it**. `assets/hero-court.jpg` is the only photograph
in the app: a running track cropped 2:1 with the marks RIGHT of centre.

**Accent was spent on three things here and is now spent on none of them** — the primary verb and the
one number each block is about all wear the PLATE. What is left of the orange is what never counted:
`log`, the two band labels, the wash inside the plate. **The cost is stated, not hidden**: `courtLine`
on a translucent `surface` is a warm grey, so each block's hero figure reads by SIZE alone. **The
RECORD is deliberately not lit** — a `12-4` is a win and a loss in one string. **The logotype and the
bloom are not further marks**: the first is the lockup, the second is a GROUND.

## The team tab

**`app/(tabs)/team.tsx` IS the roster editor — the row is the form.** A modal cost three taps and a
round trip per digit on the one screen where a scorer changes twelve of them before tip-off.

| part | what it is |
|---|---|
| the plate | the jersey, 0–99, digits only; a 2px `danger` ring on a collision |
| name | free text to `NAME_MAX`, on no box at all; blank shows `Player N` |
| the dot | dressed — `ink3` when on, `danger` when off |

Three press targets. **All three are the new-game picker's row**, taken from it: this screen had grown
three bordered boxes side by side, which read as a FORM where a jersey plate reads as a PLAYER — and
`app/start.tsx` asks the same questions an hour later and must not look like a different app.

**What that cost is the jersey FIELD, and the fix is an overlay.** The picker only TAPS its plate
(a keypad opens) where this screen types into it, and a plate is `tap × 0.72` ≈ 35pt — under the tap
floor. So the cell is a full `m.tap`, a `blank` `Jersey` is centred in it as the SURFACE, and the
field lies across the whole cell at `plateFs` in `plateInk`. **The `danger` ring is OUTSIDE the
plate**, on a wrapper — a border on the plate would eat the accent edge down its left. **The plate
does not follow the palette**: `court` / `courtLine` is the pair that does not invert.

**Every field commits AS IT IS TYPED, with the text held locally.** `rosterStore.update` runs
`cleanName`, which trims, so a store round trip per keystroke would eat a space the moment it was
typed. The local copy renders; **blur re-seeds it from the store**, which also reverts a rejected
number and normalises `07` to `7`. A colliding or half-typed number is SHOWN but never written.

**The club card is the LIST HEADER, not a block pinned above it** — one sheet, one scroller. It is
passed as an ELEMENT, not a component, so React keeps the instances and the fields hold their text.
**Keep it SHORT** (`s2` padding, name at `fsLg`): every point it spends is a player the scorer cannot
see on the first screen. Three bands, with the CREST ON THE NAME'S ROW; then COACH and ASSISTANT
COACH; then a dashed `+ ADD CLUB LOGO` with REMOVE once there is a crest. **The 2px rule under the
name is the card's whole error message** — `accent` while good, `danger` while empty, no words.

**No club colours, and that is a decision** — the palette has one skin and `theme/tokens.ts` is the
only place a hex is written, so a per-club colour is a theme change and not a field. Declined.

**No bottom padding on the frame** — the list runs to the bar and its SCROLL CONTENT carries the
inset, so the last row scrolls out from under the bar rather than stopping short of it.

**The bar's height is `hooks/useTabInset.ts`, not `safe.bottom`.** On iOS the glass bar sits ON TOP of
the scene's last 49 points and the root provider reports the WINDOW's inset; on Android the JS bar is
a flex sibling that reserves the system navigation inset itself, so `safe.bottom` there is a double
count. One hook answers both; a room adds it plus its own breathing room and never `safe.bottom` alone.

**No `KeyboardAvoidingView`, deliberately** — padding by the keyboard's height cut the viewport to a
few rows at the exact moment the scorer was working down all twenty. The keyboard sits OVER the list
and the list moves: `keyboardDismissMode="on-drag"`.

**But the keyboard's height is paid on the CONTENT, as tail.** `tail` is `max(bar, keyboard) + m.s6` —
the two never stack, since a keyboard covers the tab bar too — spent on `contentContainerStyle`, so
the viewport keeps its full height and only the pull changes.

**And the focused ROW is lifted clear.** Focus hands the ROW's node up (not the field — lifting the
name while the plate stays covered is half a fix) and the screen scrolls exactly the OVERLAP away.
**The list's own FRAME is measured, never the window**: iOS lays the keyboard OVER the frame so its
height must come off, while Android RESIZES the window and the frame has already lost it —
subtracting twice scrolls a whole keyboard too far. The lift runs in an EFFECT on the keyboard height
(the tail is paid out of that same number, and scrolling before the padding exists clamps against a
content height that has not grown); on focus it runs directly, since moving between two rows with the
keyboard up fires no keyboard event. Android's resize arrives as the frame's `onLayout`, the third
caller and the only one that catches it.

**The jersey field carries a DONE bar on iOS** — `number-pad` is the one keyboard with no return key.
One shared `InputAccessoryView` (`NUM_DONE`) serves every row and calls `Keyboard.dismiss()`, which
blurs the field and lets `onBlur` re-seed it. A no-op on Android.

**`+ ADD PLAYER` writes a blank row; there is no form behind it.** `nextFreeNumber` picks the lowest
0–99 nobody wears, because `number` is not optional. **At `ROSTER_CAP` the button is GONE, not
disabled**, and the `20/20` count turns `danger` to say why.

**Deliberately not on it: a captain and a starting five.** Both are facts about a GAME, and
`app/start.tsx` asks them at the door; a five chosen on Monday is wrong by Saturday.

## The new-game screen

**`app/start.tsx` wears the TEAM tab's layout, not a panel's** — it asks three questions (who is here,
who starts, who it is against) and those are a team screen's questions: the same `ClubCard`, the same
columned rows, the same 1px seams.

**It cannot edit the team, and the one exception is the JERSEY NUMBER** — not the club name, crest,
coaches, a player's name or position. A number is the one fact that changes at the door, because a
squad turns up in a different set of shirts. `components/team/ClubCard.tsx` is drawn `readOnly`: no
press, and **no pencil either**, or the card would promise an editor that never opens.

**A row is THREE press targets**: the plate opens the number keypad, the name picks or unpicks a
starter, the dot is availability. **The plate never changes colour for a starter** — a plate says
which shirt somebody is wearing, and a STATE on top of that is the loudest thing in the row fighting
the one thing the row is for. What says the pick is the NAME (`accent` ink at `fUi(700)`, and the word
STARTER beside it). There is still no filled row.

**Every player shows, unavailable ones dimmed**, because "actually, they made it" has to be one tap.
`availableIn` is the only filter that reaches `buildPlayers` and it is applied at `startGame`.

**`setNumber` is a KEYPAD, not a field** — two digits at courtside are faster off a grid of big targets
than off a keyboard covering half the screen, and it keeps the panel out of the `KeyboardAvoidingView`
business. It writes to `rosterStore`, and the duplicate error NAMES THE HOLDER.

**The page scrolls and the list does not**, the opposite of the TEAM tab and right here: a club card,
a roster, a two-field form and a button do not fit a 667×320 phone, so the whole column scrolls and
START GAME stays pinned under it. A `FlatList` inside a `ScrollView` would be two scrollers fighting,
and the roster is capped at 20.

**PRACTICE OR OFFICIAL is the first question, and the picker opens on OFFICIAL** — not because most
games are, but because it is the one question here that cannot be answered afterwards. Opening on
OFFICIAL with the competition blank means **START GAME is dark until the scorer has said one of the
two things out loud**, with the reason printed over the button (`NAME THE COMPETITION, OR MARK IT A
PRACTICE`). The toggle is `Seg`.

**The LEAGUE field is DRAWN ONLY FOR AN OFFICIAL GAME, not merely disabled** — a practice is not filed
under anything, and a dead field is a question still being asked.

**Under it sit the competitions the shelf already knows, as chips.** `competitionsIn` reads the INDEX,
so suggesting them costs no disk read, and they filter as the scorer types with the exact match
dropping out of the row. **A competition is only a group if the name is spelled the same way each
time**, and `competitionKey` folds case and spacing but nothing else — `VBA` and `VBA 2026` are two
seasons of one league and the app has no business merging them.

## The other side, the kind, and the competition

**`GameState` carries four labels typed on the picker** — `opponent`, `note`,
`kind: 'practice' | 'official'` and `competition` — and `lib/team.ts`'s `clean()` cleans all four. The
opponent's whole model is still one number and three buttons; the string is the LABEL on that number.

**`startGame` takes the four as ONE `MatchInfo` argument**, not four positional strings. `freshGame`
defaults to a PRACTICE with no competition; an unnamed OFFICIAL game is the one state the picker
refuses to create.

**A blank opponent reads as Opponent, never as a gap** — `opponentLabel()` decides that in one place,
and it does not SHOUT a name that is there. `competitionLabel()` likewise. Screens that would rather
say nothing than say OPPONENT test the string themselves.

**The kind is read for exactly one thing: the season is the OFFICIAL games.** `officialIn` is the
whole rule. A practice is a real game with a real box score — saved, openable, with a shot chart — it
is simply not what a season is made of.

**A game from before the two kinds is OFFICIAL** (in `reviveGame`, in `summaryKind` and on rehydrate)
— the season counted those games when they were saved. They have no competition, so they group under
`''` and print as **Unfiled**.

**The kick-off TIME and the QUARTER COUNT are cut** on the shelf and on the saved game's header alike.
**Two date labels survive and both are DIGITS**: `numDateLabel` (`19/08/2026`) is the saved game's own
line; `dayMonthLabel` (`19/08`) is the shelf row's. Both are locale-free, so a row is one width on
every device.

**`opponent`, `kind` and `competition` are the OPTIONAL keys on the index**, because a row written
before they existed has none and there is no `reviveGame` for the index. Every reader falls back.
Read the kind through **`summaryKind`**, never raw.

**A shelf row does not NAME the kind; it is DRAWN as one.** A practice takes `ink3` throughout rather
than a pill or a fill — deliberately **not accent**, because a mark on every row would teach the eye
to ignore the four places accent means something.

## The shelf

**A finished game is saved once, by `EndGamePanel`,** after `endGame()` has stamped `ended` and before
the stats screen opens. Clearing the live game does not touch the saved copy — `startGame` is the only
thing that clears the board, and it cannot reach `historyStore`.

**The storage shape is the design, and it is TWO keys, not one.** The index holds summaries only, and
it is all the lobby and the MATCHES list ever read. Each full game lives alone under `gameKey(id)` and
is read when a row is tapped. One blob would put thirty games' events behind every render of the home
screen and would walk into Android's AsyncStorage row limit. **If this ever has to scale further the
answer is `expo-sqlite`, not a bigger blob.**

**The cap is 30, and `pushSummary` RETURNS the summary it drops** so the caller can delete its row —
an index that forgets a game while its key survives is a leak that only ever grows.

**The accent marks OUR score, on every row, and the RESULT is a letter beside the date.** Those were
one colour answering two questions: the ink was `accent` on a win off ONE shared style handed to BOTH
cells, so a win lit the opponent's number orange too. So accent is OURS, and `W` / `L` sits at the end
of the date line in caps at `LS_CAPS`, `accent` for a win and **`danger` for a loss** — a stated
DEPARTURE, because an `L` in `ink3` beside a date in `ink3` is a typo. **No badge, pill or chip.** A
tie draws none (`outcomeOf` answers null) and a practice is never asked. Deleting is a LONG PRESS with
a confirm.

### One row per match, three lines, no containers

**This screen has been wrong in both directions** — first a DATABASE TABLE where a fortnight of
five-a-sides buried the two matches actually played, then over-corrected into date headings and
grouped runs of chips, which made a row a block inside a group inside a section.

**So the list is FLAT, every row is the same shape, and the separation is done with TYPE AND SPACE
rather than with containers.** TWO COLUMNS, the score on the right:

```
vs CCV · HBL              16 — 64
21/08

Practice                   2 — 0
25/08
```

A practice is the SAME shape with `Practice` where the opponent goes — **text, not a chip, a badge or
a section.** `MatchRow` is one component for both kinds.

**The score is READ AGAINST the two lines rather than above them**: `fs2xl` is very nearly
`fsSm + s1 + fsXs`, so the figures stand exactly as tall as the block they answer and the row comes
down to two lines without anything getting smaller. It stays a RAMP STEP rather than that sum computed
out.

**THE DASH IS A SEPARATE CELL AT A SMALLER SIZE, and that is the whole fix for the score.** An em dash
is ONE EM WIDE by definition, so `—` inside a string at `fs2xl` drew a rule as long as the digits were
tall. Set at `fsMd` in `ink3` between two `s2` gaps it is a hyphen between two figures again. **It is
not the row separator and the two must never be confusable** — that one is 1px, full width,
`rule`-coloured, and belongs to the list as an `ItemSeparatorComponent` (a border would draw under the
last row too).

**THE SCORE IS A THREE-CELL GRID**, ours right-aligned and theirs left. Each cell is `fs2xl * 1.7` —
three tabular digits, derived from the type size — which is what puts every dash at the same x and
every score block at the same width. The block carries `flexShrink: 0`, because those two fixed cells
ARE the alignment. **The TEXT column starts at the row's own left edge**, takes the row's whole slack
(`flex: 1`, `minWidth: 0`), so a long club name ellipsises rather than pushing the score off the edge.

**THE HIERARCHY IS FOUR STEPS OF SIZE AND INK, NOT FOUR CONTAINERS**: score `fs2xl`/`ink`, opponent
`fsSm`/`ink2`, competition `fsXs`/`ink3`, date `fsXs`/`ink3`. **Nothing on this screen has a fill, an
edge, a radius or a chevron except the filter strip**; the press is a faint `surface` wash. The row
has no fill and no border — thirty `surface` cards ruled on every side read as a stack of boxes before
they read as scores. It is TYPE ON THE ROOM'S OWN GROUND, with the bloom showing through.

**The filter is `Seg` with `compact`, and that is the prop's only caller** — the stats screens' bars
are the subject of their screens; this one is chrome above a list of scores. `compact` drops it to
`tapSm` (40) and `fsXs` and moves nothing else. It does not scroll, and it is not a title coming back.

**What DOES head the room is the CLUB** — `ClubMark`, above the filter, in the wordmark's own face at
`fsXl`, ONE STEP UNDER the wordmark's `fs2xl`: the mark can carry that step because `hooplog` is seven
characters the app chose, where a club name is as long as somebody typed it. It is `s3` in from the
edge, so the mark and the first opponent's name share an x.

**`outcomeOf` is three-way, and it has three callers** — the shelf row, the saved game's header and the
delete confirm. It replaced `resultOf`, which is `>=`, so it called `0 — 0` a WIN, and `0 — 0` is what
every unscored practice is. The delete confirm asks the KIND first, so a practice is named as a
practice. **A practice is still never labelled** — its date line is the date and nothing else.

**`filterIn` is the one derivation left**, in `lib/history.ts`. ALL returns the index BY REFERENCE —
the shelf's order is the store's. **Every field still comes off the INDEX**: a shooting line beside the
score would mean opening thirty full games on every render.

**`app/history/[id].tsx` writes no table of its own.** Its three stat tabs are the stats screen's own
— `TeamTab`, `PlayersTab`, `ZonesTab` — and the log is `PlaysList`, now its ONE caller. All of them
take their data as props precisely so a game read off disk and the live one can be the same shape.
**There is no box score tab**: `PlayersTab` renders `BoxTable` over the same `Player[]` and answers
the quarter strip as well.

**Its header is the OPPONENT, and the scoreline beside it reads THEM : US** — the name is what a shelf
of thirty games is remembered by, and the number reads in the order the eye arrives at it. `accent`
marks OUR score on every game, not only on a win, and the W/L rides at the end of the date line. The
date is `numDateLabel` digits behind the kind, which stays in front because it is the one thing here
that decides whether the numbers under it are in the season.

## The stats screen

**A finished game goes to its own page on the shelf, not to `app/stats.tsx`.** END GAME confirms, stops
the clock, **saves the game**, closes the panel and **`replace`s the board with `history/[id]`** — the
same page the MATCHES row opens, on the id `saveGame` just handed back. Two screens printing the same
hundred numbers a second apart is the pair that drifts, and `history/[id]` is the superset. **`replace`,
not `push`** — the back arrow falls through the empty stack to the LOBBY. `saveGame` also **keeps the
game it just filed in memory**, because the write is fire-and-forget and the page reads it back in the
same breath.

**The board's `totals` panel is gone.** A hundred numbers over a live court was never a thing a thumb
reads mid-possession; the score cell is a readout now.

**It is three screens, not one, and that is the whole design.** Two `Seg` strips ask the two questions
— the tab strip asks WHICH KIND of number (TEAM / PLAYERS / ZONES), the quarter strip asks WHICH PART
of the game (ALL, then `Q1…Q4`, then `OT`, `OT2`, …). Every tab answers both. `Seg` is ONE control used
twice rather than two that drift apart.

**SHOTS and ZONES were two tabs and are one.** `ZonesTab` is four blocks, coarse to fine: the marks,
the shooting line, the heat, the table. **The FG / 2PT / 3PT / FT tiles are the join**, and the zone
table's own footer was cut for them.

**This screen scrolls, and that is not a violation** — the one-viewport rule is about the BOARD. The
players table also scrolls SIDEWAYS; twenty columns do not fit a phone.

**`lib/box.ts` is the whole derivation, and nothing on the screen mutates anything.**

**The whole game is the board's counters; a quarter is REBUILT from the log.** `split` is the one
argument every reader takes: a period number, or null. **Null does not re-derive** — it returns
`g.players` untouched, because those counters are what `undo()` keeps correct. A period walks
`state.events` and rebuilds the two things no event counts:

- **the floor** — `player.starter` is who tipped off, and every `substitution` and `foulOut` after it
  moves one name, so replaying them gives the five out there at any point. That is what a quarter's
  plus-minus is made of.
- **the clock** — every event carries its period and game clock, so the gap between two consecutive
  events is game time the floor between them played. It is the same second the live ticker credits,
  which is why **the quarters add up to the whole-game minutes**; `selfcheck` asserts that sum.

**One approximation, stated out loud in the code and in the note under the table:** a gap that spans
the end of a period is credited as if the period ran out — right for a quarter that ends on 0:00, and
a quarter ended early hands its unplayed tail to whoever was on the floor.

**Three numbers are derived from the LOG'S SHAPE rather than from a tap**, and the screen prints what
each actually measured:

| shown as | what it really is |
|---|---|
| POINTS FROM TURNOVERS | points after a steal — the only opponent turnover we hear about |
| SECOND CHANCE POINTS | points after one of our offensive rebounds, before the possession ends |
| FAST BREAK POINTS | points within `BREAK_WINDOW` (7s) of a steal or a defensive rebound |

The break window is a window on the GAME CLOCK, so a clock left stopped makes it read high. **Do not
drop the note under any of the three; the note is what makes printing them honest.**

**POINTS PER POSSESSION is whole-game only** — `possessions` is a plain team counter with no event
behind it, so no quarter can claim a share of it; the quarter view reads `—` and says why.

**The scoreline is built once and read six ways.** `scoreline()` replays every scoring event into a
running `us`/`them` with the absolute game second on it, and BIGGEST LEAD, BIGGEST RUN, LEAD CHANGES,
TIMES TIED and TIME WITH THE LEAD all come off that one array. A margin carried INTO a quarter counts
as a lead held in it; **a run and a lead change do not carry**. Going ahead from 0-0 at the tip is not
a lead change.

**The two charts reuse the board's, they do not copy it.** THE FLOOR is the same grammar as the court's
own chart, down to the hook that resolves it; **the three hues come from `hooks/useDots.ts`**. BY ZONE
hands `CourtSvg` a **`heat` fill per zone** rather than carrying the partition a third time; both
mirrored halves take the zone's colour. Opacity carries the percentage and **starts at 0.18, not 0** —
a zone shot five times and missed five times is not a zone never shot from.

**The zone numbers live in the table, not on the floor** — the corner threes are a 68-unit strip out of
792, so a pill reading `4-9  44%` is wider than the zone it names.

**Neither chart is sized off `m.court`** — that metric is what is left of the BOARD. ONE box is measured
with `onLayout`, aspect-locked with `COURT_ASPECT`, then capped against the window height, and **both
courts take that one width**.

**`ZonesTab` is on `selfcheck`'s `NO_TEXT_INSIDE` list**, beside `Court.tsx`: its `accent` and `danger`
fills are chart marks, and a mark has no ink to lose because nothing is written inside it.

## The export

**A finished game leaves the app as one PDF, and the button is the LAST THING ON TEAM / ALL.** TEAM is
the tab a scorer is on when the game is a whole thing rather than a list of names, and **ALL is the
only slice `lib/pdf.ts` builds**. `app/history/[id].tsx` is its one caller.

**`lib/pdf.ts` is a PURE FUNCTION over a `GameState` that returns a string of HTML** — no file, no
store, no React, so `npm run check` renders a real sheet and reads it back.
`components/stats/ExportButton.tsx` is the other half (`expo-print` + `expo-sharing`).

**It is a FIBA box score with one team on it.** In order: the scoreline and the period line, the
twenty-one-column box score, the four team blocks, the zone table.

**It draws no floor and carries no play log.** A chart is a thing you LOOK at and a play log is a
hundred rows you SCROLL, and `history/[id]` has both. **What survives of the floor is the ZONE TABLE**,
because a shooting split is a number and not a picture; `selfcheck` asserts the page holds no `<svg>`,
no `<path>` and no play line at all.

**The numbers are the screen's own** — the same `report(g, null)` the tab above the button calls. The
period line is walked separately (`periodScores` needs both sides) and is asserted to add up to the
score the board kept.

**Every typed string is escaped** — a club name is free text and a sheet is assembled by concatenation;
`selfcheck` puts `<b>` in the club name and asserts it does not survive.

**The crest is not on it, and the coaches are not either** — the coaches for the reason they never
cross into a game (they are true of the club today, not of a game already over), the crest because a
`file://` image is not reliably loadable inside a print sheet.

**The file is RENAMED before it is shared, and diacritics are FOLDED rather than dropped** —
`KHÁNH HÒA` is `KHANH-HOA`, never `KH-NH-H-A`. **Sharing is what delivers it**: the print file lives
in the cache, which the OS may empty. Where there is no share sheet the system print dialog stands in.

## The club

`store/teamStore.ts` holds what "my team" is besides a list of people. `lib/team.ts` holds the rules —
**nothing in `lib/` touches a file**, because `expo-file-system` cannot be imported into the node
script `npm run check` runs.

**Only the NAME crosses into a game.** `startGame` copies it the way `buildPlayers` copies a jersey, so
a box score says who it was played by even after the club is renamed.

**The picker's URI is never what is stored** — `expo-image-picker` hands back a file in the CACHE, so
`setLogo` copies it into `Paths.document/team/`.

**The stored file is STAMPED — `crest-<base36>.jpg`, never `logo.png`.** RN caches an `<Image>` by its
URI, so a second crest written to the same path keeps showing the first until the app is killed. The
old file is deleted after the new one is in place, never before.

**And the path is checked on rehydrate, not trusted** — iOS moves the document directory between
installs, so `onRehydrateStorage` nulls it if the file is gone.

**`components/ui/Crest.tsx` is one component for the crest AND the monogram**, because every screen
showing it must fall back the same way. A club with no crest is the common case on a fresh install, so
`initials()` is not an error state and is not drawn like one. There is no accent ring. The monogram is
set in `fDisplay` and stays caps — initials are a mark, not a name.

**`ClubCard` is the club's only editor**, and it edits in place, committed as typed. `readOnly` is a
third RENDERING and not a second editor.

**The crest is applied on PICK, not on SAVE** — the copy is the expensive, failable half.

**AND THE PICKER IS OPENED WITHOUT ASKING FOR A PERMISSION.** `launchImageLibraryAsync` needs that
permission on **iOS 10 alone**, and on Android it goes through the system photo picker, a separate
process that needs nothing. So the gate could admit nobody who was not already admitted, and it COULD
lock somebody out. **Do not put the request back.** What is left is the honest failure path — the
picker throws, or the copy fails, and the toast says which.

**The coaches are optional and the name is not** — the name is the crest's fallback and what every
game is filed under, so `setProfile` refuses an empty one and blur restores the last good name.

## The season

`app/(tabs)/season.tsx` is the one tab that has to read the full games rather than the index, because a
season line is made of stat lines. It loads them all on mount and re-loads only when the index changes,
through **`hooks/useSavedGames.ts`** — one copy of that effect for the two screens that aggregate.

**The season is the OFFICIAL games.** `officialIn` is applied by the SCREEN and not inside `season()`,
because a competition's own page filters first and aggregates the same way. A shelf with games on it
but none official gets its own empty state rather than a card full of zeros.

**`lib/season.ts` is the whole derivation**, and two of its decisions are invisible in the output:

- **Identity is the ROSTER ID.** A game holds copies, so a player renamed or renumbered since is still
  the same person. The name shown is the one the team holds today; a player deleted from the team keeps
  the name their last game recorded.
- **PER GAME divides by the games the player APPEARED IN**, not by games in the season. `appeared()` is
  a start, a second played or anything at all on the line, because minutes are clock-driven and a
  scorer who never starts the clock would otherwise zero everybody.

**The table is `components/stats/BoxTable.tsx`, and there is one of it** — a game, a quarter and a
season are the same twenty columns over the same `Player[]`, which is why the aggregate is built as
`Player`s. `gamesFor` inserts one extra column, G, and only the season passes it.

**A headline card is always TOTALS**, whatever any toggle says — points per game computed off per-game
numbers divides by the games twice.

**THE ORDER IS THE HIERARCHY**: WHOSE season and how it has gone, HOW THE LAST GAME COMPARED, HOW EACH
COMPETITION is going, and finally WHO played in it. Every step is a narrower question than the one
above it, and **nothing on the screen is a container inside a container** — one scroller, hairlines
instead of boxes, and the only cards are the ways OUT.

- **The word SEASON heads nothing**, exactly as MATCHES has no title. What sits above the content is
  the CLUB — `ClubMark`, the same lockup MATCHES carries — drawn **above every branch**, both empty
  states included: a room that loses its header the moment it is empty reads as a screen that failed
  to load.
- **The RECORD rides at the far end of the club mark's own row** (`12-4 · 16 games`). **It is not lit.**
- **THERE ARE NO TEAM HEADLINE FIGURES ON IT.** The RECORD says how the season has gone, each
  competition card carries the same three for its slice, and the one comparison that makes a
  points-per-game figure mean anything is a tap away on the row beneath.
- **THE COMPETITIONS SIT ABOVE THE PLAYERS** — how the LEAGUE is going is what a scorer opens this tab
  asking, and who is having a season is the follow-up you scroll to. It also keeps the long list at the
  bottom, where a list belongs: twenty rows between two blocks pushes whatever follows off the bottom
  of every phone.
- **THE TWENTY-COLUMN BOX SCORE IS NOT ON THIS TAB.** `components/stats/PlayerList.tsx` is a name and
  three numbers — PTS, REB, AST — and nothing scrolls sideways. `BoxTable` is the SCOREBOOK and is
  right on a saved game or a competition's page; it is wrong on the screen they LAND on. **`BoxTable`
  and `SeasonTable` are untouched and still have their callers.**
- **THERE IS NO TOTALS / PER GAME STRIP. The list is PER GAME, always.** A season's totals are a number
  with nothing to be compared against. What is left is the half of the strip that carried information:
  the column header says `Per game`, so the reading is STATED rather than chosen. `SeasonMode` is still
  what `season()` takes.
- **G is on the row** — an average without the number of things averaged is a number you cannot argue
  with, and the denominator is the player's own game count.
- **The rows have no fill, no edge and no chevron**, and the press is a faint `surface` wash. **The
  JERSEY IS A PLAIN FIGURE and not a `Jersey` plate** — twenty plates down a list is twenty
  orange-edged blocks fighting the names beside them.

**Each competition is one card, and each is a way into `app/competition.tsx`.** `competitions()` groups
the official games on the folded key and hands each group back with **its games still whole** beside
its totals — the card needs only the aggregate, but the page behind it re-aggregates on its own
TOTALS / PER GAME toggle, and re-grouping there is how a card and its page start disagreeing about
which games they are made of. Newest first.

**A competition card's header is the count at the LEFT and the name at the RIGHT** — it is `Band`, a
name is what you read once to identify a card, and a count is what you compare between them. The RECORD
rides beside the count rather than eating a tile. **Its three tiles are AVERAGES** — points, rebounds
and assists a game, one decimal — because per-game is the only reading that compares between cards.
**The card PRESSES ON OPACITY rather than on a fill**, because a tile is opaque by construction.

**`app/competition.tsx` is addressed by the FOLDED KEY, as a query param, not by a `[name]` segment** —
a competition's name is typed by hand, and the group with no name has `''` for a key, which is an
ordinary query param and not a path segment. The page is the season screen over a slice.

## The last game's analysis

**`app/analysis.tsx` is HOW THE LAST GAME WENT against the run behind it** — six rows, three columns
(`Last` / `Avg` / `Change`), and two or three sentences under them saying what actually moved. It is
reached from a row at the foot of the STATS tab's headline, and from nowhere else. **It is a PAGE and
not a bottom sheet**, the same call `settings` and `paywall` are.

**IT READS THE GAMES ITSELF rather than taking them through the route** — a season of thirty games does
not go in a query param. **`hooks/useSavedGames.ts` exports `useSavedRows`**, the same one effect
handing back `{ id, summary, game }`, because a `GameState` carries no id. `useSavedGames` is that hook
narrowed, not a second read. **The rows are paired at the source rather than zipped by index**, because
a game that will not parse is dropped. It guards itself with the season gate, as `competition.tsx` and
`player/[id]` do.

### `lib/analysis.ts` is the whole rulebook

- **THE AVERAGE DOES NOT INCLUDE THE LAST GAME** — folding it in flattens every difference the file
  exists to show. `selfcheck` asserts it directly.
- **The window is `AVG_WINDOW` (5) games before it**, or every game there is when there are fewer.
  Five is a FORM GUIDE rather than a season.
- **The games are the SEASON's games** — official, newest first, filtered by the caller.
- **A RISE IS NOT ALWAYS GOOD.** `riseIsGood` is held once per stat in `TEAM_STATS`, so no screen has
  to know that turnovers are the one row where up is bad news. The six rows are PTS, REB, AST, STL, TO
  and FG%.
- **FG% IS POOLED and every other row is meaned** — the mean of five percentages is undefined for a
  game nobody shot in and lets a 1-for-2 night weigh as much as a 9-for-20 one. **The note under the
  table says so and must not be dropped.**
- **An average of ZERO has no percentage** — `ratio` is `null` and the absolute delta is the whole
  answer. A row with no ratio can never be ranked, so it is never a highlight.
- **ONE GAME IS NOT NOTHING** — a scorer one game into a season gets that game's own figures with `—`
  in Average and Change, never a fabricated average. Only an empty shelf returns `null`.
- **A PLAYER'S window is the games THEY APPEARED IN**, which also decides what "their last game" means.

**"What changed?" is ranked on the RELATIVE move with TWO guards**, each catching what the other cannot:
`MIN_RATIO` (0.1) throws out a big number that barely moved, and the per-stat `floor` throws out a
small number that moved a long way in percentage terms. At most three. **It is NOT balanced on
purpose**: whatever moved most is what is named. The table above is where the other side is read.

### After timeouts — the one block that compares the game with ITSELF

**A timeout is the only thing on that board a COACH did.** Every other tap on the board records
something a player did on the floor; the timeout is a decision, and the only question worth asking
about a decision is whether it worked. So the third block on the page does not look at the run of
games at all — it splits the LAST GAME in two and compares the halves.

**The measure is NET POINTS PER MINUTE, ours minus theirs.** Points alone would call a 6–8 stretch a
good one, and a shooting percentage says nothing about the half of the floor a timeout is usually
called over. Per MINUTE because the windows are short and the rest of the game is not: two raw totals
over unequal time are not a comparison.

**The minutes are GAME CLOCK.** `absOf` reads the period and the clock reading off each event, so a
stoppage costs a window nothing — which is the entire point, since a timeout IS a stoppage.

**`AFTER_TIMEOUT` is 120 seconds**, and the three ways that arithmetic goes wrong are each decided
once, in `timeoutRun`, and each asserted in `npm run check`:

- **A window is CUT SHORT BY ITS OWN PERIOD.** Two minutes after a timeout called with thirty seconds
  left is not two minutes of the same thing — the buzzer that follows is a different huddle. It is the
  same approximation `lib/box.ts` makes at a period end, and the screen says so.
- **Overlapping windows are MERGED and their shared seconds counted once.** Two timeouts a minute
  apart are one stretch of play; counting it twice would weight it twice in a rate.
- **The timeout's own second belongs to the play BEFORE it.** The basket that emptied the bench reads
  on the same clock as the timeout it caused, and crediting it to the huddle that answered it would
  score the timeout for the thing it was called over.

**A rise is good with no polarity to look up** — the measure is net points, so up is the right way and
`TEAM_STATS`'s `riseIsGood` has nothing to say here. The colour is on the CHANGE and nowhere else, as
it is in the table above.

**`timeoutRun` answers `null` when the game stamped no timeout, and refuses to guess why.** A game with
none and a game saved before the mark existed are two different sentences, and the caller has
`g.timeouts` in hand to tell them apart — a count with no marks behind it is a game that was scored
before the board wrote them down. **The rates are never printed without their note**, which is the same
rule POINTS FROM TURNOVERS carries on the stats screen and for the same reason: a window on the clock
is an approximation, and an approximation with its method hidden is a number that gets quoted.

**The block is a LIST, not the table above it.** The table is six stats against a window of games; this
is one number about one game read twice, and each line needs a caption saying what it was measured
over — a rate per minute means nothing without the minutes behind it.

### `components/stats/Compare.tsx`

**One table, two callers** — this page and the card on `player/[id]`, which is why both are built as the
same `Comparison`.

- **It is type on the room's own ground, not a card** — hairlines separate the rows; ALIGNMENT
  separates the columns.
- **The columns are fixed widths off the type size and the label takes the slack.** `W_LAST` is the
  widest of the four because it is the one cell set a STEP UP from the row it sits in.
- **The CHANGE is two cells, not one string** — `+3.6` and `+29%` have to line up down the table
  independently. **The shooting row carries its UNIT** (`+3.3 pts`), the one row where three points of
  a percentage and three percent of it are different quantities.
- **The colour is on the CHANGE and nowhere else** — the last game's figure and the average are facts;
  only the move between them has a direction.
- **`WhatChanged`'s arrow and its colour answer different questions** — the arrow says which way the
  FIGURE went, the colour says whether that was good news. On the turnover row they disagree, which is
  the whole reason both are drawn.

## The launch page and the door

**A cold start shows the MARK, and then either the lobby or the door.**
`components/ui/Launch.tsx` is the near-black with the bloom and `hooplog` on it; `app/intro.tsx` is
the four steps a scorer walks once per install.

### The launch page is NOT a route

It is a component the ROOT LAYOUT mounts OVER the navigator, because **a launch screen is a place you
are shown, never a place you go** — a route can be pushed onto, backed into and deep-linked at.
`app/(tabs)/index.tsx` owns `/` anyway.

**What it covers is a DECISION, not a load.** The fonts are already in. What is unknown is whether this
install has been through the door: `hooplog-intro` off AsyncStorage reads `false` before it lands, and
`false` is the answer that opens the onboarding. The lobby mounts underneath, `hooks/useIntro.ts`
replaces it with `/intro` if it has to, and the mark is what the scorer looks at while that happens.

**It is gated on the intro store ALONE** — every other persisted store is read by a screen that already
draws an empty state for "not yet". `MIN_MS` (700) is a FLOOR beside it, not a delay; the two are
waited on together. It fades rather than cuts, on plain `Animated` — one opacity on one view, for which
the worklet runtime would be a dependency borrowed for nothing.

**It declares `DARK` directly rather than wearing `DarkRoom`**, because that one flips the status bar
ON FOCUS and this is not a focusable screen.

**`components/ui/Wordmark.tsx` is the lockup, and it is shared** — two copies of a logotype is the pair
that ends up leaning at two angles. `WORDMARK_SLANT` moved with it.

### The door is one route and four steps

`step` is a number in the component's own state. **Four routes would be four files sharing one foot and
one progress row, and a stack a scorer could back into halfway.** There is no back BUTTON and the dots
are not tappable — the one step that requires an answer is the first, so going back is undoing work
rather than correcting it. **Android's hardware back still steps back**, and on step one it is let
through, because the route was reached by `replace` and consuming it would trap a scorer.

**Two steps ask, two tell, and the asking comes first**, so a scorer who taps straight through has
still answered everything the app needed:

| step | what it is for |
|---|---|
| Club | the NAME, because every game is filed under it and the crest falls back to it |
| Roster | WHO is on the team — the board is five rows |
| The board | two taps a stat, on a screen that looks like nothing else on a phone |
| Trial | one free game, said out loud before it is spent |

**The verb on the two asking steps is *Next*, not *Continue*.** *Got it* and *Start my first game* are
the two that tell.

**It writes through the ordinary writers and builds nothing** — `teamStore.setProfile` and
`rosterStore.add`. **It does not touch `gameStore` at all.** **The roster step IS
`components/team/RosterRow.tsx`**, lifted out of the TEAM tab when this became its second caller: the
door and the tab are the same editor. `onFocusRow` is optional there — only the TEAM tab has a list to
lift.

**It is reached by `replace` and it leaves by `replace`.** The last step lands on **`/start`**, because
the verb says START MY FIRST GAME. That leaves an EMPTY STACK behind the picker, which is why
`app/start.tsx`'s back arrow is `canGoBack() ? back() : replace('/')` — the same pair the paywall's
`close()` draws.

**SEE PLANS is the one route out of the door that comes back** — it PUSHES the paywall over the top.

**And the door SPENDS the launch wall.** `markLaunchShown()` in `hooks/useGate.ts` is called by
`useIntro` on the launch that opens the onboarding, and `useLaunchPaywall(hold)` is held while the
intro is pending: the last step is the trial's own offer with SEE PLANS on it, and a paywall stacked
over that is the same pitch twice inside ten seconds.

### What it is made of

**`constants/intro.ts` is the copy, as a table**, so `npm run check` walks it: four steps each with a
title and one sentence, the four numbered board lines with their tap counts, the three things the free
game gives. The script holds the plural of `1 TAP`, that exactly one badge is `live`, that the two lit
headlines are the two steps that ask for nothing, that **the trial's three and the paywall's
`BENEFITS` are not the same three**, and that the copy table matches the step list's own LENGTH.

**`constants/options.ts` carries the four ANSWER TABLES** (`PERIOD_CHOICES`, `LENGTH_CHOICES`,
`LABEL_CHOICES`, `BOARD_CHOICES`) plus `shapeLabel`. **`app/settings.tsx` is the only reader** and the
tables are held by `selfcheck` alone. They stay a table so a second copy of `6 / 8 / 10 / 12` cannot
offer a length the other screen does not.

**`components/intro/MiniBoard.tsx` is the LIGHT palette inside a dark room, and that is the point** —
the board is the one white screen in the app and a scorer three steps into a dark onboarding has no way
of knowing it. It declares `PALETTE` through `ThemeProvider` (which is also what makes `Jersey` draw the
real plate) and runs full-bleed against the near-black. **The contrast between the two IS the
explanation.** It draws the floor straight rather than through `CourtSvg`, which renders lit zones, hit
regions and a live tap off `uiStore`. Nothing here presses, reads a store, or is real.

### The first-run roster

**`SEED_ROSTER` is five blank shirts numbered 1 to 5** — five because five is `STARTERS`, so a scorer
who skips that step still has a board that can start. A blank name is not an error state; the row draws
`Player N`. **The ids stay `p${number}`**, so a game persisted before the store split still lines up.

**`npm run check` has its own `squad()` fixture** — eight shirts, five on and three sitting — and does
not play its games with whatever a fresh install happens to seed.

**An upgrading install sees the door too**: there is no `hooplog-intro` record on a phone that has been
keeping stats for months, and every alternative is a heuristic over somebody else's data. What makes it
survivable is that **nothing the four steps show is blank**. `resetIntro()` is the debug way back, with
no control in the UI, exactly as `resetBilling()` is.

## The paywall

**One free game, then the wall.** `app/paywall.tsx` is a PAGE and not a panel — it is read, compared and
scrolled, and it opens from places with no `<PanelHost />` under them.

**`lib/billing.ts` is the whole rulebook and it is a plain module**, so `npm run check` walks the entire
gate table. `store/billingStore.ts` remembers two booleans; `hooks/useGate.ts` is the join, and **no
screen reads `entitled` directly**.

### The trial is one SAVED game

**Spent when the game reaches the SHELF, not at tip-off.** `EndGamePanel` calls `useTrial()` in the same
breath as `saveGame`, which is its ONE call site. Abandoning a warm-up costs nothing, and a mis-tap on
START GAME does not burn the thing they came to try.

**The loophole is real and it is accepted**: nothing stops somebody starting and exiting for ever
without saving. What they get free is a scoreboard — no box score, no shelf row, nothing to export.

### The line

**Anything that makes a SECOND game, or reads ACROSS games, is locked. Anything needed to play and read
the ONE free game stays open.** `locked()` is that sentence applied once:

| gate | what it covers | open when |
|---|---|---|
| `newGame` | NEW GAME on the lobby | until the free game is filed |
| `season` | the STATS tab, `competition`, `player/[id]` | never, unpaid |
| `export` | the PDF | never, unpaid |
| `deepStats` | PLAYERS / ZONES / PLAYS on a saved game | never, unpaid |

`newGame` is the ONLY gate the trial moves, and `selfcheck` asserts exactly that. The other three are
paid from the start, which is less harsh than it reads: the wall stands in front of an empty room until
the trial game fills it.

**Three rooms are deliberately NOT gated.** MATCHES, because it is how a scorer reaches their trial
game. TEAM, because a roster is what the free game is played WITH. GAME SETTINGS, because `periods` and
`periodLen` are STAMPED at tip-off — locking the page would force the one free game to 4 × 10:00 for
ever, which is a rule change disguised as a paywall.

**A free scorer keeps their game's TEAM tab in full, every quarter split included** — what the TEAM
did, not what each player did. **The quarter strip is never gated**; it is a slice of the same team
line, so locking it would be selling one tab twice.

### How it appears

**Every cold start until they subscribe**, fired by `useLaunchPaywall()` from the LOBBY — not the root
layout, which holds the first frame and has no route to push from. The once-per-PROCESS flag is at
MODULE SCOPE, like the undo stack: the lobby mounts and unmounts as a scorer moves through the tab
group, and a wall keyed on mounting would reappear every time they came home from the board.

**It is ALWAYS closable, and that is load-bearing** — a scorer who has spent their trial still owns that
game's team line. **`close()` is `back()`, not `replace('/')`**: it opens OVER whatever they were doing.

**Every gate names itself.** `GATE_PITCH` is the one line above the headline, printed only when a TAP
opened the screen — on a cold start there is nothing to explain.

### What is drawn

**The reference's layout in this app's own materials**: the photograph, the close, the headline, three
benefits, two plan cards, the verb. The hero is the LOBBY's own `assets/hero-court.jpg`, faded by
GRADIENTS and never by `opacity`, via `components/ui/HeroArt.tsx` (extracted because the trial step
draws the same one; it is NOT the lobby's `HeaderArt`, which is a corner rather than a band).

- **The headline is ONE BIG LIT VERB ON ONE LINE, CENTRED: *Upgrade to access*.** It **does not change
  per gate** — explaining which door the scorer came through is `Locked.tsx`'s job, and that is the
  screen they were actually standing in. The route still CARRIES the gate (`showPaywall(gate)`), so
  putting the line back is one block and no plumbing. `GlowText` is the gradient; on web it falls back
  to flat. **The BODY face, not `fDisplay`.**
- **Its size is decided by WIDTH as well as height** — `headFs` is the available measure over
  **`HEAD_EM` (9)**, that string's rendered width in ems taken off Inter Bold (the WIDER of the two
  faces, so the number is conservative), with **`fs2xl` as the ceiling**. It lands at 24pt on a 320
  phone, 39pt on a 430 phone and 44pt on an 820 tablet. `numberOfLines={1}` is the guarantee, not the
  mechanism.
- **It is CENTRED against the benefits and cards below it, which stay left.**
- **Selection is an accent EDGE and nothing else** — no fill, no tint, no swapped ink; the two cards
  have to be read against each other. The BADGE is the one standing fill, and `selfcheck` asserts only
  one card carries it.
- **The verb wears `bloom`**, and its label carries the selected plan's price so the CTA and the cards
  can never disagree.
- **The yearly card's per-month figure is DERIVED**, not typed, and asserted against the price above it.
  `vnd()` groups from the RIGHT — grouping from the left is correct for six digits and wrong for every
  other length.

**Two things from the reference are deliberately absent**: a FREE TRIAL card (the trial is a free GAME
the scorer already has, not a plan they can select) and the FREE TRIAL ENABLED toggle.

**`components/ui/Locked.tsx` is what a locked ROOM looks like** — a padlock, the gate's own name from
`GATE_PITCH`, the blurb, and a SEE PLANS button. **A locked CONTROL does not get it**: a button keeps
its shape and opens the paywall when pressed. **It does not blur the real numbers behind it** — on a
free install those numbers do not EXIST. **`SegItem` grew a `locked` flag** that draws a padlock after
the label and nothing else.

**IT IS NOT THE PAYWALL'S HEADLINE AND MUST NOT BECOME IT.** This one is a DOOR and its heading is
`GATE_PITCH[gate]`, which changes per room; the paywall is the OFFER, and that is where the one big verb
belongs.

**The two aggregate pages guard themselves** — every route into `competition.tsx` and `player/[id]`
already checks the gate, and both check it again anyway.

### Where real billing goes

**There is no store, no receipt and no network.** `unlock()` sets a flag, and the paywall's `buy()` is
the ONE seam: StoreKit / Play Billing lands there. Not one consumer changes, because no screen asks
anything but whether the scorer is entitled. **There is deliberately no RESTORE PURCHASE button** until
there is something to restore.

## The walkthrough

`components/tutorial/` walks twenty steps over the REAL board against a throwaway game. It is reached
from a permanent row at the foot of the lobby — *How the board works* — which is not a card, not a
first-run prompt and not dismissible.

**Nothing is mimed, nothing is gated and nothing is done for the scorer.** Every step is finished by the
scorer performing the real action against the real store; `saveGame`, the trial spend and the route out
are the only things short-circuited, and they are short-circuited in `EndGamePanel`. `tutorialCompleted`
and `tutorialLastStep` are persisted for the RESUME question and for nothing else — **no verb anywhere
is dark because somebody has not watched a walkthrough.**

### The throwaway game

**The board holds one game, so the tour cannot be opened while one is standing.** The row takes the
lobby's own `inProgress` test and prints why it is dark.

**Two things make the tour safe, and both live in `store/tutorialStore.ts`:** the board it replaced is
stashed as JSON at module scope, and `pausePersist(true)` stops `gameStore` reaching the disk for the
length of the tour. So the scorer's own board is on disk the whole way through. **A paused write is
DROPPED rather than queued.** `installGame` is the other seam and is deliberately NOT on the
`GameStore` interface: every action there is a thing a scorer does, and this is a thing done TO the
board, twice, by one caller.

**`lib/tutorial.ts`'s `tutorialGame` builds it through `buildPlayers`,** then does the one thing a
tip-off cannot: sends a player off. **The disqualified one has to be a STARTER** — `useRailPlayers`
draws the actives and then the disqualified, sliced to five, so a bench player sent off is never reached
by the slice.

**IT OPENS AT ZERO** — the score, the opponent's score, both footer counters and the LOG. CAUSE AND
EFFECT is the whole point: a scorer three steps in cannot see their own tap move a figure that started
at eighteen, and UNDO has nothing of the app's own making to take back.

### The script is data

**`constants/tutorial.ts` is one table and every string the tour prints.** A step is a row: what it
points at, what it is CALLED, what finishes it, and whether it is in this scorer's tour at all.
Reordering the walkthrough is moving a row. `lib/tutorial.ts` is its rulebook.

**Completion is two snapshots of five facts**, taken when the step opens and now: what is open, what has
been logged, the two hand-counted numbers off the footer, and whether the clock is going. Comparing
against the START rather than the previous frame is what makes a step survive a re-render, a rotation
or a phone call.

- **`uiStore.opens` exists for this and has one reader** — the panel KIND cannot say a tap landed, so
  what is compared is how many times something has been opened since the step began.
- **UNDO is watched on the log AND on BOTH footer counters** — undoing a possession or a timeout moves
  a counter while leaving the log the same length. Reading the undo stack's own depth is the thing it
  cannot do: that is a module-scope array that notifies nobody.
- **Four settings branch the script** — `assist`, `ft`, `tap`, `poss` — and the step that does not
  apply is DROPPED rather than disabled. `selfcheck` asserts each branch has exactly one step per value
  and that the tour is the same length whatever the settings say. The footer's pair is the two halves
  of one cell: a split cell is taught by its POSSESSION half, because a scorer who asked for that half
  is the only one who has to be shown it, and a whole cell is taught as the timeout it is.

**The tour closes a sheet the next step does not want.** A step whose flow ends on an open sheet
leaves one up — the sub step ends on the bench question, the period step on the quarter panel — and
the step after each points at a control on the BOARD, underneath it. It also survives the hold: the
two sheets that light and close take `LIT_MS` to go, and the tour has already moved on by then, so it
must not be the thing waiting for them. `wantsPanel` is that question and `selfcheck` walks the script pairwise
for it.

### The overlay

**Z-order is stated, not inherited: board, `PanelHost` at 40, the tour at 50, `Toast` at 60.** Above the
panel so a step can point at a control ON one; below the toast because step four's whole claim is that a
note confirms the entry.

**The tour's own root is `pointerEvents="box-none"`, which is what makes the hole LIVE.** At the default
`auto` it is itself the touch target everywhere no child of it is one — which is exactly the cut-out —
so every step the scorer has to PERFORM becomes unfinishable. **Any full-window layer over this board
takes `box-none` or it takes the board's taps with it.**

**Every box is `measureInWindow` and nothing is hardcoded.** The four regions come off
`store/layoutStore.ts`; everything else registers through `hooks/useTutorialTarget.ts`, which is
`useLitRect`'s shape for `useLitRect`'s reasons. **It is a second hook rather than a widened `RectKey`**
because the two answer different questions: the scrim wants THE ONE lit control and holds a single slot;
the tour wants any of twenty, by name, and holds a map.

**The finger lands on the SPOT, not in the middle, and only on the floor.** A control is one thing, so
its centre is where a hand belongs; the COURT is seven zones and its centre is a two, so *Tap outside
the arc* would otherwise draw a fingertip in the paint. `spotFor` is that rule and `step.spot` is the
coordinate, carried by the two steps that ask for a shot and by nothing else — `selfcheck` asserts a
step with a spot really does point at the court, and that the three-point step's spot really is a three.
**Reduced motion rings the SPOT too** — a ring around the whole floor says "the court".

**`Press` grew a `targetId`, and it costs a real game nothing** — the hook's two selectors read through
the name, so an unnamed control's selector returns the same `false` and the same `0` for ever and
zustand never notifies it. The two refs are MERGED and memoised, because a fresh callback ref on every
render would detach and re-attach a node on a board that repaints once a second.

**`Spotlight` is ONE path with `fillRule="evenodd"`, not `PanelHost`'s four bands** — four rectangles
cannot round a corner, and a cut-out that does not match the control's radius reads as a box drawn near
a button. The paint and the block are two layers: the SVG is `pointerEvents="none"` and four TRANSPARENT
bands do the blocking, because a sheet that swallowed the tap it is asking for would be a tour that
cannot be finished. **When the thing being pointed at IS an open panel it paints nothing** — `PanelHost`
has already dimmed everything but that sheet.

**THE CARD IS A TITLE AND NOTHING ELSE.** The ring is already round the control and the finger is
already on the spot; a paragraph beside them is the app explaining a thing the scorer is looking at, on
the one screen where looking at it IS the lesson. What it buys is SIZE: one string at `fsLg` over two
lines instead of `fsMd` over one with `fsSm` under it. The step still finishes only on the real action,
so there is no way past a step but to do it — SKIP and hardware back are the ways out.

**A MULTI-TAP FLOW IS SPLIT INTO A STEP PER TAP, and the shots are why.** A shot is a spot, a result and
a shooter; as one step whose ring walked all three sheets, *Now a made three* over a ring on the MADE
tile named the outcome of a flow rather than the tap in front of the scorer. So the two is
`court` → `miss` → `who` and the three is `three` → `three.made` → `three.who.*`, which also means the
tour rings **MADE as well as MISS**. `via` survives for the steps where a ring genuinely has to move: PF
and RB ask a kind and then a player, and the last tap of a three on an assist board.

**So NO TWO STEPS CARRY THE SAME TITLE, and `npm run check` holds them apart.** A title names the control
AND what the tap is for — *Tap a player to tally*, *Tap a player to sub*. **The branch pairs are held to
it too.**

**The caption docks on the side with the most room, and a sideways one has to be able to hold a card.**
The board is landscape-only under 700, so the widest gap beside a spotlit court is the rail — docking
there would put the card back over the thing it describes. A left-docked card is centred vertically
rather than pinned to the top, because SKIP is in that corner.

**Reduce motion gets a static ring, not a pulsing one** — `hooks/useReducedMotion.ts` kills the
animation outright and `Court`, `PanelHost` and `Toast` all obey it. A pulse is still motion.

**A fouled-out row DOES open its own question**, and that was a decision about the board rather than
about the tour: `useFlow` opens it at the fifth foul and `Rail` reaches it from the dimmed row. The step
finishes on `anyPanel`, so nothing in the script had to learn what a substitution is. **The tour's own
`reset()` still closes it**, lock or no lock — the lock is on the scrim and hardware back, not on the
store.

## Options

`constants/options.ts` holds twelve switches — `periods`, `periodLen`, `ft`, `tap`, `assist`, `bar`,
`labels`, the three dot hues `dotMade` / `dotMiss` / `dotFt`, `poss` and `board` — stored in `gameStore` and
persisted. **All of them are exposed, and in exactly one place**: `app/settings.tsx`, one `Seg` row per
option plus a swatch grid for the hues. `setOption` remains the only writer, and `onRehydrateStorage`
rebuilds `options` from the names that are left, so a stray key from an older build is not carried
forward and a key that arrived after builds shipped falls back to its default.

**It is a PAGE, not a panel, and that is the whole of why the gear is gone from the board.** The way
into a page is its own control, so GAME SETTINGS sits at the foot of the lobby at `Btn`'s lightest
weight. It is a `DarkRoom`, four blocks deep, ordered by how often a scorer touches them: the rules of
the game, what a stat is called, the chart's three marks, then the board's own behaviour.

**`periods` and `periodLen` are the rules of the game, and they do not behave like the others.** Two
halves or four quarters; six, eight, ten or twelve minutes each. Every other option is read LIVE off
`options`; these two are **STAMPED ONTO THE GAME** at tip-off — `startGame` is the one place they cross
— and read off `GameState.periods` / `GameState.periodLen` for ever after. A quarter split is ARITHMETIC
over the length, so a saved game whose length came from a live setting would silently re-slice itself
the day a scorer switched to halves. **The settings page says so out loud** — `FROM THE NEXT GAME ON`.

**A game from before either was a question was played 4 × 10:00.** `REG_PERIODS` and `PERIOD_LEN` in
`constants/game.ts` are that fallback and nothing else — three consumers: `DEFAULT_OPTIONS`,
`reviveGame` and the store's rehydrate. `lib/box.ts`'s **`lenOf(g)`** is where the fallback is actually
spent, so no reader of a saved game can forget it.

**`lib/format.ts` owns what a period is called, in two forms** (it had three hardcoded copies):
`periodLabel(p, regulation)` is the two-character form — `Q3`, `H1`, `OT`, `OT2` — and
`periodName(p, regulation)` is the spoken one: `1st quarter`, `1st half`, `Overtime`. (`periodWord`
alone is capitalised, because its other caller is a tile caption.) **The regulation count is always the
GAME's, never the live setting's.**

**`poss` is the one switch that ADDS a control rather than changing one.** TIMEOUTS ONLY leaves the
footer's fourth cell whole and counting timeouts; BOTH divides it in halves, POSS above TIMEOUT. It is
read LIVE — turning it on shows the count the game already holds, turning it off hides a count the game
goes on holding — and it is `off` on a fresh install, because the quieter board is right for more
scorers and because a possession count begun in the third quarter is a possession count OF the third
quarter. It lives in the board's block on the settings page, under the background, since the footer is
the board's own row. The tour's footer step is a pair keyed on it (`poss` / `timeout`).

**`board` is the board's own skin, and it is not `skin` coming back** — `skin` was an AUTO / LIGHT /
DARK control that repainted the WHOLE APP. WHITE is the default; LOBBY hands the board the same `DARK`
the four rooms declare, through the same `DarkRoom`. It switches the whole PALETTE rather than the fill
alone, deliberately: near-black ink on a near-black ground is a board nobody can read. **The dark board
takes NO `Bloom`.** It is read LIVE off `options`; nothing is stamped. The route paints its own ground,
because `app/_layout.tsx` paints the LIGHT canvas behind a transparent Stack whatever this says.

**The three dot hues are not the skin switcher coming back** — they move the three marks a chart draws
and nothing else. The reason they are settable is accessibility: a scorer who cannot separate orange
from grey cannot read a chart whose two commonest marks are orange and grey. **`hooks/useDots.ts` is
the one reader**, and its three callers are `Court.tsx`, `ZonesTab.tsx` and `app/player/[id].tsx`. The
zone HEAT is deliberately not in it — it is `accent` at a computed alpha, a bucket's percentage rather
than a mark. The defaults reproduce exactly what the chart drew before any of it was settable.

**`labels` is what a stat is CALLED once the panel is open — SHORT (`DF`), WORD (`Defensive`) or BOTH —
and the default is the WORD.** The abbreviations are the scorebook's, not the scorer's. **It reaches
the PANELS and nothing else**: `FoulKindPanel`, `RebKindPanel` and `PlayerActionsPanel`. The board's own
PF / FT / RB keys stay abbreviations whatever it says — three cells wide, pressed a hundred times a
game, known by shape.

**`lib/labels.ts`'s `tileWords` is the whole rule, and `StatTile` is its ONE reader** — three panels
each branching on the option is three answers waiting to drift, so the panels pass a `short` and a
`full` and never see the option. **The screen reader always hears the full word.**

**A word in the big slot is not an abbreviation in it**, which is what `Tile`'s `word` prop carries —
and it switches the FACE as well as the size. `Defensive` at `fs3xl` runs off a tile a third of a 320pt
phone's court wide, so the word drops to `fsXl` (`fs2xl` when `big`), takes two lines, keeps
`adjustsFontSizeToFit` as the floor, and is set in `fUi` rather than `fNum`: `+1s`, `DEL`, `OK` and the
two-letter shorts are codes and take the number's weight, where a word takes the body's. Only
`tileWords` sets it.

## Rules that look arbitrary and are not

**A roster edit is not a game edit, and `undo()` does not reach it.** Removing a player from the team
mid-game leaves the game exactly as it was — they stay on the floor, they keep their stats — because the
game holds copies.

**`position` is a LABEL, and nothing WRITES it.** Not the picker, not the rail, not one stat ever read
it. The key survives in `RosterPlayer` and `migrateRoster` so a roster persisted with positions is not
thrown away. Cut it from the type only on purpose, never as tidying.

**`available` is the one that does something**, and exactly one thing: `availableIn` filters the starter
picker, so an unavailable player never reaches `buildPlayers`. There is no second check on the board and
there must not be — an injury reported after tip-off is not that game's business. Neither key crosses
into a `Player`, and `selfcheck` asserts `buildPlayers` leaves both behind.

**The availability dot is a TOGGLE, not decoration.** `components/ui/Dot.tsx`: `ink3` when available,
`danger` when not. Its callers are the two team screens. It is its own file so `selfcheck`'s
inverted-surface guard can exempt it by name without exempting the two screens that use it.

**The starter picker ignores a sixth tap rather than swapping someone out** — the app must not guess
which of the five they meant to drop.

**PF and FT are deliberately not connected.** Only one team is tracked, so a foul you log was committed
*by* your player and sends the *opponent* to the line, while a free throw you log is taken *by* your
player off a foul by the opponent. **Do not add a PF→FT bridge.**

**`FOUL_KINDS` holds five, `FOUL_MENU` offers four.** The keys are what the event log and `selfcheck`
speak; the menu is OF / DF / TF / FL, where `personal` is the one labelled DF. Add a kind to both or to
neither. Only kinds with `dq: true` count toward `FOULS`; **technical is excluded (NBA-style)** and
flipping that one flag switches ruleset.

**`recordFoul` returns `'ok' | 'out' | 'denied'` and the caller must branch on it.** `'out'` sets
`status: 'out'`, which removes the player from both `onCourt` and `onBench` permanently; `substitute`
refuses to send them back to the bench **and refuses to bring them back on**, returning `false` — a
picker disabling their tile is a fact about a panel, and this is a fact about the game, so the rule is
in `lib/actions.ts`. A refusal logs nothing and changes nothing, so the store pops its snapshot exactly
as a denied foul does.

**A PLAYER WHO IS OUT MAY NOT BE LEFT IN THE FIVE.** The fifth foul opens `FouledOutPanel` itself —
`useFlow` opens it in place of the reset — and while `owesSub(g)` is true (the floor is short of
`STARTERS` and the bench is not empty) **that panel is the one thing in the app a scorer cannot walk
away from**: `PanelHost` gives the scrim a null `onPress` and swallows hardware back.

**It is never a trap, and there are exactly three ways out.** Pick the replacement. Or, when the bench is
empty, CLOSE — nobody can come on, and the panel says so. Or, for a mis-tap, UNDO THE FOUL, which is
drawn **only when `Panel.fresh` is true**: the panel was opened by the foul itself, so that foul is still
the top of the undo stack. Reached later from a dimmed row `fresh` is false and no such button appears.
`owesSub` asks the GAME, not a player — the debt is the empty place on the floor.

**The rail always renders five rows.** If fouling out has left fewer than five active, the disqualified
fill the gap (shown `OUT`, dimmed) so the column keeps its rhythm and the player stays reachable; past
that it pads with empty rows. **That gap is the exception now, not the resting state** — a dimmed row
means a bench with nobody on it, or a debt left unpaid by force-quitting mid-panel, and tapping it
reopens the same locked question.

**The footer is four parts, 1 / 2 / 1: UNDO | score · clock · quarter | TIMEOUT.** Every cell grows off a
`flexBasis:0`, so nothing sizes to its own text. **The readout takes the middle and takes double.**
Inside the middle the split is weighted — 1.25 / 0.95 / 0.80, summing to 3 so the block itself does not
move: `108 : 99` is six digits and `07:24` is four, so an even split starves the score.

**The score is now READ and nothing else.** `ScoreCell` is a plain `View`: no `Press`, no held light, no
rect for the scrim to cut around.

**The clock and the quarter are two cells with a rule between them.** There is no PLAY button and no
CLOCK button — the time IS the clock control — but **its state is carried by the ink, not by a fill**:
running reads **`live`**, stopped reads `danger`. Stopped is the base state, so a board nobody has
touched reads red, which is true. **Running is `live` and not `accent`**: orange lands about twenty
degrees from `danger`, a difference a considered look can make and a GLANCE FROM THE BENCH cannot, on
the one cell that means one thing running and the opposite stopped.

**And that ink stands down while a panel is open**, taking `ink2`. The scrim darkens a FILL and not a
GLYPH, so the clock would otherwise be the one coloured thing left in the row, beside the one control
the scrim actually cuts a hole for.

**A HAND-COUNTED NUMBER TOOK END'S CELL, and END's arming went with it.** Ending a game is a
once-a-night decision and lives on the quarter panel; the confirm panel is what makes a mis-tap
survivable. A number tapped dozens of times a night is what belongs there instead: one tap is +1, the
count sits in the cell, and it goes through `edit()` like every stat.

**THE TIMEOUT COUNT HAS THAT CELL AND THE POSSESSION COUNT IS THE OPT-IN HALF OF IT.** They are the
same kind of number and not the same kind of decision. Every game has timeouts, every scorer has to
know how many are gone, and nobody has to be taught what the number means — so it is not a setting.
A possession count is a tap on every change of possession, forty a quarter, bought for exactly one
figure (POINTS PER POSSESSION), which is a trade only some scorers want to make. So `options.poss` is
what SPLITS the cell — see Options — and the timeout is what is there when nobody has answered.

**The split is two STACKED halves, not two side by side.** The cell keeps its quarter of the row and
pays in HEIGHT. Halved the other way it is about 45pt wide on a phone in portrait, which is a cell
that clips its own label — and the label is the half a scorer needs to tell the two counts apart.
`CountCell` is the one component for all three cases and `half` is a SIZE (`fsXs` over `fsNav`, against
`fsNav` over `fsNavLg`), never a different layout.

**`possessions` and `timeouts` are plain integers on `GameState`** — no player stat, because both
belong to the team and inventing a `playerId` for either would put a number on the box score nobody
tapped. BOTH are in the undo `Snapshot`, which is the only list that has to be kept in step. A game
read back from before timeouts were counted took none: nothing counted them, so there is nothing to
report.

**THE TIMEOUT ALSO LEAVES A MARK IN THE LOG AND THE POSSESSION DOES NOT**, and that is the one place
the two part company. A `timeout` event carries the period and the clock reading and nothing else: no
player, no value, nothing credited anywhere, so no box score moves. It is written for exactly one
reader — `timeoutRun` in `lib/analysis.ts`, which cannot ask whether the team played better after a
timeout without knowing when the timeout was. The counter is still what the footer reads; the mark is
the time beside it, and one UNDO takes back both because the snapshot carries the log. It is logged
only when the count actually ROSE, so a tap the clamp ate marks nothing. **The play log prints it with
a DASH where a jersey goes** — the column prints `Opp` for the other player-less event, and `Opp` over
a line reading Timeout would say it was theirs.

**Minutes are clock-driven**, and the clock's `tick` is the one action that does **not** deep-copy —
`secondsPlayed` changes 600 times a quarter, and a new roster identity each second would repaint the
rail for a number it does not show. Persist writes are debounced 2s and flushed on background.
`setInterval` is only a repaint tick: elapsed time is derived from a wall-clock stamp, and whatever the
app missed while backgrounded is credited on `AppState` → `active`.

**The opponent is a single number** — `oppScore` and nothing else: no opponent roster, no opponent shot
chart, no opponent fouls.

**The plus-minus has both halves, and the opponent's missing roster was never the obstacle.**
`onCourtPoints` is credited by `creditOnCourt` and `onCourtOppPoints` by `debitOnCourt`, which
`recordOppPoint` calls — the three OPP buttons are tapped while play is in front of you, so the five
standing there are exactly the five the basket went against. `plusMinus()` guards both halves with
`?? 0`, because a game persisted before the against-half existed would read `NaN`.

**`ptsOffSteals()` is still partial**, because a steal is the only opponent turnover a one-team board
hears about. Print it as POINTS FROM TURNOVERS with the note that says exactly that; never without.

**The team NAME is not hardcoded** — `DEFAULT_TEAM.name` in `lib/team.ts`. `SEED_ROSTER` seeds
`rosterStore` and is never read again. Every store persists to AsyncStorage and survives a kill, the
crest as a file beside them; nothing syncs anywhere.

**Declined and then built**: roster editing (now the TEAM tab + `rosterStore`, and the reason the store
split exists), a configurable period length, and box-score export as the PDF.

## Cut, and not to be rebuilt without being asked

Deleted outright — the argument for each is above, in its own section:

- `Pinstripe.tsx` (+ `STRIPE_PITCH`, `STRIPE_W`, `stripeInk`) — and with it any weave, grid, noise
  field or monogram behind a screen or on the jersey plate.
- `Tagline` in `Wordmark.tsx`, and the club lockup on the LOBBY (it heads MATCHES and STATS instead).
- The lobby's third block, and every cut preview (roster, FINAL STATS, MY TEAM, `8/8 AVAILABLE`).
- `Headline` / `Figure` — the season tab's team headline figures; its TOTALS / PER GAME strip; its
  `2/30` count, `N GAMES OFFICIAL` line and `BY COMPETITION` heading; `BoxTable` on that tab.
- `groupByDay` / `dayHeading` / `dayKey` and the shelf's date headings and result badge;
  `dateLabel` / `yearLabel` / `timeLabel` / `periodsLabel`.
- `BoxScore`, `TotalsPanel`, `PlaysPanel`, `ShotsTab.tsx`; the board's `totals` panel.
- `editPlayer` and `editTeam` panels; the roster row's 4px accent mark and its `×`; the ✓/— slot; a
  three-mode arm strip (✓ / C / ★) on the TEAM tab; captain and starting five there; club colours.
- The manual 2/3 override and the zone label on the shot panel; zone numbers on the floor; the FT dock's
  running made-attempted chip; the free-throw dot's label.
- The FULL RESET tile on the quarter panel; the clock keypad's right-to-left digit shift; a BACK button
  on `SetClockPanel`.
- The skin switcher, `auto`, the two frosted palettes; `clockRun` / `clockStop` / `clockInk`; END's
  arming; the score cell's press.
- The intro's rules step (`RULE_ECHOES`, `RuleEcho`, `Echo`, `Seams`) and its `Pointer` chip.
- The walkthrough's meaning line, nudge and SHOW ME (`Show`, `useShowRunner`, `NUDGE_MS`, `SHOW_MS`,
  `TUTORIAL_COPY.showMe`, the overlay's `Phase`).
- The paywall's FREE TRIAL card and its toggle; a RESTORE PURCHASE button; the media-library permission
  request before the crest picker.
- `assets/hero-ball.png`.

Left standing with NO CALLER, deliberately, so the gesture that reaches them next can be chosen rather
than restored: `app/stats.tsx`, `resultOf` (held to `>=` by `selfcheck`), `shapeLabel`,
`RemovePlayerPanel` + the `removePlayer` panel kind, `resetClock`, `Slug.tsx`, `hooks/useLastGame.ts`.
**Nothing removes a player from the app today.**
