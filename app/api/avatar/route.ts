import { NextRequest, NextResponse } from 'next/server';
import sharp from 'sharp';
import { eq } from 'drizzle-orm';
import { db } from '@/lib/db/drizzle';
import { users, activityLogs, ActivityType } from '@/lib/db/schema';
import { getUser, getUserWithTeam } from '@/lib/db/queries';
import { putBlob } from '@/lib/blob';

export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
  const user = await getUser();
  if (!user) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  const form = await request.formData();
  const file = form.get('file');
  if (!(file instanceof File)) {
    return NextResponse.json({ error: 'missing file field' }, { status: 400 });
  }

  const buf = Buffer.from(await file.arrayBuffer());

  const optimized = await sharp(buf)
    .resize(256, 256, { fit: 'cover' })
    .webp({ quality: 80 })
    .toBuffer();

  const key = `avatars/${user.id}/${Date.now()}.webp`;
  const { url } = await putBlob(key, optimized, 'image/webp');

  await db.update(users).set({ avatarUrl: url }).where(eq(users.id, user.id));

  const userWithTeam = await getUserWithTeam(user.id);
  if (userWithTeam?.teamId) {
    await db.insert(activityLogs).values({
      teamId: userWithTeam.teamId,
      userId: user.id,
      action: ActivityType.UPDATE_AVATAR,
    });
  }

  return NextResponse.json({ url, bytes: optimized.byteLength });
}
