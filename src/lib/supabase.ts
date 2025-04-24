import { createClient } from '@supabase/supabase-js';

// Initialize Supabase client with environment variables
// These should be available from Next.js which automatically loads .env.local
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('Supabase credentials not found in environment variables.');
  console.error('Make sure your .env.local file contains:');
  console.error('NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co');
  console.error('NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key');
  
  // Check if running in Node.js and not in Next.js (like in a script)
  if (typeof window === 'undefined' && !process.env.NEXT_PUBLIC_VERCEL_ENV) {
    console.error('If running a script directly, make sure dotenv is configured to load .env.local');
  }
  
  throw new Error('Supabase credentials not found. Please check your environment variables.');
}

// Regular client for most operations
export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Service role client for admin operations (bypasses RLS)
// This should only be used server-side
export const supabaseAdmin = supabaseServiceKey 
  ? createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    })
  : null; 