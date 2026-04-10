import { NextResponse } from "next/server";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const question: string = body.question || "";

    if (!question.trim()) {
      return NextResponse.json({
        answer: "Please ask a valid question.",
      });
    }

    // 🔥 Load your JSON artifact
    const res = await fetch(
      "http://localhost:3000/data/sample-artifact.json"
    );

    if (!res.ok) {
      throw new Error("Failed to load artifact JSON");
    }

    const data = await res.json();

    const chunks = data.chunks || [];

    const lowerQuestion = question.toLowerCase();

    // 🔥 Simple keyword-based retrieval (v1 logic)
    let matchedChunk = null;

    for (const chunk of chunks) {
      const text = chunk.raw_text.toLowerCase();

      // basic matching rules
      if (
        lowerQuestion.includes("ai") && text.includes("ai")
      ) {
        matchedChunk = chunk;
        break;
      }

      if (
        lowerQuestion.includes("data") && text.includes("data")
      ) {
        matchedChunk = chunk;
        break;
      }
    }

    // ❌ No match
    if (!matchedChunk) {
      return NextResponse.json({
        answer: "No relevant information found in the document.",
      });
    }

    // ✅ Return matched chunk
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