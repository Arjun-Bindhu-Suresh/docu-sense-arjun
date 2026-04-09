const test = require("node:test");
const assert = require("node:assert/strict");

const {
  validateCuratedArtifact,
} = require("../lib/validate-curated-artifact");

test("accepts a valid curated artifact", () => {
  const input = {
    schema_version: "1.0.0",
    document_id: "doc-123",
    title: "Quarterly Report",
    source_filename: "quarterly-report.pdf",
    ingestion_date: "2026-04-09",
    source_hash: "abc123",
    summary: "A concise summary of the curated document.",
    topics: ["finance", "quarterly results"],
    chunks: [
      {
        chunk_id: "chunk-1",
        raw_text: "Revenue increased by 12 percent.",
        normalized_text: "revenue increased by 12 percent.",
        section_path: ["Executive Summary"],
        content_type: "paragraph",
        char_range: [0, 33],
        page_number: 1,
        retrieval_terms: ["revenue", "growth"],
      },
    ],
  };

  assert.deepEqual(validateCuratedArtifact(input), {
    success: true,
    errors: [],
  });
});

test("rejects a chunk when char_range start is greater than end", () => {
  const input = {
    schema_version: "1.0.0",
    document_id: "doc-123",
    title: "Quarterly Report",
    source_filename: "quarterly-report.pdf",
    ingestion_date: "2026-04-09",
    source_hash: "abc123",
    summary: "A concise summary of the curated document.",
    topics: ["finance", "quarterly results"],
    chunks: [
      {
        chunk_id: "chunk-1",
        raw_text: "Revenue increased by 12 percent.",
        normalized_text: "revenue increased by 12 percent.",
        section_path: ["Executive Summary"],
        content_type: "paragraph",
        char_range: { start: 33, end: 10 },
        page_number: 1,
        retrieval_terms: ["revenue", "growth"],
      },
    ],
  };

  assert.deepEqual(validateCuratedArtifact(input), {
    success: false,
    errors: ["Chunk char_range start must be less than or equal to end."],
  });
});

test("rejects a curated artifact when summary is empty", () => {
  const input = {
    schema_version: "1.0.0",
    document_id: "doc-123",
    title: "Quarterly Report",
    source_filename: "quarterly-report.pdf",
    ingestion_date: "2026-04-09",
    source_hash: "abc123",
    summary: "",
    topics: ["finance", "quarterly results"],
    chunks: [
      {
        chunk_id: "chunk-1",
        raw_text: "Revenue increased by 12 percent.",
        normalized_text: "revenue increased by 12 percent.",
        section_path: ["Executive Summary"],
        content_type: "paragraph",
        char_range: { start: 0, end: 33 },
        page_number: 1,
        retrieval_terms: ["revenue", "growth"],
      },
    ],
  };

  assert.deepEqual(validateCuratedArtifact(input), {
    success: false,
    errors: ["Summary must not be empty."],
  });
});

test("rejects a curated artifact when topics is empty", () => {
  const input = {
    schema_version: "1.0.0",
    document_id: "doc-123",
    title: "Quarterly Report",
    source_filename: "quarterly-report.pdf",
    ingestion_date: "2026-04-09",
    source_hash: "abc123",
    summary: "A concise summary of the curated document.",
    topics: [],
    chunks: [
      {
        chunk_id: "chunk-1",
        raw_text: "Revenue increased by 12 percent.",
        normalized_text: "revenue increased by 12 percent.",
        section_path: ["Executive Summary"],
        content_type: "paragraph",
        char_range: { start: 0, end: 33 },
        page_number: 1,
        retrieval_terms: ["revenue", "growth"],
      },
    ],
  };

  assert.deepEqual(validateCuratedArtifact(input), {
    success: false,
    errors: ["Topics must not be empty."],
  });
});

test("rejects a curated artifact when document_id is empty", () => {
  const input = {
    schema_version: "1.0.0",
    document_id: "",
    title: "Quarterly Report",
    source_filename: "quarterly-report.pdf",
    ingestion_date: "2026-04-09",
    source_hash: "abc123",
    summary: "A concise summary of the curated document.",
    topics: ["finance", "quarterly results"],
    chunks: [
      {
        chunk_id: "chunk-1",
        raw_text: "Revenue increased by 12 percent.",
        normalized_text: "revenue increased by 12 percent.",
        section_path: ["Executive Summary"],
        content_type: "paragraph",
        char_range: { start: 0, end: 33 },
        page_number: 1,
        retrieval_terms: ["revenue", "growth"],
      },
    ],
  };

  assert.deepEqual(validateCuratedArtifact(input), {
    success: false,
    errors: ["Required field must not be empty: document_id"],
  });
});
