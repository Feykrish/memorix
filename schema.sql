-- ═══════════════════════════════════════════════════════════════════════
-- Memorix — Supabase Schema
-- Run this in the Supabase SQL Editor to create all tables
-- ═══════════════════════════════════════════════════════════════════════

-- Questions cache: store generated questions to reduce API costs
CREATE TABLE IF NOT EXISTS questions_cache (
  id TEXT PRIMARY KEY,
  categorie TEXT NOT NULL,
  sous_categorie TEXT NOT NULL,
  niveau TEXT NOT NULL,
  langue TEXT DEFAULT 'fr',
  contenu JSONB NOT NULL,
  utilisation_count INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_questions_cache_lookup
  ON questions_cache (categorie, sous_categorie, niveau, langue);

-- User sessions: track progress per category
CREATE TABLE IF NOT EXISTS sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL,
  categorie TEXT NOT NULL,
  sous_categorie TEXT NOT NULL,
  niveau TEXT NOT NULL,
  nb_questions INTEGER NOT NULL DEFAULT 5,
  statut TEXT DEFAULT 'en_cours',
  questions_ratees JSONB DEFAULT '[]',
  questions_maitrisees JSONB DEFAULT '[]',
  nb_connaissances INTEGER DEFAULT 0,
  jour INTEGER DEFAULT 1,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions (user_id);
CREATE INDEX IF NOT EXISTS idx_sessions_user_cat ON sessions (user_id, categorie, sous_categorie);

-- Journal: daily progression log
CREATE TABLE IF NOT EXISTS journal (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL,
  date DATE NOT NULL,
  resume JSONB NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_journal_user_date ON journal (user_id, date);

-- User profiles: preferences and stats
CREATE TABLE IF NOT EXISTS users_profiles (
  id TEXT PRIMARY KEY,
  langue TEXT DEFAULT 'fr',
  nb_questions_defaut INTEGER DEFAULT 5,
  difficulte_defaut TEXT DEFAULT 'auto',
  streak INTEGER DEFAULT 0,
  total_connaissances INTEGER DEFAULT 0,
  notifications_actives BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ═══════════════════════════════════════════════════════════════════════
-- Row Level Security (RLS) — allow anonymous access for now
-- ═══════════════════════════════════════════════════════════════════════

ALTER TABLE questions_cache ENABLE ROW LEVEL SECURITY;
ALTER TABLE sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE journal ENABLE ROW LEVEL SECURITY;
ALTER TABLE users_profiles ENABLE ROW LEVEL SECURITY;

-- Allow all operations for now (no auth yet)
CREATE POLICY "Allow all on questions_cache" ON questions_cache FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all on sessions" ON sessions FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all on journal" ON journal FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all on users_profiles" ON users_profiles FOR ALL USING (true) WITH CHECK (true);
