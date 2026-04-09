const REQUIRED_TOP_LEVEL_FIELDS = [
  "schema_version",
  "document_id",
  "title",
  "source_filename",
  "ingestion_date",
  "source_hash",
  "summary",
  "topics",
  "chunks",
];

const REQUIRED_CHUNK_FIELDS = [
  "chunk_id",
  "raw_text",
  "normalized_text",
  "section_path",
  "content_type",
  "char_range",
  "retrieval_terms",
];

function validateCuratedArtifact(input) {
  const errors = [];

  if (!isRecord(input)) {
    return {
      success: false,
      errors: ["Artifact must be an object."],
    };
  }

  for (const field of REQUIRED_TOP_LEVEL_FIELDS) {
    if (!(field in input)) {
      errors.push(`Missing required field: ${field}`);
    }
  }

  if (input.summary === "") {
    errors.push("Summary must not be empty.");
  }

  if (errors.length === 0) {
    for (const chunk of input.chunks) {
      if (!isRecord(chunk)) {
        errors.push("Chunk must be an object.");
        continue;
      }

      for (const field of REQUIRED_CHUNK_FIELDS) {
        if (!(field in chunk)) {
          errors.push(`Missing required chunk field: ${field}`);
        }
      }

      if (hasInvalidCharRange(chunk.char_range)) {
        errors.push("Chunk char_range start must be less than or equal to end.");
      }
    }
  }

  return {
    success: errors.length === 0,
    errors,
  };
}

function isRecord(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function hasInvalidCharRange(charRange) {
  return (
    isRecord(charRange) &&
    typeof charRange.start === "number" &&
    typeof charRange.end === "number" &&
    charRange.start > charRange.end
  );
}

module.exports = {
  validateCuratedArtifact,
};
