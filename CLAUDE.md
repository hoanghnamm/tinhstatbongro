# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

**HoopLog** — a live basketball stats board for one scorer keeping stats for **one team**
on a phone or tablet at courtside. The board is a single screen; everything else on it is a
modal panel over it. The app lives in `livestats/` (Expo SDK 54, React Native 0.81, New
Architecture, TypeScript strict, Zustand, NativeWind v4, Expo Router).

Bundle/package id `com.n2937.hooplog`, scheme `hooplog`.

Four constraints drive every decision:

- **Speed of entry beats completeness.** Every stat is 2–3 taps.
- **One team only.** The opponent is a single integer with three buttons.
- **The court is the primary input.** A tap on the floor starts a shot entry.
- **Nothing scrolls on the board.** The board is exactly one viewport. Only panels scroll.

Those four are about the BOARD. The screens around it — the four tabs, the starter picker
and the two stats screens — are ordinary responsive screens held to ordinary rules;
`app/(tabs)/team.tsx` has a `FlatList` that scrolls, and that is not a violation of anything.

## Commands

```
cd livestats
npm run check      # tsx lib/selfcheck.ts — the rules AND the styling guards
npm run typecheck  # tsc --noEmit; strict, and it must stay at zero
npm start          # expo start
npx expo-doctor    # after any dependency change
```

`npm run check` is the whole test suite: one assert-based script, no framework. It boots
the real `lib/` modules against a plain `GameState` and then greps the component tree —
which since the routes landed means `components/` **and** `app/`, because a route is a
component and falls into the same three traps.
**Run it after touching anything in `lib/`, `constants/`, `components/` or `app/`.** There is no
per-file test and no runner — to check one thing, edit or comment out the block in
`lib/selfcheck.ts` and run it again.

**Never hand-pick a dependency version.** `npx expo install <pkg>` and
`npx expo install --fix` exist so the SDK 54 resolver picks them; `expo-doctor` catches the
peers a resolver cannot (`react-native-worklets` is a direct dependency for exactly that
reason). `babel-preset-expo` is also direct, which is unusual: NativeWind needs a
`babel.config.js`, and naming the preset there means it must resolve from the project root.

## Routing

Expo Router, a stack with a tab group inside it, headers hidden:

```
app/_layout.tsx        Stack + SafeAreaProvider + the palette + the fonts
app/(tabs)/_layout.tsx the four tabs
  (tabs)/index.tsx     LOBBY  — the team profile and the way into a game
  (tabs)/matches.tsx   MATCHES — the shelf of finished games
  (tabs)/season.tsx    STATS  — every saved game added up
  (tabs)/team.tsx      TEAM   — the durable roster
app/start.tsx          NEW GAME — the kind, the squad, the five, and who it is against
app/game.tsx           THE BOARD
app/stats.tsx          THE STATS SCREEN — one game, in full
app/history/[id].tsx   ONE SAVED GAME — its box score and its play log
app/competition.tsx    ONE COMPETITION — its games added up
```

**THE SHELF'S ROOM IS CALLED MATCHES, and the model is still called a game.** `GameState` is
the state of a game, `historyStore` saves games, `GameSummary` summarises one — a MATCH is
what one of them is once it is over and on a shelf, and that is the only place the word is
spent. Renaming the route renamed the file too: there is no `games.tsx`.

**The board is outside the tab group, and that is the point of the group.** A
tab bar under the board would steal a strip of height the court cannot spare and
would put navigation controls in the same row as UNDO and POSS. `start`, `stats`,
`history/[id]` and `competition` are outside it too, for the softer version of the same reason:
each is a place you go INTO and come back out of, so each gets a back button
rather than a tab that suggests it is a fifth room.

**TEAM is singular.** There is one team; a plural label promises a switcher that
does not exist and is not coming.

**THE TAB BAR IS TWO BARS, SPLIT BY PLATFORM.** iOS renders the real UIKit bar through
`expo-router/unstable-native-tabs`, which on iOS 26 is Liquid Glass; Android keeps the JS
`<Tabs>` it has always had. Glass is a UIKit material and there is no honest Android
equivalent — a translucent fill over a blur is a different thing that reads as a bug beside
the real one — so Android is not asked to imitate it. Both bars are built from ONE `TABS`
table in `app/(tabs)/_layout.tsx`, so the four rooms cannot drift apart.

**GLASS IS WHAT YOU GET BY NOT ASKING FOR A BACKGROUND.** `backgroundColor` and `blurEffect`
are both left unset on the native bar, deliberately: either one replaces the system appearance
with a flat fill or a pre-26 `UIBlurEffect`, and the glass goes with it. The only two colours
that bar sets are the tint and the label ink. `minimizeBehavior` is `never` against the iOS 26
default of `automatic` — a bar that shrinks away on scroll is a navigation control that is not
where it was a moment ago. `letterSpacing` is the one thing that does not cross:
`NativeTabsLabelStyle` has no such key, so `LS_LABEL` is spent on the Android bar only.

**AND THE GLASS STOPS AT THE TAB BAR — AND AT THE LOBBY.** Not the board, not the rail, not
the footer, not the score cell, not a panel. The board is read at arm's length in gym lighting
and glass is contrast spent on decoration; the `dock` panel in particular exists so the court
stays VISIBLE behind it, and frosting it would undo the one thing it is for.

**THE LOBBY IS THE ONE EXCEPTION AND IT EARNED IT.** It is the room you stand in BEFORE the
game — the only screen in the app nobody is reading while something is happening — so the
argument that kills glass everywhere else does not reach it. `expo-blur` came back for that
screen alone and is still spent there and nowhere else; `expo-linear-gradient` came back with
it and has since spread to all four rooms as the BLOOM, and to the one button that is lit by it.
See "The lobby".

**THE FOUR ROOMS ARE DARK, AND THE GROUP IS WHERE THAT IS SAID.** `TabsLayout` wraps both bars
in `ThemeProvider value={DARK}`, so LOBBY, MATCHES, STATS and TEAM are one place drawn one way,
and every shared component inside them — `Card`, `Band`, `Btn`, `Crest`, `Seam`, `BoxTable`,
`ClubCard` — follows with no `dark` prop anywhere. It began as the lobby's own provider with the
other three inheriting the light palette off the root, which is how the app came to wear two
skins in the space of one tap. **The board is NOT in this group and is still light**, along with
`start`, `stats`, `history/[id]`, `competition` and `player/[id]` — walking onto the board is
meant to feel like the lights coming up. **GLASS DID NOT SPREAD WITH THE PALETTE**: it is still
the lobby's cards and its one circular control, because the bloom is strongest there and a blur
needs something to sample.

**THE PALETTE AND THE STATUS BAR TRAVEL TOGETHER, AND THAT PAIR IS `components/ui/DarkRoom.tsx`.**
Getting one without the other is a bug you only see on a device — a dark screen under a dark
status bar loses the clock and the battery — so they are one wrapper rather than two things to
remember, and it has three callers: the tab group, `app/start.tsx` and `app/player/[id].tsx`.

**THE BAR IS FLIPPED ON FOCUS, NOT BY A MOUNTED `<StatusBar>`.** That component sets the style
when it mounts and the last one mounted wins — and a stack keeps every screen under the top one
MOUNTED, so a declarative `light` followed the scorer onto the light board and left the clock
behind an invisible status bar. `useFocusEffect` + `setStatusBarStyle` is the fact the navigator
actually knows. The cleanup puts the root's `dark` back rather than leaving the last dark room's
choice standing, and React runs every cleanup in a commit before any effect — so a push from one
dark room to another sets `dark` then `light`, never the other way round.

**TWO PUSHED PAGES WEAR THE SAME WRAPPER AND ARE NOT IN THE GROUP**, because they are not rooms:
**`app/start.tsx`**, the door into a game, and **`app/player/[id].tsx`**, a player's own season.
Both are reached FROM the four rooms and read like it — a light picker between a dark lobby and
a dark TEAM tab was the app blinking once on the way through. Neither needed a colour changed:
every value on both was already a token, so the fields, the chips, the seams, `ClubCard`, `Seg`
and even `CourtSvg`'s floor followed on their own. **START GAME takes the `bloom` variant**, the
same as NEW GAME — one verb across two screens, and the only two buttons in the app that start
something. **What stays LIGHT is everything about a game that is over or on**: the board, a
saved game, a competition.

**THE JS BAR IS `bg`, NOT `surface`, AND THE TAB SCENE IS PAINTED TOO.** Both are the same
decision twice: this palette's surfaces are TRANSLUCENT and the shell in `app/_layout.tsx`
paints the LIGHT canvas behind the navigator, so a 5% white bar sampled the wrong ground and
came out grey. A bar is not a card sitting on the screen above it — it is a strip of the same
near-black floor, with the 1px seam every card is drawn with along its top edge.

**`components/nav/nativeTabs.ts` is the only module that names `unstable-native-tabs`**, and
it is a re-export and nothing else. The `unstable-` prefix means the path will be renamed when
the API settles; keeping it in one file makes that rename one line. A shim that also made
decisions would be a second place to look when upstream changes — the decisions live in the
layout beside the JS bar they are the counterpart of. **It needs a development build and
Xcode 26**: glass comes from linking against the iOS 26 SDK, and there is no `app.json` key
for it in SDK 54.

**`app/_layout.tsx` is the old `App.tsx`, minus the board.** It writes the palette with
`vars()`, sets the status bar and **starts the game clock**. The clock is deliberately
NOT started in `game.tsx`: a running clock is a fact about the game, not about
which screen is showing, and walking off to MY TEAM mid-quarter must not quietly stop
crediting minutes.

**`<RotateGate />` is mounted inside `game.tsx`, not at the root.** At the root it would
cover home and my team, which are meant to work in portrait. The board is the one screen a
portrait phone cannot show, so the board is the one screen that gates — and the board and
its panels stay mounted underneath it, so turning the device back restores the exact state
the scorer was in. The gate is keyed on `portrait && min(w,h) < 700`, never on orientation
alone: **an 820×1180 tablet in portrait is a designed layout and never sees it.**

**Three of the four tabs mount their own `<PanelHost />`.** The panel router is the app's
one modal system; a second one off the board would be two systems to keep in step. A
`center` panel needs no measured rect, so it works with nothing else in place. STATS is the
one tab without one, because nothing on it opens a panel.

`router.replace('/game')` out of the picker, not `push` — back off the board goes home, not
to a picker for a game that has already started.

