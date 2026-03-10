-- ============================================================================
-- MIGRATION: Training Agents — Dynamic AI Training System
-- Purpose: Tables for Clarence as Training Orchestrator with dynamic agent
--          generation, user skill tracking, and session debrief
-- ============================================================================

-- ============================================================================
-- TABLE 1: user_training_profiles
-- Tracks each user's training history, skill ratings, and progression
-- ============================================================================
CREATE TABLE IF NOT EXISTS user_training_profiles (
  profile_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  company_id UUID,
  total_sessions INTEGER DEFAULT 0,
  completed_sessions INTEGER DEFAULT 0,
  skill_ratings JSONB DEFAULT '{}',
  strengths TEXT[] DEFAULT '{}',
  weaknesses TEXT[] DEFAULT '{}',
  preferred_contract_types TEXT[] DEFAULT '{}',
  experience_level TEXT DEFAULT 'beginner'
    CHECK (experience_level IN ('beginner', 'intermediate', 'advanced')),
  last_debrief_summary TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id)
);

-- ============================================================================
-- TABLE 2: generated_agents
-- Stores dynamically generated AI opponent configurations per session
-- ============================================================================
CREATE TABLE IF NOT EXISTS generated_agents (
  agent_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL,
  persona JSONB NOT NULL,
  objectives JSONB NOT NULL,
  leverage_inputs JSONB NOT NULL,
  leverage_result JSONB NOT NULL,
  personality_traits JSONB NOT NULL,
  system_prompt TEXT NOT NULL,
  initial_positions JSONB,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================================================
-- TABLE 3: training_session_results
-- Stores post-session analysis, scores, and Clarence's debrief
-- ============================================================================
CREATE TABLE IF NOT EXISTS training_session_results (
  result_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  opponent_agent_id UUID REFERENCES generated_agents(agent_id) ON DELETE SET NULL,
  overall_score INTEGER,
  clauses_won INTEGER DEFAULT 0,
  clauses_lost INTEGER DEFAULT 0,
  clauses_compromised INTEGER DEFAULT 0,
  leverage_awareness_score INTEGER,
  tactical_score INTEGER,
  clause_scores JSONB DEFAULT '{}',
  debrief_text TEXT,
  debrief_highlights JSONB DEFAULT '[]',
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================================================
-- INDEXES
-- ============================================================================
CREATE INDEX IF NOT EXISTS idx_training_profiles_user_id
  ON user_training_profiles(user_id);

CREATE INDEX IF NOT EXISTS idx_generated_agents_session_id
  ON generated_agents(session_id);

CREATE INDEX IF NOT EXISTS idx_training_results_user_id
  ON training_session_results(user_id);

CREATE INDEX IF NOT EXISTS idx_training_results_session_id
  ON training_session_results(session_id);

-- ============================================================================
-- RLS POLICIES
-- ============================================================================
ALTER TABLE user_training_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE generated_agents ENABLE ROW LEVEL SECURITY;
ALTER TABLE training_session_results ENABLE ROW LEVEL SECURITY;

-- Users can read/write their own training profile
CREATE POLICY "Users manage own training profile"
  ON user_training_profiles
  FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Users can read generated agents for their sessions
CREATE POLICY "Users read own session agents"
  ON generated_agents
  FOR SELECT
  USING (
    session_id IN (
      SELECT session_id FROM sessions WHERE customer_id = auth.uid()
    )
  );

-- Service role can insert generated agents
CREATE POLICY "Service role manages agents"
  ON generated_agents
  FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- Users can read their own session results
CREATE POLICY "Users read own training results"
  ON training_session_results
  FOR SELECT
  USING (auth.uid() = user_id);

-- Service role can insert/update training results
CREATE POLICY "Service role manages training results"
  ON training_session_results
  FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- ============================================================================
-- RPC: Increment training session counters atomically
-- ============================================================================
CREATE OR REPLACE FUNCTION increment_training_counters(p_user_id UUID)
RETURNS VOID AS $$
BEGIN
  UPDATE user_training_profiles
  SET total_sessions = total_sessions + 1,
      completed_sessions = completed_sessions + 1,
      updated_at = now()
  WHERE user_id = p_user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
