import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { supabase } from "@/lib/supabase-db"

export async function GET(req: Request) {
  try {
    console.log("Account status API called");
    
    // Check authentication
    const session = await getServerSession(authOptions)
    console.log("Session object:", JSON.stringify(session?.user || {}, null, 2));
    
    if (!session || !session.user) {
      console.log("Unauthorized: No session or user");
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Get userId from query params
    const url = new URL(req.url)
    const userId = url.searchParams.get("userId")
    console.log("Checking account status for userId:", userId);

    // Verify user has permission (can only check own account)
    if (!userId) {
      console.log("No userId provided in query");
      return NextResponse.json({ error: "User ID is required" }, { status: 400 });
    }
    
    // Check if the userId matches the authenticated user's ID or bypass check in development
    const isAuthMatch = userId === session.user.id;
    console.log("Authorization check:", { requestUserId: userId, sessionUserId: session.user.id, match: isAuthMatch });
    
    if (!isAuthMatch) {
      console.log("Permission denied. Session user ID:", session.user.id, "Requested user ID:", userId);
      return NextResponse.json(
        { error: "You don't have permission to access this account" },
        { status: 403 }
      )
    }

    // Get user account setup status directly from Supabase
    console.log("Fetching from Supabase users table for ID:", userId);
    const { data, error } = await supabase
      .from('users')
      .select('account_setup')
      .eq('id', userId)
      .single();

    console.log("Supabase response:", { data, error: error ? error.message : null });

    if (error) {
      if (error.code === 'PGRST116') {
        console.log("User not found in database");
        return NextResponse.json({ error: "User not found" }, { status: 404 })
      }
      throw error;
    }

    // Check if account_setup field exists and get its value
    const accountSetup = data?.account_setup !== undefined ? !!data.account_setup : false;
    console.log("Account setup value:", accountSetup);

    // Return the response with CORS headers to allow the middleware to access it
    const response = NextResponse.json({ accountSetup });
    response.headers.append("Access-Control-Allow-Origin", "*");
    response.headers.append("Access-Control-Allow-Methods", "GET, OPTIONS");
    response.headers.append("Access-Control-Allow-Headers", "Content-Type, Authorization");
    
    return response;
  } catch (error) {
    console.error("Error checking account status:", error)
    return NextResponse.json(
      { error: "Error checking account status" },
      { status: 500 }
    )
  }
} 