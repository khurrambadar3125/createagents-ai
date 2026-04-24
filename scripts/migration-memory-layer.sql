-- CreateAgent Runtime — Memory Layer Migration
-- Phase 1: Persistent memory per agent per visitor
-- Run this in Supabase SQL Editor. Does NOT touch existing tables.

-- 1. Memory files — stores the /memories directory contents per agent per visitor
CREATE TABLE IF NOT EXISTS agent_memory_files (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  agent_id uuid NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
  visitor_id text NOT NULL DEFAULT 'default',
  file_path text NOT NULL,
  content text NOT NULL DEFAULT '',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(agent_id, visitor_id, file_path)
);

-- Index for fast lookups by agent + visitor
CREATE INDEX IF NOT EXISTS idx_memory_files_agent_visitor
  ON agent_memory_files(agent_id, visitor_id);

-- 2. Access log — audit trail for memory operations
CREATE TABLE IF NOT EXISTS agent_memory_access_log (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  agent_id uuid NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
  visitor_id text NOT NULL DEFAULT 'default',
  operation text NOT NULL, -- 'view' | 'create' | 'str_replace' | 'insert' | 'delete' | 'rename'
  file_path text NOT NULL,
  detail jsonb,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_memory_access_agent
  ON agent_memory_access_log(agent_id, visitor_id);

-- 3. RLS policies
ALTER TABLE agent_memory_files ENABLE ROW LEVEL SECURITY;
ALTER TABLE agent_memory_access_log ENABLE ROW LEVEL SECURITY;

-- Agent owners can read/write memory for their own agents
CREATE POLICY "Agent owners manage memory files"
  ON agent_memory_files FOR ALL
  USING (
    agent_id IN (
      SELECT id FROM agents WHERE owner_id = auth.uid()
    )
  )
  WITH CHECK (
    agent_id IN (
      SELECT id FROM agents WHERE owner_id = auth.uid()
    )
  );

-- Agent owners can read access logs for their own agents
CREATE POLICY "Agent owners read memory access logs"
  ON agent_memory_access_log FOR SELECT
  USING (
    agent_id IN (
      SELECT id FROM agents WHERE owner_id = auth.uid()
    )
  );

-- Service role (supabaseAdmin) bypasses RLS, so the API routes work.
-- These policies only apply to client-side Supabase calls.

-- 4. updated_at auto-trigger
CREATE OR REPLACE FUNCTION update_memory_file_timestamp()
RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_memory_file_updated_at
  BEFORE UPDATE ON agent_memory_files
  FOR EACH ROW
  EXECUTE FUNCTION update_memory_file_timestamp();
