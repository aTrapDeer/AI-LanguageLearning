-- First, let's temporarily disable RLS for all tables to allow registration
ALTER TABLE users DISABLE ROW LEVEL SECURITY;
ALTER TABLE accounts DISABLE ROW LEVEL SECURITY;
ALTER TABLE sessions DISABLE ROW LEVEL SECURITY;
ALTER TABLE verification_tokens DISABLE ROW LEVEL SECURITY;
ALTER TABLE progress DISABLE ROW LEVEL SECURITY;
ALTER TABLE learning DISABLE ROW LEVEL SECURITY;
ALTER TABLE chats DISABLE ROW LEVEL SECURITY;
ALTER TABLE vocabulary DISABLE ROW LEVEL SECURITY;
ALTER TABLE visual_learning DISABLE ROW LEVEL SECURITY;
ALTER TABLE speech DISABLE ROW LEVEL SECURITY;

-- Alternatively, if you want to keep RLS enabled, you need to create bypass policies
-- This is a safer approach for production environments

-- First, drop the existing policies
DROP POLICY IF EXISTS "Users can view their own data" ON users;
DROP POLICY IF EXISTS "Users can update their own data" ON users;
DROP POLICY IF EXISTS "Users can view their own accounts" ON accounts;
DROP POLICY IF EXISTS "Users can view their own sessions" ON sessions;
DROP POLICY IF EXISTS "Users can view their own progress" ON progress;
DROP POLICY IF EXISTS "Users can update their own progress" ON progress;
DROP POLICY IF EXISTS "Users can insert their own progress" ON progress;

-- Then create more permissive policies
-- Allow anyone to create users (needed for registration)
CREATE POLICY "Anyone can create users" ON users
FOR INSERT WITH CHECK (true);

-- Allow authenticated users to view their own data
CREATE POLICY "Users can view their own data" ON users
FOR SELECT USING (auth.uid()::text = id::text);

-- Allow authenticated users to update their own data
CREATE POLICY "Users can update their own data" ON users
FOR UPDATE USING (auth.uid()::text = id::text);

-- Allow service accounts to do all operations
CREATE POLICY "Service accounts can do anything to users" ON users
USING (upper(current_setting('app.role', true)::text) = 'SERVICE_ROLE')
WITH CHECK (upper(current_setting('app.role', true)::text) = 'SERVICE_ROLE');

-- Repeat for other tables
-- For accounts
CREATE POLICY "Service accounts can do anything to accounts" ON accounts
USING (upper(current_setting('app.role', true)::text) = 'SERVICE_ROLE')
WITH CHECK (upper(current_setting('app.role', true)::text) = 'SERVICE_ROLE');

CREATE POLICY "Users can view their own accounts" ON accounts
FOR SELECT USING (auth.uid()::text = user_id::text);

-- For sessions
CREATE POLICY "Service accounts can do anything to sessions" ON sessions
USING (upper(current_setting('app.role', true)::text) = 'SERVICE_ROLE')
WITH CHECK (upper(current_setting('app.role', true)::text) = 'SERVICE_ROLE');

CREATE POLICY "Users can view their own sessions" ON sessions
FOR SELECT USING (auth.uid()::text = user_id::text);

-- For verification tokens
CREATE POLICY "Service accounts can do anything to verification_tokens" ON verification_tokens
USING (upper(current_setting('app.role', true)::text) = 'SERVICE_ROLE')
WITH CHECK (upper(current_setting('app.role', true)::text) = 'SERVICE_ROLE'); 