**The lobby's header is the club as it is TODAY; the hero's scoreline is the game being
PLAYED.** The two names come from two different stores on purpose — rename the club mid-season
and the game on the board still says the name it was started under. The whole identity block is a way into the
team editor, because the crest is the thing a scorer reaches for when they want to change
the crest — and it **ROUTES TO THE TEAM TAB** rather than opening a dialog over itself.
`EditTeamPanel` was that dialog and is gone: two editors over three fields is one field added
twice, and this screen has no room for a card. **`components/ui/Icon.tsx` went with the two
pencils it existed for**: the player row and the club card are both fields now, and a field
needs no affordance saying it can be typed in.

**The lobby is a team-profile screen, not a menu.** The brand lockup and the club headline,
then the LIVE game if there is one with CONTINUE under it, the last game's six numbers, the
season's six, and NEW GAME at the foot.

**THE HEADER IS TWO ROWS: A LOCKUP AND A HEADLINE.** Crest + HOOPLOG at the left and one
circular control at the right; then the CLUB NAME at `fs2xl` underneath. It was crest →
wordmark → gear on a single row with the club as an `fsXs` subtitle, which put the one thing
this screen is about in the smallest type on it. The club is the headline now and HOOPLOG is
the small mark above it — nobody opens this app wondering what it is called.

**The headline is TWO-TONE, and the rule is generic**: every word but the last takes `ink2`,
the last takes `ink`. It lands the weight on the noun that is actually the club's name, and a
single-word club needs no special case. It wraps to two lines rather than eliding — this is
the biggest type on the screen and a truncated club name is worse than a second line.

**THE COACH IS NOT ON THIS SCREEN ANY MORE.** It was the `· NAME` half of the subtitle that
the headline replaced. It is a fact about the club, it is edited on the TEAM tab, and the
one-window budget the headline just spent had to come from somewhere. All of it is derived — the live score straight off `gameStore`,
`totals()` over the last finished game, `season()` over the saved ones — and nothing on it is
stored twice.

**THE LAST GAME'S SCORELINE IS NOT ON THIS SCREEN, though its STAT LINE is.** The scoreline
was the hero's `FINAL` state and it is cut: one card carrying a scoreline is unambiguous,
while the same card carrying either a live score or a finished one is a card the eye has to
read a band to trust. The six numbers stay as the `LAST GAME` strip; the score itself is on
the MATCHES shelf and on the game's own stats screen.

**AND IT FITS IN ONE WINDOW DOWN TO THE VERBS.** A roster preview of eight rows, a FINAL
STATS button, a MY TEAM button and a running `8/8 AVAILABLE` count were all on it and are all
cut: every one of them pointed at a tab that is one tap away anyway, and together they pushed
the screen past the fold. What survives of the count is the WARNING — `NEED AT LEAST 5
AVAILABLE PLAYERS` — because that one is the reason NEW GAME is dark. The `ScrollView` stays
as the small-window safety net, not as the design; do not put a list back on this screen.

**THE SEASON'S SIX NUMBERS SIT UNDER LAST GAME AND ABOVE NEW GAME**, having moved here off the STATS tab where
they were a headline over a table nobody reads during a possession; on the lobby they are the
line a scorer opens the app to see. The card is a way into the STATS tab, exactly as the
identity block is a way into TEAM.

**It is the OFFICIAL games**, like everything else that says "season" — and reading them costs
the lobby every saved game off disk, which is the one thing the two-key storage shape was meant
to avoid on this screen. It is a single pass on mount through `useSavedGames`, off the render
path, memoised so the running clock cannot re-run it, and the card is simply not drawn until it
lands or when no official game has been played — six zeros under the word SEASON reads as a bad
one, not as an empty one.

**THE HERO IS THE LIVE GAME AND ONLY THAT**, so most of the time there is no hero at all —
a shelf full of games and nothing on the board is an ordinary Tuesday, and the screen says so
by being short. `LIVE` carries the running score with the period and the clock beside it, the
mark-coloured dot showing only while the clock is actually running. The `NO GAME YET`
onboarding card stands in on a FRESH INSTALL and only there: no board, no shelf.

**LAST GAME is the last FINISHED game, never the live one**, and it is hidden outright when
there is none — six zeros read as a game that went badly rather than as no data. Which copy
that is comes from `hooks/useLastGame.ts`: `gameStore` while the finished game is still the
one on the board, `historyStore` once a new game has replaced it.

**CONTINUE GAME rides with the scoreline, NEW GAME is the last thing on the screen.** The two
used to share a row, which meant the primary verb moved depending on whether a game was on.
Now neither moves: a scorer coming back mid-quarter finds the way in directly under the score
they were just looking at, and the foot of the screen is where the one thing that STARTS
something lives. NEW GAME only changes weight — `accent` normally, `surface` while a game is
on — and while one is on it goes through the confirm panel, because losing a live game to a
mis-tap is the worst thing this screen can do.

**The two strips' cells use the 1px seam, but NOT `flex:1`.** The card is in a column sized by its own
content, and a `flex:1` child of one of those collapses to nothing — so the rows take their
height from padding and type. Every piece is a module-level component for the same class of
reason: declared inside `LobbyScreen` they would be a new type on every render, and a
running clock would remount the whole card once a second.

**Layout here is keyed on WIDTH, not orientation** — 700pt, the same line `team.tsx` draws.
This is not the board: a tablet in portrait is wide enough whichever way it is held, so the
LAST GAME strip and the season card both go six-across above that line and 3+3 below it. There is one column now
that the roster is off the screen, and it is capped at that same 700 — run full width, a
tablet draws a scoreline a foot across.

## The team tab

**`app/(tabs)/team.tsx` IS the roster editor — the row is the form.** A jersey and a name are
two short fields, and a modal around them cost three taps and a round trip per digit on the
one screen where a scorer changes twelve of them in a row, at a table, before anything has
tipped off. `editPlayer` is gone; see "Panels".

**Three parts, left to right, each its own target:**

| part | what it is |
|---|---|
| `#` | the jersey, 0–99, digits only; its border goes `danger` on a collision |
| name | free text to `NAME_MAX`; blank is ordinary and shows `Player N` |
| the slot | dressed — `accent` + tick when on, an outline and a `danger` dash when off |

The slot is `available` under another shape, and `availableIn` is still the only thing that
reads it. The row's own `opacity: 0.45` is the second half of that readout.

**A 4px `accent` MARK at the row's left edge and a `×` at its right were both built and cut.**
The mark said exactly what the slot already says and the dim says again; the `×` put a
destructive target a thumb's width from two text fields, on the screen a scorer types
fastest on. **Nothing removes a player from the app now** — `RemovePlayerPanel` and the
`removePlayer` kind survive with NO CALLER, deliberately, so the gesture that reaches them
next can be chosen rather than restored. Do not re-add either control without being asked.

**Every field commits AS IT IS TYPED, with the text held locally.** That split is not
decoration: `rosterStore.update` runs `cleanName`, which trims, so a store round trip per
keystroke would eat a space the moment it was typed. The local copy is what renders; **blur
re-seeds it from the store**, which is also what reverts a rejected number and normalises
`07` to `7`. A colliding or half-typed number is SHOWN but never written — the roster never
holds two of the same shirt, not even for one keystroke.

**THE CLUB CARD IS THE LIST HEADER, not a block pinned above it.** It scrolls with the
roster, because a screen that is one sheet has one scroller — and because a header held still
over a moving list is a second surface that has to earn itself. It is passed as an ELEMENT,
not a component, so React keeps the same instances across renders and the fields hold their
text. **It is therefore kept SHORT**: `s2` padding throughout, the name at `fsLg`, and every
point it spends is a player the scorer cannot see on the first screen.

**Three bands on it, and the CREST SITS ON THE NAME'S ROW.** The mark and the word are the
same fact and were two bands for no reason; side by side the crest also takes its height from
the field beside it rather than setting the band's. Then COACH and ASSISTANT COACH across,
then a dashed `+ ADD CLUB LOGO` with REMOVE beside it once there is a crest. **The 2px rule
under the name is the card's whole error message** — `accent` while the name is good, `danger`
while it is empty, no words. The name is the one required field: it is the crest's fallback,
the lobby's subtitle and what every game is filed under, so `setProfile` refuses an empty one
and blur puts the last good name back.

**No club colours, and that is a decision.** The mockup pairs the crest with MAIN and ACCENT
swatches. The palette has exactly one skin and `theme/tokens.ts` is the only place a hex is
written, so a per-club colour is a theme change and not a field. It was raised and declined.

**NO BOTTOM PADDING ON THE FRAME, and that is the other half of one sheet.** The list runs
all the way to the bar and its SCROLL CONTENT carries the inset, so the last row scrolls out
from under the bar rather than stopping short of it.

**AND THE BAR'S OWN HEIGHT IS `hooks/useTabInset.ts`, WHICH IS NOT `safe.bottom`.** The four
rooms share one bar and the bar is two bars, and the two occupy a screen in opposite ways. On
**iOS** the glass bar sits ON TOP of the scene's last 49 points — glass has something behind
it — and the safe-area provider lives at the root of `app/_layout.tsx`, ABOVE the tab
controller, so it reports the WINDOW's inset and knows nothing about a bar nested inside it.
On **Android** the JS bar is a flex sibling of the scene and reserves the system navigation
inset itself, so the screen owes it nothing and `safe.bottom` there is the double count that
left a dead strip of canvas under the last row. One hook answers both; a room adds it plus
its own breathing room and never `safe.bottom` on its own. The TEAM tab is where getting this
wrong showed first — it paid a flat `m.s3` against a bar four times that, so + ADD PLAYER and
the last row sat BEHIND the glass with nothing left to scroll.

**No `KeyboardAvoidingView`, deliberately.** Padding the bottom by the keyboard's height cut
the viewport to a few rows at the exact moment the scorer was working down all fifteen. The
keyboard sits OVER the list and the list is what moves: `keyboardDismissMode="on-drag"`, so
one gesture both reaches the next row and puts the keyboard away.

**BUT THE KEYBOARD'S HEIGHT IS PAID ON THE CONTENT, AS TAIL.** That is not the same thing and
is the other half of being able to move: with nothing below the last row there is nothing to
scroll INTO, so the rows the keyboard covers cannot be lifted clear of it. `tail` is
`max(bar, keyboard) + m.s6` — the two never stack, because a keyboard covers the tab bar too
— and it is spent on `contentContainerStyle`, so the viewport keeps its full height and all
that changes is how far the list can be pulled up. Do not add one back here —
`EditTeamPanel` and the new-game screen keep theirs because they are forms, not lists.

**The jersey field carries a DONE bar on iOS.** `number-pad` is the one keyboard with no
return key at all, so two digits go in and there is no way off it. One shared
`InputAccessoryView` (`NUM_DONE`) serves every row and calls `Keyboard.dismiss()`, which
blurs whichever field is focused and lets `onBlur` re-seed it. Android needs none of it and
gets none — its numeric pad has a dismiss key, and the component is a no-op there.

