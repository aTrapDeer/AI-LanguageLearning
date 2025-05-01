import { NextResponse } from "next/server"
import { supabase, supabaseAdmin } from "@/lib/supabase-db"

export async function GET(req: Request) {
  const url = new URL(req.url)
  const userId = url.searchParams.get("userId")

  try {
    console.log("🔵 Testing Supabase connection for user ID:", userId);
    
    if (!userId) {
      return NextResponse.json({ error: "Please provide a userId parameter" }, { status: 400 });
    }
    
    // First, get the user to see if it exists
    console.log("🔵 Fetching user data from Supabase");
    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('*')
      .eq('id', userId)
      .single();
    
    if (userError) {
      console.log("🔴 Error fetching user:", userError);
      return NextResponse.json({ 
        error: "Error fetching user", 
        details: userError.message,
        code: userError.code
      }, { status: 500 });
    }
    
    console.log("🔵 User data:", {
      ...userData,
      password: '[REDACTED]'
    });
    
    // Test updating just the account_setup field directly
    const client = supabaseAdmin || supabase;
    
    console.log("🔵 Testing account_setup update only");
    const { data: updateResult, error: updateError } = await client
      .from('users')
      .update({
        account_setup: true
      })
      .eq('id', userId)
      .select()
      .single();
    
    if (updateError) {
      console.log("🔴 Error updating account_setup:", updateError);
      return NextResponse.json({ 
        error: "Failed to update account_setup", 
        details: updateError.message,
        code: updateError.code
      }, { status: 500 });
    }
    
    // Test updating learning_languages
    console.log("🔵 Testing learning_languages update");
    const { data: langUpdateResult, error: langUpdateError } = await client
      .from('users')
      .update({
        learning_languages: ['en', 'es', 'fr']
      })
      .eq('id', userId)
      .select()
      .single();
    
    if (langUpdateError) {
      console.log("🔴 Error updating learning_languages:", langUpdateError);
      return NextResponse.json({ 
        error: "Failed to update learning_languages", 
        details: langUpdateError.message,
        code: langUpdateError.code
      }, { status: 500 });
    }
    
    return NextResponse.json({
      success: true,
      originalUser: { ...userData, password: '[REDACTED]' },
      accountSetupUpdate: { ...updateResult, password: '[REDACTED]' },
      languagesUpdate: { ...langUpdateResult, password: '[REDACTED]' }
    });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error("🔴 Test endpoint error:", errorMessage);
    return NextResponse.json({
      error: "General error testing Supabase connection",
      details: errorMessage
    }, { status: 500 });
  }
} 