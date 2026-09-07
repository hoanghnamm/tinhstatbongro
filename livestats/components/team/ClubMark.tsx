import { Text } from 'react-native';

import { Crest } from '../ui/Crest';
import { Row } from '../ui/Row';
import { useMetrics } from '../../theme/metrics';
import { LS_TITLE, fDisplay, ls } from '../../theme/tokens';
import { useTeamStore } from '../../store/teamStore';
import { useTheme } from '../../theme/useTheme';

/**
 * THE CLUB AS A ROOM'S OWN HEADER — the crest and the name, in the display face.
 *
 * IT WAS THE LOBBY'S AND IT IS NOT ANY MORE. The crest and the name sat under
 * (and then beside) `hooplog` on the home screen, where they answered a
 * question the lobby was already answering: the mark says what the app is, and
 * the club under it was a second identity on the one screen that has an
 * identity of its own. Here it is the first thing in a room that HEADS
 * NOTHING — MATCHES and STATS both open straight onto their content — so what
 * it says is whose shelf and whose season these numbers are.
 *
 * IT TAKES THE MARK'S OWN SLOT: first child of the screen's padded flow, at the
 * top left, so walking from the lobby into either room puts one lockup exactly
 * where the other one was. It does NOT take the mark's own SIZE. `fs2xl` is the
 * wordmark's step and this sat there for a revision, which made a long club
 * name the loudest thing in a room whose whole content is quiet rows of type —
 * and the wordmark can carry that step because `hooplog` is seven characters
 * the app chose, where a club name is as long as somebody typed it. `fsXl` is
 * the step under it: still the biggest thing on either screen, still plainly a
 * lockup rather than a label, and one line on a narrow phone at a length the
 * display step was already wrapping at.
 *
 * AND IT IS SET IN `fDisplay`, WHICH IS A STATED DEPARTURE. The rule everywhere
 * else is that user text is body text — a name a scorer typed is never set in
 * the app's own logotype face. This is the one place it is, and it is asked for:
 * the club is standing in for the wordmark, in the wordmark's position, so it is
 * set the way the wordmark is set. It does NOT take the lean — `WORDMARK_SLANT`
 * is the lockup's alone and nothing else in the app leans — and it is printed
 * exactly as it was typed, because nothing in this app shouts.
 *
 * The line box is 1.3 for `fDisplay`'s reason: Anton is tall and condensed, and
 * a caps-height box cuts the tails off a descender. It may not go under 1.15.
 *
 * It is a READOUT, not a way in. The club is edited on the TEAM tab, which is
 * one tab away from both callers, and a crest that opened an editor from here
 * is exactly the route that was cut when the lobby's identity block went.
 */
export function ClubMark() {
  const m = useMetrics();
  const t = useTheme();
  const club = useTeamStore((s) => s.profile);

  const fs = m.fsXl;

  return (
    <Row gap={m.s2}>
      <Crest name={club.name} uri={club.logoUri} size={Math.round(fs * 1.05)} />
      <Text
        numberOfLines={1}
        // `flexShrink` AND `minWidth: 0` ARE THE WHOLE OF THE LONG-NAME RULE:
        // the crest is a fixed circle and the name is what gives way, so a club
        // with a long name ellipsises rather than pushing its own mark off the
        // screen.
        style={{
          flexShrink: 1,
          minWidth: 0,
          ...fDisplay(),
          fontSize: fs,
          lineHeight: fs * 1.3,
          letterSpacing: ls(fs, LS_TITLE),
          color: t.ink,
        }}
      >
        {club.name}
      </Text>
    </Row>
  );
}
