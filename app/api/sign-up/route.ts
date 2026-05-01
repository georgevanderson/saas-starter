import { NextRequest, NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import { db } from '@/lib/db/drizzle';
import {
  users,
  teams,
  teamMembers,
  activityLogs,
  ActivityType,
} from '@/lib/db/schema';
import { hashPassword, setSession } from '@/lib/auth/session';

export async function POST(req: NextRequest) {
  let email = '';
  let password = '';
  const ct = req.headers.get('content-type') || '';

  try {
    if (ct.includes('application/json')) {
      const body = await req.json();
      email = String(body.email ?? '').trim();
      password = String(body.password ?? '');
    } else {
      const fd = await req.formData();
      email = String(fd.get('email') ?? '').trim();
      password = String(fd.get('password') ?? '');
    }
  } catch {
    return NextResponse.json({ error: 'invalid body' }, { status: 400 });
  }

  if (!email || !email.includes('@') || password.length < 8) {
    return NextResponse.json({ error: 'invalid input' }, { status: 400 });
  }

  const existing = await db
    .select()
    .from(users)
    .where(eq(users.email, email))
    .limit(1);
  if (existing.length > 0) {
    return NextResponse.json({ error: 'user exists' }, { status: 409 });
  }

  const passwordHash = await hashPassword(password);
  const [createdUser] = await db
    .insert(users)
    .values({ email, passwordHash, role: 'owner' })
    .returning();
  if (!createdUser) {
    return NextResponse.json({ error: 'create failed' }, { status: 500 });
  }

  const [createdTeam] = await db
    .insert(teams)
    .values({ name: `${email}'s Team` })
    .returning();

  await db.insert(teamMembers).values({
    userId: createdUser.id,
    teamId: createdTeam.id,
    role: 'owner',
  });

  await db.insert(activityLogs).values({
    teamId: createdTeam.id,
    userId: createdUser.id,
    action: ActivityType.SIGN_UP,
    ipAddress: '',
  });

  await setSession(createdUser);

  return NextResponse.json({ ok: true, userId: createdUser.id });
}
