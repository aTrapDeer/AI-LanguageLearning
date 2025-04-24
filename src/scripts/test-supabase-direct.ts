import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { createClient } from '@supabase/supabase-js';

// Get the directory name
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables from .env.local first
dotenv.config({ path: path.resolve(__dirname, '../../.env.local') });

// Log whether we have the credentials
console.log('Supabase URL defined:', !!process.env.NEXT_PUBLIC_SUPABASE_URL);
console.log('Supabase Anon Key defined:', !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

// Create the client directly
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('Missing Supabase credentials. Check your .env.local file.');
  process.exit(1);
}

console.log('Supabase URL:', supabaseUrl);
console.log('Creating Supabase client...');

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function testTables() {
  try {
    // Test table existence
    const tables = [
      'users',
      'accounts',
      'sessions',
      'verification_tokens',
      'progress',
      'learning',
      'chats',
      'vocabulary',
      'visual_learning',
      'speech'
    ];
    
    console.log('\n🔍 Checking database tables:');
    
    for (const table of tables) {
      const { error } = await supabase
        .from(table)
        .select('*')
        .limit(1);
      
      if (error) {
        console.error(`❌ Table '${table}' error:`, error.message);
      } else {
        console.log(`✅ Table '${table}' exists`);
      }
    }
    
    console.log('\n✨ Supabase connection test completed!');
  } catch (error) {
    console.error('Error testing tables:', error);
  }
}

testTables(); 