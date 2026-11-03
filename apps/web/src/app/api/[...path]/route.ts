import { NextRequest, NextResponse } from 'next/server';

const API_BACKEND_URL = process.env.API_BACKEND_URL || 'http://localhost:3001/api/v1';

async function handler(req: NextRequest, { params }: { params: { path: string[] } }) {
  const path = params.path.join('/');
  const searchParams = req.nextUrl.searchParams.toString();
  const targetUrl = `${API_BACKEND_URL}/${path}${searchParams ? `?${searchParams}` : ''}`;

  const headers = new Headers(req.headers);
  headers.delete('host');

  // Automatically attach Bearer token from cookie if not already set
  const authToken =
    req.cookies.get('auth_token')?.value ||
    req.cookies.get('accessToken')?.value;
  if (authToken && !headers.has('authorization')) {
    headers.set('authorization', `Bearer ${authToken}`);
  }

  try {
    const body = ['GET', 'HEAD'].includes(req.method) ? undefined : await req.arrayBuffer();

    const response = await fetch(targetUrl, {
      method: req.method,
      headers,
      body,
      redirect: 'manual',
      // @ts-ignore
      duplex: 'half',
    });

    const responseHeaders = new Headers(response.headers);

    // Sync auth cookie on login
    if (path === 'auth/login' && response.ok) {
      try {
        const cloned = response.clone();
        const json = await cloned.json();
        const token = json?.data?.accessToken || json?.accessToken;
        if (token) {
          responseHeaders.append(
            'Set-Cookie',
            `auth_token=${token}; Path=/; Max-Age=604800; SameSite=Lax`,
          );
        }
      } catch {}
    }

    // Clear auth cookie on logout
    if (path === 'auth/logout') {
      responseHeaders.append(
        'Set-Cookie',
        'auth_token=; Path=/; Max-Age=0; SameSite=Lax',
      );
    }

    return new NextResponse(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers: responseHeaders,
    });
  } catch (error: any) {
    console.error('App Route API proxy error:', error);
    return NextResponse.json(
      {
        error: 'Backend API unreachable',
        message: 'Could not connect to backend at http://127.0.0.1:3001. Ensure the API is running with "npm run dev".',
        details: error.message,
      },
      { status: 502 },
    );
  }
}

export const GET = handler;
export const POST = handler;
export const PUT = handler;
export const PATCH = handler;
export const DELETE = handler;

