import 'server-only';
import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);

export async function sendEmail(opts: {
  to: string;
  subject: string;
  html: string;
}) {
  const from = process.env.RESEND_FROM_EMAIL || 'onboarding@resend.dev';
  const { data, error } = await resend.emails.send({
    from,
    to: opts.to,
    subject: opts.subject,
    html: opts.html,
  });
  if (error) {
    console.error('resend send error', error);
    throw new Error(error.message || 'resend failed');
  }
  return data;
}
