import { Text, View } from 'react-native';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';

import { GATE_PITCH, type Gate } from '../../lib/billing';
import { showPaywall } from '../../hooks/useGate';
import { Btn } from '../panels/shell';
import { Col, Row } from './Row';
import { useMetrics } from '../../theme/metrics';
import { LS_LABEL, LS_TITLE, fUi, ls } from '../../theme/tokens';
import { useTheme } from '../../theme/useTheme';

/**
 * WHAT A LOCKED ROOM LOOKS LIKE.
 *
 * A SCREEN behind the wall gets this instead of its contents — the STATS tab, a
 * competition, a player's season. A CONTROL behind the wall does not: a button
 * keeps its own shape and opens the paywall when pressed, because replacing
 * NEW GAME with a padlock would take the verb off the screen it is the point
 * of.
 *
 * ## IT IS NOT THE PAYWALL'S HEADLINE, AND MUST NOT BECOME IT
 *
 * This screen was once rebuilt around the same big lit UPGRADE TO ACCESS the
 * paywall carries, and it was the wrong screen for it. **The two say different
 * things.** This one is a DOOR: a scorer landed in a room they cannot use, and
 * what it owes them is the room's own name and a way on — which is why the
 * heading is `GATE_PITCH[gate]` and changes per room. The paywall is the OFFER,
 * and it is where the one big verb belongs. Two screens shouting the same
 * sentence one tap apart is the sentence meaning less on both.
 *
 * ## IT DOES NOT BLUR THE NUMBERS BEHIND IT
 *
 * The obvious version of this screen draws the real season under a blur, so the
 * scorer can see the shape of what they are missing. It is not built and should
 * not be: on a free install those numbers do not EXIST — the season is the
 * official games and there are none — so the blur would be over a table of
 * zeros. A teaser that teases nothing is worse than an honest empty room, and
 * building it would mean computing an aggregate specifically to obscure it.
 *
 * ## IT IS THE SAME SHAPE AS THE EMPTY STATES IT SITS BESIDE
 *
 * The STATS tab already has a NO OFFICIAL GAMES YET state and this lands in the
 * same slot: a glyph, a line, a line under it, on the room's own ground with no
 * card around it. A locked room that looked like a different KIND of screen
 * from an empty one would read as an error rather than as a door.
 */
export function Locked({
  gate,
  /** what is actually behind it, in the scorer's words — one short sentence */
  blurb,
}: {
  gate: Gate;
  blurb: string;
}) {
  const m = useMetrics();
  const t = useTheme();

  return (
    <Col gap={m.s4} align="center" style={{ paddingVertical: m.s6, paddingHorizontal: m.s4 }}>
      <View
        style={{
          width: m.tap,
          height: m.tap,
          borderRadius: m.tap / 2,
          alignItems: 'center',
          justifyContent: 'center',
          // the one fill here, and it is the room's own raised cell rather than
          // an accent: a padlock in accent would spend the hue on a thing the
          // scorer cannot have, where every other accent on these screens marks
          // something they can press
          backgroundColor: t.surface2,
        }}
      >
        <MaterialCommunityIcons name="lock-outline" size={m.fsLg} color={t.ink2} />
      </View>

      <Col gap={m.s2} align="center">
        <Text
          style={{
            textAlign: 'center',
            ...fUi(700),
            fontSize: m.fsLg,
            letterSpacing: ls(m.fsLg, LS_TITLE),
            color: t.ink,
          }}
        >
          {GATE_PITCH[gate]}
        </Text>
        <Text
          style={{
            textAlign: 'center',
            ...fUi(400),
            fontSize: m.fsSm,
            lineHeight: m.fsSm * 1.45,
            letterSpacing: ls(m.fsSm, LS_LABEL),
            color: t.ink3,
          }}
        >
          {blurb}
        </Text>
      </Col>

      {/* the verb wears `bloom` like every other button in this app that starts
          something, and it is capped so it does not run the width of a tablet */}
      <Row align="stretch" style={{ width: '100%', maxWidth: 340 }}>
        <Btn label="See plans" variant="bloom" onPress={() => showPaywall(gate)} />
      </Row>
    </Col>
  );
}
