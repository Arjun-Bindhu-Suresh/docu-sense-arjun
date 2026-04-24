import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import { retrieveTopChunks, ArtifactChunk } from "@/lib/retrieval";

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

let cachedArtifact: ArtifactData | null = null;

function loadArtifact(): ArtifactData {
  if (cachedArtifact) return cachedArtifact;
  const filePath = path.join(process.cwd(), "public", "data", "sample-artifact.json");
  cachedArtifact = JSON.parse(fs.readFileSync(filePath, "utf-8"));
  return cachedArtifact!;
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const question: string = (body.question || "").trim();

    if (!question) {
      return NextResponse.json({ answer: "Please ask a valid question.", chunks_used: [] });
    }

    const data = loadArtifact();
    const topChunks = retrieveTopChunks(question, data.chunks, 3);

    if (topChunks.length === 0) {
      return NextResponse.json({
        answer: "No relevant information was found in this document for your question.",
        chunks_used: [],
      });
    }

    // Build answer directly from retrieved chunks — no LLM call needed
    const answer = topChunks
      .map((c) => `[${c.section_path}]\n${c.raw_text}`)
      .join("\n\n");

    return NextResponse.json({
      answer,
      chunks_used: topChunks.map((c) => ({
        chunk_id: c.chunk_id,
        section_path: c.section_path,
        raw_text: c.raw_text,
      })),
    });
  } catch (error) {
    console.error("API Error:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json(
      { answer: `System error: ${message}`, chunks_used: [] },
      { status: 500 }
    );
  }
}
