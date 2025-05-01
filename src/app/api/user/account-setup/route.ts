import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { z } from "zod"
import { db } from "@/lib/db" 
import { supabase, supabaseAdmin } from "@/lib/supabase-db"

const AccountSetupSchema = z.object({
  userId: z.string().optional(),
  name: z.string().min(3).max(30).optional(),
  username: z.string().min(3).max(30).optional(),
  bio: z.string().max(160).optional(),
  learningLanguages: z.array(z.string()),
  activeLanguage: z.string().optional(),
  proficiencyLevels: z.record(z.string(), z.string()).optional(),  // Updated to support multiple languages
})

export async function POST(req: Request) {
  try {
    console.log("🔵 Account setup API called");
    
    // Check authentication
    const session = await getServerSession(authOptions)
    console.log("🔵 Session:", JSON.stringify(session?.user || {}, null, 2));
    
    if (!session || !session.user) {
      console.log("🔴 Unauthorized: No session or user");
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const requestBody = await req.json()
    const validationResult = AccountSetupSchema.safeParse(requestBody)

    if (!validationResult.success) {
      console.log("🔴 Validation error:", validationResult.error.issues);
      return NextResponse.json(
        { error: validationResult.error.issues[0].message },
        { status: 400 }
      )
    }

    // Get userId either from the session or from the request body
    const userId = requestBody.userId || session.user.id;
    const { learningLanguages, activeLanguage, proficiencyLevels = {} } = validationResult.data

    console.log("🔵 Processing request with:", { 
      userId, 
      learningLanguages, 
      activeLanguage, 
      proficiencyLevels 
    });

    const existingUser = await db.user.findUnique({
      where: { id: userId },
    })

    if (!existingUser) {
      return NextResponse.json(
        { error: "User not found" },
        { status: 404 }
      )
    }

    // Skip username check as it's now optional
    
    // Use admin client when available, otherwise fallback to regular client
    const client = supabaseAdmin || supabase;
    console.log("🔵 Using Supabase client:", client === supabaseAdmin ? "Admin" : "Regular");

    try {
      // Update user in database with Supabase Client directly - only update languages and account_setup
      console.log("🔵 Updating user with data:", {
        id: userId,
        learning_languages: learningLanguages,
        active_language: activeLanguage,
        onboarded: true,
      });
      
      // First, check the raw schema from Supabase to confirm field names
      console.log("🔵 Checking database schema for users table");
      try {
        const { data: columns, error: columnsError } = await client.from('information_schema.columns')
          .select('column_name, data_type')
          .eq('table_name', 'users');
        
        if (!columnsError && columns) {
          console.log("🔵 Users table columns:", columns);
        }
      } catch (schemaError) {
        console.log("🔴 Unable to get schema:", schemaError);
      }
      
      // Get current user data first to preserve required fields
      console.log("🔵 Fetching current user data for ID:", userId);
      const { data: currentUser, error: fetchError } = await client
        .from('users')
        .select('*')
        .eq('id', userId)
        .single();
        
      if (fetchError) {
        console.log("🔴 Error fetching current user:", fetchError);
        throw fetchError;
      }

      console.log("🔵 Current user data retrieved:", { 
        id: currentUser.id, 
        email: currentUser.email,
        has_password: !!currentUser.password,
        learning_languages: currentUser.learning_languages,
      });
      
      // Simplify the update to test basic functionality
      console.log("🔵 Attempting to update user");
      const updatePayload = {
        // Keep essential fields
        password: currentUser.password,
        email: currentUser.email,
        // Update with new values
        learning_languages: learningLanguages,
        active_language: activeLanguage,
        onboarded: true,
        account_setup: true
      };
      
      console.log("🔵 Update payload:", JSON.stringify(updatePayload, null, 2));
      
      const { data: updatedUser, error } = await client
        .from('users')
        .update(updatePayload)
        .eq('id', userId)
        .select()
        .single();
      
      if (error) {
        console.log("🔴 Supabase update error:", error);
        console.log("🔴 Error details:", JSON.stringify(error, null, 2));
        
        // Try alternative approach with direct SQL
        console.log("🔵 Attempting alternative direct SQL update approach");
        try {
          // First, check if we can query the user at all
          const { data: testUser, error: testError } = await client
            .from('users')
            .select('id')
            .eq('id', userId)
            .single();
            
          if (testError) {
            console.log("🔴 Test query error:", testError);
            throw new Error("Unable to query user: " + testError.message);
          }
          
          console.log("🔵 Test query successful, user exists:", testUser);
          
          // Now try a minimal update first
          const { error: minimalError } = await client
            .from('users')
            .update({ account_setup: true })
            .eq('id', userId);
            
          if (minimalError) {
            console.log("🔴 Minimal update error:", minimalError);
            throw new Error("Minimal update failed: " + minimalError.message);
          }
          
          console.log("🔵 Minimal update successful, now trying language updates");
          
          // Try updating one field at a time
          const { error: langError } = await client
            .from('users')
            .update({ active_language: activeLanguage })
            .eq('id', userId);
            
          if (langError) {
            console.log("🔴 Active language update error:", langError);
            throw new Error("Active language update failed: " + langError.message);
          }
          
          // Now try the array field
          const { error: arrError } = await client
            .from('users')
            .update({ learning_languages: learningLanguages })
            .eq('id', userId);
            
          if (arrError) {
            console.log("🔴 Learning languages update error:", arrError);
            // Continue even if this fails
          }
          
          console.log("🔵 Alternative updates completed");
        } catch (sqlErr) {
          console.error("🔴 Alternative update error details:", sqlErr);
          throw sqlErr;
        }
      }
      
      console.log("🔵 User updated successfully:", updatedUser);
    } catch (dbError) {
      console.error("🔴 Database error details:", dbError);
      console.error("🔴 Full error object:", JSON.stringify(dbError, null, 2));
      return NextResponse.json(
        { error: `Database update failed: ${dbError instanceof Error ? dbError.message : 'Unknown error'}` },
        { status: 500 }
      );
    }

    // Create or update progress records for each learning language
    console.log("🔵 Now updating progress records for languages:", learningLanguages);
    
    for (const language of learningLanguages) {
      try {
        const isActive = language === activeLanguage
        console.log(`🔵 Processing progress for language ${language}, isActive: ${isActive}`);
        
        // Check if a progress record already exists
        console.log(`🔵 Checking for existing progress record...`);
        const { data: existingProgress, error: findError } = await client
          .from('progress')
          .select('id')
          .eq('user_id', userId)
          .eq('language', language)
          .maybeSingle() // Use maybeSingle instead of single to avoid error if not found
        
        if (findError) {
          console.error('🔴 Error finding progress:', findError);
          continue // Skip to next language instead of failing the whole process
        }
        
        // Use the specific proficiency level for this language, or default to 1
        const proficiencyLevel = proficiencyLevels[language] 
          ? parseInt(proficiencyLevels[language]) 
          : (isActive ? 1 : 1);
          
        console.log(`🔵 Setting level ${proficiencyLevel} for language ${language}`);
        
        // Default XP is 0
        const xp = 0
        
        if (existingProgress) {
          console.log(`🔵 Updating existing progress record with ID ${existingProgress.id}`);
          // Update existing progress record
          const { error: updateError } = await client
            .from('progress')
            .update({ 
              level: proficiencyLevel,
              xp: xp
            })
            .eq('id', existingProgress.id)
          
          if (updateError) {
            console.error('🔴 Error updating progress:', updateError);
            // Continue with next language instead of failing completely
          } else {
            console.log(`🔵 Successfully updated progress for ${language}`);
          }
        } else {
          console.log(`🔵 Creating new progress record`);
          // Create new progress record
          const progressPayload = {
            user_id: userId,  // Make sure this matches the column name in Supabase
            language: language,
            level: proficiencyLevel,
            xp: xp
          };
          
          console.log(`🔵 Progress payload:`, progressPayload);
          
          const { data: newProgress, error: insertError } = await client
            .from('progress')
            .insert(progressPayload)
            .select()
          
          if (insertError) {
            console.error('🔴 Error creating progress:', insertError);
            console.error('🔴 Details:', JSON.stringify(insertError, null, 2));
            // Continue with next language instead of failing completely
          } else {
            console.log(`🔵 Successfully created progress for ${language}:`, newProgress);
          }
        }
      } catch (progressError) {
        console.error(`🔴 Error processing progress for language ${language}:`, progressError);
        // Continue with next language instead of failing completely
      }
    }

    console.log("🔵 Account setup completed successfully");
    
    // Get updated user data
    const { data: updatedUserData } = await client
      .from('users')
      .select()
      .eq('id', userId)
      .single();
      
    return NextResponse.json({
      success: true,
      user: updatedUserData,
    })
  } catch (error: unknown) {
    console.error("🔴 Detailed account setup error:", error);
    if (error instanceof Error && error.stack) {
      console.error("🔴 Error stack:", error.stack);
    }
    
    // Final fallback - try a minimal update before giving up
    try {
      console.log("🔵 Final fallback: Setting account_setup to true");
      
      // Need to get these values from the request again
      const requestBody = await req.clone().json();
      
      // Try to get a fresh session in case the original one is no longer valid
      const fallbackSession = await getServerSession(authOptions);
      
      const fallbackUserId = requestBody.userId || (fallbackSession?.user?.id);
      const fallbackActiveLanguage = requestBody.activeLanguage;
      const fallbackProficiencyLevels = requestBody.proficiencyLevels;
      const fallbackLearningLanguages = requestBody.learningLanguages || [];
      
      if (!fallbackUserId) {
        throw new Error("No user ID available for fallback");
      }
      
      await supabase
        .from('users')
        .update({ account_setup: true })
        .eq('id', fallbackUserId);
        
      console.log("🔵 Minimal account setup complete");
      
      // Create minimal progress records
      for (const language of fallbackLearningLanguages) {
        if (fallbackActiveLanguage && fallbackProficiencyLevels && fallbackProficiencyLevels[language]) {
          await supabase
            .from('progress')
            .insert({
              user_id: fallbackUserId,
              language: language,
              level: parseInt(fallbackProficiencyLevels[language]),
              xp: 0
            });
            
          console.log(`🔵 Minimal progress record created for ${language}`);
        }
      }
      
      return NextResponse.json({
        success: true,
        message: "Basic account setup completed",
        user: {
          id: fallbackUserId,
          active_language: fallbackActiveLanguage
        }
      });
    } catch (fallbackError) {
      console.error("🔴 Even fallback failed:", fallbackError);
      // Continue to error response
    }
    
    const errorMessage = error instanceof Error ? error.message : "An unknown error occurred"
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    )
  }
} 