"use client";

import { useState, FormEvent } from "react";
import axios from "axios";

interface Suggestion {
  originalText: string;
  suggestedChange: string;
}

export default function Home() {
  const [sourceUrl, setSourceUrl] = useState("");
  const [targetUrl, setTargetUrl] = useState("");
  const [anchorText, setAnchorText] = useState("");
  const [suggestions, setSuggestions] = useState<
    Suggestion[] | null
  >(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setSuggestions(null);

    try {
      const res = await axios.post("/api/generate", {
        sourceUrl,
        targetUrl,
        anchorText,
      });
      setSuggestions(res.data.suggestions);
    } catch (err: any) {
      console.error(err);
      setError("Failed to get suggestions");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-gray-50">
      <div className="w-full max-w-lg bg-white p-6 rounded shadow">
        <h1 className="text-2xl font-bold mb-4">
          Link Insertion Suggestion Tool
        </h1>
        <form onSubmit={handleSubmit} className="space-y-4">
          <input
            type="url"
            placeholder="Source Article URL"
            value={sourceUrl}
            onChange={(e) => setSourceUrl(e.target.value)}
            required
            className="w-full text-black p-2 border rounded"
          />
          <input
            type="url"
            placeholder="Target URL"
            value={targetUrl}
            onChange={(e) => setTargetUrl(e.target.value)}
            required
            className="w-full text-black p-2 border rounded"
          />
          <input
            type="text"
            placeholder="Anchor Text"
            value={anchorText}
            onChange={(e) => setAnchorText(e.target.value)}
            required
            className="w-full p-2 text-black border rounded"
          />
          <button
            type="submit"
            disabled={loading}
            className="w-full p-2 bg-blue-600 text-black rounded hover:bg-blue-700"
          >
            {loading
              ? "Generating..."
              : "Generate Suggestions"}
          </button>
        </form>

        {error && (
          <p className="mt-4 text-red-600">{error}</p>
        )}

        {suggestions && (
          <div className="mt-6 space-y-4">
            {suggestions.map((s, idx) => (
              <div
                key={idx}
                className="p-4 border rounded bg-gray-500"
              >
                <h2 className="font-semibold">
                  Suggestion {idx + 1}
                </h2>
                <p>
                  <strong>Original Text:</strong>
                  <br />
                  {s.originalText}
                </p>
                <p className="mt-2">
                  <strong>Suggested Change:</strong>
                  <br />
                  {s.suggestedChange}
                </p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
