"use client";

import { useEffect, useState } from "react";

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

export default function Home() {
  const [data, setData] = useState<ArtifactData | null>(null);
  const [error, setError] = useState<string>("");
  const [question, setQuestion] = useState<string>("");
  const [answer, setAnswer] = useState<string>("");
  const [isLoadingAnswer, setIsLoadingAnswer] = useState<boolean>(false);

  useEffect(() => {
    fetch("/data/sample-artifact.json")
      .then((res) => {
        if (!res.ok) {
          throw new Error("Failed to fetch sample-artifact.json");
        }
        return res.json();
      })
      .then((json: ArtifactData) => {
        setData(json);
      })
      .catch((err: Error) => {
        console.error("Fetch error:", err);
        setError(err.message);
      });
  }, []);

  async function handleAsk() {
    if (!question.trim()) return;

    try {
      setIsLoadingAnswer(true);
      setAnswer("");

      const res = await fetch("/api/ask", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ question }),
      });

      if (!res.ok) {
        throw new Error("Failed to get answer from API");
      }

      const result = await res.json();
      setAnswer(result.answer || "No answer returned.");
    } catch (err) {
      console.error(err);
      setAnswer("Something went wrong while getting the answer.");
    } finally {
      setIsLoadingAnswer(false);
    }
  }

  if (error) {
    return (
      <main className="min-h-screen bg-gray-50 flex items-center justify-center p-8">
        <div className="w-full max-w-2xl rounded-2xl bg-white p-6 shadow">
          <h1 className="text-2xl font-bold text-red-600 mb-3">Error</h1>
          <p className="text-gray-700">{error}</p>
          <p className="text-sm text-gray-500 mt-4">
            Make sure <code>/public/data/sample-artifact.json</code> exists and
            contains valid JSON.
          </p>
        </div>
      </main>
    );
  }

  if (!data) {
    return (
      <main className="min-h-screen bg-gray-50 flex items-center justify-center p-8">
        <div className="rounded-2xl bg-white px-8 py-6 shadow">
          <p className="text-gray-700 text-lg">Loading document data...</p>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-5xl mx-auto">
        <header className="mb-8">
          <h1 className="text-4xl font-bold text-gray-900">DocuSense</h1>
          <p className="mt-2 text-gray-600">
            AI-powered document understanding (Proof of Concept)
          </p>
        </header>

        <div className="grid gap-6">
          <section className="bg-white p-6 rounded-2xl shadow">
            <h2 className="text-xl font-semibold mb-3 text-gray-900">
              Document
            </h2>
            <div className="space-y-2 text-gray-700">
              <p>
                <span className="font-medium">Title:</span> {data.title}
              </p>
              <p>
                <span className="font-medium">Source File:</span>{" "}
                {data.source_filename}
              </p>
              <p>
                <span className="font-medium">Document ID:</span>{" "}
                {data.document_id}
              </p>
              <p>
                <span className="font-medium">Schema Version:</span>{" "}
                {data.schema_version}
              </p>
              <p>
                <span className="font-medium">Ingestion Date:</span>{" "}
                {data.ingestion_date}
              </p>
              <p className="break-all">
                <span className="font-medium">Source Hash:</span>{" "}
                {data.source_hash}
              </p>
            </div>
          </section>

          <section className="bg-white p-6 rounded-2xl shadow">
            <h2 className="text-xl font-semibold mb-3 text-gray-900">
              Summary
            </h2>
            <p className="text-gray-700 leading-7">{data.summary}</p>
          </section>

          <section className="bg-white p-6 rounded-2xl shadow">
            <h2 className="text-xl font-semibold mb-3 text-gray-900">
              Key Topics
            </h2>
            <ul className="list-disc pl-5 space-y-2 text-gray-700">
              {data.topics.map((topic, index) => (
                <li key={index}>{topic}</li>
              ))}
            </ul>
          </section>

          <section className="bg-white p-6 rounded-2xl shadow">
            <h2 className="text-xl font-semibold mb-3 text-gray-900">
              Ask a Question
            </h2>

            <input
              type="text"
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              placeholder="Ask something about the document..."
              className="w-full border border-gray-300 rounded-lg p-3 mb-4 outline-none focus:ring-2 focus:ring-blue-500"
            />

            <button
              onClick={handleAsk}
              disabled={isLoadingAnswer || !question.trim()}
              className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition disabled:bg-gray-400 disabled:cursor-not-allowed"
            >
              {isLoadingAnswer ? "Thinking..." : "Ask"}
            </button>

            <div className="mt-4 rounded-xl bg-gray-50 p-4 border border-gray-200">
              <p className="text-gray-700">
                {answer || "Answer will appear here..."}
              </p>
            </div>
          </section>

          <section className="bg-white p-6 rounded-2xl shadow">
            <h2 className="text-xl font-semibold mb-3 text-gray-900">
              Sample Chunks
            </h2>
            <div className="space-y-4">
              {data.chunks.map((chunk) => (
                <div
                  key={chunk.chunk_id}
                  className="rounded-xl border border-gray-200 p-4"
                >
                  <p className="text-sm text-gray-500 mb-2">
                    <span className="font-medium">Chunk ID:</span>{" "}
                    {chunk.chunk_id}
                  </p>
                  <p className="text-sm text-gray-500 mb-2">
                    <span className="font-medium">Section:</span>{" "}
                    {chunk.section_path}
                  </p>
                  <p className="text-sm text-gray-500 mb-2">
                    <span className="font-medium">Content Type:</span>{" "}
                    {chunk.content_type}
                  </p>
                  {chunk.page_number && (
                    <p className="text-sm text-gray-500 mb-2">
                      <span className="font-medium">Page:</span>{" "}
                      {chunk.page_number}
                    </p>
                  )}
                  <p className="text-gray-700">{chunk.raw_text}</p>
                </div>
              ))}
            </div>
          </section>
        </div>
      </div>
    </main>
  );
}