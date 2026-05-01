import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { eq } from 'drizzle-orm';
import { signToken, verifyToken } from '@/lib/auth/session';
import { db } from '@/lib/db/drizzle';
import { users } from '@/lib/db/schema';

const protectedRoutes = '/dashboard';

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const sessionCookie = request.cookies.get('session');
  const isProtectedRoute = pathname.startsWith(protectedRoutes);

  if (
    request.method === 'POST' &&
    pathname === '/sign-up' &&
    !request.headers.get('next-action')
  ) {
    return NextResponse.rewrite(new URL('/api/sign-up', request.url));
  }

  if (isProtectedRoute && !sessionCookie) {
    return NextResponse.redirect(new URL('/sign-in', request.url));
  }

  let res = NextResponse.next();

  if (sessionCookie) {
    try {
      const parsed = await verifyToken(sessionCookie.value);
      const expiresInOneDay = new Date(Date.now() + 24 * 60 * 60 * 1000);

      if (isProtectedRoute) {
        const rows = await db
          .select({ sv: users.sessionVersion })
          .from(users)
          .where(eq(users.id, parsed.user.id))
          .limit(1);
        const dbVersion = rows[0]?.sv ?? null;
        if (dbVersion === null || dbVersion !== parsed.user.sessionVersion) {
          const redirected = NextResponse.redirect(
            new URL('/sign-in', request.url)
          );
          redirected.cookies.delete('session');
          return redirected;
        }
      }

      if (request.method === 'GET') {
        res.cookies.set({
          name: 'session',
          value: await signToken({
            ...parsed,
            expires: expiresInOneDay.toISOString(),
          }),
          httpOnly: true,
          secure: true,
          sameSite: 'lax',
          expires: expiresInOneDay,
        });
      }
    } catch (error) {
      console.error('Error updating session:', error);
      res.cookies.delete('session');
      if (isProtectedRoute) {
        return NextResponse.redirect(new URL('/sign-in', request.url));
      }
    }
  }

  return res;
}

export const config = {
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico).*)'],
  runtime: 'nodejs',
};
