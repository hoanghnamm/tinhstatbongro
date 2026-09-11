/**
 * SENDING THE ONE MAIL THIS SERVER SENDS.
 *
 * A `fetch` to Resend and nothing else — no SDK, because an SDK for one POST is
 * a dependency to keep current for as long as the server runs. Swapping Resend
 * for Postmark or SES is this file and this file alone.
 *
 * ## WITH NO KEY THE LINK GOES TO THE LOG
 *
 * Which is exactly what a developer wants and exactly what a production box
 * must not do quietly — so it is loud, and `routes/auth.ts` will only hand a
 * link back over HTTP when `ALLOW_DEV_LOGIN` is set as well.
 */
import { env } from './env.js';

export interface Mail {
  to: string;
  subject: string;
  text: string;
}

export function signInMail(link: string, minutes: number): Omit<Mail, 'to'> {
  // Plain text, no template, no images. It is read on a phone in an arena and
  // it has one job. Sentence case, like everything else in this app.
  return {
    subject: 'Your HoopRec sign-in link',
    text: [
      'Tap to sign in:',
      '',
      link,
      '',
      `The link works once and expires in ${minutes} minutes.`,
      'If you did not ask for it, nothing has happened and you can ignore this.',
    ].join('\n'),
  };
}

export async function send(mail: Mail): Promise<void> {
  if (!env.resendKey) {
    console.warn(`[mail] no RESEND_API_KEY — not sent to ${mail.to}\n${mail.text}`);
    return;
  }
  const response = await fetch('https://api.resend.com/emails', {
    signal: AbortSignal.timeout(10_000),
    method: 'POST',
    headers: {
      authorization: `Bearer ${env.resendKey}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      from: env.mailFrom,
      to: [mail.to],
      subject: mail.subject,
      text: mail.text,
    }),
  });
  if (!response.ok) {
    throw new Error(`mail failed: ${response.status} ${await response.text()}`);
  }
}
