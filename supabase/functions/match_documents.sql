CREATE OR REPLACE FUNCTION match_documents(
  query_embedding vector(384),
  match_count int,
  filter_industry text DEFAULT NULL
)
RETURNS TABLE (
  id uuid,
  document_id uuid,
  content text,
  section text,
  title text,
  similarity float
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    dc.id,
    dc.document_id,
    dc.content,
    dc.section,
    d.title,
    1 - (dc.embedding <=> query_embedding) as similarity
  FROM document_chunks dc
  JOIN documents d ON dc.document_id = d.id
  WHERE d.status = 'ready'
    AND (
      filter_industry IS NULL
      OR filter_industry = ANY(d.industry)
    )
  ORDER BY dc.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;