**`+ ADD PLAYER` writes a blank row, and there is no form behind it.** `nextFreeNumber` picks
the lowest 0–99 nobody wears, because `number` is not optional and a new row has to arrive
wearing something. **At `ROSTER_CAP` the button is GONE, not disabled** — a dark button on a
full roster is a control still asking to be pressed — and the `15/15` count in the header
turns `danger` to say why.

**What is deliberately not on it: a captain, and a starting five.** Both are facts about a
GAME, and `app/start.tsx` asks them at the door; a starting five chosen on Monday is wrong by
Saturday. A mocked-up three-mode arm strip (✓ dressed / C captain / ★ starter) over this same
row was declined for exactly that reason — do not build it without being asked.

## The new-game screen

**`app/start.tsx` wears the TEAM tab's layout, not a panel's.** It was a tile grid inside the
foul panel's shell while the only question was "which five". It is now three — who is here,
who starts, and who it is against — and those are a team screen's questions, so it is the
team screen: the same `ClubCard`, the same columned rows, the same 1px seams.

**It cannot edit the team, and the one exception is the JERSEY NUMBER.** Not the club name,
not the crest, not the coaches, not a player's name or position — those are settled once, on
the tab built for them, and the club name in particular is what the game is about to be FILED
UNDER, so renaming it here would rewrite the label on the game being started. A number is the
one fact that changes at the door, because a squad turns up in a different set of shirts.

**`components/team/ClubCard.tsx` is that card, and there is one of it.** `readOnly` is the
picker: no press, and **no pencil either**, or the card would promise an editor that never
opens.

**A row is THREE press targets, not one.** The plate opens the number keypad, the name picks
or unpicks a starter, and the dot is availability — the same `Dot` toggle the TEAM tab draws,
because it is the same fact an hour later. **Every player shows, unavailable ones dimmed**,
because this is the screen where "actually, they made it" has to be one tap; what they are
not is one of the answers to who is starting. `availableIn` is still the only filter that
reaches `buildPlayers`, and it is applied at `startGame` — an unavailable player never enters
the game at all. Turning one off drops them from the picked five in the same breath.

**`setNumber` is a KEYPAD, not a field** — the same call `SetClockPanel` makes. Two digits at
courtside are faster off a grid of big targets than off a keyboard that covers half the
screen on its way in, and it keeps the panel out of the `KeyboardAvoidingView` business. It
writes to `rosterStore`, so a new number is durable, and the duplicate error NAMES THE HOLDER
exactly as the TEAM tab's own inline number field does.

**THE PAGE SCROLLS AND THE LIST DOES NOT**, which is the opposite of the TEAM tab and the
right way round here: a club card, a roster, a two-field form and a button do not fit a
667×320 phone however they are stacked, so the whole column scrolls and START GAME stays
pinned under it. A `FlatList` inside a `ScrollView` would be two scrollers fighting, and the
roster is capped at 15 anyway — there is nothing to virtualise.

**PRACTICE OR OFFICIAL IS THE FIRST QUESTION ON THE MATCH CARD, and the picker opens on
OFFICIAL.** Not because most games are: because it is the one question here that cannot be
answered afterwards. Nothing in the app edits a saved game, so a game filed under the wrong
kind is wrong for as long as it is on the shelf — the season either counts a scrimmage or
drops a league game. Opening on OFFICIAL with the competition still blank means **START GAME
is dark until the scorer has said one of the two things out loud**, and the reason is printed
over the button (`NAME THE COMPETITION, OR MARK IT A PRACTICE`) exactly as the lobby prints
why NEW GAME is dark. One tap either way, once a night. The toggle is `Seg`, the same control
the stats screens ask their two questions with.

**The LEAGUE field is DRAWN ONLY FOR AN OFFICIAL GAME, not merely disabled.** A practice is
not filed under anything, and a dead field on the card is a question still being asked.

**Under it sit the competitions the shelf already knows, as chips.** `competitionsIn` reads
the INDEX — thirty summaries already in memory — so suggesting them costs no disk read, and
they filter as the scorer types with the exact match dropping out of the row: a chip that
would type nothing new is a target that does nothing. The first game of a season is typed and
every game after it is a tap, which is the whole point — **a competition is only a group if
the name is spelled the same way each time**, and `competitionKey` folds case and spacing but
nothing else. `VBA` and `VBA 2026` are two seasons of one league and the app has no business
merging them.

## The other side

**`GameState` carries an `opponent` and a `note`, and they are typed on the picker.** The
opponent's whole model is still one number and three buttons; the string is the LABEL on that
number, so a shelf of thirty games can say who each was against. Both are optional and both
are cleaned by `lib/team.ts`'s own `clean()` — they are the same kind of thing as a club name,
which is why they live beside it rather than in a fourth lib file.

**A blank opponent reads as OPPONENT, never as a gap.** `opponentLabel()` is the one place
that decides so. The lobby's hero, the two stats screens and the shelf row all print through
it; the ones that would rather say nothing than say OPPONENT test the string themselves.

**THE ROW'S SUBTITLE IS THE OPPONENT AND THE DATE, AND NOTHING ELSE.** The kick-off TIME and
the QUARTER COUNT were both on it and are both cut, on the shelf and on the saved game's own
header alike: `21:40` is not a fact anybody looks a game up by, and `4 QUARTERS` reads the
same on twenty-nine rows out of thirty. `dateLabel`, `yearLabel`, `timeLabel` and
`periodsLabel` went with them — the two labels left in `lib/history.ts` are **digits**,
`numDateLabel` (`19/08/2026`, the saved game's line) and `dayMonthLabel` (`19/08`, the shelf,
where thirty rows are one season and the year is noise). `periods` is still ON the summary, so
the day something wants to say `+ 1 OT` the number is there.

**`GameSummary.opponent` was the one OPTIONAL key on the index**, because a row written before
opponents existed has none and there is no `reviveGame` for the index. Every reader falls
back, so an older summary simply says less. `kind` and `competition` joined it on the same
terms — read the kind through **`summaryKind`**, never raw.

## The kind, and the competition

**`GameState` carries a `kind` — `'practice' | 'official'` — and a `competition`, and both
are typed on the picker.** They are the third and fourth of the game's own labels, beside the
opponent and the note, and `lib/team.ts` cleans all four because they are the same kind of
thing as a club name.

**The kind is read for exactly one thing: the season is the OFFICIAL games.** `officialIn` is
the whole rule. A practice is a real game with a real box score — it is saved, it opens, it
has a shot chart — it is simply not what a season is made of, which is exactly what the
scorer said when they tapped PRACTICE at the door.

**A GAME FROM BEFORE THE TWO KINDS IS OFFICIAL**, in `reviveGame`, in `summaryKind` and on
rehydrate of the live game. The season counted those games when they were saved, and a
migration that quietly dropped a month of games out of the season line would be the worse
surprise. The same games have no competition, so they group under `''` and print as
**UNFILED** — a label for history, not for a gap, because the picker will not start a new
official game without a name.

**`startGame` takes the four labels as ONE `MatchInfo` argument**, not as four positional
strings. It is one answer — the match card fills all of it in one place — and a fifth label
later should not move anybody's call site. `freshGame` defaults to a PRACTICE with no
competition, because a board that has never been through the picker has nothing filed and an
unnamed OFFICIAL game is the one state the picker refuses to create.

**A SHELF ROW'S TITLE IS THE KIND**: the competition's name on an official game, the word
PRACTICE on a practice, UNFILED on an official game saved before competitions existed. It was
a small TAG beside a date that was the title, and the swap is the point — the shelf is read by
scanning, and nobody scans thirty dates looking for the cup game. The date drops to the
subtitle beside the opponent as `19/08`. A practice takes `ink2` rather than a pill or a fill:
it is deliberately **not accent**, because a mark on every row would teach the eye to ignore
the four places accent actually means something.

## The lobby

**`accent` is spent on exactly two things on this screen**: the primary button and our own
score. Not the crest, not the roster count, not the jerseys, not the US pill — the mockup
paints nine things with it, which teaches the eye to ignore all nine. The active tab and the
LIVE banner are the other two places in the app it survives.

**THE BLOOM IS NOT A THIRD.** The gradient behind the header is the accent at 34% falling to
nothing before the fold, and it is a GROUND rather than a mark: it names nothing, it is behind
everything, and no control is picked out by it. It exists because a `BlurView` samples what is
behind it — over a flat slab the glass would be a slightly lighter flat slab, and the bloom is
what the circle and the cards actually pick up. It is `pointerEvents="none"`, which is
load-bearing: it covers every control in the header, and a decorative layer that eats taps is
invisible when it goes wrong.

**AND IT IS `components/ui/Bloom.tsx` NOW, BECAUSE ALL FOUR ROOMS DRAW IT.** Four copies of
three colour stops and an axis is four chances for one room to sit at a different angle to the
light than the room next door, which is exactly what the eye catches moving between two tabs.
Two rules for every caller, and both have bitten: it is the FIRST child of the screen's root
view, OUTSIDE the padded flow, so it runs edge to edge under the safe-area inset — a gradient
that starts below the status bar draws a line across the top of the screen, which is the
opposite of a bloom — and it eats no taps. The stops, the axis and the height live in
`theme/tokens.ts` (`BLOOM_START` / `BLOOM_END` / `BLOOM_STOPS` / `BLOOM_HEIGHT`, `bloomWash`)
beside the palette, because a gradient is a raw value like a hex.

**NEW GAME IS THE BACKGROUND MADE INTO A BUTTON, and that is `Btn`'s `bloom` variant.** Not an
orange slab with a gradient on it: the SAME CONSTRUCTION as the screen behind it — the room's
near-black `bg` as the fill, with the accent washing across it at falling alpha on the bloom's
own axis (`bloomFill`). The edge is the accent, because a near-black fill draws no edge against
a near-black room.

**IT IS DENSER THAN THE WASH AND SOFTER THAN THE RAW ACCENT**, and it is pinned between those
two by what went wrong at each end. The wash runs 0.34 → 0.07 down half a window; a button is
forty-eight points tall, and those alphas over a strip that short is a dark slab nobody reads as
the primary verb — worse, one that reads like the `surface` weight this same button takes while
a game is live. The other end is the flat `#F26414` slab the variant exists to stop being: at
full strength the fill is louder than everything it sits among and the gradient in it cannot be
seen at all. So the ramp is a SOFT orange throughout — **0.82 → 0.56 → 0.30**, the accent
stepped back off full at the near corner and falling to a warm ember at the far one, which
leaves the whole width of the button carrying visible movement in one hue. Every stop is that
one orange over the room's own near-black through `withAlpha`, so there is no new hex.

