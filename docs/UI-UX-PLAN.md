# HoopRec UI/UX refinement plan

Date: 7 September 2026. Updated 8 September 2026: implemented in Lobby, Season and Team. The implementation notes below supersede the original concept and proposed details where stated.

## Implementation notes — 8 September

Latest revision: the user requested removal of the mascot. All mascot rendering, its component, asset and sizing tokens have been removed; the UI refinements remain. Mascot descriptions below document the earlier implementation only.

- The user's seated-basketball reference replaces the earlier scorebook mascot concept. The shipped character is a calm orange basketball with small facial features and dark courtside shoes. One static pose is used at different sizes; additional poses and motion remain optional future work.
- Lobby keeps League and MVP as its only populated blocks, separates loading from empty content, and gives New game a readable label with the existing bloom button treatment. Continue game remains primary during a live game.
- Season has a 700 dp reading cap, a record that moves below the club on narrow screens, explicit competition Per game captions, and player rows that stack identity above aligned values on narrow screens. Derivations and gates are unchanged.
- Team uses at most two columns, persistent coach captions, a focus rule, an explicit unavailable symbol and a small setup companion that hides while editing. Shared roster and club components expose opt-in presentation so onboarding and other callers retain their defaults.
- The three rooms feather the existing bloom through a scoped wrapper. The mascot is a matte raster with an SVG radial mask, not an alpha-cutout PNG. No dependency or board token changes were needed.
- Validation: repository selfcheck and strict TypeScript pass. Browser review covered Team at 390×844 and desktop width; Lobby and locked/populated Season at 320×568; synthetic season averages and long Vietnamese names; typing a spaced Vietnamese name and changing availability. Synthetic fixture route was removed after review. Native keyboard/Done/rotation, large system font scaling, crest-picker errors and first-time scorer usability testing remain device/manual checks; they are not claimed as verified.

The sections below retain the original proposal as design history. See `docs/design/mascot.md` for the shipped artwork and usage.

The goal is a more distinctive, easier-to-read HoopRec for a scorer getting ready courtside, reviewing the season, and maintaining the team. The chosen mascot personality is a **calm courtside companion**.

## Scope

Only these three tabs receive a redesign:

- Lobby: `livestats/app/(tabs)/index.tsx`.
- Season stats: `livestats/app/(tabs)/season.tsx`.
- Team: `livestats/app/(tabs)/team.tsx`.

The live board is excluded, including its controls, panels, geometry, clock, game actions and visual tokens. Matches, single-game stats, competition/player/analysis detail pages, onboarding, picker, paywall, settings and the tab bar also retain their current presentation and behavior. Existing links to those destinations continue to work.

The repository contains substantial pre-existing changes. Implementation must start from that working state and preserve it, rather than reset to HEAD.

## Design direction: a courtside journal

Keep the warm near-black room, orange identity, existing lowercase wordmark, native body typography and tabular numbers. Make the screens recognisable through disciplined composition and an original character. The useful content should carry the design.

- Use stronger hierarchy and controlled widths before adding decoration.
- Preserve the lobby's two primary blocks. Give League and MVP distinct internal compositions within the existing glass-card system.
- Use open rows and spacing for season data and roster editing; avoid adding containers around every value.
- Keep sentence case and the existing semantic color roles. An orange mascot is brand illustration, never an indication of a made shot or a selected player.
- Retain System on iOS, Inter on Android and the current restricted Anton usage. A new font dependency is unnecessary.
- Derive spacing and type from the current metrics ramp. Interactive targets stay at least 48 dp.
- Motion is restrained: existing press feedback first, optional one-shot character movement later, static under reduced motion. No looping bounce, confetti, chat bubbles or decorative counters.

The design-taste skill is applied to the audit, visual hierarchy and restraint. Its website-specific font, component-library and scroll-animation defaults do not replace this React Native app's rules.

## Evidence from the current app

The audit read the three route implementations, their shared components and the relevant sections of `docs/DECISIONS.md`. A desktop web preview was inspected for Team's seeded roster and Season's locked state. Lobby navigation in that fresh preview redirects to onboarding; populated Lobby/Season observations below are code-based, not screenshot-verified. Native phone/keyboard verification belongs to implementation.

| Finding | Why it matters | Priority |
|---|---|---|
| Lobby's primary creation control displays only `+`. | The action is a large target, but its purpose is less explicit to a first-time scorer. | High |
| Lobby derives both absent content and pending saved-game reads as missing League/MVP blocks. | Its empty card can appear while saved games are still loading. | High |
| Season's club and full record share a row; player-stat columns use fixed font multiples. | Long names and narrow, tall phones can leave too little width for identity. | High |
| Competition values are averaged but captioned only Points/Rebounds/Assists. | Users should be able to tell whether a figure is a total or per game. | High |
| Filled coach fields lose their placeholder labels; roster availability is conveyed by a dot and dimming. | Field roles and the availability interaction need clearer explanation. | High |
| Team stretches into three columns at desktop width; Season has no reading-width cap. | Identity, editable fields and associated numbers can become too far apart. | Medium |
| The preview showed a hard lower edge to the bloom. | Reproduce on target devices before deciding whether this is a web rendering issue. | Investigation |

