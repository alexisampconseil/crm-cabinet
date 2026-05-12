import { createServerClient } from '@supabase/ssr'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

// Routes publiques accessibles sans authentification
const PUBLIC_PATHS = ['/login', '/kyc']

function isPublicPath(pathname: string): boolean {
  return PUBLIC_PATHS.some(p => pathname === p || pathname.startsWith(p + '/'))
}

// Routes API — s'authentifient elles-mêmes
function isApiPath(pathname: string): boolean {
  return pathname.startsWith('/api/')
}

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl

  // Laisser passer les API routes (elles vérifient leur propre auth)
  if (isApiPath(pathname)) return NextResponse.next()

  // Laisser passer les routes publiques
  if (isPublicPath(pathname)) {
    // Si déjà authentifié et sur /login → rediriger vers le bon espace
    if (pathname === '/login') {
      const roleCookie = request.cookies.get('amp_role')?.value
      if (roleCookie === 'conseiller') {
        return NextResponse.redirect(new URL('/dashboard', request.url))
      }
      if (roleCookie === 'client') {
        return NextResponse.redirect(new URL('/tableau-de-bord', request.url))
      }
    }
    return NextResponse.next()
  }

  // Vérification de la session Supabase
  let response = NextResponse.next({
    request: { headers: request.headers },
  })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll: (cookiesToSet) => {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          response = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    const loginUrl = new URL('/login', request.url)
    loginUrl.searchParams.set('next', pathname)
    return NextResponse.redirect(loginUrl)
  }

  // Vérification de rôle par zone
  const roleCookie = request.cookies.get('amp_role')?.value

  const isConseillerRoute =
    pathname.startsWith('/dashboard') ||
    pathname.startsWith('/clients') ||
    pathname.startsWith('/conformite') ||
    pathname.startsWith('/catalogue') ||
    pathname.startsWith('/portefeuilles') ||
    pathname.startsWith('/agenda') ||
    pathname.startsWith('/documents') ||
    pathname.startsWith('/reporting')

  const isClientRoute =
    pathname.startsWith('/tableau-de-bord') ||
    pathname.startsWith('/mon-kyc') ||
    pathname.startsWith('/mes-documents') ||
    pathname.startsWith('/messagerie')

  if (isConseillerRoute && roleCookie === 'client') {
    return NextResponse.redirect(new URL('/tableau-de-bord', request.url))
  }

  if (isClientRoute && roleCookie === 'conseiller') {
    return NextResponse.redirect(new URL('/dashboard', request.url))
  }

  return response
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon\\.ico|.*\\.svg$|.*\\.png$|.*\\.jpg$|.*\\.ico$).*)',
  ],
}
