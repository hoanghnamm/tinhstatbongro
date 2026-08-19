import { Text, View } from 'react-native';

import { useAnnounce } from '../../hooks/useAnnounce';
import { useGameStore } from '../../store/gameStore';
import { useUiStore } from '../../store/uiStore';
import { useMetrics } from '../../theme/metrics';
import { LS_LABEL, fNum, fUi, ls } from '../../theme/tokens';
import { useTheme } from '../../theme/useTheme';
import { Seg } from '../stats/parts';
import { Btn, PTitle, Row } from './shell';
import type { Options } from '../../constants/options';

/**
 * The switches, finally given a face.
 *
 * They have been in `gameStore` since the port and nothing has ever written
 * them but their defaults — the web build read them off the query string, and
 * there is no query string here. The gear on HOME is the only way in, and this
 * panel is deliberately the smallest thing that could be one: a row of the
 * `Seg` the stats screen already uses per option, no new control and no new
 * modal. A row is two choices or three; `Seg` takes either.
 *
 * There is no SKIN row. There is one skin, it is light, and the switcher was
 * cut along with the option — see `theme/tokens.ts`. A row here that offered a
 * choice the app cannot make would be worse than no row.
 *
 * BAR is landscape-only and says so: in portrait the action bar and the OPP
 * buttons share one strip and neither has an edge to sit on.
 */
interface Choice {
  key: keyof Options;
  title: string;
  note: string;
  items: { key: Options[keyof Options]; label: string }[];
}

const ROWS: Choice[] = [
  {
    key: 'ft',
    title: 'FREE THROWS',
    note: 'QUICK logs one attempt per tap. TRIP asks how many shots first, then takes them together.',
    items: [
      { key: 'quick', label: 'QUICK' },
      { key: 'trip', label: 'TRIP' },
    ],
  },
  {
    key: 'tap',
    title: 'A TAP ON A PLAYER',
    note: 'STATS opens their stat sheet. SUB goes straight to the substitution.',
    items: [
      { key: 'stats', label: 'STATS' },
      { key: 'sub', label: 'SUBSTITUTE' },
    ],
  },
  {
    key: 'assist',
    title: 'AFTER A MADE SHOT',
    note: 'ASK prompts for the assist every time. SKIP never does.',
    items: [
      { key: 'ask', label: 'ASK' },
      { key: 'skip', label: 'SKIP' },
    ],
  },
  {
    key: 'labels',
    title: 'ON THE PANELS',
    note: 'What a foul, a rebound or a tally is called once the panel is open. WORD spells it out, SHORT is the scorebook abbreviation, BOTH puts the word under it. The board keys stay PF / FT / RB.',
    items: [
      { key: 'full', label: 'WORD' },
      { key: 'short', label: 'SHORT' },
      { key: 'both', label: 'BOTH' },
    ],
  },
  {
    key: 'bar',
    title: 'PF / FT / RB EDGE',
    note: 'Which side the action column takes in landscape; OPP always takes the other.',
    items: [
      { key: 'right', label: 'RIGHT' },
      { key: 'left', label: 'LEFT' },
    ],
  },
];

export function SettingsPanel() {
  const m = useMetrics();
  const t = useTheme();
  const options = useGameStore((s) => s.options);
  const setOption = useGameStore((s) => s.setOption);
  const reset = useUiStore((s) => s.reset);

  useAnnounce('settings');

  return (
    <>
      <PTitle title="SETTINGS" />

      <View style={{ flexDirection: 'column', gap: m.spLg }}>
        {ROWS.map((row) => (
          <View key={row.key} style={{ flexDirection: 'column', gap: m.s2 }}>
            <Text
              style={{
                fontFamily: fNum(500),
                fontSize: m.fsXs,
                letterSpacing: ls(m.fsXs, LS_LABEL),
                color: t.ink2,
              }}
            >
              {row.title}
            </Text>
            <Seg
              items={row.items}
              value={options[row.key]}
              onChange={(k) => setOption(row.key, k)}
            />
            <Text
              style={{
                fontFamily: fUi(400),
                fontSize: m.fsXs,
                lineHeight: m.fsXs * 1.5,
                color: t.ink3,
              }}
            >
              {row.note}
            </Text>
          </View>
        ))}
      </View>

      <Row mt>
        <Btn label="DONE" variant="solid" onPress={reset} />
      </Row>
    </>
  );
}
