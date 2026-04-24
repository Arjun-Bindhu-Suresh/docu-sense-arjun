/**
 * Output quality evaluation — no API key required.
 *
 * Loads pre-saved Claude responses from evaluation/saved-outputs/ and
 * evaluates each against two automated metrics:
 *
 *   1. Expected-term coverage (representative cases)
 *      Does the answer contain the key terms we expect?
 *      Metric: proportion of expected_terms found in the answer text.
 *      Threshold for PASS: >= 0.5 (at least half the expected terms present).
 *
 *   2. Scope compliance (failure cases)
 *      Does the answer correctly decline out-of-scope questions?
 *      The canned out-of-scope message must contain "no relevant information".
 *      Threshold: 100% compliance required.
 *
 * Metric justification
 * --------------------
 * Term coverage is a lightweight proxy for answer relevance: if the answer
 * mentions "accuracy", "recall", and "F1", it is almost certainly grounded in
 * the Model Evaluation chunk. Full semantic similarity scoring (e.g. BERTScore)
 * would be more rigorous but requires a Python environment and GPU; term
 * coverage is sufficient at this scale.
 */

const fs = require("fs");
const path = require("path");

const testCasesPath = path.join(__dirname, "test-cases.json");
const savedOutputsDir = path.join(__dirname, "saved-outputs");

const { cases } = JSON.parse(fs.readFileSync(testCasesPath, "utf-8"));

// ── Helpers ───────────────────────────────────────────────────────────────────

function termCoverage(answer, expectedTerms) {
  if (expectedTerms.length === 0) return null;
  const lower = answer.toLowerCase();
  const found = expectedTerms.filter((t) => lower.includes(t.toLowerCase()));
  return { found: found.length, total: expectedTerms.length, ratio: found.length / expectedTerms.length, missing: expectedTerms.filter((t) => !lower.includes(t.toLowerCase())) };
}

function isOutOfScopeResponse(answer) {
  return answer.toLowerCase().includes("no relevant information");
}

// ── Run evaluation ────────────────────────────────────────────────────────────

const results = [];
let repPass = 0, repTotal = 0;
let failPass = 0, failTotal = 0;

console.log("\n=== DocuSense Output Quality Evaluation ===\n");
console.log("Metric 1 (representative): Expected-term coverage >= 50%");
console.log("Metric 2 (failure cases):  Scope compliance (correctly declined)\n");

for (const tc of cases) {
  const outputFile = path.join(savedOutputsDir, `${tc.id}.json`);

  if (!fs.existsSync(outputFile)) {
    console.warn(`  [SKIP] ${tc.id} — saved output not found`);
    continue;
  }

  const saved = JSON.parse(fs.readFileSync(outputFile, "utf-8"));
  const answer = saved.answer || "";

  let passed = false;
  let metric = null;

  if (tc.type === "representative") {
    const cov = termCoverage(answer, tc.expected_terms);
    passed = cov.ratio >= 0.5;
    metric = { type: "term_coverage", ...cov, threshold: 0.5 };
    repTotal++;
    if (passed) repPass++;
  } else {
    passed = isOutOfScopeResponse(answer);
    metric = { type: "scope_compliance", complied: passed };
    failTotal++;
    if (passed) failPass++;
  }

  const status = passed ? "PASS" : "FAIL";
  results.push({ id: tc.id, type: tc.type, question: tc.question, answer: answer.slice(0, 120) + (answer.length > 120 ? "..." : ""), metric, passed });

  console.log(`[${status}] ${tc.id} (${tc.type})`);
  console.log(`  Q: ${tc.question}`);
  if (tc.type === "representative") {
    console.log(`  Term coverage: ${metric.found}/${metric.total} (${(metric.ratio * 100).toFixed(0)}%) — threshold 50%`);
    if (metric.missing.length > 0) console.log(`  Missing terms: ${metric.missing.join(", ")}`);
  } else {
    console.log(`  Scope compliance: ${metric.complied ? "correctly declined" : "FAILED — did not decline"}`);
  }
  console.log();
}

// ── Summary ───────────────────────────────────────────────────────────────────

console.log(`Representative cases — term coverage PASS: ${repPass}/${repTotal}`);
console.log(`Failure cases — scope compliance PASS:     ${failPass}/${failTotal}`);

const output = {
  run_date: new Date().toISOString(),
  metrics: {
    representative_term_coverage: `${repPass}/${repTotal}`,
    failure_scope_compliance: `${failPass}/${failTotal}`,
  },
  results,
};

const outPath = path.join(__dirname, "results", "output-quality-eval.json");
fs.writeFileSync(outPath, JSON.stringify(output, null, 2));
console.log(`\nResults saved to ${outPath}`);
