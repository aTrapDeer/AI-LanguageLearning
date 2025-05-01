import { NextResponse } from "next/server"
import { supabaseAdmin } from "@/lib/supabase-db"

export async function GET() {
  try {
    console.log("🔵 Attempting to fix Supabase RLS policies for account setup");
    
    if (!supabaseAdmin) {
      return NextResponse.json({ 
        error: "Supabase admin client not available" 
      }, { status: 500 });
    }
    
    // First, check if the account_setup column exists
    console.log("🔵 Checking if account_setup column exists");
    const { data: columnCheck, error: columnError } = await supabaseAdmin.rpc(
      'test_query',
      { query_text: `
        SELECT column_name, data_type
        FROM information_schema.columns
        WHERE table_name = 'users'
        AND column_name = 'account_setup';
      `}
    );
    
    if (columnError) {
      console.error("🔴 Error checking for account_setup column:", columnError);
      return NextResponse.json({ 
        error: "Failed to check if account_setup column exists", 
        details: columnError.message
      }, { status: 500 });
    }
    
    console.log("🔵 Column check result:", columnCheck);
    
    // If column doesn't exist, add it
    if (!columnCheck || columnCheck.length === 0) {
      console.log("🔵 account_setup column doesn't exist, creating it");
      
      const { error: addColumnError } = await supabaseAdmin.rpc(
        'test_query',
        { query_text: `
          ALTER TABLE users
          ADD COLUMN IF NOT EXISTS account_setup BOOLEAN NOT NULL DEFAULT FALSE;
        `}
      );
      
      if (addColumnError) {
        console.error("🔴 Error adding account_setup column:", addColumnError);
        return NextResponse.json({ 
          error: "Failed to add account_setup column", 
          details: addColumnError.message
        }, { status: 500 });
      }
    }
    
    // Create or replace RLS policy for updating account_setup
    console.log("🔵 Creating or replacing RLS policy for account_setup");
    const { error: policyError } = await supabaseAdmin.rpc(
      'test_query',
      { query_text: `
        DROP POLICY IF EXISTS "Users can update account_setup" ON users;
        
        CREATE POLICY "Users can update account_setup" ON users
        FOR UPDATE TO authenticated
        USING (auth.uid() = id)
        WITH CHECK (auth.uid() = id);
      `}
    );
    
    if (policyError) {
      console.error("🔴 Error creating RLS policy:", policyError);
      return NextResponse.json({ 
        error: "Failed to create RLS policy", 
        details: policyError.message
      }, { status: 500 });
    }
    
    return NextResponse.json({
      success: true,
      message: "Supabase setup fixed for account_setup field"
    });
  } catch (error: any) {
    console.error("🔴 Fix endpoint error:", error);
    return NextResponse.json({ 
      error: "General error fixing Supabase setup", 
      details: error.message || String(error)
    }, { status: 500 });
  }
} 