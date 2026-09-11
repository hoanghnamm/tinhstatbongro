import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';

/**
 * THE FILE HALF OF A BACKUP, on a phone. `platform/backupFile.web.ts` is the
 * browser's, and `lib/backup.ts` is the rules both of them carry.
 *
 * The split is the same one `components/stats/ExportButton.tsx` already makes
 * for the PDF: work out WHAT to write with no platform in sight, then hand it
 * to whichever of the two doors this build has. Saving is `Sharing` on a phone
 * and a download in a browser; opening is the system picker on a phone and an
 * `<input type="file">` in a browser. Neither is interesting, and neither
 * belongs anywhere near `lib/`.
 *
 * NOTHING HERE REPORTS A FAULT. `lib/fault.ts` is about the app's own disk
 * failing under it, which is a condition a scorer has to be told about whether
 * or not they were looking. A share sheet that would not open is a thing that
 * happened because they pressed a button, and the button says so itself.
 */

/** Both doors exist on both platforms; the flag is here for the ones that do not. */
export const CAN_OPEN = true;

/**
 * WRITE IT, THEN SHARE IT — and the sharing is what delivers it.
 *
 * The file lands in the cache, which the OS is free to empty, so a sheet
 * nobody shared is a backup nobody has. That is the same reason `ExportButton`
 * shares rather than saves, and it is why the return value is about the SHEET
 * opening rather than about the write.
 */
export async function saveBackup(json: string, name: string): Promise<boolean> {
  const target = new File(Paths.cache, name);
  try {
    if (target.exists) target.delete();
    target.create();
    target.write(json);

    if (!(await Sharing.isAvailableAsync())) return false;
    await Sharing.shareAsync(target.uri, {
      mimeType: 'application/json',
      UTI: 'public.json',
      dialogTitle: 'HoopRec backup',
    });
    return true;
  } catch {
    return false;
  }
}

/**
 * THE SYSTEM PICKER. `null` covers both "they changed their mind" and "it would
 * not open", because the screen says the same thing either way: nothing was
 * restored, the button is still there.
 *
 * `application/json` is asked for and not enforced — some file providers hand
 * back a backup typed as `text/plain` or as nothing at all, and refusing it on
 * a MIME type would refuse a good file. `readBackup` is the real gate and it
 * reads the contents, which is the only thing that actually settles it.
 */
export async function openBackup(): Promise<string | null> {
  try {
    const picked = await File.pickFileAsync({ mimeTypes: ['application/json', 'text/plain'] });
    if (picked.canceled) return null;
    return await picked.result.text();
  } catch {
    return null;
  }
}