The bloom observation does not justify changing the shared background globally in this task. Any proposed correction must be opt-in to these routes; otherwise record it separately.

## Lobby

Target reading order: **wordmark → League → MVP → game actions → walkthrough**.

1. Keep the column centered and capped at the existing 700-wide measure. Refine card height, spacing and name fit so the game action remains visible on an ordinary phone; scrolling remains the safety net for smaller windows and larger text.
2. Give League a clear competition identity, a dominant points figure and compact supporting record/shooting data. Keep current-competition selection and existing calculations.
3. Let MVP emphasize the player name and jersey identity, with the existing three per-game values aligned below. Avoid tiny type caused by unrestricted name shrinking; define and test a readable minimum and truncation behavior.
4. **Recommended explicit design revision:** show the visible label “New game” in the existing four-fifths button, with the gear remaining in the final fifth. Use the existing `Btn` text mode. This revisits the deliberate plus-only decision in `DECISIONS.md`; it does not require a new button API or changing other plus controls. Update the decision record when implemented.
5. Continue game stays the strongest action while a game is active. Preserve gate-before-confirm order, the current discard confirmation and the availability requirement. Provide a direct Team link beside the existing insufficient-player explanation.
6. Separate pending reads from actual empty data. Reserve the eventual block footprint with static loading shapes or a concise reading state, avoiding an empty-state flash. Tally appears only after the empty state is established.
7. Keep one empty card replacing both content blocks. Use clear copy: “No official games yet” and “Official games build your season. Practice games stay in Matches.” Avoid “at the door,” which describes the app's internal metaphor rather than the user's action.
8. Integrate Tally within that empty card. Once the lobby has data, a small simplified Tally can replace the illustration/icon space in the existing walkthrough row. At most one instance is visible; no third content block and no second logo beside the wordmark.

## Season stats

Target reading order: **club + record → last-game comparison → competitions → players**.

1. Introduce a centered reading measure using route-owned layout. **Recommended explicit design revision:** on compact widths or larger text, move the record beneath the club name within the same header group rather than crushing the name. This revisits the documented single-row arrangement; keep that arrangement at comfortable widths and update the decision record when implemented.
2. Keep the comparison entry visually identifiable through its title, date/opponent context and existing destination. Do not add a second summary dashboard or move full analysis onto this tab.
3. Add one quiet “Per game” caption to each competition summary; keep the three current averages and neutral record. Do not add a totals/per-game switch.
4. Rebalance `PlayerList` around available width. Keep jersey, name, G, PTS, REB and AST, with aligned numeric columns and useful room for names. No horizontal scroll, repeated chevrons, jersey plates or extra statistics.
5. Improve accessible row descriptions to include the player, relevant figures and destination. Keep visual rows spare and their pressed state consistent.
6. Distinguish locked, reading, no games, practice-only and populated states. Locked remains a subscription explanation, not a claim that data is missing. Tally belongs in unlocked no-data states; populated stats remain focused on numbers.
7. Preserve official-only filtering, legacy Unfiled groups and averages over games a player appeared in. No calculation, storage or gate changes; no `PanelHost` on Season.

## Team

Target reading order: **club editor → players + availability explanation → editable roster → Add player**.

1. Retain one `FlatList` with the club editor supplied as a stable header element. Keep the existing inline editing and keyboard-lift model.
2. Add compact persistent captions for Coach and Assistant coach in a Team-only presentation. Keep the club name and crest visually primary. Avoid turning the header into a larger settings form.
3. Place one short availability explanation near the Players heading: “Tap a dot to change availability.” Keep the existing number/name/dot targets. Strengthen non-color state cues and accessible state announcements where needed.
4. Refine focus treatment and baseline alignment. Preserve local text while typing, per-keystroke commits and store reseeding on blur, including accented names and spaces.
5. Use one column on phones and a deliberate two-column roster on wider screens, with a bounded content width. Treat this as an intentional revision of the current unlimited column growth and update the decision record when implemented. Re-test list remount and focus on rotation.
6. Preserve duplicate-number handling and its outside error ring, jerseys 0–99, the roster cap of 20, Add hidden at cap, immediate crest application and the iOS number-pad Done accessory.
7. Tally is reserved for a genuinely empty roster or a compact helper when all seeded names are blank. The helper disappears once useful roster content exists and while the keyboard is open. It must not replace the club crest, occupy a player row or interfere with focus.

## Mascot: Tally, the courtside keeper

Tally is an original concept built around a pocket basketball scorebook: an orange cloth spine, warm paper body, asymmetric folded corner, short graphite pencil and small court shoes. Small attentive eyes and a restrained smile express readiness. A simple half-court mark connects the book to basketball. The working name is provisional.

