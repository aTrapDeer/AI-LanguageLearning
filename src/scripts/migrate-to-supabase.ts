import { PrismaClient } from '@prisma/client';
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Supabase credentials not found. Please check your .env file.');
  process.exit(1);
}

// Initialize Prisma and Supabase clients
const prisma = new PrismaClient();
const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function migrateUsers() {
  console.log('🔄 Migrating users...');
  const users = await prisma.user.findMany();
  
  for (const user of users) {
    const { error } = await supabase.from('users').insert({
      id: user.id,
      name: user.name,
      email: user.email,
      password: user.password,
      native_language: user.nativeLanguage,
      active_language: user.activeLanguage,
      learning_languages: user.learningLanguages,
      created_at: user.createdAt.toISOString(),
      updated_at: user.updatedAt.toISOString()
    });

    if (error) {
      console.error(`Failed to migrate user ${user.id}:`, error);
    }
  }
  
  console.log(`✅ Migrated ${users.length} users`);
}

async function migrateAccounts() {
  console.log('🔄 Migrating accounts...');
  const accounts = await prisma.account.findMany();
  
  for (const account of accounts) {
    const { error } = await supabase.from('accounts').insert({
      id: account.id,
      user_id: account.userId,
      type: account.type,
      provider: account.provider,
      provider_account_id: account.providerAccountId,
      refresh_token: account.refresh_token,
      access_token: account.access_token,
      expires_at: account.expires_at,
      token_type: account.token_type,
      scope: account.scope,
      id_token: account.id_token,
      session_state: account.session_state
    });

    if (error) {
      console.error(`Failed to migrate account ${account.id}:`, error);
    }
  }
  
  console.log(`✅ Migrated ${accounts.length} accounts`);
}

async function migrateSessions() {
  console.log('🔄 Migrating sessions...');
  const sessions = await prisma.session.findMany();
  
  for (const session of sessions) {
    const { error } = await supabase.from('sessions').insert({
      id: session.id,
      session_token: session.sessionToken,
      user_id: session.userId,
      expires: session.expires.toISOString()
    });

    if (error) {
      console.error(`Failed to migrate session ${session.id}:`, error);
    }
  }
  
  console.log(`✅ Migrated ${sessions.length} sessions`);
}

async function migrateProgress() {
  console.log('🔄 Migrating progress...');
  const progressItems = await prisma.progress.findMany();
  
  for (const progress of progressItems) {
    const { error } = await supabase.from('progress').insert({
      id: progress.id,
      user_id: progress.userId,
      language: progress.language,
      level: progress.level,
      xp: progress.xp,
      created_at: progress.createdAt.toISOString(),
      updated_at: progress.updatedAt.toISOString()
    });

    if (error) {
      console.error(`Failed to migrate progress ${progress.id}:`, error);
    }
  }
  
  console.log(`✅ Migrated ${progressItems.length} progress items`);
}

async function migrateLearning() {
  console.log('🔄 Migrating learning items...');
  const learningItems = await prisma.learning.findMany();
  
  for (const item of learningItems) {
    const { error } = await supabase.from('learning').insert({
      id: item.id,
      user_id: item.userId,
      language: item.language,
      word: item.word,
      translation: item.translation,
      difficulty: item.difficulty,
      last_recalled: item.lastRecalled.toISOString(),
      next_review: item.nextReview.toISOString(),
      success_count: item.successCount,
      failure_count: item.failureCount,
      notes: item.notes,
      tags: item.tags,
      created_at: item.createdAt.toISOString(),
      updated_at: item.updatedAt.toISOString()
    });

    if (error) {
      console.error(`Failed to migrate learning item ${item.id}:`, error);
    }
  }
  
  console.log(`✅ Migrated ${learningItems.length} learning items`);
}

async function migrateChats() {
  console.log('🔄 Migrating chats...');
  const chats = await prisma.chat.findMany();
  
  for (const chat of chats) {
    const { error } = await supabase.from('chats').insert({
      id: chat.id,
      user_id: chat.userId,
      language: chat.language,
      message: chat.message,
      response: chat.response,
      audio_url: chat.audioUrl,
      created_at: chat.createdAt.toISOString()
    });

    if (error) {
      console.error(`Failed to migrate chat ${chat.id}:`, error);
    }
  }
  
  console.log(`✅ Migrated ${chats.length} chats`);
}

async function migrateVocabulary() {
  console.log('🔄 Migrating vocabulary...');
  const vocabItems = await prisma.vocabulary.findMany();
  
  for (const vocab of vocabItems) {
    const { error } = await supabase.from('vocabulary').insert({
      id: vocab.id,
      user_id: vocab.userId,
      language: vocab.language,
      word: vocab.word,
      translation: vocab.translation,
      mastery: vocab.mastery,
      last_reviewed: vocab.lastReviewed?.toISOString() || null,
      next_review: vocab.nextReview?.toISOString() || null,
      created_at: vocab.createdAt.toISOString()
    });

    if (error) {
      console.error(`Failed to migrate vocabulary ${vocab.id}:`, error);
    }
  }
  
  console.log(`✅ Migrated ${vocabItems.length} vocabulary items`);
}

async function migrateVisualLearning() {
  console.log('🔄 Migrating visual learning...');
  const visualItems = await prisma.visualLearning.findMany();
  
  for (const visual of visualItems) {
    const { error } = await supabase.from('visual_learning').insert({
      id: visual.id,
      user_id: visual.userId,
      language: visual.language,
      image_url: visual.imageUrl,
      description: visual.description,
      user_description: visual.userDescription,
      accuracy: visual.accuracy,
      created_at: visual.createdAt.toISOString()
    });

    if (error) {
      console.error(`Failed to migrate visual learning ${visual.id}:`, error);
    }
  }
  
  console.log(`✅ Migrated ${visualItems.length} visual learning items`);
}

async function migrateSpeech() {
  console.log('🔄 Migrating speech...');
  const speechItems = await prisma.speech.findMany();
  
  for (const speech of speechItems) {
    const { error } = await supabase.from('speech').insert({
      id: speech.id,
      user_id: speech.userId,
      language: speech.language,
      prompt: speech.prompt,
      audio_url: speech.audioUrl,
      transcription: speech.transcription,
      accuracy: speech.accuracy,
      feedback: speech.feedback,
      created_at: speech.createdAt.toISOString()
    });

    if (error) {
      console.error(`Failed to migrate speech ${speech.id}:`, error);
    }
  }
  
  console.log(`✅ Migrated ${speechItems.length} speech items`);
}

async function main() {
  console.log('🚀 Starting migration to Supabase...');
  
  try {
    // Execute migration functions in order
    await migrateUsers();
    await migrateAccounts();
    await migrateSessions();
    await migrateProgress();
    await migrateLearning();
    await migrateChats();
    await migrateVocabulary();
    await migrateVisualLearning();
    await migrateSpeech();
    
    console.log('✅ Migration completed successfully!');
  } catch (error) {
    console.error('❌ Migration failed:', error);
  } finally {
    await prisma.$disconnect();
  }
}

main(); 