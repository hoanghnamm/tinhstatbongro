import { Text } from 'react-native';
import { Col } from '../ui/Row';

import { useMetrics } from '../../theme/metrics';

import { useTheme } from '../../theme/useTheme';
import { fUi, LS_TITLE, ls } from '../../theme/tokens';

/** A title and nothing under it — the line explaining the screen is gone. */
export function EmptyState({ title }: { title: string }) {
  const m = useMetrics();

  const t = useTheme();
  return (
    <Col align="center" gap={m.s2} style={{ paddingVertical: m.s5, paddingHorizontal: m.s3 }}>

      <Text accessibilityRole="header" style={{ ...fUi(600), fontSize: m.fsLg,
        lineHeight: m.fsLg * 1.3, letterSpacing: ls(m.fsLg, LS_TITLE), color: t.ink, textAlign: 'center' }}>
        {title}
      </Text>
    </Col>
  );
}
