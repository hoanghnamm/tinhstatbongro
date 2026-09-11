import { useState } from 'react';
import { Platform, Text } from 'react-native';
import { File, Paths } from 'expo-file-system';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';

import { gameReportHtml, reportFileName } from '../../lib/pdf';
import { Btn } from '../panels/shell';
import { Col, Row } from '../ui/Row';
import { useMetrics } from '../../theme/metrics';
import { LS_MICRO, fUi, ls } from '../../theme/tokens';
import { useTheme } from '../../theme/useTheme';
import type { GameState } from '../../types';

/** A4 in points, which is what `printToFileAsync` measures a page in. */
const A4 = { width: 595, height: 842 };

/**
 * EXPORT PDF — the one control on the stats screens that writes anything.
 *
 * It sits at the FOOT OF TEAM / ALL and nowhere else, and both halves of that
 * are deliberate. TEAM is the tab a scorer is on when the game is a whole
 * thing rather than a list of names, and ALL is the only slice the sheet is
 * built from — `lib/pdf.ts` prints the whole game, so offering the button
 * under a quarter would promise a document that does not exist. It is the last
 * thing on the tab because it is the last thing you do with a finished game.
 *
 * The work is three steps and each one can fail on somebody's phone, so each
 * is caught rather than assumed: build the HTML (pure, and the only step that
 * cannot fail), print it to a file, and hand that file to the share sheet.
 * **Sharing is what actually delivers it** — the print file lives in the cache
 * and the OS may empty it, so a sheet nobody shared is a sheet nobody has.
 * Where there is no share sheet the system print dialog stands in, which is
 * also the whole of the web path.
 *
 * The file is RENAMED before it is shared. `printToFileAsync` returns a random
 * name, and a scorer picking one of six games out of a mail thread reads the
 * file name, not the first page.
 */
export function ExportButton({ game }: { game: GameState }) {
  return <PdfExportButton build={() => gameReportHtml(game)} fileName={reportFileName(game)} title="Game report" description="The whole game: box score, team line and zones" />;
}

export function PdfExportButton({ build, fileName, title, description }: {
  build: () => string; fileName: string; title: string; description?: string;
}) {
  const m = useMetrics();
  const t = useTheme();
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);

  const run = async (): Promise<void> => {
    if (busy) return;
    setBusy(true);
    setFailed(false);
    try {
      const html = build();
      // no file system to print into, so the browser's own dialog is the export
      if (Platform.OS === 'web') {
        await Print.printAsync({ html });
        return;
      }

      const { uri } = await Print.printToFileAsync({ html, ...A4 });
      let out = uri;
      try {
        const target = new File(Paths.cache, fileName);
        if (target.exists) target.delete();
        new File(uri).move(target);
        out = target.uri;
      } catch {
        /* a sheet under a random name is worth more than no sheet */
      }

      if (await Sharing.isAvailableAsync())
        await Sharing.shareAsync(out, {
          mimeType: 'application/pdf',
          UTI: 'com.adobe.pdf',
          dialogTitle: title,
        });
      else await Print.printAsync({ html });
    } catch {
      setFailed(true);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Col gap={m.s2} style={{ marginBottom: m.spLg }}>
      <Row>
        <Btn
          label={busy ? 'Preparing…' : 'Export PDF'}
          variant="accent"
          disabled={busy}
          onPress={() => void run()}
        />
      </Row>
      {(failed || description) && <Text
        style={{
          textAlign: 'center',
          ...fUi(500),
          fontSize: m.fsXs,
          letterSpacing: ls(m.fsXs, LS_MICRO),
          color: failed ? t.danger : t.ink3,
        }}
      >
        {failed
          ? 'The sheet could not be made — try again'
          : description}
      </Text>}
    </Col>
  );
}
