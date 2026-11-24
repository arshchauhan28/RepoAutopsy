import { NextRequest, NextResponse } from 'next/server'

const getBackendUrl = () => {
  return (
    process.env.BACKEND_API_URL ||
    process.env.NEXT_PUBLIC_API_URL ||
    'http://localhost:8000'
  ).replace(/\/$/, '')
}

async function handleProxy(request: NextRequest, { params }: { params: Promise<{ path: string[] }> }) {
  const { path } = await params
  const targetPath = path.join('/')
  const backendUrl = getBackendUrl()

  // Construct destination URL with query string
  const search = request.nextUrl.search
  const destination = `${backendUrl}/api/v1/${targetPath}${search}`

  // Clone headers
  const headers = new Headers()
  request.headers.forEach((value, key) => {
    const lowerKey = key.toLowerCase()
    // Do not forward host or connection headers to backend
    if (!['host', 'connection'].includes(lowerKey)) {
      headers.set(key, value)
    }
  })

  // Read first-party session cookie from Vercel domain
  const sessionCookie = request.cookies.get('repoautopsy_session')
  if (sessionCookie?.value) {
    // Deliver identity to FastAPI both in Cookie and Authorization header
    headers.set('Cookie', `repoautopsy_session=${sessionCookie.value}`)
    if (!headers.get('Authorization')) {
      headers.set('Authorization', `Bearer ${sessionCookie.value}`)
    }
  }

  // Preserve client forwarded IP
  const clientIp = request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip')
  if (clientIp) {
    headers.set('X-Forwarded-For', clientIp)
  }

  // Read request body for non-GET/HEAD requests
  let body: BodyInit | null = null
  if (request.method !== 'GET' && request.method !== 'HEAD') {
    try {
      body = await request.arrayBuffer()
    } catch {
      body = null
    }
  }

  try {
    const backendResponse = await fetch(destination, {
      method: request.method,
      headers,
      body,
      cache: 'no-store',
      redirect: 'manual',
    })

    const responseBody = await backendResponse.arrayBuffer()
    const responseHeaders = new Headers()

    backendResponse.headers.forEach((value, key) => {
      const lowerKey = key.toLowerCase()
      if (!['content-encoding', 'content-length'].includes(lowerKey)) {
        responseHeaders.set(key, value)
      }
    })

    const response = new NextResponse(responseBody, {
      status: backendResponse.status,
      statusText: backendResponse.statusText,
      headers: responseHeaders,
    })

    // On logout or 401 unauthenticated, clear the first-party Vercel session cookie
    if (targetPath === 'auth/logout' || (backendResponse.status === 401 && sessionCookie)) {
      response.cookies.delete('repoautopsy_session')
    }

    return response
  } catch (err: any) {
    console.error(`BFF Proxy failed to reach ${destination}:`, err)
    return NextResponse.json(
      { detail: 'Backend service is currently unreachable. Please try again shortly.' },
      { status: 502 }
    )
  }
}

export const GET = handleProxy
export const POST = handleProxy
export const PUT = handleProxy
export const PATCH = handleProxy
export const DELETE = handleProxy
export const HEAD = handleProxy
export const OPTIONS = handleProxy
