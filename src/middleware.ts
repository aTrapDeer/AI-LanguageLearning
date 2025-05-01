import { withAuth } from "next-auth/middleware"
import { NextResponse } from "next/server"
import { getToken } from "next-auth/jwt"

export default withAuth(
  async function middleware(req) {
    console.log("Middleware executing for path:", req.nextUrl.pathname);
    const token = await getToken({ req })
    const isAuth = !!token
    
    // Check if the user is authenticated
    if (!isAuth) {
      console.log("User not authenticated, redirecting to login");
      return NextResponse.redirect(new URL("/login", req.url))
    }
    
    console.log("User authenticated with ID:", token.id);
    
    // Skip account setup check for account-setup path to avoid redirect loops
    if (req.nextUrl.pathname === "/account-setup") {
      console.log("Already on account setup page, skipping check");
      return NextResponse.next()
    }
    
    // Only check account setup for dashboard and learn paths
    if (["/dashboard", "/learn"].some(path => req.nextUrl.pathname.startsWith(path))) {
      console.log("Checking account setup for protected path:", req.nextUrl.pathname);
      const accountSetupURL = new URL("/account-setup", req.url)
      
      try {
        // Check account setup status
        const apiUrl = `${req.nextUrl.origin}/api/user/account-status?userId=${token.id}`;
        console.log("Fetching account status from:", apiUrl);
        const response = await fetch(apiUrl, {
          method: "GET",
          headers: {
            "Content-Type": "application/json",
            // Include the session token so the API will accept the request
            "Cookie": req.headers.get("cookie") || "",
          },
        })
        
        if (response.ok) {
          const data = await response.json()
          console.log("Account setup status response:", data);
          
          // If account is not set up, redirect to setup
          if (!data.accountSetup) {
            console.log("Account not set up, redirecting to setup page");
            return NextResponse.redirect(accountSetupURL)
          } else {
            console.log("Account already set up, continuing to requested page");
          }
        } else {
          console.error("Error response from account status API:", response.status);
          const errorText = await response.text();
          console.error("Error details:", errorText);
        }
      } catch (error) {
        console.error("Error checking account setup:", error)
      }
    } else {
      console.log("Path not requiring account setup check:", req.nextUrl.pathname);
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