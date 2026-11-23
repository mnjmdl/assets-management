import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
  const { pathname, search } = request.nextUrl;

  // 1. Allow public static assets, fonts, icons, manifest, service worker, workflow guide, and Next.js internals
  if (
    pathname.startsWith('/_next') ||
    pathname.startsWith('/icons') ||
    pathname.startsWith('/manifest') ||
    pathname.startsWith('/workflow') ||
    pathname === '/sw.js' ||
    pathname === '/offline.html' ||
    pathname === '/favicon.ico' ||
    pathname === '/apple-icon.png' ||
    pathname === '/app-icon.png'
  ) {
    return NextResponse.next();
  }

  // 2. Read authorization cookie or header
  const authHeader = request.headers.get('authorization');
  const token =
    request.cookies.get('auth_token')?.value ||
    request.cookies.get('accessToken')?.value ||
    (authHeader && authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null);

  // 3. Allow public auth & health check endpoints
  if (
    pathname.startsWith('/api/auth/login') ||
    pathname.startsWith('/api/auth/register') ||
    pathname.startsWith('/api/auth/refresh') ||
    pathname.startsWith('/api/health')
  ) {
    return NextResponse.next();
  }

  // 4. Handle Login Page
  if (pathname === '/login') {
    const isSwitching = request.nextUrl.searchParams.get('switch') === 'true';
    // If already authenticated with a valid token and not intentionally switching company, redirect to dashboard
    if (token && !isSwitching) {
      return NextResponse.redirect(new URL('/', request.url));
    }
    return NextResponse.next();
  }

  // 5. Block all other URLs if not authenticated
  if (!token) {
    // API routes: return 401 Unauthorized JSON
    if (pathname.startsWith('/api/')) {
      return NextResponse.json(
        {
          success: false,
          statusCode: 401,
          message: 'Unauthorized: Authentication required. Please sign in.',
        },
        { status: 401 },
      );
    }

    // Web Pages: redirect to /login with target redirect parameter
    const loginUrl = new URL('/login', request.url);
    const redirectPath = pathname + search;
    if (redirectPath !== '/') {
      loginUrl.searchParams.set('redirect', redirectPath);
    }
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Match all request paths except static files
     */
    '/((?!_next/static|_next/image|favicon.ico).*)',
  ],
};

