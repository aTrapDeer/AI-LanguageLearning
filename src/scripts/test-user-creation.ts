import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { db } from '../lib/db';
import bcrypt from 'bcryptjs';

// Get the directory name
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables from .env.local
dotenv.config({ path: path.resolve(__dirname, '../../.env.local') });

/**
 * Test script that creates a user in Turso
 * This uses the app's database adapter to verify CRUD behavior
 */
async function createTestUser() {
  try {
    console.log('🔄 Creating test user in Turso database...');
    
    // Generate hashed password
    const hashedPassword = await bcrypt.hash('TestPassword123', 10);
    
    // Create test user data
    const userData = {
      name: 'Test User',
      email: `test${Date.now()}@example.com`,
      password: hashedPassword,
      nativeLanguage: 'English',
      activeLanguage: 'en',
      learningLanguages: ['fr', 'es'],
      accountSetup: false,
    };
    
    // Create user using the adapter
    const newUser = await db.user.create({
      data: userData
    });
    
    console.log('✅ Test user created successfully!');
    console.log('User ID:', newUser.id);
    console.log('Email:', newUser.email);
    
    // Create some progress for this user
    const progressData = {
      userId: newUser.id,
      language: 'fr',
      level: 1,
      xp: 0
    };
    
    const progress = await db.progress.findFirst({
      where: {
        userId: newUser.id,
        language: 'fr'
      }
    });
    
    if (!progress) {
      console.log('Creating progress record for user...');
      const newProgress = await db.progress.create({
        data: progressData
      });
      console.log('✅ Progress created:', newProgress.id);
    } else {
      console.log('✅ Progress already exists:', progress.id);
    }
    
  } catch (error) {
    console.error('❌ Failed to create test user:', error);
  }
}

createTestUser(); 