import { withAuth } from "next-auth/middleware"
import { NextResponse } from "next/server"
import { getToken } from "next-auth/jwt"

const authSecret = process.env.AUTH_SECRET ?? process.env.NEXTAUTH_SECRET

export default withAuth(
  async function middleware(req) {
    const token = await getToken({ req, secret: authSecret })
    const isAuth = !!token
    
    if (!isAuth) {
      return NextResponse.redirect(new URL("/login", req.url))
    }

    if (req.nextUrl.pathname === "/account-setup") {
      return NextResponse.next()
    }
    
    if (["/dashboard", "/learn"].some(path => req.nextUrl.pathname.startsWith(path))) {
      const accountSetupURL = new URL("/account-setup", req.url)
      
      try {
        const apiUrl = `${req.nextUrl.origin}/api/user/account-status?userId=${token.id}`;
        const response = await fetch(apiUrl, {
          method: "GET",
          headers: {
            "Content-Type": "application/json",
            "Cookie": req.headers.get("cookie") || "",
          },
        })
        
        if (response.ok) {
          const data = await response.json()
          if (!data.accountSetup) {
            return NextResponse.redirect(accountSetupURL)
          }
        } else {
          console.error("Error response from account status API:", response.status);
        }
      } catch (error) {
        console.error("Error checking account setup:", error)
      }
    }
    
    return NextResponse.next()
  },
  {
    callbacks: {
      authorized: ({ token }) => !!token
    },
  }
)

export const config = {
  matcher: [
    // Match dashboard paths
    '/dashboard',
    '/dashboard/:path*',
    // Match learn paths
    '/learn',
    '/learn/:path*',
    // Match account-setup path
    '/account-setup'
  ]
} 