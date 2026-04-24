const STOPWORDS = new Set([
  "a", "an", "the", "is", "are", "was", "were", "be", "been", "being",
  "have", "has", "had", "do", "does", "did", "will", "would", "could",
  "should", "may", "might", "shall", "can", "need", "dare", "ought",
  "to", "of", "in", "on", "at", "by", "for", "with", "about", "against",
  "between", "into", "through", "during", "before", "after", "above",
  "below", "from", "up", "down", "out", "off", "over", "under", "again",
  "and", "but", "or", "nor", "so", "yet", "both", "either", "neither",
  "not", "only", "own", "same", "than", "too", "very", "just", "i",
  "me", "my", "we", "our", "you", "your", "he", "she", "they", "them",
  "this", "that", "these", "those", "what", "which", "who", "how",
  "when", "where", "why", "all", "each", "few", "more", "most", "it",
  "its", "such", "no", "as",
]);

export type ArtifactChunk = {
  chunk_id: string;
  raw_text: string;
  normalized_text: string;
  section_path: string;
  content_type: string;
  char_range: { start: number; end: number };
  page_number?: number;
  retrieval_terms: string[];
};

export function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((t) => t.length > 1 && !STOPWORDS.has(t));
}

export function scoreChunk(queryTerms: string[], chunk: ArtifactChunk): number {
  const chunkTerms = new Set(tokenize(chunk.raw_text));
  const taggedTerms = new Set(
    chunk.retrieval_terms.flatMap((t) => tokenize(t))
  );

  let score = 0;
  for (const term of queryTerms) {
    if (chunkTerms.has(term)) score += 1;
    if (taggedTerms.has(term)) score += 2;
  }
  return score;
}

export function countMatchingTerms(
  queryTerms: string[],
  chunk: ArtifactChunk
): number {
  const chunkTerms = new Set(tokenize(chunk.raw_text));
  const taggedTerms = new Set(
    chunk.retrieval_terms.flatMap((t) => tokenize(t))
  );
  return queryTerms.filter(
    (term) => chunkTerms.has(term) || taggedTerms.has(term)
  ).length;
}

export function retrieveTopChunks(
  query: string,
  chunks: ArtifactChunk[],
  k = 3
): ArtifactChunk[] {
  const queryTerms = tokenize(query);
  if (queryTerms.length === 0) return [];

  // Require at least 2 distinct query terms to match (or all terms if query
  // has fewer than 2). This prevents accidental single-word overlaps (e.g.
  // "language" matching the Applications chunk for unrelated queries).
  const minMatches = Math.min(2, queryTerms.length);

  return chunks
    .map((chunk) => ({
      chunk,
      score: scoreChunk(queryTerms, chunk),
      matches: countMatchingTerms(queryTerms, chunk),
    }))
    .filter(({ score, matches }) => score > 0 && matches >= minMatches)
    .sort((a, b) => b.score - a.score)
    .slice(0, k)
    .map(({ chunk }) => chunk);
}
