import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams
  const code = searchParams.get('code')
  const returnTo = searchParams.get('return_to') || '/dashboard'

  // Open-redirect safety: ensure returnTo is a relative path starting with /
  const safeReturnTo =
    returnTo.startsWith('/') && !returnTo.startsWith('//') && !returnTo.includes('://')
      ? returnTo
      : '/dashboard'

  if (!code) {
    return NextResponse.redirect(
      new URL(`/auth/callback?error=${encodeURIComponent('Missing authentication handoff code.')}`, request.url)
    )
  }

  const backendUrl = (
    process.env.BACKEND_API_URL ||
    process.env.NEXT_PUBLIC_API_URL ||
    'http://localhost:8000'
  ).replace(/\/$/, '')

  try {
    const exchangeRes = await fetch(`${backendUrl}/api/v1/auth/handoff/exchange`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ handoff_code: code }),
      cache: 'no-store',
    })

    if (!exchangeRes.ok) {
      const errData = await exchangeRes.json().catch(() => ({}))
      const errorMsg = errData.detail || 'Authentication handoff exchange failed.'
      return NextResponse.redirect(
        new URL(`/auth/callback?error=${encodeURIComponent(errorMsg)}`, request.url)
      )
    }

    const data = await exchangeRes.json()
    const sessionToken = data.session_token

    if (!sessionToken) {
      return NextResponse.redirect(
        new URL(`/auth/callback?error=${encodeURIComponent('Authentication server returned no session token.')}`, request.url)
      )
    }

    // Set first-party HTTP-only cookie on the Vercel domain
    const response = NextResponse.redirect(new URL(safeReturnTo, request.url))
    const isHttps = request.url.startsWith('https://') || process.env.NODE_ENV === 'production'

    response.cookies.set('repoautopsy_session', sessionToken, {
      httpOnly: true,
      secure: isHttps,
      sameSite: 'lax',
      path: '/',
      maxAge: 14 * 86400, // 14 days
    })

    return response
  } catch (err: any) {
    return NextResponse.redirect(
      new URL(
        `/auth/callback?error=${encodeURIComponent(err?.message || 'Server error during authentication handoff.')}`,
        request.url
      )
    )
  }
}
