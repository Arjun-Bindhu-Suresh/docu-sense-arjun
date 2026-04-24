/**
 * Offline retrieval evaluation — no API key required.
 * Tests whether the correct chunks are returned for each test case.
 * Metric: Hit Rate @ 3 (is the expected chunk in the top-3 results?)
 */

const fs = require("fs");
const path = require("path");

// ── Inline retrieval logic (mirrors frontend/src/lib/retrieval.ts) ──────────

const STOPWORDS = new Set([
  "a","an","the","is","are","was","were","be","been","being","have","has","had",
  "do","does","did","will","would","could","should","may","might","shall","can",
  "need","to","of","in","on","at","by","for","with","about","and","but","or",
  "not","no","i","me","my","we","our","you","your","he","she","they","them",
  "this","that","these","those","what","which","who","how","when","where","why",
  "all","each","few","more","most","it","its","such","as","so","just",
]);

function tokenize(text) {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((t) => t.length > 1 && !STOPWORDS.has(t));
}

function scoreChunk(queryTerms, chunk) {
  const chunkTerms = new Set(tokenize(chunk.raw_text));
  const taggedTerms = new Set(chunk.retrieval_terms.flatMap((t) => tokenize(t)));
  let score = 0;
  for (const term of queryTerms) {
    if (chunkTerms.has(term)) score += 1;
    if (taggedTerms.has(term)) score += 2;
  }
  return score;
}

function countMatchingTerms(queryTerms, chunk) {
  const chunkTerms = new Set(tokenize(chunk.raw_text));
  const taggedTerms = new Set(chunk.retrieval_terms.flatMap((t) => tokenize(t)));
  return queryTerms.filter((term) => chunkTerms.has(term) || taggedTerms.has(term)).length;
}

function retrieveTopChunks(query, chunks, k = 3) {
  const queryTerms = tokenize(query);
  if (queryTerms.length === 0) return [];
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

// ── Load fixtures ────────────────────────────────────────────────────────────

const artifactPath = path.join(__dirname, "../data/gold/sample-artifact.json");
const testCasesPath = path.join(__dirname, "test-cases.json");

const artifact = JSON.parse(fs.readFileSync(artifactPath, "utf-8"));
const { cases } = JSON.parse(fs.readFileSync(testCasesPath, "utf-8"));

// ── Run evaluation ───────────────────────────────────────────────────────────

let hits = 0;
let total = 0;
const results = [];

for (const tc of cases) {
  const retrieved = retrieveTopChunks(tc.question, artifact.chunks, 3);
  const retrievedIds = retrieved.map((c) => c.chunk_id);

  let passed;
  if (tc.expected_chunks.length === 0) {
    // Failure case: expect no results
    passed = retrieved.length === 0;
  } else {
    // Representative case: expected chunk must appear in top-3
    passed = tc.expected_chunks.every((id) => retrievedIds.includes(id));
    total++;
    if (passed) hits++;
  }

  results.push({
    id: tc.id,
    type: tc.type,
    question: tc.question,
    expected_chunks: tc.expected_chunks,
    retrieved_chunks: retrievedIds,
    passed,
  });
}

// ── Print results ────────────────────────────────────────────────────────────

console.log("\n=== DocuSense Retrieval Evaluation ===\n");

for (const r of results) {
  const status = r.passed ? "PASS" : "FAIL";
  console.log(`[${status}] ${r.id} (${r.type})`);
  console.log(`  Q: ${r.question}`);
  console.log(`  Expected: [${r.expected_chunks.join(", ") || "none"}]`);
  console.log(`  Retrieved: [${r.retrieved_chunks.join(", ") || "none"}]\n`);
}

const hitRate = total > 0 ? ((hits / total) * 100).toFixed(0) : "N/A";
console.log(`Hit Rate @ 3 (representative cases): ${hits}/${total} = ${hitRate}%`);
console.log(`Failure cases correctly returned empty: ${results.filter(r => r.type === "failure" && r.passed).length}/${results.filter(r => r.type === "failure").length}`);

// Save results
const outputPath = path.join(__dirname, "results", "retrieval-eval.json");
fs.writeFileSync(outputPath, JSON.stringify({ run_date: new Date().toISOString(), hit_rate: `${hitRate}%`, results }, null, 2));
console.log(`\nResults saved to ${outputPath}`);
