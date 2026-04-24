"use client";

import { useEffect, useState } from "react";

type ArtifactChunk = {
  chunk_id: string;
  raw_text: string;
  normalized_text: string;
  section_path: string;
  content_type: string;
  char_range: { start: number; end: number };
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

type ChunkUsed = {
  chunk_id: string;
  section_path: string;
  raw_text: string;
};

type AskResult = {
  answer: string;
  chunks_used: ChunkUsed[];
  model?: string;
};

export default function Home() {
  const [data, setData] = useState<ArtifactData | null>(null);
  const [error, setError] = useState<string>("");
  const [question, setQuestion] = useState<string>("");
  const [result, setResult] = useState<AskResult | null>(null);
  const [isLoadingAnswer, setIsLoadingAnswer] = useState<boolean>(false);

  useEffect(() => {
    fetch("/data/sample-artifact.json")
      .then((res) => {
        if (!res.ok) throw new Error("Failed to fetch sample-artifact.json");
        return res.json();
      })
      .then((json: ArtifactData) => setData(json))
      .catch((err: Error) => {
        console.error("Fetch error:", err);
        setError(err.message);
      });
  }, []);

  async function handleAsk() {
    if (!question.trim()) return;
    try {
      setIsLoadingAnswer(true);
      setResult(null);
      const res = await fetch("/api/ask", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question }),
      });
      if (!res.ok) throw new Error("Failed to get answer from API");
      const json: AskResult = await res.json();
      setResult(json);
    } catch (err) {
      console.error(err);
      setResult({ answer: "Something went wrong while getting the answer.", chunks_used: [] });
    } finally {
      setIsLoadingAnswer(false);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter") handleAsk();
  }

  if (error) {
    return (
      <main className="min-h-screen bg-gray-50 flex items-center justify-center p-8">
        <div className="w-full max-w-2xl rounded-2xl bg-white p-6 shadow">
          <h1 className="text-2xl font-bold text-red-600 mb-3">Error</h1>
          <p className="text-gray-700">{error}</p>
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
          <p className="mt-2 text-gray-600">AI-powered document Q&amp;A — answers grounded in your document</p>
        </header>

        <div className="grid gap-6">
          <section className="bg-white p-6 rounded-2xl shadow">
            <h2 className="text-xl font-semibold mb-3 text-gray-900">Document</h2>
            <div className="space-y-2 text-gray-700">
              <p><span className="font-medium">Title:</span> {data.title}</p>
              <p><span className="font-medium">Source File:</span> {data.source_filename}</p>
              <p><span className="font-medium">Document ID:</span> {data.document_id}</p>
              <p><span className="font-medium">Ingestion Date:</span> {data.ingestion_date}</p>
            </div>
          </section>

          <section className="bg-white p-6 rounded-2xl shadow">
            <h2 className="text-xl font-semibold mb-3 text-gray-900">Summary</h2>
            <p className="text-gray-700 leading-7">{data.summary}</p>
          </section>

          <section className="bg-white p-6 rounded-2xl shadow">
            <h2 className="text-xl font-semibold mb-3 text-gray-900">Key Topics</h2>
            <div className="flex flex-wrap gap-2">
              {data.topics.map((topic, index) => (
                <span key={index} className="bg-blue-50 text-blue-700 px-3 py-1 rounded-full text-sm font-medium">
                  {topic}
                </span>
              ))}
            </div>
          </section>

          <section className="bg-white p-6 rounded-2xl shadow">
            <h2 className="text-xl font-semibold mb-3 text-gray-900">Ask a Question</h2>
            <div className="flex gap-3 mb-4">
              <input
                type="text"
                value={question}
                onChange={(e) => setQuestion(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Ask something about the document..."
                className="flex-1 border border-gray-300 rounded-lg p-3 outline-none focus:ring-2 focus:ring-blue-500"
              />
              <button
                onClick={handleAsk}
                disabled={isLoadingAnswer || !question.trim()}
                className="bg-blue-600 text-white px-5 py-2 rounded-lg hover:bg-blue-700 transition disabled:bg-gray-400 disabled:cursor-not-allowed whitespace-nowrap"
              >
                {isLoadingAnswer ? "Thinking..." : "Ask"}
              </button>
            </div>

            {result ? (
              <div className="space-y-4">
                <div className="rounded-xl bg-blue-50 p-4 border border-blue-200">
                  <p className="text-xs font-semibold text-blue-500 uppercase tracking-wide mb-1">Answer</p>
                  <p className="text-gray-800 leading-7">{result.answer}</p>
                  {result.model && (
                    <p className="text-xs text-gray-400 mt-2">Model: {result.model}</p>
                  )}
                </div>

                {result.chunks_used.length > 0 && (
                  <div>
                    <p className="text-sm font-semibold text-gray-600 mb-2">
                      Sources used ({result.chunks_used.length} chunk{result.chunks_used.length !== 1 ? "s" : ""})
                    </p>
                    <div className="space-y-2">
                      {result.chunks_used.map((c) => (
                        <div key={c.chunk_id} className="rounded-lg border border-gray-200 bg-gray-50 p-3">
                          <p className="text-xs text-blue-600 font-medium mb-1">{c.section_path}</p>
                          <p className="text-sm text-gray-700">{c.raw_text}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="rounded-xl bg-gray-50 p-4 border border-gray-200">
                <p className="text-gray-400">Answer will appear here...</p>
              </div>
            )}
          </section>

          <section className="bg-white p-6 rounded-2xl shadow">
            <h2 className="text-xl font-semibold mb-3 text-gray-900">
              Document Chunks <span className="text-sm font-normal text-gray-400">({data.chunks.length} total)</span>
            </h2>
            <div className="space-y-3">
              {data.chunks.map((chunk) => (
                <div key={chunk.chunk_id} className="rounded-xl border border-gray-200 p-4">
                  <div className="flex items-center gap-3 mb-2">
                    <span className="text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded font-mono">
                      {chunk.chunk_id}
                    </span>
                    <span className="text-xs text-blue-600 font-medium">{chunk.section_path}</span>
                    {chunk.page_number && (
                      <span className="text-xs text-gray-400">p.{chunk.page_number}</span>
                    )}
                  </div>
                  <p className="text-gray-700 text-sm leading-6">{chunk.raw_text}</p>
                  <div className="flex flex-wrap gap-1 mt-2">
                    {chunk.retrieval_terms.map((term, i) => (
                      <span key={i} className="text-xs bg-green-50 text-green-700 px-2 py-0.5 rounded">
                        {term}
                      </span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </section>
        </div>
      </div>
    </main>
  );
}
