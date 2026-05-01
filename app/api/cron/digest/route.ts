import { NextRequest, NextResponse } from 'next/server';
import { and, eq, gte, isNotNull, isNull, desc } from 'drizzle-orm';
import { db } from '@/lib/db/drizzle';
import { activityLogs, users, teamMembers } from '@/lib/db/schema';
import { sendEmail } from '@/lib/email';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function isAuthorized(request: NextRequest) {
  const expected = process.env.CRON_SECRET;
  if (!expected) return false;
  const auth = request.headers.get('authorization') ?? '';
  return auth === `Bearer ${expected}`;
}

export async function GET(request: NextRequest) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  const since = new Date(Date.now() - 24 * 60 * 60 * 1000);

  const recipients = await db
    .selectDistinct({
      userId: users.id,
      email: users.email,
      name: users.name,
    })
    .from(users)
    .innerJoin(teamMembers, eq(teamMembers.userId, users.id))
    .where(isNull(users.deletedAt));

  let sent = 0;
  for (const r of recipients) {
    const rows = await db
      .select({
        action: activityLogs.action,
        timestamp: activityLogs.timestamp,
      })
      .from(activityLogs)
      .where(
        and(eq(activityLogs.userId, r.userId), gte(activityLogs.timestamp, since))
      )
      .orderBy(desc(activityLogs.timestamp))
      .limit(50);

    const items = rows
      .map(
        (row) =>
          `<li><code>${escape(row.action)}</code> &middot; ${row.timestamp.toISOString()}</li>`
      )
      .join('');

    const html = `
      <h2>Your daily activity digest</h2>
      <p>Hi ${escape(r.name ?? r.email)},</p>
      <p>Activity in the last 24 hours:</p>
      <ul>${items || '<li><em>No activity recorded.</em></li>'}</ul>
    `;

    try {
      await sendEmail({
        to: r.email,
        subject: 'Your daily activity digest',
        html,
      });
      sent++;
    } catch (err) {
      console.error('digest send failed for', r.email, err);
    }
  }

  return NextResponse.json({ recipients: recipients.length, sent });
}

function escape(s: string) {
  return s.replace(/[&<>"']/g, (c) =>
    c === '&'
      ? '&amp;'
      : c === '<'
        ? '&lt;'
        : c === '>'
          ? '&gt;'
          : c === '"'
            ? '&quot;'
            : '&#39;'
  );
}
