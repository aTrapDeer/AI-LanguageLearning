-- Create schema tables for Supabase based on the Prisma models

-- Account table
CREATE TABLE IF NOT EXISTS accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  type TEXT NOT NULL,
  provider TEXT NOT NULL,
  provider_account_id TEXT NOT NULL,
  refresh_token TEXT,
  access_token TEXT,
  expires_at INTEGER,
  token_type TEXT,
  scope TEXT,
  id_token TEXT,
  session_state TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(provider, provider_account_id)
);

-- Session table
CREATE TABLE IF NOT EXISTS sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_token TEXT UNIQUE NOT NULL,
  user_id UUID NOT NULL,
  expires TIMESTAMP WITH TIME ZONE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- User table
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT,
  email TEXT UNIQUE NOT NULL,
  email_verified TIMESTAMP WITH TIME ZONE,
  image TEXT,
  password TEXT NOT NULL,
  native_language TEXT NOT NULL DEFAULT 'English',
  active_language TEXT NOT NULL DEFAULT 'en',
  learning_languages TEXT[] DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- VerificationToken table
CREATE TABLE IF NOT EXISTS verification_tokens (
  identifier TEXT NOT NULL,
  token TEXT NOT NULL,
  expires TIMESTAMP WITH TIME ZONE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  PRIMARY KEY (identifier, token)
);

-- Progress table
CREATE TABLE IF NOT EXISTS progress (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  language TEXT NOT NULL,
  level INTEGER NOT NULL DEFAULT 1,
  xp INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, language)
);

-- Learning table
CREATE TABLE IF NOT EXISTS learning (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  language TEXT NOT NULL,
  word TEXT NOT NULL,
  translation TEXT NOT NULL,
  difficulty INTEGER NOT NULL DEFAULT 0,
  last_recalled TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  next_review TIMESTAMP WITH TIME ZONE NOT NULL,
  success_count INTEGER NOT NULL DEFAULT 0,
  failure_count INTEGER NOT NULL DEFAULT 0,
  notes TEXT,
  tags TEXT[] DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Index for Learning table
CREATE INDEX IF NOT EXISTS learning_user_id_language_idx ON learning(user_id, language);
CREATE INDEX IF NOT EXISTS learning_next_review_idx ON learning(next_review);

-- Chat table
CREATE TABLE IF NOT EXISTS chats (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  language TEXT NOT NULL,
  message TEXT NOT NULL,
  response TEXT NOT NULL,
  audio_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Index for Chat table
CREATE INDEX IF NOT EXISTS chats_user_id_idx ON chats(user_id);

-- Vocabulary table
CREATE TABLE IF NOT EXISTS vocabulary (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  language TEXT NOT NULL,
  word TEXT NOT NULL,
  translation TEXT NOT NULL,
  mastery INTEGER NOT NULL DEFAULT 0,
  last_reviewed TIMESTAMP WITH TIME ZONE,
  next_review TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Index for Vocabulary table
CREATE INDEX IF NOT EXISTS vocabulary_user_id_idx ON vocabulary(user_id);

-- VisualLearning table
CREATE TABLE IF NOT EXISTS visual_learning (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  language TEXT NOT NULL,
  image_url TEXT NOT NULL,
  description TEXT NOT NULL,
  user_description TEXT,
  accuracy INTEGER,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Index for VisualLearning table
CREATE INDEX IF NOT EXISTS visual_learning_user_id_idx ON visual_learning(user_id);

-- Speech table
CREATE TABLE IF NOT EXISTS speech (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  language TEXT NOT NULL,
  prompt TEXT NOT NULL,
  audio_url TEXT NOT NULL,
  transcription TEXT,
  accuracy INTEGER,
  feedback TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Index for Speech table
CREATE INDEX IF NOT EXISTS speech_user_id_idx ON speech(user_id);

-- Enable Row Level Security
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE progress ENABLE ROW LEVEL SECURITY;
ALTER TABLE learning ENABLE ROW LEVEL SECURITY;
ALTER TABLE chats ENABLE ROW LEVEL SECURITY;
ALTER TABLE vocabulary ENABLE ROW LEVEL SECURITY;
ALTER TABLE visual_learning ENABLE ROW LEVEL SECURITY;
ALTER TABLE speech ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
CREATE POLICY "Users can view their own data" ON users
FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Users can update their own data" ON users
FOR UPDATE USING (auth.uid() = id);

-- Similar policies for other tables
CREATE POLICY "Users can view their own accounts" ON accounts
FOR SELECT USING (auth.uid()::text = user_id::text);

CREATE POLICY "Users can view their own sessions" ON sessions
FOR SELECT USING (auth.uid()::text = user_id::text);

CREATE POLICY "Users can view their own progress" ON progress
FOR SELECT USING (auth.uid()::text = user_id::text);

CREATE POLICY "Users can update their own progress" ON progress
FOR UPDATE USING (auth.uid()::text = user_id::text);

CREATE POLICY "Users can insert their own progress" ON progress
FOR INSERT WITH CHECK (auth.uid()::text = user_id::text);

-- Add similar policies for other tables 