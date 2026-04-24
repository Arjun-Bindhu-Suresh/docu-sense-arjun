# DocuSense — AI Document Q&A Application

DocuSense is an end-to-end AI document Q&A application. It ingests a single document through a structured ETL pipeline and lets users ask natural-language questions. The system retrieves the most relevant document chunks using scored keyword overlap and returns them as the answer.

---

## Live App

Deployed on Vercel: [docu-sense-arjun.vercel.app](https://docu-sense-arjun.vercel.app)

---

## What the App Does

- Displays a processed document (title, summary, key topics)
- Accepts natural-language questions about the document
- Retrieves the most relevant chunks using keyword overlap scoring
- Returns the retrieved chunk texts directly as the answer — no LLM required
- Displays the answer alongside the source chunks used (evidence)

### Supported Tasks
- Summarizing a document
- Extracting key topics or themes
- Answering narrow, document-grounded questions
- Showing which document chunks were used to generate an answer

### Out of Scope
- Multi-document search or comparison
- Open-domain chatbot (questions outside the document are declined)
- User authentication or multi-user support
- Large-scale vector database infrastructure
- Real-time document uploads (document is pre-processed)

---

## Part 1: Architecture Classification — Retrieval-first

### Why Retrieval-first?

DocuSense uses a single pattern: keyword overlap scoring selects the top-3 most relevant document chunks for each user question, and those chunks are returned directly as the answer. No LLM or API key is required.

Chunks are scored by term overlap with the query:
- Raw text match: **+1** per matching term
- Curated `retrieval_terms` match: **+2** per matching term (subject-matter tags weighted higher)
- Only chunks where **at least 2 distinct query terms** match are returned (minimum-terms gate)

### Why Not Prompt-first / LLM generation?

Adding an LLM call (e.g., Claude, OpenAI) would require an API key, add per-query cost, and introduce latency and external dependencies. For a single focused document where the chunk text itself is the answer, returning the retrieved text directly is simpler, faster, fully transparent, and needs no credentials to run.

### Why Not Pure RAG with vector embeddings?

Vector embeddings (Pinecone, Chroma, etc.) require an embedding API, a vector database, and an embedding step per query. This is significant operational overhead for a single-document proof of concept that fits comfortably in memory. Keyword scoring is sufficient and fully debuggable at this scope.

### Why Not Tool-first?

The system does not need to call external APIs, run calculations, or look up live data. All information lives in the pre-processed artifact. Tool calling would add complexity without benefit here.

### Architecture Tradeoffs

| Factor | This system | RAG + LLM alternative |
|---|---|---|
| Cost | Zero (no API calls) | Medium (embedding + LLM per query) |
| Operational overhead | Very low (static JSON, no credentials) | High (vector DB, API keys, embeddings) |
| Performance | Very fast (~50 ms) | Slower (embedding + generation steps) |
| Debuggability | High (scores visible, fully deterministic) | Lower (opaque embeddings + generation) |
| Determinism | 100% — same query always returns same chunks | Variable (LLM temperature, model updates) |
| Context-window limits | Not applicable — no LLM in the loop | Must fit retrieved chunks in model context |
| Amount of data / files | Single document; keyword index fits in memory | Scales to thousands of documents via vector index |
| Answer quality | Exact document text, no synthesis | Synthesised, more natural language |
| Scale to many docs | Poor (no index) | Excellent |

### Important Capability Not Implemented: LLM Answer Generation

The system returns raw retrieved chunk text rather than generating a synthesised answer. Adding an LLM (e.g., Claude Haiku) would let the system produce concise, natural-language answers instead of raw excerpts. It would require an API key, add ~1–2 s latency, and cost per query. I would add this when:
- Users find the raw chunk text too verbose or hard to parse
- The document corpus grows and answers need to synthesise across multiple chunks
- A budget for API usage is available

---

## Part 2: Pipeline and Data Flow

```
Raw Document (PDF)
    │
    ▼
[Bronze Layer]  data/bronze/      ← raw file stored as-is
    │
    ▼
[Silver Layer]  data/silver/      ← cleaned, structured text extraction
    │
    ▼
[Gold Layer]    data/gold/sample-artifact.json
                  schema_version, title, summary, topics, chunks[]
                  each chunk: raw_text, normalized_text, section_path,
                               char_range, page_number, retrieval_terms[]
    │
    ▼  (copied to)
frontend/public/data/sample-artifact.json
    │
    ├──► GET /data/sample-artifact.json  → UI renders summary, topics, chunks
    │
    └──► POST /api/ask   { question: "..." }
              │
              ├─ 1. Load artifact (server-side, in-memory cached)
              ├─ 2. Tokenize query → remove stopwords
              ├─ 3. Score each chunk: text overlap (+1) + retrieval_terms bonus (+2)
              ├─ 4. Filter: score > 0 AND ≥ 2 distinct query terms match
              ├─ 5. Sort by score, return top-3
              │
              ├─ [Zero chunks?] → return "No relevant information found"
              │
              └─ 6. Format answer: join chunks as [section_path]\nraw_text
                 Return { answer, chunks_used[] }
                        │
                        ▼
                  UI: answer text + source chunks displayed
```

### Internal Information for Debugging / Evaluation

Every `/api/ask` response includes:
- `answer` — retrieved chunk texts joined with section headers
- `chunks_used` — chunk_id, section_path, raw_text for each retrieved chunk

No API key required. Evaluation scripts in `evaluation/` can run offline and verify:
- which chunks were retrieved and why (scores)
- whether the right chunks were returned for each test case
- whether saved outputs have the required schema

Where errors can happen:
- **Retrieval**: keyword mismatch for paraphrased questions (known limitation)
- **Artifact load**: if `public/data/sample-artifact.json` is missing or malformed
- **Answer formatting**: unexpected chunk structure (caught and returned as error message)

---

## Part 3: Evaluation

### Evaluation Commands

```bash
npm test              # Schema validation unit tests
npm run eval:retrieval  # Retrieval hit-rate evaluation
npm run eval:baseline   # Baseline vs improved comparison
npm run eval:quality    # Output quality evaluation
npm run eval:e2e        # End-to-end pipeline evaluation
npm run eval:all        # Run all four in sequence
```

---

### 3a. Upstream Component: Retrieval Quality

**Metric: Hit Rate @ 3** — is the expected chunk in the top-3 results?

**Why this metric:** For a retrieval system whose job is to surface the right document section for a user question, hit rate directly measures whether the correct information is present in the response. Precision@k is also tracked implicitly: the system returns at most 3 chunks, so if the expected chunk is present it is always in a very small candidate set.

Run: `npm run eval:retrieval`

| Case | Question | Expected Chunk | Retrieved | Pass |
|---|---|---|---|---|
| tc-01 | What is machine learning? | chunk-1 | chunk-1, chunk-2, chunk-3 | PASS |
| tc-02 | What are the types of machine learning? | chunk-2 | chunk-1, chunk-2, chunk-3 | PASS |
| tc-03 | What metrics are used to evaluate ML models? | chunk-4 | chunk-1, chunk-4, chunk-2 | PASS |
| tc-04 | What are the applications of ML in healthcare/finance? | chunk-5 | chunk-5, chunk-1, chunk-2 | PASS |
| tc-05 | What ethical concerns exist in machine learning? | chunk-7 | chunk-1, chunk-7, chunk-2 | PASS |
| tc-06 (failure) | Who invented the Python programming language? | none | none | PASS |
| tc-07 (failure) | What is the current GDP of Germany? | none | none | PASS |

**Hit Rate @ 3: 5/5 = 100%**
**Failure case accuracy: 2/2 = 100%** (after the minimum-terms fix described in Part 4)

---

### 3b. Output Quality

**Metric: Expected-term coverage** — does the answer mention the key terms we expect for that question?

**Why this metric:** Term coverage is a lightweight proxy for answer relevance. If the answer to "What metrics are used to evaluate ML models?" contains "accuracy", "recall", "F1", and "cross-validation", it is almost certainly grounded in the Model Evaluation chunk and is factually correct. Full semantic similarity scoring (e.g., BERTScore, ROUGE) would be more rigorous but requires a Python environment; term coverage is sufficient at this document scale.

**Threshold:** PASS if ≥ 50% of expected terms appear in the answer.

Run: `npm run eval:quality`

Saved responses are in `evaluation/saved-outputs/`.

| Case | Type | Term Coverage | Pass |
|---|---|---|---|
| tc-01 | representative | 4/4 = 100% | PASS |
| tc-02 | representative | 3/3 = 100% | PASS |
| tc-03 | representative | 5/5 = 100% | PASS |
| tc-04 | representative | 4/4 = 100% | PASS |
| tc-05 | representative | 4/4 = 100% | PASS |
| tc-06 | failure | scope compliance | PASS |
| tc-07 | failure | scope compliance | PASS |

**Representative term coverage PASS: 5/5 = 100%**
**Failure scope compliance PASS: 2/2 = 100%**

---

### 3c. End-to-End Task Success

**Metric:** Does the full pipeline (artifact load → retrieval → prompt build → response schema) complete correctly for every test case?

**Stages verified per case:**
1. Artifact is loaded with valid chunks
2. Retrieval returns the correct chunks (or correctly returns none)
3. Context string is well-formed (representative cases only)
4. Out-of-scope gate fires and returns canned message (failure cases only)
5. Saved response has `answer` string and `chunks_used` array
6. Answer is grounded in chunks that retrieval actually returned (representative cases only)

Run: `npm run eval:e2e`

**End-to-end task success: 7/7 = 100%**

---

### 3d. Baseline Comparison

**Baseline (Assignment 5):** Only matched if the question contained the word "ai" or "data" AND a chunk contained the same word. Hard-coded, fragile.

Run: `npm run eval:baseline`

| Question | Baseline | Improved |
|---|---|---|
| What is machine learning? | FAIL | PASS |
| What are the types of machine learning? | FAIL | PASS |
| What metrics are used to evaluate ML models? | FAIL | PASS |
| What are ML applications in healthcare/finance? | FAIL | PASS |
| What ethical concerns exist in ML? | FAIL | PASS |
| Who invented Python? (failure) | PASS | PASS |
| What is GDP of Germany? (failure) | PASS | PASS |

**Baseline: 2/7 | Improved: 7/7**

The baseline "passed" both failure cases only because it returned nothing for almost every question — it had no real retrieval at all.

---

### 3e. Failure Cases

**tc-06 — Before fix:** "Who invented the Python programming language?" incorrectly retrieved chunk-5 (Applications) because the word "language" in the query matched "natural language processing" in the chunk. This single-word false positive shows that keyword retrieval without a coverage gate is vulnerable to accidental term overlap.

**tc-06 — After fix:** Returns no chunks. The minimum-terms gate (≥2 distinct query terms must match) eliminates this false positive. Only "language" matched (1 out of 4 query terms), which is below the threshold.

**tc-07:** "What is the current GDP of Germany?" — no economic content in the ML document. Returns no chunks both before and after the fix.

**Remaining weakness:** Paraphrased questions. "What challenges does ML face?" may not reliably retrieve chunk-6 ("Limitations and Challenges") because the query term "challenges" appears in chunk-6's raw text ("significant challenges") but is not in `retrieval_terms`. This is a known limitation of keyword retrieval.

---

## Part 4: Improvement Made (Evidence-Based)

### Problem Identified

`tc-06` ("Who invented the Python programming language?") was a documented failure: the retrieval function returned chunk-5 instead of no results. Evidence: `evaluation/results/retrieval-eval.json` showed `tc-06: FAIL` before the fix. The root cause was that a single matching query term ("language" → "natural language processing") was enough to pass the `score > 0` filter.

### Change Made

**File changed:** `frontend/src/lib/retrieval.ts` (and mirrored in both `evaluation/evaluate-retrieval.js` and `evaluation/baseline-comparison.js`)

Added a **minimum matching terms gate**: a chunk is only included if at least `min(2, queryTerms.length)` distinct query terms match it. This prevents accidental single-term overlaps from polluting results while still handling single-token queries ("What is overfitting?" tokenizes to ["overfitting"] — 1 term required → chunk-6 still matches correctly).

```typescript
// Before
.filter(({ score }) => score > 0)

// After  
const minMatches = Math.min(2, queryTerms.length);
.filter(({ score, matches }) => score > 0 && matches >= minMatches)
```

### What Improved

| Metric | Before | After |
|---|---|---|
| Retrieval hit rate @ 3 (representative) | 5/5 (100%) | 5/5 (100%) |
| Failure case accuracy | 1/2 (50%) | 2/2 (100%) |
| Baseline comparison overall | 6/7 (86%) | 7/7 (100%) |

No representative cases were broken by the change. The fix is targeted and evidence-driven.

### What Still Remains Weak

Paraphrase handling. A user asking "What can go wrong with ML models?" would need the word "wrong", "problems", or "limitations" to reliably retrieve chunk-6. Semantic vector retrieval is the correct long-term fix; it was not added here because the document is small enough that the current keyword approach is acceptable and far simpler to operate.

---

## Setup

### Prerequisites
- Node.js 18+

### Local Development

```bash
git clone https://github.com/Arjun-Bindhu-Suresh/docu-sense-arjun.git
cd docu-sense-arjun

cd frontend
npm install
npm run dev
```

App runs at http://localhost:3000

### Run Tests and Evaluations

```bash
# From repo root:
npm test               # Schema validation unit tests (5 cases)
npm run eval:retrieval # Hit rate @ 3 evaluation (7 cases)
npm run eval:baseline  # Baseline vs improved comparison (7 cases)
npm run eval:quality   # Output quality / term coverage (7 cases)
npm run eval:e2e       # End-to-end pipeline validation (7 cases)
npm run eval:all       # All four in sequence
```

No API key required for any evaluation script.

### Deployment

Deployed on Vercel. No environment variables required — the app runs entirely on static JSON and server-side retrieval logic.

---

## Repository Structure

```
docu-sense-arjun/
├── data/
│   ├── bronze/               Raw documents (ingestion input)
│   ├── silver/               Cleaned structured data
│   └── gold/
│       └── sample-artifact.json   Curated chunks (source of truth, 7 chunks)
├── evaluation/
│   ├── test-cases.json            7 test cases (5 representative + 2 failure)
│   ├── evaluate-retrieval.js      Retrieval hit-rate evaluation (upstream component)
│   ├── baseline-comparison.js     Baseline (Assignment 5) vs improved comparison
│   ├── evaluate-output-quality.js Output quality / term coverage evaluation
│   ├── evaluate-end-to-end.js     End-to-end pipeline stage validation
│   ├── saved-outputs/             Pre-saved response fixtures for quality eval
│   │   ├── tc-01.json … tc-07.json
│   └── results/
│       ├── retrieval-eval.json          Saved: 5/5 hit rate, 2/2 failure accuracy
│       ├── baseline-comparison.json     Saved: 2/7 baseline → 7/7 improved
│       ├── output-quality-eval.json     Saved: 5/5 term coverage, 2/2 scope compliance
│       └── end-to-end-eval.json         Saved: 7/7 pipeline stages pass
├── frontend/
│   ├── src/
│   │   ├── app/
│   │   │   ├── page.tsx           Main UI
│   │   │   └── api/ask/route.ts   Q&A API endpoint (retrieval + answer formatting)
│   │   └── lib/
│   │       └── retrieval.ts       Keyword scoring retrieval (with min-terms gate)
│   ├── public/data/               Artifact served statically to UI
│   └── .env.local.example         Example env file (no API key needed)
├── lib/
│   └── validate-curated-artifact.js   Schema validation
├── tests/
│   └── validate-curated-artifact.test.js   Unit tests (5 cases)
└── README.md
```
