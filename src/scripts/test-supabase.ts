import { supabase } from '../lib/supabase';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

// Get the directory name
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables from .env.local
dotenv.config({ path: path.resolve(__dirname, '../../.env.local') });

async function testSupabaseConnection() {
  try {
    console.log('🔄 Testing Supabase connection...');
    
    // Test basic query
    const { data, error } = await supabase
      .from('users')
      .select('*')
      .limit(5);
    
    if (error) {
      console.error('❌ Connection error:', error);
      return;
    }
    
    console.log('✅ Successfully connected to Supabase!');
    console.log(`Found ${data.length} users`);
    
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
    
  } catch (error) {
    console.error('❌ Test failed:', error);
  }
}

testSupabaseConnection(); 