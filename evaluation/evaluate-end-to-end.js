/**
 * End-to-end pipeline evaluation — no API key required.
 *
 * Simulates the complete /api/ask pipeline for each test case up to (but not
 * including) the Claude API call, then cross-checks against the saved outputs
 * in evaluation/saved-outputs/ to verify the full flow.
 *
 * Pipeline stages tested:
 *   1. Artifact loading     — artifact parses and contains chunks
 *   2. Retrieval            — correct chunks (or no chunks) are returned
 *   3. Prompt construction  — context string is well-formed
 *   4. Out-of-scope gate    — zero-chunk cases are caught before Claude is called
 *   5. Response schema      — saved outputs have the required { answer, chunks_used } shape
 *   6. Grounding check      — for representative cases, chunk IDs in saved output
 *                             overlap with what retrieval actually returns
 *
 * What "end-to-end success" means for this system:
 *   - Representative question → retrieval finds relevant chunks → Claude receives
 *     those chunks → answer references document content
 *   - Out-of-scope question → retrieval finds no chunks → Claude is NOT called →
 *     user receives the canned decline message
 */

const fs = require("fs");
const path = require("path");

// ── Inline retrieval (mirrors frontend/src/lib/retrieval.ts) ─────────────────

const STOPWORDS = new Set([
  "a","an","the","is","are","was","were","be","been","being","have","has","had",
  "do","does","did","will","would","could","should","may","might","shall","can",
  "need","to","of","in","on","at","by","for","with","about","and","but","or",
  "not","no","i","me","my","we","our","you","your","he","she","they","them",
  "this","that","these","those","what","which","who","how","when","where","why",
  "all","each","few","more","most","it","its","such","as","so","just",
]);

function tokenize(text) {
  return text.toLowerCase().replace(/[^a-z0-9\s]/g, " ").split(/\s+/).filter((t) => t.length > 1 && !STOPWORDS.has(t));
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

function buildContextText(topChunks) {
  return topChunks.map((c) => `[${c.section_path}]\n${c.raw_text}`).join("\n\n");
}

// ── Load fixtures ─────────────────────────────────────────────────────────────

const artifactPath = path.join(__dirname, "../data/gold/sample-artifact.json");
const testCasesPath = path.join(__dirname, "test-cases.json");
const savedOutputsDir = path.join(__dirname, "saved-outputs");

const artifact = JSON.parse(fs.readFileSync(artifactPath, "utf-8"));
const { cases } = JSON.parse(fs.readFileSync(testCasesPath, "utf-8"));

// ── Run end-to-end checks ─────────────────────────────────────────────────────

console.log("\n=== DocuSense End-to-End Pipeline Evaluation ===\n");

const results = [];
let passed = 0;

for (const tc of cases) {
  const checks = {};

  // Stage 1: artifact loaded
  checks.artifact_loaded = Array.isArray(artifact.chunks) && artifact.chunks.length > 0;

  // Stage 2: retrieval
  const retrieved = retrieveTopChunks(tc.question, artifact.chunks, 3);
  const retrievedIds = retrieved.map((c) => c.chunk_id);

  if (tc.expected_chunks.length === 0) {
    checks.retrieval_correct = retrieved.length === 0;
  } else {
    checks.retrieval_correct = tc.expected_chunks.every((id) => retrievedIds.includes(id));
  }

  // Stage 3: prompt construction (only if chunks retrieved)
  if (retrieved.length > 0) {
    const ctx = buildContextText(retrieved);
    checks.prompt_well_formed = ctx.includes("[") && ctx.includes("]") && ctx.length > 50;
  } else {
    checks.prompt_well_formed = null; // not applicable — out-of-scope gate fires
  }

  // Stage 4: out-of-scope gate
  if (tc.type === "failure") {
    checks.out_of_scope_gate = retrieved.length === 0; // gate fires correctly
  } else {
    checks.out_of_scope_gate = null; // not applicable
  }

  // Stage 5: saved-output response schema
  const savedFile = path.join(savedOutputsDir, `${tc.id}.json`);
  if (fs.existsSync(savedFile)) {
    const saved = JSON.parse(fs.readFileSync(savedFile, "utf-8"));
    checks.response_has_answer = typeof saved.answer === "string" && saved.answer.length > 0;
    checks.response_has_chunks_used = Array.isArray(saved.chunks_used);
  } else {
    checks.response_has_answer = false;
    checks.response_has_chunks_used = false;
  }

  // Stage 6: grounding check (representative only)
  if (tc.type === "representative" && fs.existsSync(savedFile)) {
    const saved = JSON.parse(fs.readFileSync(savedFile, "utf-8"));
    const savedChunkIds = (saved.chunks_used || []).map((c) => c.chunk_id);
    const overlap = retrievedIds.filter((id) => savedChunkIds.includes(id));
    checks.answer_grounded_in_retrieved = overlap.length > 0;
  } else {
    checks.answer_grounded_in_retrieved = null; // not applicable
  }

  // Overall pass: all non-null checks must pass
  const relevant = Object.entries(checks).filter(([, v]) => v !== null);
  const allPassed = relevant.every(([, v]) => v === true);
  if (allPassed) passed++;

  results.push({ id: tc.id, type: tc.type, question: tc.question, checks, passed: allPassed });

  const status = allPassed ? "PASS" : "FAIL";
  console.log(`[${status}] ${tc.id} (${tc.type})`);
  console.log(`  Q: ${tc.question}`);
  for (const [k2, v] of Object.entries(checks)) {
    if (v !== null) console.log(`  ${v ? "✓" : "✗"} ${k2}`);
  }
  console.log();
}

console.log(`End-to-end task success: ${passed}/${cases.length}`);

// ── Save results ──────────────────────────────────────────────────────────────

const output = {
  run_date: new Date().toISOString(),
  pipeline_stages: [
    "artifact_loaded",
    "retrieval_correct",
    "prompt_well_formed",
    "out_of_scope_gate",
    "response_has_answer",
    "response_has_chunks_used",
    "answer_grounded_in_retrieved",
  ],
  summary: { passed, total: cases.length },
  results,
};

const outPath = path.join(__dirname, "results", "end-to-end-eval.json");
fs.writeFileSync(outPath, JSON.stringify(output, null, 2));
console.log(`\nResults saved to ${outPath}`);
