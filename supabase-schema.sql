-- ============================================================
-- IntelliTwin Supabase Schema + RLS Policies (Audit & Fix)
-- Run this in your Supabase SQL Editor (Dashboard > SQL Editor)
-- ============================================================

-- 1. Uploads table (File metadata)
CREATE TABLE IF NOT EXISTS uploads (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  file_name   TEXT NOT NULL,
  file_url    TEXT NOT NULL,
  file_type   TEXT,
  summary     TEXT DEFAULT NULL,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Modules table (AI analysis parts)
CREATE TABLE IF NOT EXISTS modules (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  file_id        UUID REFERENCES uploads(id) ON DELETE CASCADE,
  module_name    TEXT NOT NULL,
  topics         JSONB DEFAULT '[]',
  estimated_time TEXT,
  created_at     TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Q&A table (Questions from modules)
CREATE TABLE IF NOT EXISTS qna (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  module_id   UUID REFERENCES modules(id) ON DELETE CASCADE,
  question    TEXT NOT NULL,
  answer      TEXT NOT NULL,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- 4. Planner table (Schedule & Tasks)
CREATE TABLE IF NOT EXISTS planner (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  module      TEXT,
  topic       TEXT,
  task        TEXT NOT NULL,
  due_date    TEXT,
  status      TEXT DEFAULT 'Pending',
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- 5. User Settings table
CREATE TABLE IF NOT EXISTS user_settings (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_name   TEXT DEFAULT 'Alex Student',
  theme       TEXT DEFAULT 'dark',
  preferences JSONB DEFAULT '{}',
  updated_at  TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- ENABLE Row Level Security (RLS)
-- ============================================================
ALTER TABLE uploads ENABLE ROW LEVEL SECURITY;
ALTER TABLE modules ENABLE ROW LEVEL SECURITY;
ALTER TABLE qna     ENABLE ROW LEVEL SECURITY;
ALTER TABLE planner ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_settings ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- CREATE Access Policies (Public Access for Dashboard Ease)
-- ============================================================

-- Policy: Select (Read) all
DROP POLICY IF EXISTS "Allow Public Read Access on uploads" ON uploads;
CREATE POLICY "Allow read uploads" ON uploads FOR SELECT TO public USING (true);

-- Policy: Insert all
DROP POLICY IF EXISTS "Allow Public Insert Access on uploads" ON uploads;
CREATE POLICY "Allow insert uploads" ON uploads FOR INSERT TO public WITH CHECK (true);

-- Generic Public Policies for related tables
CREATE POLICY "Allow Public Read Access on modules"       ON modules       FOR SELECT USING (true);
CREATE POLICY "Allow Public Read Access on qna"           ON qna           FOR SELECT USING (true);
CREATE POLICY "Allow Public Read Access on planner"       ON planner       FOR SELECT USING (true);
CREATE POLICY "Allow Public Read Access on user_settings" ON user_settings FOR SELECT USING (true);

CREATE POLICY "Allow Public Insert Access on modules"       ON modules       FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow Public Insert Access on qna"           ON qna           FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow Public Insert Access on planner"       ON planner       FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow Public Insert Access on user_settings" ON user_settings FOR INSERT WITH CHECK (true);

-- Policy: Update all
CREATE POLICY "Allow Public Update Access on uploads"       ON uploads       FOR UPDATE USING (true);
CREATE POLICY "Allow Public Update Access on modules"       ON modules       FOR UPDATE USING (true);
CREATE POLICY "Allow Public Update Access on qna"           ON qna           FOR UPDATE USING (true);
CREATE POLICY "Allow Public Update Access on planner"       ON planner       FOR UPDATE USING (true);
CREATE POLICY "Allow Public Update Access on user_settings" ON user_settings FOR UPDATE USING (true);

-- Policy: Delete all
CREATE POLICY "Allow Public Delete Access on uploads"       ON uploads       FOR DELETE USING (true);
CREATE POLICY "Allow Public Delete Access on modules"       ON modules       FOR DELETE USING (true);
CREATE POLICY "Allow Public Delete Access on qna"           ON qna           FOR DELETE USING (true);
CREATE POLICY "Allow Public Delete Access on planner"       ON planner       FOR DELETE USING (true);
CREATE POLICY "Allow Public Delete Access on user_settings" ON user_settings FOR DELETE USING (true);

-- ============================================================
-- Realtime publications
-- ============================================================
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    CREATE PUBLICATION supabase_realtime;
  END IF;
END $$;

ALTER PUBLICATION supabase_realtime ADD TABLE uploads, modules, qna, planner, user_settings;

-- ============================================================
-- STORAGE BUCKET CONFIGURATION (Run in SQL Editor)
-- ============================================================

-- 1. Create the bucket
INSERT INTO storage.buckets (id, name, public)
SELECT 'uploads', 'uploads', true
WHERE NOT EXISTS (
    SELECT 1 FROM storage.buckets WHERE id = 'uploads'
);

-- 2. Create Storage Policies for 'uploads'
DO $$
BEGIN
    -- Drop existing to ensure fresh start
    DROP POLICY IF EXISTS "Allow uploads" ON storage.objects;
    DROP POLICY IF EXISTS "Allow read uploads" ON storage.objects;
    DROP POLICY IF EXISTS "Allow delete uploads" ON storage.objects;
    
    -- Create new policies
    CREATE POLICY "Allow uploads" ON storage.objects FOR INSERT TO public WITH CHECK (bucket_id = 'uploads');
    CREATE POLICY "Allow read uploads" ON storage.objects FOR SELECT TO public USING (bucket_id = 'uploads');
    CREATE POLICY "Allow delete uploads" ON storage.objects FOR DELETE TO public USING (bucket_id = 'uploads');
END $$;

-- Initial Settings Row if missing
INSERT INTO user_settings (user_name) 
SELECT 'Alex Student'
WHERE NOT EXISTS (SELECT 1 FROM user_settings LIMIT 1);
