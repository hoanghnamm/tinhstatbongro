/**
 * THE FILE HALF OF A BACKUP, in a browser. See `platform/backupFile.ts` for
 * why this is split at all; `lib/backup.ts` is the rules both doors carry.
 *
 * Both halves are a few lines of DOM that have not changed in a decade: an
 * anchor with a `download` attribute over an object URL saves, and a hidden
 * `<input type="file">` opens. There is no library and there is no permission
 * to ask for — the picker IS the permission, which is the same argument
 * `teamStore.setLogo` makes about the crest.
 *
 * THE OBJECT URL IS REVOKED, and it matters more here than it usually does:
 * a backup of a full season is megabytes, and a blob nobody released is
 * megabytes held for the life of the tab — on the one platform whose whole
 * problem is running out of room.
 */

/** Both doors exist here. Kept beside the native flag so callers ask one thing. */
export const CAN_OPEN = true;

/**
 * SAVE, which in a browser means DOWNLOAD.
 *
 * `true` means the download was handed to the browser, not that a file exists:
 * where it lands, and whether the reader confirmed a prompt, is the browser's
 * business and it never tells us. An installed web app on iOS opens the share
 * sheet for this, which is exactly the behaviour a scorer wants.
 */
export function saveBackup(json: string, name: string): Promise<boolean> {
  try {
    const url = URL.createObjectURL(new Blob([json], { type: 'application/json' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = name;
    // Safari will not follow a click on an anchor that is not in the document
    document.body.appendChild(link);
    link.click();
    link.remove();
    // the click has already been dispatched; the browser holds its own
    // reference to the blob, so releasing ours on the next turn is safe
    setTimeout(() => URL.revokeObjectURL(url), 0);
    return Promise.resolve(true);
  } catch {
    return Promise.resolve(false);
  }
}

/**
 * OPEN, and it resolves `null` for a cancel.
 *
 * A file input gives no cancel event in any browser worth relying on, so the
 * promise settles on `change` and on the window regaining focus — the second
 * being the only signal a dismissed picker leaves behind. Two frames of grace
 * before the focus path gives up, because `change` fires just after `focus` on
 * a real pick and settling on focus first would report a cancel that did not
 * happen.
 */
export function openBackup(): Promise<string | null> {
  return new Promise((resolve) => {
    let settled = false;
    const done = (value: string | null): void => {
      if (settled) return;
      settled = true;
      window.removeEventListener('focus', onFocus);
      input.remove();
      resolve(value);
    };

    const input = document.createElement('input');
    input.type = 'file';
    // asked for, not enforced — `readBackup` reads the contents, which is the
    // only thing that settles whether a file is a backup
    input.accept = 'application/json,.json';
    input.style.display = 'none';

    input.addEventListener('change', () => {
      const file = input.files?.[0];
      if (!file) return done(null);
      file
        .text()
        .then((text) => done(text))
        .catch(() => done(null));
    });

    function onFocus(): void {
      // `change` lands just after the window comes back on a real pick
      setTimeout(() => {
        if (!input.files?.length) done(null);
      }, 400);
    }
    window.addEventListener('focus', onFocus);

    document.body.appendChild(input);
    input.click();
  });
}