It is a SEVENTH variant rather than a change to `accent` on purpose: every other accent button
in the app is on a panel over a light court, where there is no bloom to belong to and where a
fill that falls to near-black would be a hole. Pressed, the whole ramp steps down to `accent2` —
down is darker on anything orange — and only the edge is left for `pressedStyle` to move with
it. While a game is on it still drops to `surface`, which is the whole of what that state says.

## Architecture

**Six stores, one job each.**

- `store/teamStore.ts` — the **club**: name, crest, head coach, assistant. See "The club".

- `store/rosterStore.ts` — the **team**: `{id, number, name, position?, available}` × 15
  max. Persisted plainly, because a roster is edited a handful of times a season and not
  600 times a quarter. **It is on persist version 2**: `available` was added after builds
  shipped, `undefined` is falsy, and a rehydrate without the migration is an empty starter
  picker at tip-off. `migrateRoster` lives in `lib/roster.ts` so `npm run check` runs the
  real one.
- `store/historyStore.ts` — the games that are **over**. See "The shelf" below.
- `store/gameStore.ts` — the `GameState`, every action, undo, the options. Persisted to
  AsyncStorage through a debounced writer.
- `store/uiStore.ts` — the in-flight entry (`mark`/`zone`/`side`/`shotType`/`what`/
  `shooter`/`foulKind`/`trip`/`note`), the panel router, the toast. Not persisted; a
  half-finished tap is not worth restoring.
- `store/layoutStore.ts` — rects measured via `onLayout` + `measureInWindow`. Only the
  board writes to it.

**The club is not the roster, and they are two stores.** `rosterStore` is a list with a cap
and a duplicate rule; `teamStore` is a record with a FILE attached, and the file is the part
with a lifecycle nothing else in the app has. Both are the durable half and both outlive
every game.

**The roster is not the game, and that split is the point.** A team outlives any number of
games; a stat line belongs to exactly one. `types/index.ts` says so in the type system —
`Player extends Omit<RosterPlayer, 'position' | 'available'>` — and `lib/roster.ts`'s
**`buildPlayers` is the only crossing for people**. It runs once, at tip-off, from
`gameStore.startGame(roster, starterIds, teamName)`, and
it copies field by field with a **fresh `zeroStats()` per player**, so editing the team
after tip-off cannot reach the game being played and no two players can end up on one
counter. `npm run check` asserts both by renaming, renumbering and deleting a roster entry
mid-game and reading the box score back.

`startGame` deliberately does **not** go through `edit()`: starting a game is not a stat to
be undone, and it clears the undo stack outright.

**The rules are plain functions, not store methods.** `lib/actions.ts` holds every mutation
as a function over a `GameState`; the store's only job is to snapshot, call one, and
publish. That split is why `npm run check` can exercise the whole rulebook without React,
Zustand or a device — keep new rules on that side of the line.

**Undo is snapshot-based, not inverse-op-based.** The store's `edit()` wrapper pushes a JSON
deep copy of `{score, oppScore, possessions, players, events}` before every mutation (capped
at 80, plus the clock for the one action that owns it);
`undo()` restores it wholesale. A mutation that does not go through `edit()` is silently
skipped by undo. The stack lives at **module scope in `gameStore.ts`, not in the store** —
nothing on screen depends on it, and putting it in state would repaint the board eighty
times a game. A `denied` foul pops its own snapshot back off.

**`undo()` explicitly carries `secondsPlayed` forward.** Minutes come from the game clock,
not from the action being undone; rewinding a basket must not rewind time already played.

**END QUARTER IS UNDOABLE, and it is the only clock action that is.** `nextQuarter` goes
through `edit()` like a basket does, because it is a tile sat next to END GAME on the same
panel and a mis-tap costs a whole period — SET can put 10:00 back, but nothing can put the
QUARTER back. ±1s and the keypad are deliberately NOT on the stack: both are corrections
already, and a correction that needs undoing is retyped.

**So `Snapshot` carries `period` and `remaining` OPTIONALLY**, and `edit(fn, true)` is what
puts them there — one caller, today. A snapshot pushed by a basket must not carry a time, or
undoing that basket a minute later would wind the game clock back to when it was scored;
`undo()` therefore restores the clock only when it finds one, and always `running: false`,
because coming back into a quarter through UNDO is not a restart. `lib/actions.ts`'s
**`nextPeriod`** is the mutation itself, on the same side of the line as every other rule, so
`npm run check` asserts both halves without the store: that the buzzer logs no event and
credits no minute, and that the snapshot puts the quarter back on the time it was ended at.

**Two parallel records per action.** Counters live on `player.stats`; a separate
append-only `state.events` array feeds the play-by-play. Every `record*` writes both — the
box score reads stats, `PlaysList` reads events. Event ids come off `events.length`, so
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

**The drawing is the contract.** Every cut `zoneFor` makes is a line that is actually
painted on the floor by `CourtSvg.tsx`, and every line that bounds a region is a zone edge:

| line, as drawn | separates |
|---|---|
| the lane, `x = 277 / 513`, `y = 276` | the paint |
| `y = 101`, lane edge → three-point line | `corner2` \| `wing2` |
| `y = 203.7`, three-point line → sideline | `corner3` \| `wing3` |
| the three-point line, `x = 68 / 724` + the arc | 2PT \| 3PT |
| the lane extensions, `(310,276)→(187,521)` and `(480,276)→(603,521)` | `wing` \| `top` |

The backboard, the rim and the free-throw circle bound nothing; they are markings, and no
one reads a circle as a zone edge. **Sectors are NOT angular.** An `atan2` fan out of the
basket, cut at 22.5 / 67.5 / 112.5 / 157.5°, was what `zoneFor` used to do, and the floor
has no line for any of those four rays — so the lit fill and the paint disagreed by whole
slabs, which is what "ấn chỗ thì thiếu, chỗ thì thừa" was. Do not re-derive a sector from
an angle.

**The two corner cuts are at different heights on purpose**, because two different lines
are drawn: inside the arc the corner ends at the free-throw line extended (101), outside it
at the stub the three-point line turns on (203.7). The boundary therefore *steps* at
`x = 68 / 724`, and a point can be below one cut and above the other.

**`ZONE_PATHS` carries the same partition a second time, as eleven exact closed paths, and
it lives in `lib/court.ts` beside `zoneFor` — with `COURT_LINES` and `RIM`, which are the
line work.** They were in `CourtSvg.tsx` while that component was the only thing in the app
that drew a court; the stats screen's own two charts draw the same floor, and **two
component-local copies of eleven closed paths is exactly what this file exists to prevent**,
so every renderer reads the strings and none of them owns them. The only two vertices not read
straight off the drawing are where each lane
extension crosses the arc — `(540.6904, 396.8874)` and `(249.6808, 396.1479)` — and they
are solved, not eyeballed. **The two sides are not mirrors:** the extensions are symmetric
about the lane's centre 395, the arc about the basket at 396, so the two crossings differ
by three quarters of a unit in `y`.

**`zoneFor` and those path strings change together or not at all**, and `selfcheck`
enforces it two ways: it rasterises the real `d` strings out of `lib/court.ts` and asserts
all 412,632 cells of the viewBox resolve to the zone `zoneFor` names — no gap, no overlap,
no drift — and it asserts each of the nine bounding lines is still drawn, so a zone edge
cannot quietly lose its line. It samples at `(px + 0.31, py + 0.27)` rather than at the
pixel centre: every boundary is an integer, `203.7`, or a slope of `123/245`, and a centre
lands exactly on one often enough that an inclusive `<=` and a scanline edge rule disagree
— noise, not drift, and no sample at this offset can sit on a boundary. **There was a third
way and it is gone with the thing it guarded**: the PDF drew the same floor onto paper, so
every `<path>` the sheet emitted had to be a string this file owns. The sheet draws no floor
now — see "The export" — and `selfcheck` asserts the opposite instead, that nothing on it
draws at all.

**The strings are read out of the SOURCE rather than imported**, both times. What is
being checked is the text a human edits; an import would only prove the array agrees with
itself.

The eleven paths replaced five oversized wedges cut down by a `courtClip` and two `Mask`s.
A closed path is exact by construction and needs no `Defs`. The zones are never hit-tested
— the wrapper owns the pointer — and only the one matching `ui.zone`/`ui.side` is rendered
at all.

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
`Press`, `Tile`, `Badge`, `Surface`, `Jersey`. They exist because three CSS→RN default differences
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

**`Jersey` is the plate, and there is exactly one of it.** A rectangle, not a bubble — the
number gets the whole height of the box rather than a circle's inscribed square, which on a
rail row is most of the difference between two legible digits and two small ones. Its
resting pair is the FLOOR (`court` fill, `courtLine` ink); `selected` and `out` are
inversions and are written as pairs. **Both dimensions are the caller's**, because the two
callers know different things: the rail *measures* its row (a `flex:1` leftover no ramp can
name), the team list takes a size off the ramp. Do not build a second one for a third caller.

**`Btn` has six variants and the ladder is deliberate:** `accent` (primary) > `solid` (ink)
> `surface` (filled, 1px `rule`) > `plain` (transparent, 2px `line`), plus `danger` and
`made`. `surface` exists for the home screen and only for it — three stacked buttons need
three weights, where a panel's two-button row only ever needed two.

**A press on the board LIGHTS the cell, and `t.press` is the only fill that does it.** The
clock, the quarter, POSS, UNDO, a player row and PF/FT/RB all take `t.press` while
the finger is down, and it is a step *away* from `surface` — `surface2` is the canvas, so
using it there read as the cell dimming at the one moment it is the thing being looked at.
It is a brightness and not a hue: no accent, no tint. On the light palette there is no
headroom — the surface is already white — so `press` IS the canvas, because down is the only
direction left with contrast to spend, and the token records that rather than hiding it.
Panels and `Tile` still press on `surface2`; they sit on a scrim, not on the board.

**And the light is HELD until the panel it opened closes.** `lib/lit.ts` answers which
control that is, and it is a function rather than a second `Record<Panel['kind'], …>` beside
`MODE` for two reasons: **step 2 is shared** — `who` is one panel for PF, FT, RB, a tally and
a shot, so only the in-flight `what` says whose flow it is — and **a tap can open a chain**,
so the quarter cell owns `endQuarter`, `setClock` and `endGame` alike. **`'score'` was a third
light and is gone with the panel behind it** — see the footer. `litPlayerId` is the
rail's half of it: the row whose own panel is open, which is **not** `ui.shooter` and does not
outrank it. UNDO, POSS and the clock open nothing and are therefore deliberately absent —
holding them lit would mean inventing a state the model does not have.

**`rects.lit` is one slot, not a key per control**, because two are never lit at once. It is
measured on the OFF→ON edge rather than in `onLayout`, since becoming lit is not a layout
change — the panel opened, the row did not move — with `onLayout` kept as well so a rotation
mid-panel does not strand the hole. `useLitRect` clears the slot on cleanup, and React runs
every cleanup in a commit before any effect, so a control going dark cannot wipe the slot of
the one lighting up beside it.

