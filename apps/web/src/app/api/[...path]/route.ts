import { NextRequest, NextResponse } from 'next/server';
import { normalizeApiUrl } from '@/config/companies';

const DEFAULT_BACKEND_URL = process.env.API_BACKEND_URL || 'http://localhost:3001/api/v1';

async function handler(req: NextRequest, { params }: { params: { path: string[] } }) {
  const path = params.path.join('/');
  const searchParams = req.nextUrl.searchParams.toString();

  // Dynamic Multi-Company Backend URL routing:
  // Reads from cookie or header, falling back to process.env.API_BACKEND_URL
  const cookieBackend = req.cookies.get('api_backend_url')?.value;
  const headerBackend = req.headers.get('x-backend-url');
  const rawBaseUrl = cookieBackend || headerBackend || DEFAULT_BACKEND_URL;
  const baseUrl = normalizeApiUrl(rawBaseUrl);

  const targetUrl = `${baseUrl}/${path}${searchParams ? `?${searchParams}` : ''}`;

  const headers = new Headers(req.headers);
  headers.delete('host');

  // Forward selected company code if present
  const companyCode = req.cookies.get('company_code')?.value || req.headers.get('x-company-code');
  if (companyCode && !headers.has('x-company-code')) {
    headers.set('x-company-code', companyCode);
  }

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
    console.error(`App Route API proxy error targeting ${targetUrl}:`, error);
    return NextResponse.json(
      {
        error: 'Backend API unreachable',
        message: `Could not connect to backend server at ${baseUrl}. Please ensure the server is running and reachable from your network.`,
        targetUrl,
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