Reference principles, not character parts to copy:

| Reference | Transferable lesson | Boundary |
|---|---|---|
| [Duolingo: Reshaping Duo](https://blog.duolingo.com/reshaping-duo/) | Develop and test the silhouette before expressive details. | No owl shape, eye mask or matching proportions. |
| [COLLINS: Mailchimp](https://wearecollins.com/case-studies/mailchimp/) | A capable product can retain restrained humor and a distinctive illustration voice. | No Freddie likeness, wink or yellow brand system. |
| [FIBA: JIP's purpose](https://www.fiba.basketball/en/news/celebrate-recycle-and-play-with-the-three-host-countries-of-the-fiba-basketball-world-cup-2023) | Physical features can express a character's role; JIP's back hoop serves its recycling message. | No robot, built-in hoop or tournament styling. |

The concept sheet is saved at `docs/design/tally-concept-v1.png`. It establishes character direction, not a ready-to-import sprite sheet. Generated lettering is presentation copy and does not replace the existing HoopRec wordmark.

Production design package:

- Three consistent poses: ready, greeting and reviewing.
- A simplified small-use version and a one-color silhouette.
- Transparent individual assets, consistent proportions and padding; no baked-in background or text.
- A compact usage guide covering size, clear space, expression and allowed placements.
- Static first release. Consider a short acknowledgment only if it improves a real interaction.

Refinement required from this first sheet: reduce the paper grain and dimensional shading, remove fine shoe detail and make the fold/spine silhouette do more of the recognition work. Check actual 48 dp and larger placements on the existing dark background. Decorative assets remain outside accessibility focus and never intercept touches.

## Implementation sequence and boundaries

| Phase | Deliverable | Completion condition |
|---|---|---|
| 1. Baseline and layout studies | Before captures, state inventory and three phone layout studies with a tablet adaptation. Use disposable fixtures for populated screens. | Every scoped screen has empty, populated and relevant blocked/loading states; no customer data changed. |
| 2. Mascot refinement | Three poses, micro version, silhouette and usage guide. | Recognisable at small sizes, consistent across poses, quiet beside the primary action. |
| 3. Lobby | Revised two-block composition, explicit action and correct loading/empty treatment. | Start/resume paths and guards preserved; no third block. |
| 4. Season | Header, reading width, average labels, compact player rows and state treatment. | Statistics match the baseline; long names fit without horizontal scrolling. |
| 5. Team | Labeled club editor, availability explanation, bounded roster and focus polish. | Fast inline editing and native keyboard behavior preserved. |
| 6. Verification | Visual comparisons, accessibility checks, repository checks and scope diff. | No regression in excluded screens, especially the board. |

Primary existing files are the three tab routes and `components/stats/PlayerList.tsx`, which currently has only the Season caller. New mascot components/assets should be self-contained and imported only by the scoped routes. Keep the imported asset list explicit so unused poses are not bundled unnecessarily.

`ClubCard` also serves the new-game picker, and `RosterRow` also serves onboarding. If changed, add a narrowly scoped, explicit presentation option whose default preserves current behavior. Retain the shared editing implementation; do not fork it. Compare their excluded callers afterward.

Do not restyle `ClubMark`, `Jersey`, `Press`, `Btn`, `stats/parts`, `Bloom`, the theme provider, palette or board metrics globally to obtain this redesign. Use route composition, existing props and additive opt-in presentation only where necessary. Introduce no new dependencies by default. Read the exact Expo v57 documentation before implementation, as required by `livestats/AGENTS.md`.

## Acceptance checklist

- Compare at 320×568, 390×844, 820×1180 and 1180×820, plus larger text, long Vietnamese names and reduced motion. These are test viewports, not new hardcoded UI sizes.
- Lobby: fresh/empty, pending saved-game read, practice-only, populated, active game, fewer than five available players, locked entry and interrupted walkthrough.
- Season: locked, loading, empty, practice-only, one official game, several competitions, Unfiled legacy data, 20 players and fractional averages. Verify every visible number against the same fixture before and after.
- Team: five seeded blank shirts, empty roster, 19→20 players, mixed availability, 0/07/99, blank and colliding numbers, accented/spaced names, and crest pick/cancel/failure. No new delete-player flow.
- Native checks: first and last editable rows, moving focus with the keyboard open, scroll dismissal, iOS Done, Android keyboard resize and rotation. No keyboard covering the focused row.
- Ask a first-time scorer to locate New game, explain a competition average and change availability without coaching. Revise any unclear control; do not claim improvement from appearance alone.
- Run `npm run check` and `npm run typecheck` from `livestats` after implementation. Run Expo Doctor only if dependencies change.
- Compare the light and dark board against pre-change captures and inspect its files for unintended changes. Check Matches, picker and onboarding if any shared opt-in APIs were added.

The original planning pass added only this document, the initial concept image and its prompt. The implementation and validation status is recorded at the top of this document.