**The tile grid's 1px divider IS the gap:** a rule-coloured parent showing through 1px
seams. Tiles must be opaque and carry no border and no radius, or the seam disappears.

## Theme and sizing

`theme/tokens.ts` is two layers: a palette (the only place a hex is written) and semantic
names aliased onto it. **THE SKIN IS LIGHT AND THERE IS STILL NO SWITCHER — but there are now
TWO PALETTES, and `DARK` is the TAB GROUP'S.** It is not the second skin that was cut:
nothing reads a preference, nothing persists, there is no `auto`, and no user-facing control
chooses between them. A SUBTREE declares the palette it is drawn in, through a context in
`theme/useTheme.ts` — which is exactly the seam this file always said `useTheme()` was being
kept as. Exactly one subtree uses it, and it is `app/(tabs)/_layout.tsx`.

**Doing it in `useTheme()` is what keeps the shared components shared.** `Card`, `Btn`, `Band`,
`Seam`, `Crest`, `BoxTable` and `ClubCard` all call it internally, so they follow the surface
they are standing on with no `dark` prop threaded through any of them and no second copy of any
of them — `ClubCard` is the same card on the dark TEAM tab and on the light new-game picker. The
provider sits at the GROUP rather than in a screen, because a component cannot provide to its
own `useTheme()` call, and because four screens declaring it four times is four things to keep
in step.

**`DARK`'s SURFACES ARE TRANSLUCENT, and that is what makes the glass work.** A card there is a
`BlurView`, and an opaque child inside one covers the blur completely — so `surface`, `surface2`,
`rule`, `line` and `press` all carry alpha. The alpha lives in the PALETTE rather than in a
`glass` prop on each component, for the same reason as above. It is safe because every consumer
draws on the near-black `bg` with the bloom the only thing between — **do not reuse this palette
on a screen with a light ground under it**, where a 5% white surface is a surface nobody can
see. `Card`'s `glass` prop is the opt-in and is still the lobby's alone; everywhere else it
stays the opaque surface it has always been.

**AND FOUR VIEWS HAVE TO ASK WHETHER IT IS TRANSLUCENT, which is `isTranslucent(p)`.** One
question, asked of the PALETTE rather than threaded down as a prop — and it reads the surface
rather than carrying a flag beside it, because a flag is a second fact that can disagree with
the first. Its readers are the views that paint a GROUND behind something they do not own:
**`Card`'s shadow wrapper** and the competition card's, which painted `surface` there and again
on the inner view, compositing the same 5% white twice AND putting an opaque slab in front of
the bloom (what goes with the fill is Android's `elevation`, which on near-black is a shadow
nobody can see); and **`PanelHost`'s frame**, which must be OPAQUE whatever the palette says —
a dialog is a sheet in front of the room, and a 5% white over a scrim is not a sheet but a
slightly paler hole. The TEAM tab's `InputAccessoryView` is the fourth and does not need to ask:
it sits over the keyboard with nothing of its own behind it and takes `bg` outright, which is
the same value `surface2` already was on the light skin.

**THE PANELS ARE INLINE-STYLED NOW, ALL OF THEM.** `PHead`, `PTitleText`, `Pts`, `Note` and
`Empty` in `components/panels/shell.tsx` carried `className="text-ink"` and friends, and a
NativeWind class resolves through the CSS variables the ROOT pushes down — which are the LIGHT
palette's, whatever subtree the panel is actually drawn in. The settings panel over the lobby
was near-black ink on a near-black sheet. A class and a `useTheme()` read can only agree where
one palette is in play, so the panels have none left.

**Two of its tokens are deliberately not the light values.** `danger` and `live` both LIFT,
because `#B3261E` and `#0E8FA3` on near-black are smears rather than colours. Same two hues,
same two jobs, the versions that survive there.

**AN INVERTED PAIR MUST NOW SURVIVE BOTH PALETTES.** `Crest`'s monogram is the one this caught:
it was `ink` fill under `surface` ink, correct on light and INVISIBLE on dark, where `ink` is
near-white and `surface` is a translucent white. It is `bg` now — the one token that is the
opposite of `ink` in both. `selfcheck`'s fill-without-ink grep cannot see this class of bug: it
checks that a pair EXISTS, not that it inverts.

The switcher, `auto`,
the dark palette and the two frosted ones were built and cut — a scorer picks a theme once
and never again, and every branch that served the choice was paying for a decision nobody
makes at courtside. The blur in `Surface`, the `bgWash` gradient in `_layout` and the
`expo-blur` / `expo-linear-gradient` dependencies went with them, and `useTheme()` is now a
constant wearing a hook's name: it reads no state and never causes a render. The two-layer
split survives because it is what keeps the hexes in one place, not because a second skin is
coming — **do not add one back without being asked.**

**THE SKIN IS ORANGE AND THE GREYS ARE WARM.** `accent` is `#F26414`; the ink ramp is anchored
on a near-black `#050505` and every grey above it carries warmth, because a cool blue-grey ramp
under a saturated orange reads as two palettes sharing a screen. **The court is the one surface
left slightly cool** — it is the backdrop the orange marks are read against, and it is the only
place the contrast is worth the seam.

**THREE HUES DO THREE JOBS, AND THEY DO NOT TRADE.**

| hue | means | where |
|---|---|---|
| `accent` orange | OURS — the primary action, our score, a made shot, the active tab | the four places accent has always been |
| `live` teal | NOW — in progress, unresolved | the running clock, the lobby's LIVE dot, the court's tap mark |
| `danger` red | this destroys something, or it has stopped | destructive verbs, the stopped clock, an unavailable player |

**`live` IS THE RETIRED ACCENT, not a fourth hue.** When accent was teal it sat opposite red and
the footer's clock could carry run/stop in ink alone. Orange does not, so rather than invent a
colour the teal kept the one job that needed it. `mark` aliases the same raw for the same
reason: a tap not yet resolved into a make or a miss is the same "in progress" a running clock
is — and it must NOT be orange, because two dots away orange means MADE, which is exactly what
the tap mark exists to be distinct from.

**`accent2` is the pressed accent and it is DARKER, never fainter.** It had no caller for a long
time and has exactly one now: a filled accent button. `opacity` fades a saturated orange toward
a warm canvas of nearly the same hue, so the primary button read as going PALE under the thumb
instead of going down. Every other `Btn` variant keeps the fade — none of them is orange.

**CARDS AND PANELS FLOAT; THE BOARD DOES NOT.** `ELEV_CARD` / `ELEV_LIFT` / `ELEV_PANEL` are the
whole ramp and they live in `tokens.ts` beside the palette, because a shadow is a raw value like
a hex. **The court, the rail, the footer and every tile grid stay flat**, and that is not an
omission: the 1px seam that divides a tile grid IS the grid, and a tile that lifts casts onto its
neighbour and eats the seam it is defined by.

**A SHADOW AND A CLIP CANNOT SHARE A VIEW.** `overflow:'hidden'` is `clipsToBounds` on iOS, so a
card that clips its children to its corner radius clips its own shadow with them. `Card` is
therefore TWO views — the outer carries the fill, the radius and the elevation, the inner carries
the same radius plus the clip — and `season.tsx`'s competition card wraps its `Press` the same
way. Android has the second half of the same trap: `elevation` draws nothing without an opaque
`backgroundColor` on the same view. Every step writes both platforms out; a step that set only
one would be flat on the other, which is how a depth pass half-lands.

**`PanelHost` is the one deliberate exception** — its frame keeps the shadow and the clip on one
view. Every mode except `dock` already sits on a scrim, which is doing the separating a shadow
would, so if the clip eats it on iOS the panel loses a refinement and not its legibility.

NativeWind resolves colours through CSS variables rather than literals: the root view
writes the palette with `vars()`, so a `bg-surface` class and a `useTheme()` read can
never disagree. `global.css` carries the same values as the fallback only. **Sizes are
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
The footer's middle block carries three numbers side by side — score, clock and quarter, **all
three at this one size** — so its type is capped by `(half − 34) / 7.76`: `108 : 99` is 3.08em
with its gaps, `07:24` is 2.56em and `2ND` is 2.12em with its tracking, plus the two rules and
six cells of `s1` padding. The vh term wins on every screen the board actually runs on; the cap
stays because `fsNav` grows with the window height while the block does not, and the day that
crosses over the clock reads `07:2…` rather than throwing.

Custom fonts have no numeric weight axis in RN, so a weight is a family name — `fNum()` /
`fUi()` are the only place that mapping lives. **Tabular numerals everywhere a number can
change**, so a tick never shifts the layout.

**THE FACE IS HELVETICA NEUE, AND IT IS ONE FACE FOR THE NUMBERS AND THE WORDS ALIKE.** Chakra
Petch had the numbers and is gone with its package: a squared display face made the board look
like a scoreboard graphic, and the numbers on it are read, not admired. `fNum` and `fUi` still
both exist — they differ in weight and tracking now, not in family.

**AND IT IS SPLIT BY PLATFORM, exactly as the tab bar is.** Helvetica Neue is an Apple face:
free and already installed on iOS, and simply absent on Android, where bundling it would need
a licence this project does not have. **Android keeps Inter** — the closest neo-grotesque that
was already a dependency — so the split costs no new package on either side. On iOS a weight
is a POSTSCRIPT NAME (`HelveticaNeue-Medium`), because that is the convention every component
here is already written to; note the family ships **no SemiBold**, so 600 resolves to Medium,
which is a real face rather than a synthesised one. Both faces carry tabular figures, which is
load-bearing and not a nicety — the footer's clock would shift the middle block once a second
without them.

**`theme/tokens.ts` MAY NOT IMPORT `react-native`**, which is why the platform is read off
`process.env.EXPO_OS` rather than `Platform.OS`. `lib/pdf.ts` imports `PALETTE` from it and
`npm run check` runs that under plain node, where a `react-native` import throws on the first
line of Flow it meets. `babel-preset-expo` inlines the constant at build time; under node it
is `undefined` and lands on the Inter branch, which the script never reads anyway.

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
there would drag every panel in with it. Ask `isDocked()`; never keep a second list. **There were four modes and there are three**:
`wide` was the box-score panel's own size and nothing else's, so it went when that panel did.

| mode | where | scrim |
|---|---|---|
| `dock` | the columns right of the court, the rail's full height | **clear** |
| `court` | the court's own footprint, top edge to footer | dimmed |
| `center` | a centred dialog | dimmed |

