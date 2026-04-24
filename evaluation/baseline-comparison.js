/**
 * Baseline comparison: original keyword filter (Assignment 5) vs
 * scored retrieval (Assignment 6).
 *
 * The baseline only matched "ai" or "data" keywords — very brittle.
 * This script shows which questions each approach handles correctly.
 */

const fs = require("fs");
const path = require("path");

// ── Baseline: original Assignment 5 approach ─────────────────────────────────

function baselineRetrieve(question, chunks) {
  const lowerQuestion = question.toLowerCase();
  for (const chunk of chunks) {
    const text = chunk.raw_text.toLowerCase();
    if (lowerQuestion.includes("ai") && text.includes("ai")) return [chunk];
    if (lowerQuestion.includes("data") && text.includes("data")) return [chunk];
  }
  return [];
}

// ── Improved: Assignment 6 scored retrieval ───────────────────────────────────

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

function improvedRetrieve(question, chunks, k = 3) {
  const queryTerms = tokenize(question);
  if (queryTerms.length === 0) return [];
  const minMatches = Math.min(2, queryTerms.length);
  return chunks
    .map((chunk) => {
      const chunkTerms = new Set(tokenize(chunk.raw_text));
      const taggedTerms = new Set(chunk.retrieval_terms.flatMap((t) => tokenize(t)));
      let score = 0;
      let matches = 0;
      for (const term of queryTerms) {
        const inText = chunkTerms.has(term);
        const inTags = taggedTerms.has(term);
        if (inText) score += 1;
        if (inTags) score += 2;
        if (inText || inTags) matches++;
      }
      return { chunk, score, matches };
    })
    .filter(({ score, matches }) => score > 0 && matches >= minMatches)
    .sort((a, b) => b.score - a.score)
    .slice(0, k)
    .map(({ chunk }) => chunk);
}

// ── Load fixtures ─────────────────────────────────────────────────────────────

const artifact = JSON.parse(fs.readFileSync(path.join(__dirname, "../data/gold/sample-artifact.json"), "utf-8"));
const { cases } = JSON.parse(fs.readFileSync(path.join(__dirname, "test-cases.json"), "utf-8"));

// ── Compare ───────────────────────────────────────────────────────────────────

console.log("\n=== Baseline vs Improved Retrieval Comparison ===\n");
console.log("Question".padEnd(55), "Baseline".padEnd(12), "Improved");
console.log("-".repeat(85));

const rows = [];

for (const tc of cases) {
  const baselineResults = baselineRetrieve(tc.question, artifact.chunks);
  const improvedResults = improvedRetrieve(tc.question, artifact.chunks, 3);

  const baselineIds = baselineResults.map((c) => c.chunk_id);
  const improvedIds = improvedResults.map((c) => c.chunk_id);

  let baselinePass, improvedPass;
  if (tc.expected_chunks.length === 0) {
    baselinePass = baselineIds.length === 0;
    improvedPass = improvedIds.length === 0;
  } else {
    baselinePass = tc.expected_chunks.every((id) => baselineIds.includes(id));
    improvedPass = tc.expected_chunks.every((id) => improvedIds.includes(id));
  }

  const q = tc.question.length > 52 ? tc.question.slice(0, 49) + "..." : tc.question;
  const b = baselinePass ? "PASS" : "FAIL";
  const i = improvedPass ? "PASS" : "FAIL";
  console.log(q.padEnd(55), b.padEnd(12), i);

  rows.push({ id: tc.id, question: tc.question, baseline_pass: baselinePass, improved_pass: improvedPass });
}

const baselineHits = rows.filter((r) => r.baseline_pass).length;
const improvedHits = rows.filter((r) => r.improved_pass).length;
console.log("-".repeat(85));
console.log(`\nOverall pass rate — Baseline: ${baselineHits}/${rows.length} | Improved: ${improvedHits}/${rows.length}`);

const output = {
  run_date: new Date().toISOString(),
  baseline_pass_rate: `${baselineHits}/${rows.length}`,
  improved_pass_rate: `${improvedHits}/${rows.length}`,
  rows,
};
const outPath = path.join(__dirname, "results", "baseline-comparison.json");
fs.writeFileSync(outPath, JSON.stringify(output, null, 2));
console.log(`Results saved to ${outPath}`);
