import { supabase, supabaseAdmin } from './supabase';
import { User, Learning, Progress, Chat } from '@prisma/client';

// Use admin client for write operations, regular client for reads
const adminClient = supabaseAdmin || supabase;

// Export the supabase client directly
export { supabase, supabaseAdmin };

// User functions
export async function getUserById(id: string) {
  const { data, error } = await supabase
    .from('users')
    .select('*')
    .eq('id', id)
    .single();
  
  if (error) throw error;
  return data;
}

export async function getUserByEmail(email: string) {
  const { data, error } = await supabase
    .from('users')
    .select('*')
    .eq('email', email)
    .single();
  
  if (error && error.code !== 'PGRST116') throw error;
  return data;
}

export async function createUser(userData: Omit<User, 'id' | 'createdAt' | 'updatedAt'>) {
  // Extract fields for clarity
  const { 
    name, 
    email, 
    password, 
    nativeLanguage, 
    activeLanguage, 
    learningLanguages,
    accountSetup 
  } = userData;

  // Use admin client for creating users to bypass RLS
  const { data, error } = await adminClient
    .from('users')
    .insert([{
      name,
      email,
      password,
      native_language: nativeLanguage,
      active_language: activeLanguage,
      learning_languages: learningLanguages,
      account_setup: accountSetup
    }])
    .select()
    .single();
  
  if (error) throw error;
  return data;
}

export async function updateUser(id: string, userData: Partial<User>) {
  // Use admin client for updating users to bypass RLS
  const { data, error } = await adminClient
    .from('users')
    .update(userData)
    .eq('id', id)
    .select()
    .single();
  
  if (error) throw error;
  return data;
}

// Learning functions
export async function getLearningItems(userId: string, language: string) {
  const { data, error } = await supabase
    .from('learning')
    .select('*')
    .eq('user_id', userId)
    .eq('language', language);
  
  if (error) throw error;
  return data;
}

export async function createLearningItem(learningData: Omit<Learning, 'id' | 'createdAt' | 'updatedAt'>) {
  // Use admin client for creating items to bypass RLS
  const { data, error } = await adminClient
    .from('learning')
    .insert([learningData])
    .select()
    .single();
  
  if (error) throw error;
  return data;
}

// Progress functions
export async function getProgress(userId: string, language: string) {
  const { data, error } = await supabase
    .from('progress')
    .select('*')
    .eq('user_id', userId)
    .eq('language', language)
    .single();
  
  if (error && error.code !== 'PGRST116') throw error;
  return data;
}

export async function getAllUserProgress(userId: string) {
  const { data, error } = await supabase
    .from('progress')
    .select('*')
    .eq('user_id', userId);
  
  if (error) throw error;
  return data;
}

export async function updateProgress(id: string, progressData: Partial<Progress>) {
  // Use admin client for updating progress to bypass RLS
  const { data, error } = await adminClient
    .from('progress')
    .update(progressData)
    .eq('id', id)
    .select()
    .single();
  
  if (error) throw error;
  return data;
}

export async function createProgress(progressData: Omit<Progress, 'id' | 'createdAt' | 'updatedAt'>) {
  // Use admin client for creating progress to bypass RLS
  const { data, error } = await adminClient
    .from('progress')
    .insert([{
      user_id: progressData.userId,
      language: progressData.language,
      level: progressData.level,
      xp: progressData.xp
    }])
    .select()
    .single();
    
  if (error) throw error;
  return data;
}

// Chat functions
export async function getChatHistory(userId: string, language: string) {
  const { data, error } = await supabase
    .from('chats')
    .select('*')
    .eq('user_id', userId)
    .eq('language', language)
    .order('createdAt', { ascending: false });
  
  if (error) throw error;
  return data;
}

export async function createChatMessage(chatData: Omit<Chat, 'id' | 'createdAt'>) {
  // Use admin client for creating messages to bypass RLS
  const { data, error } = await adminClient
    .from('chats')
    .insert([chatData])
    .select()
    .single();
  
  if (error) throw error;
  return data;
}

// Other model functions can be added similarly 