**Five panel kinds live off the board** — `newGame`, `setNumber`, `removePlayer`,
`removeGame`, `settings` — and all five are `center`, because there is no court to dock
against or cover and because that is what they are anyway: three confirms, a keypad and a
short list of switches. They ride the same `Panel` union and the same exhaustive switch as
everything else. **There is no FORM among them any more**, and that is the pattern rather
than an accident: the TEAM tab edits a player on its row and the club on its card, in place.

**`editTeam` was one of the two that went.** `EditTeamPanel` held the club name, both coaches
and the crest picker behind a dialog; `ClubCard` holds all four inline now and is the club's
only writer. The lobby's identity block, which was its one caller, routes to the TEAM tab.

**`editPlayer` was the other, and was the seventh.** It was one panel for ADD and EDIT, with
`playerId: string | null` deciding which. The TEAM tab's ROW IS THE EDITOR now — the jersey
and the name are inline fields on it — so the panel was a modal wrapped around two inputs
that already had somewhere to live. `+ ADD PLAYER` writes a blank row straight into the
store instead of opening a form. Do not put it back: a second way to edit the two fields the
row already edits is the one that drifts.

**Two places in the app have a `TextInput`** — the TEAM tab (its roster rows AND its club
card) and the new-game screen's two match fields — and the board is never one of them. **Only
ONE of the two avoids the keyboard**: the new-game screen is a FORM, where a field pushed
under the keyboard is a field you cannot see, so it keeps its `KeyboardAvoidingView`. The
TEAM tab is a LIST and deliberately has none; see "The team tab". `SetNumberPanel` is
deliberately not a third: it is a keypad precisely so it does not have to be. Its number field is held as TEXT, not a
number: an empty field and a typed `0` are different states and `Number('')` is `0`. The
duplicate error **names the holder** — `#12 IS TAKEN BY bd` — because "already in use" makes
the scorer go and look; SAVE stays dark until both fields are good, so the error is the only
thing that can be wrong.

**A dimmed scrim is FOUR bands with the lit control cut out of them, not one sheet.** The
button that opened the panel is the one thing on the board that is not behind it, so it must
not be dimmed — and no fill can achieve that, because a 45% black sheet multiplies the lit
cell down along with its neighbours. Nor can the cell be lifted over the top: RN's `zIndex`
orders siblings, and every board control is a grandchild of a view that is `PanelHost`'s
sibling, so no depth given to a cell climbs past the overlay. `Scrim` therefore tiles the
window around `rects.lit` — **the bands must not overlap**, or two 45% sheets crossing draw a
darker seam. `dock` never cuts a hole; it has no sheet to cut.

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

**AND ITS CONFIRM WEARS THE REBOUND PANEL'S SHELL, over the court.** `endGame` was the one
`center` dialog reached from a `court` panel — a paragraph on a different surface arriving in
the middle of a chain that had been tiles the whole way. It is `PHead` + two big tiles now,
KEEP / PLAYING beside END / SAVE + STATS, which is `RebKindPanel` exactly, two columns and
all. **The prose went with the dialog**: it said the clock stops, the game is saved and the
stats screen opens, and the last of those is on screen a second later anyway. The header
carries the SCORELINE in its stead — the one fact worth reading before a game is filed under
it, in the slot where the quarter panel keeps its live clock.

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

## The stats screen

**A FINISHED GAME GOES TO ITS OWN PAGE ON THE SHELF, not to `app/stats.tsx`.** END GAME on
the quarter panel confirms, stops the clock, **saves the game to the shelf**, closes the panel
and **`replace`s the board with `history/[id]`** — the same page the MATCHES row opens, on the
id `saveGame` just handed back. Two screens printing the same hundred numbers a second apart
is the pair that drifts, and `history/[id]` is the superset: it has the play log as well.
**`replace`, not `push`, is the whole of the back arrow's behaviour** — the game is over, so
there is nothing to go back TO, and the arrow falls through the empty stack to the LOBBY.
`saveGame` also **keeps the game it just filed in memory**, because the write is
fire-and-forget and the page reads it back in the same breath.

**`app/stats.tsx` therefore has NO CALLER**, and it is left standing rather than deleted —
the live game's full line, if anything ever wants it again. Nothing routes there today.

**IT WAS THE ONLY PLACE THE LIVE GAME'S FULL LINE LIVED.** The board used to carry a
`totals` panel over it — the box score as a mid-game glance, with PLAY BY PLAY and FULL STATS
under it — opened by tapping the score in the footer. That tap stopped landing, and the whole
chain was cut rather than repaired: `TotalsPanel`, `PlaysPanel` and `BoxScore` are gone, the
score cell is a readout, and a hundred numbers over a live court was never a thing a thumb
reads mid-possession anyway. **The lobby no longer offers it either**; the way to a finished
game's full line is the MATCHES tab,
which is where every other one already lives. For a game that has already left the board it
is `app/history/[id].tsx` — same numbers, read off its own key.

**It is three screens, not one, and that is the whole design.** The full line after the buzzer
is about a hundred numbers, and a hundred numbers in one column is a document rather than a
screen. Two `Seg` strips ask the two questions — the tab strip asks WHICH KIND of number
(TEAM / PLAYERS / ZONES) and the quarter strip asks WHICH PART of the game (ALL, then
`Q1…Q4`, then `OT`, `OT2`, …). Every tab answers both. `Seg` is ONE control used twice
rather than two that drift apart.

**SHOTS AND ZONES WERE TWO TABS AND ARE ONE.** `ShotsTab` drew the marks and `ZonesTab` drew
the buckets those same marks fall into, over the same slice, on the same court, at the same
width — so reading "where did they shoot from" against "how did they shoot from there" meant
flipping between two tabs for one answer. `ZonesTab` is now four blocks, coarse to fine: the
marks, the shooting line, the heat, the table. `ShotsTab.tsx` is GONE, not kept as a second
caller.

**The FG / 2PT / 3PT / FT tiles are the join, and the zone table's own footer was cut for
them.** Both said 2PT, 3PT and FG; the tiles also say FT, which no zone does. One of the two
had to go and it was the copy a screen further down.

**This screen scrolls, and that is not a violation.** The one-viewport rule is about the
BOARD, where a thumb has to find a control without looking. Nobody reads a box score with one
thumb during a possession. The players table also scrolls SIDEWAYS — twenty columns do not
fit a phone and never will.

**`lib/box.ts` is the whole derivation, and nothing on the screen mutates anything.** It is
plain functions over a `GameState`, on the same side of the line as `lib/actions.ts`, so
`npm run check` exercises all of it without React.

**The whole game is the board's counters; a quarter is REBUILT from the log.** `split` is the
one argument every reader takes: a period number, or null. **Null does not re-derive** — it
returns `g.players` untouched, because those counters are what `undo()` keeps correct and
re-deriving them would only invite the two to disagree. A period walks `state.events` and
rebuilds the two things no event counts:

- **the floor** — `player.starter` is who tipped off, and every `substitution` and `foulOut`
  after it moves one name, so replaying them gives the five who were out there at any point.
  That is what a quarter's plus-minus is made of.
- **the clock** — every event carries its period and game clock, so the gap between two
  consecutive events is game time the floor between them played. It is the same second the
  live ticker credits, which is why **the quarters add up to the whole-game minutes** rather
  than competing with them. `selfcheck` asserts that sum.

**One approximation, stated out loud in the code and in the note under the table:** a gap
that spans the end of a period is credited as if the period ran out. That is the right guess
— a quarter almost always ends on 0:00, whereas two minutes with nothing logged in them are
ordinary — but a quarter ENDED EARLY hands its unplayed tail to whoever was on the floor.

**Three numbers are derived from the LOG'S SHAPE rather than from a tap**, and the screen
prints what each one actually measured rather than hiding it:

| shown as | what it really is |
|---|---|
| POINTS FROM TURNOVERS | points after a steal — the only opponent turnover we hear about |
| SECOND CHANCE POINTS | points after one of our offensive rebounds, before the possession ends |
| FAST BREAK POINTS | points within `BREAK_WINDOW` (7s) of a steal or a defensive rebound |

The break window is a window on the GAME CLOCK, not a tap, so a clock left stopped makes it
read high. Do not drop the note under any of the three; the note is what makes printing them
honest.

**POINTS PER POSSESSION is whole-game only.** `possessions` is a plain team counter with no
event behind it, so no quarter can claim a share of it — the quarter view reads `—` and says
why. Anything else would be inventing a denominator.

**The scoreline is built once and read six ways.** `scoreline()` replays every scoring event
into a running `us`/`them` with the absolute game second on it, and BIGGEST LEAD, BIGGEST RUN,
LEAD CHANGES, TIMES TIED and TIME WITH THE LEAD all come off that one array. A margin carried
INTO a quarter counts as a lead held in it; **a run and a lead change do not carry** — both
are things that happen, and one that happened in the first is not a fact about the third.
Going ahead from 0-0 at the tip is not a lead change.

**The two charts reuse the board's, they do not copy it.** THE FLOOR is the same grammar as the
court's own chart — `accent` for a make, `markMiss` for a miss, one `danger` dot for the free
throws however many were taken, because every one of them is logged at `FT_SPOT`. BY ZONE hands
`CourtSvg` a **`heat` fill per zone** rather than carrying the partition a third time; both
mirrored halves take the zone's colour, because a zone is one bucket in `zoneSplits` however
many regions draw it. Opacity carries the percentage and **starts at 0.18, not 0** — a zone
shot five times and missed five times is not the same thing as a zone never shot from.

**The zone numbers live in the table, not on the floor.** Labels on the court were the obvious
thing and do not survive contact with a phone: the corner threes are a 68-unit strip out of
792, so a pill reading `4-9  44%` is wider than the zone it names.

**Neither chart is sized off `m.court`.** That metric is what is left of the BOARD after the
rail and the two action columns are subtracted, and this screen has none of them. ONE box is
measured with `onLayout`, aspect-locked with `COURT_ASPECT`, then capped against the window
height, and **both courts take that one width** — they are the same floor, and a step between
them would read as two different ones.

**`ZonesTab` is on `selfcheck`'s `NO_TEXT_INSIDE` list**, beside `Court.tsx`, for the same
reason: its `accent` and `danger` fills are chart marks — a dot, a dot, a heat — and a mark
has no ink to lose because nothing is written inside it.

## The export

**A FINISHED GAME LEAVES THE APP AS ONE PDF, and the button is the LAST THING ON TEAM /
ALL.** Both halves of that are the decision. TEAM is the tab a scorer is on when the game is
a whole thing rather than a list of names, and **ALL is the only slice `lib/pdf.ts` builds**
— the sheet is the whole game, so offering the button under `Q3` would promise a document
that does not exist. `app/history/[id].tsx` is its one caller; `app/stats.tsx` still has
none of its own.

