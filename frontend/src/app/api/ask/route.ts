import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";

type ArtifactChunk = {
  chunk_id: string;
  raw_text: string;
  normalized_text: string;
  section_path: string;
  content_type: string;
  char_range: {
    start: number;
    end: number;
  };
  page_number?: number;
  retrieval_terms: string[];
};

type ArtifactData = {
  schema_version: string;
  document_id: string;
  title: string;
  source_filename: string;
  ingestion_date: string;
  source_hash: string;
  summary: string;
  topics: string[];
  chunks: ArtifactChunk[];
};

function loadArtifact(): ArtifactData {
  const filePath = path.join(
    process.cwd(),
    "public",
    "data",
    "sample-artifact.json"
  );

  const fileContents = fs.readFileSync(filePath, "utf-8");
  return JSON.parse(fileContents);
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const question: string = body.question || "";

    if (!question.trim()) {
      return NextResponse.json({
        answer: "Please ask a valid question.",
      });
    }

    const data = loadArtifact();
    const chunks = data.chunks || [];
    const lowerQuestion = question.toLowerCase();

    let matchedChunk: ArtifactChunk | null = null;

    for (const chunk of chunks) {
      const text = chunk.raw_text.toLowerCase();

      if (lowerQuestion.includes("ai") && text.includes("ai")) {
        matchedChunk = chunk;
        break;
      }

      if (lowerQuestion.includes("data") && text.includes("data")) {
        matchedChunk = chunk;
        break;
      }
    }

    if (!matchedChunk) {
      return NextResponse.json({
        answer: "No relevant information found in the document.",
      });
    }

    return NextResponse.json({
      answer: matchedChunk.raw_text,
    });
  } catch (error) {
    console.error("API Error:", error);

    return NextResponse.json({
      answer: "System error occurred while processing your request.",
    });
  }
}