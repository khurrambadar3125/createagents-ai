-- Enable pgvector extension
CREATE EXTENSION IF NOT EXISTS vector;

-- Knowledge base documents table
CREATE TABLE IF NOT EXISTS knowledge_documents (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  title text NOT NULL,
  content text NOT NULL,
  domain text NOT NULL,
  subdomain text,
  vertical text,
  source_type text CHECK (source_type IN (
    'framework','regulation','textbook','case_study',
    'best_practice','research','howto','glossary','faq'
  )),
  language text DEFAULT 'en',
  region text DEFAULT 'global',
  tags text[] DEFAULT '{}',
  compliance_standards text[] DEFAULT '{}',
  embedding vector(1536),
  chunk_index int DEFAULT 0,
  total_chunks int DEFAULT 1,
  word_count int,
  quality_score float DEFAULT 0.8,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Vector similarity search function
CREATE OR REPLACE FUNCTION search_knowledge(
  query_embedding vector(1536),
  match_threshold float DEFAULT 0.7,
  match_count int DEFAULT 8,
  filter_vertical text DEFAULT NULL,
  filter_domain text DEFAULT NULL,
  filter_language text DEFAULT 'en'
)
RETURNS TABLE (
  id uuid,
  title text,
  content text,
  domain text,
  vertical text,
  source_type text,
  similarity float
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    kd.id,
    kd.title,
    kd.content,
    kd.domain,
    kd.vertical,
    kd.source_type,
    1 - (kd.embedding <=> query_embedding) AS similarity
  FROM knowledge_documents kd
  WHERE
    1 - (kd.embedding <=> query_embedding) > match_threshold
    AND (filter_vertical IS NULL OR kd.vertical = filter_vertical)
    AND (filter_domain IS NULL OR kd.domain = filter_domain)
    AND (kd.language = filter_language OR kd.language = 'en')
  ORDER BY kd.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;

-- Hybrid search (vector + keyword)
CREATE OR REPLACE FUNCTION hybrid_knowledge_search(
  query_text text,
  query_embedding vector(1536),
  match_count int DEFAULT 8
)
RETURNS TABLE (
  id uuid,
  title text,
  content text,
  domain text,
  vertical text,
  source_type text,
  score float
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  WITH vector_search AS (
    SELECT kd.id, 1 - (kd.embedding <=> query_embedding) AS vscore
    FROM knowledge_documents kd
    WHERE kd.embedding IS NOT NULL
    ORDER BY kd.embedding <=> query_embedding
    LIMIT 50
  ),
  keyword_search AS (
    SELECT kd.id,
      ts_rank(to_tsvector('english', kd.title || ' ' || kd.content),
      plainto_tsquery('english', query_text)) AS kscore
    FROM knowledge_documents kd
    WHERE to_tsvector('english', kd.title || ' ' || kd.content)
      @@ plainto_tsquery('english', query_text)
    LIMIT 50
  )
  SELECT
    kd.id, kd.title, kd.content, kd.domain, kd.vertical,
    kd.source_type,
    COALESCE(vs.vscore, 0) * 0.7 + COALESCE(ks.kscore, 0) * 0.3 AS score
  FROM knowledge_documents kd
  LEFT JOIN vector_search vs ON kd.id = vs.id
  LEFT JOIN keyword_search ks ON kd.id = ks.id
  WHERE vs.id IS NOT NULL OR ks.id IS NOT NULL
  ORDER BY score DESC
  LIMIT match_count;
END;
$$;

-- Keyword-only search fallback (works without embeddings)
CREATE OR REPLACE FUNCTION keyword_knowledge_search(
  query_text text,
  match_count int DEFAULT 8,
  filter_vertical text DEFAULT NULL,
  filter_domain text DEFAULT NULL
)
RETURNS TABLE (
  id uuid,
  title text,
  content text,
  domain text,
  vertical text,
  source_type text,
  score float
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    kd.id, kd.title, kd.content, kd.domain, kd.vertical, kd.source_type,
    ts_rank(to_tsvector('english', kd.title || ' ' || kd.content),
    plainto_tsquery('english', query_text))::float AS score
  FROM knowledge_documents kd
  WHERE
    to_tsvector('english', kd.title || ' ' || kd.content)
      @@ plainto_tsquery('english', query_text)
    AND (filter_vertical IS NULL OR kd.vertical = filter_vertical)
    AND (filter_domain IS NULL OR kd.domain = filter_domain)
  ORDER BY score DESC
  LIMIT match_count;
END;
$$;

-- Full text search index
CREATE INDEX IF NOT EXISTS knowledge_fts_idx
  ON knowledge_documents
  USING GIN(to_tsvector('english', title || ' ' || content));

-- Knowledge categories for UI
CREATE TABLE IF NOT EXISTS knowledge_categories (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  name text NOT NULL,
  slug text UNIQUE NOT NULL,
  description text,
  vertical text,
  document_count int DEFAULT 0,
  icon text,
  colour text
);

-- Feedback table
CREATE TABLE IF NOT EXISTS knowledge_feedback (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  document_id uuid REFERENCES knowledge_documents(id),
  user_id uuid,
  query text,
  helpful boolean,
  comment text,
  created_at timestamptz DEFAULT now()
);