**`lib/pdf.ts` is a PURE FUNCTION over a `GameState` that returns a string of HTML**, on the
same side of the line as `box.ts` and `actions.ts`: it touches no file, no store and no
React, so `npm run check` renders a real sheet and reads it back. `components/stats/ExportButton.tsx`
is the other half — `expo-print` turns the string into a file and `expo-sharing` hands it
on — and that component is the only part of the export that needs a phone.

**IT IS A FIBA BOX SCORE WITH ONE TEAM ON IT.** The layout is the one every scorer already
knows, and the one difference is the one this app has always had: the other side is a single
integer, so where a FIBA sheet prints a second roster this one prints their score, their
quarters and the two scoreboard numbers a single integer can honestly support. In order: the
scoreline and the period line, the twenty-one-column box score, the four team blocks, and the
zone table.

**IT DRAWS NO FLOOR AND CARRIES NO PLAY LOG, and it did both.** The two courts were on it and
so was every play, oldest first — the one place the document deliberately disagreed with the
screen, because the board's log is newest-first for a scorer checking what just happened.
Both are cut. A chart is a thing you LOOK at and a play log is a hundred rows you SCROLL, and
the screen is where both of those work: `app/history/[id].tsx` has the same floor, tappable,
and the same log, in a list. The sheet is the scorebook — the numbers, in the shape a scorer
already knows — and it is a page and a bit shorter for it. **What survives of the floor is the
ZONE TABLE**, because a shooting split is a number and not a picture; `selfcheck` asserts the
page holds no `<svg>`, no `<path>` and no play line at all, so neither creeps back.

**The numbers are the screen's own.** It calls the same `report(g, null)` the tab above the
button calls, so the sheet cannot drift from what the scorer was just looking at, and
`selfcheck` asserts the headline off the same call. The period line is the one thing walked
separately — `periodScores` needs both sides and neither of the two things `linesFor`
reconstructs — so it is asserted to add up to the score the board kept.

**Every typed string is escaped**, because a club name is free text and a sheet is assembled
by concatenation. `selfcheck` puts `<b>` in the club name and asserts it does not survive.

**THE CREST IS NOT ON IT, and the coaches are not either.** The coaches for the reason they
have never crossed into a game: they are true of the club today, not of a game that is
already over. The crest for a duller one — a `file://` image is not reliably loadable inside
a print sheet, and inlining it would mean a base64 payload measured against `lib/` never
touching a file. Neither is a decision worth reopening without being asked.

**The file is RENAMED before it is shared, and diacritics are FOLDED rather than dropped** —
`KHÁNH HÒA` is `KHANH-HOA`, never `KH-NH-H-A`. `printToFileAsync` returns a random name, and
a scorer picking one game out of a mail thread of six reads the file name, not the first page.
**Sharing is what delivers it**: the print file lives in the cache, which the OS may empty, so
a sheet nobody shared is a sheet nobody has. Where there is no share sheet the system print
dialog stands in, which is also the whole of the web path.

## The club

`store/teamStore.ts` holds what "my team" is besides a list of people: the name, the crest,
the head coach and the assistant. `lib/team.ts` holds the rules, on the same side of the
line as `roster.ts` — **nothing in `lib/` touches a file**, because `expo-file-system`
cannot be imported into the node script `npm run check` runs.

**Only the NAME crosses into a game.** `startGame` copies it the way `buildPlayers` copies a
jersey, so a box score says who it was played by even after the club is renamed. The crest
and the two coaches do not cross: they are true of the club today, not of a game that is
already over. (A coach on a printed box score would be a fair ask; it is not built, and
building it means putting them in `GameState.team`, not reading `teamStore` from a screen.)

**The picker's URI is never what is stored.** `expo-image-picker` hands back a file in the
CACHE, which the OS empties when storage runs low, so `setLogo` copies it into
`Paths.document/team/` and keeps that path. A crest that disappears on a low-storage morning
is worse than no crest.

**The stored file is STAMPED — `crest-<base36>.jpg`, never `logo.png`.** React Native caches
an `<Image>` by its URI, so a second crest written to the same path keeps showing the first
one until the app is killed. A new name each time is the whole fix; the old file is deleted
after the new one is in place, never before, so a failed copy cannot leave the club with no
crest at all.

**And the path is checked on rehydrate, not trusted.** iOS moves the document directory
between installs and a backup restore can bring the record back without the file. A dead URI
renders as a broken square exactly where the monogram would have rendered as a crest, so
`onRehydrateStorage` nulls it if the file is gone.

**`components/ui/Crest.tsx` is one component for the crest AND the monogram**, because they
are one thing — the round mark that says whose board this is — and every screen showing it
must fall back the same way. A club with no crest is the common case on a fresh install and
stays the common case for scorers who never upload one, so `initials()` is not an error
state and is not drawn like one. There is no accent ring; see the lobby's note on accent.

**`ClubCard` IS THE CLUB'S ONLY EDITOR**, and it edits in place: name, both coaches and the
crest, committed as they are typed. `EditTeamPanel` was the form that used to own all four
and is gone — see "Panels". `readOnly` is a third RENDERING and not a second editor: on the
new-game picker every field is text and the crest row is not drawn at all, because a club is
renamed on the team screen and not thirty seconds before tip-off, and a rename mid-picker
would change the name the game is about to be FILED UNDER.

**The crest is applied on PICK, not on SAVE.** The copy is the expensive, failable half, and
holding it behind a button would mean either doing it twice or keeping a cache URI alive
long enough to go stale. CANCEL in `EditTeamPanel` therefore drops the three text fields and
nothing else, and the panel says so out loud rather than leaving it to be discovered.

**The coaches are optional and the name is not.** Most scorers keeping stats for their own
club ARE the coach, and a form that insisted would be asking them to write their own name
down to get past it. The name is required because it is the crest's fallback, the lobby's
subtitle and what every game is filed under.

## The shelf

**A finished game is saved once, by `EndGamePanel`,** after `endGame()` has stamped `ended`
and before the stats screen opens. Clearing the live game does not touch the saved copy —
`startGame` is the only thing that clears the board, and it cannot reach `historyStore`.

**The storage shape is the design, and it is TWO keys, not one.** The index holds summaries
only — a date, a score, a period count — and it is all the lobby and the MATCHES list ever
read. Each full game, which is a few hundred events, lives alone under `gameKey(id)` and is
read when a row is actually tapped. One blob would put thirty games' events behind every
render of the home screen and would walk into Android's AsyncStorage row limit on the way.
**If this ever has to scale further the answer is `expo-sqlite`, not a bigger blob.**

**The cap is 30, and dropping a summary returns it** so the caller can delete its row —
`pushSummary` hands back what fell off, because an index that forgets a game while its key
survives is a leak that only ever grows.

**A summary carries the opponent, the kind and the competition**, so a row can say who it was
against and whether it counts. All three are the optional keys in `GameSummary`; see "The
kind, and the competition".

**The win badge is `accent` and the loss badge is `ink2`, never green and red.** On this
board `danger` means "this will destroy something", and a game you lost is not an error. A
draw takes `ink2` too and says D. Deleting is a LONG PRESS with a confirm; a swipe would be
a second interaction vocabulary for one action that already has a panel waiting for it.

**`app/history/[id].tsx` writes no table of its own.** Its three stat tabs are the stats
screen's own — `TeamTab`, `PlayersTab`, `ZonesTab` — and the log is `PlaysList`, which is now
its ONE caller: `PlaysPanel` was the other and went with the board's box score. All of them
take their data as props precisely so a game read off disk and the live one can be the same
shape. A second table here would only be the one that drifts.

**THERE IS NO BOX SCORE TAB, and `BoxScore` IS GONE.** The saved-game screen had one and it
was the twenty-column table a second time: `PlayersTab` renders `BoxTable` over the same
`Player[]`, and unlike the panel it answered the quarter strip as well. That left the board's
`totals` panel as its one caller, and when that panel was cut the component had none — so it
was deleted rather than kept warm. `BoxTable` is the twenty columns now, everywhere.

**Its header is the OPPONENT, and the scoreline beside it reads THEM : US.** The name is what
a shelf of thirty games is remembered by, where FINAL is a word every one of them would wear;
and the number reads in the order the eye arrives at it, their name then their score. `accent`
still marks OUR score and still only when we won. The date drops to the small line under it as
digits — `numDateLabel`, `19/08/2026` — behind the kind, which stays in front because it is the
one thing on this screen that decides whether the numbers under it are in the season.

## The season

`app/(tabs)/season.tsx` is the one tab that has to read the full games rather than the
index, because a season line is made of stat lines and a summary has none. It loads them
all on mount and re-loads only when the index changes — through **`hooks/useSavedGames.ts`**,
which is one copy of that effect for the two screens that aggregate rather than one each.

**THE SEASON IS THE OFFICIAL GAMES.** `officialIn` is applied by the SCREEN and not inside
`season()`, because a competition's own page filters first and aggregates the same way. A
shelf with games on it but none of them official gets its own empty state rather than a card
full of zeros — that empty state is where the rule is said out loud now.

**THE COUNT UNDER THE TITLE IS GONE**, and it was `6 GAMES OFFICIAL · 2 PRACTICE NOT
COUNTED`. It was a caption explaining an absence nobody had noticed yet: the number of games
NOT on a screen is not a fact about the screen, and the G column in the table already says
how many each player played. It went with the shelf's own `2/30` and the `BY COMPETITION`
heading over the cards — a heading over the first thing on a screen names what the eye has
already read.

**`lib/season.ts` is the whole derivation**, plain functions on the same side of the line as
`box.ts`, and two of its decisions are invisible in the output:

- **Identity is the ROSTER ID.** A game holds copies, so a player renamed or renumbered
  since is still the same person and their line still adds up. The name shown is the one the
  team holds today; a player deleted from the team keeps the name their last game recorded.
- **PER GAME divides by the games the player APPEARED IN**, not by games in the season. A
  twelfth man who turned up twice averages over two — the other reading punishes a player
  for the nights the team played without them. `appeared()` is a start, a second played or
  anything at all on the line, because minutes are clock-driven and a scorer who never
  starts the clock would otherwise zero everybody.

**The table is `components/stats/BoxTable.tsx`, and there is one of it.** A game, a quarter
and a season are the same twenty columns over the same `Player[]` — which is exactly why the
aggregate is built as `Player`s. `gamesFor` inserts one extra column, G, and only the season
passes it: an average without its denominator beside it is a number you cannot argue with.

**A headline card is always TOTALS**, whatever any toggle says — on the lobby, on a
competition's page, anywhere. Points per game computed off per-game numbers divides by the
games twice.

**THE SEASON'S OWN SIX NUMBERS ARE NOT ON THIS SCREEN — they are the card on the LOBBY**, and
nothing heads this one but the word SEASON. A headline belongs on the screen the app opens
on, not on the one you come to when you already want the detail. `app/competition.tsx` keeps its own copy of the six, because that page has no
lobby above it.

**SO THE FIRST THING ON IT IS THE COMPETITIONS, one card each**, and each is a way in
to `app/competition.tsx`. `competitions()` groups the official games on the folded key and
hands each group back with **its games still whole** beside its totals — the card needs the
aggregate and nothing else, but the page behind it re-aggregates on its own TOTALS / PER GAME
toggle, and re-grouping there is how a card and its own page start disagreeing about which
games they are made of. The order is the order the games are handed in, which is newest
first, so the competition being played this month heads the list.

**A competition card's header is the count at the LEFT and the name at the RIGHT.** It is
`Band`, the same strip every card on these screens wears. A name is what you read once to
identify a card; a count is what you compare between them, so the count sits where the eye
already is. The RECORD rides beside the count rather than eating a tile.

**Its three tiles are AVERAGES — points, rebounds and assists a game — and per-game is the
only reading that compares between cards**: a six-game cup run and a twenty-game league
season have totals that cannot be put beside each other. One decimal, not none, because 68
and 68.4 are the same number to a reader and the difference between two competitions is often
the tenth.

**The card PRESSES ON OPACITY rather than on a fill**, which is the one place these screens
depart from the board's convention. A tile is opaque by construction — the 1px seams between
them ARE the grid — so a background change underneath cannot be seen anywhere but the edges.

**`app/competition.tsx` is addressed by the FOLDED KEY, as a query param, not by a `[name]`
segment.** Two reasons that are the same reason twice: a competition's name is typed by hand,
so only the key says that `VBA 2026` and `vba  2026` are one competition — and the group with
no name at all has `''` for a key, which is a perfectly ordinary query param and not a path
segment. The page is the season screen over a slice: the same six headline numbers, the same
toggle and the same `BoxTable`, because a competition line and a season line are the same
twenty columns over the same `Player[]`.

## Rules that look arbitrary and are not

**A roster edit is not a game edit, and `undo()` does not reach it.** Removing a player
from MY TEAM mid-game leaves the game exactly as it was — they stay on the floor, they keep
their stats — because the game holds copies. That is the intended behaviour and the remove
confirm says so out loud. `undo()` covers the game; the roster has its own confirm instead.

**`position` is a LABEL, and now nothing WRITES it either.** Not the picker, not the rail,
not one stat ever read it, and the form that used to set it went with `editPlayer` — the
inline row has four controls and a fifth for a label nobody reads was not one of them. The
key survives in `RosterPlayer` and in `migrateRoster` so a roster persisted with positions is
not quietly thrown away; it simply has no editor. Cut it from the type only on purpose, never
as tidying. **`available` is the one that does something**, and it does exactly one thing: `availableIn` filters the
starter picker, so an unavailable player never reaches `buildPlayers` and the game is played
by the squad that turned up. There is no second check on the board and there must not be —
an injury reported after tip-off is not that game's business. Neither key crosses into a
`Player`: `Player extends Omit<RosterPlayer, 'position' | 'available'>`, and `selfcheck`
asserts that `buildPlayers` leaves both behind.

**The availability dot is a TOGGLE, not decoration.** `components/ui/Dot.tsx`: `ink3` when
available, `danger` when not — the same ink the rail gives a player who cannot take the
floor, because it is the same fact a day earlier. **Its one caller is now the new-game
screen**; the TEAM tab draws the same fact as the row's ✓/— slot instead, and the two agree —
`danger` is what marks the absence in both. It is its own file so `selfcheck`'s
inverted-surface guard can exempt it by name (nothing is written inside a dot, so there is
no ink to lose) without exempting the two screens that use it.

**The starter picker ignores a sixth tap rather than swapping someone out.** Five rail rows
and up to fifteen on the team, so the app cannot pick for the scorer and must not guess
which of the five they meant to drop. A picked row wears the `Jersey`'s `selected` pair and
the word STARTER in accent — never a filled row, for the same reason a selected tile never
took a fill.

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

**AND THE SCORE IS NOW READ AND NOTHING ELSE.** It opened the box-score panel, which was the
board's one door to both the mid-game glance and the play log; the tap stopped showing
anything, and the panel was cut with it rather than repaired — the full line is `/stats` and
each saved game's own page, neither of which has to fit over a live court. So `ScoreCell` is a
plain `View`: no `Press`, no held light, no rect for the scrim to cut around. Two of the
middle third's three cells still open something; the score is not one of them.

**Inside the middle the split is weighted, not equal** — 1.25 / 0.95 / 0.80, summing to 3 so
the block itself does not move. `108 : 99` is six digits and `07:24` is four, so an even split
starves the score. The quarter's old 0.70 was cut for three characters a step *smaller*; now
that it renders at `fsFtr` like the two beside it, `2ND` needs the tenth back, and the clock —
which has the most slack of the three — is where it comes from.

**The clock and the quarter are two cells with a rule between them.** They are two different
controls and were once told apart only by sharing a tint. There is still no PLAY button and
no CLOCK button — the time IS the clock control — but **its state is carried by the ink, not
by a fill**: the red/green gradient behind the pair is gone, a running clock reads **`live`**
and a stopped one reads danger. Stopped is still the base state, so a board nobody has touched
still reads red — which is true. `clockRun` / `clockStop` / `clockInk` went with the
gradient; the palette has no dead entries.

**RUNNING IS `live` AND NOT `accent`, and that is the whole reason `live` exists.** It used to
be `accent`, back when accent was teal and sat opposite red on the wheel. Accent is ORANGE now
and lands about twenty degrees from `danger` — a difference a considered look can make and a
GLANCE FROM THE BENCH cannot, on the one cell that means one thing running and the opposite
stopped. So the teal did not leave the palette when it lost the accent slot; it moved to the
job it was always doing best. See "Theme and sizing".

**AND THAT INK STANDS DOWN WHILE A PANEL IS OPEN**, taking `ink2` for as long as anything is
over the board. The scrim darkens a FILL and not a GLYPH — 45% black turns the footer's white
to grey and leaves every label on it legible — so the clock is the one coloured thing left in
the row, sitting directly beside the quarter cell, which is the one control the scrim actually
cuts a hole for. Two cells reading as lit is one too many, and it was reported as exactly that.
Nobody checks whether the clock is running through a modal; the quarter panel prints the time
in its own header anyway.

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

`constants/options.ts` holds five switches (`ft`, `tap`, `assist`, `bar`, `labels`), stored
in `gameStore` and persisted. **All five are exposed, and in exactly one place**: the gear
in the lobby's top-right opens `SettingsPanel`, one row of the `Seg` the stats screen
already uses per option — no new control and no new modal. **There is no SKIN row**, because there is
no skin to choose. `skin` was another option and the only one ever offered, as an AUTO / LIGHT / DARK
segmented control in Home's top-right corner; it is gone, along with the corner it sat in.
`setOption` remains the only writer, and `onRehydrateStorage` rebuilds `options` from the
names that are left, so a game persisted by a build that still had `skin` does not
carry the stray key forward — and `labels`, which arrived after builds shipped, falls back
to its default there rather than rendering a tile with no label at all. Box-score export and a configurable period length were both
declined; **roster editing was declined and then built** — it is `app/(tabs)/team.tsx` and
`store/rosterStore.ts` now, and it is the reason the store split exists.

**`labels` is what a stat is CALLED once the panel is open — SHORT (`DF`), WORD
(`DEFENSIVE`) or BOTH — and the default is the WORD.** The abbreviations are the
scorebook's, not the scorer's, and a board that answers "which foul was that" with two
letters is asking a question of its own; BOTH is the tile the board drew before the option
existed, and SHORT is for the scorer who has learnt them and wants the biggest target.
**It reaches the PANELS and nothing else**: `FoulKindPanel`, `RebKindPanel` and
`PlayerActionsPanel`, which are the three places a stat is NAMED rather than merely tapped.
The board's own PF / FT / RB keys stay abbreviations whatever it says — the bar is three
cells wide, they are pressed a hundred times a game, and a scorer knows them by shape.

**`lib/labels.ts`'s `tileWords` is the whole rule, and `StatTile` in `components/panels/shell.tsx`
is its ONE reader.** Three panels each branching on the option is three answers waiting to
drift, so the panels pass a `short` and a `full` and never see the option at all. The screen
reader always hears the full word, whatever is drawn: an abbreviation is a thing to look at,
not a thing to say.

**A WORD IN THE BIG SLOT IS NOT AN ABBREVIATION IN IT**, which is what `Tile`'s `word` prop
carries. `DEFENSIVE` at `fs3xl` runs off a tile a third of a 320pt phone's court wide, so
the word drops to `fsXl` (`fs2xl` when `big`), takes two lines, and keeps
`adjustsFontSizeToFit` under it as the floor for the one that still will not fit. Only
`tileWords` sets it.

The team NAME is no longer hardcoded — it is `DEFAULT_TEAM.name` in `lib/team.ts`, which is
what a fresh install starts on and what the editor overwrites. The period length still is.

`SEED_ROSTER` in `constants/game.ts` is the first-run team and **nothing more** — it seeds
`rosterStore` and is never read again. Its ids stay `p${number}` so a game persisted before
the split still lines up with the roster it was built from. The PERIOD LENGTH is still
hardcoded there; the team name is not any more — it is `DEFAULT_TEAM` in `lib/team.ts`, and
the editor overwrites it. Every store persists to AsyncStorage and survives a kill, the
crest as a file beside them; nothing syncs anywhere.

**The opponent is a single number.** `oppScore` and nothing else: no opponent roster, no
opponent shot chart, no opponent fouls.

**The plus-minus has both halves, and the opponent's missing roster was never the
obstacle.** `onCourtPoints` is credited by `creditOnCourt` and `onCourtOppPoints` by
`debitOnCourt`, which `recordOppPoint` calls — the three OPP buttons are tapped while play
is in front of you, so the five standing there are exactly the five the basket went
against. `plusMinus()` is the difference and it is a real +/-. It guards both halves with
`?? 0`, because a game persisted before the against-half existed rehydrates without the key
and a missing number would read `NaN` rather than merely read low. **The board's box-score
panel still shows ON** — the "for" half is what a scorer glances at mid-game — and the
stats screen shows the +/-.

**`ptsOffSteals()` is still partial**, because a steal is the only opponent turnover a
one-team board hears about, and it reads high if an opponent rebound goes unlogged. The
stats screen prints it as POINTS FROM TURNOVERS with the note that says exactly that;
do not print it without the note.

`livestats/AGENTS.md` (loaded via `livestats/CLAUDE.md`) points at the versioned Expo docs —
note it currently names v57 while the project is on **SDK 54**.
