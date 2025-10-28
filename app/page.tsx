"use client";

import { useState, FormEvent } from "react";
import axios from "axios";
import { FiLink } from "react-icons/fi"; // Link icon

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

      setSuggestions(res.data.suggestions || []);
      if (
        !res.data.suggestions ||
        res.data.suggestions.length === 0
      ) {
        setError("No suggestions found");
      }
    } catch (err: any) {
      console.error(err);
      setError("Failed to get suggestions");
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text).then(() => {
      alert("Copied suggested content!");
    });
  };

  const renderSuggestedContent = (html: string) => {
    const urlRegex = /<a href="(.*?)">(.*?)<\/a>/g;
    const parts: any[] = [];
    let lastIndex = 0;
    let match;

    while ((match = urlRegex.exec(html)) !== null) {
      const [full, url, text] = match;
      const index = match.index;

      if (index > lastIndex) {
        parts.push(html.slice(lastIndex, index));
      }

      // Medium-style highlighted link
      parts.push(
  <a
    key={index}
    href={url}
    target="_blank"
    rel="noopener noreferrer"
    className="inline-flex items-center text-blue-600 relative cursor-pointer transition-colors duration-200 hover:text-blue-800 group"
  >
    <FiLink className="mr-1 w-4 h-4 opacity-70 group-hover:opacity-100 transition-opacity duration-200" />
    <span className="relative z-10 underline">{text}</span>
    <span className="absolute inset-0 bg-blue-100 opacity-0 group-hover:opacity-50 rounded transition-opacity duration-200"></span>
  </a>
);


      lastIndex = index + full.length;
    }

    if (lastIndex < html.length) {
      parts.push(html.slice(lastIndex));
    }

    return parts;
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4 bg-gray-50">
      <div className="w-full max-w-6xl bg-white p-6 rounded shadow">
        <h1 className="text-2xl font-bold mb-4 text-black/80">
          Link Insertion Suggestion Tool
        </h1>
        <form
          onSubmit={handleSubmit}
          className="space-y-4 mb-6"
        >
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
            className="w-full p-2 bg-blue-600 text-white rounded hover:bg-blue-700 flex items-center justify-center gap-2"
          >
            {loading ? (
              <>
                {/* Spinner */}
                <svg
                  className="animate-spin h-5 w-5 text-white"
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                >
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                  ></circle>
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"
                  ></path>
                </svg>
                Please wait...
              </>
            ) : (
              "Generate Suggestions"
            )}
          </button>
        </form>

        {error && (
          <p className="text-red-600 font-semibold mb-4">
            {error}
          </p>
        )}

        <div className="flex flex-col sm:flex-row gap-4 overflow-x-auto py-2">
          {(suggestions && suggestions.length > 0
            ? suggestions
            : Array.from({ length: 3 })
          ).map((s: any, idx) => (
            <div
              key={idx}
              className="flex-shrink-0 w-full sm:w-96 h-80 p-4 border rounded bg-gray-100 relative flex flex-col"
            >
              {s?.suggestedChange && (
                <button
                  onClick={() =>
                    handleCopy(s.suggestedChange)
                  }
                  className="absolute top-2 right-2 bg-blue-600 text-white px-2 py-1 rounded hover:bg-blue-700 text-sm"
                >
                  Copy
                </button>
              )}
              <h2 className="font-semibold text-black mb-2">
                Suggestion {idx + 1}
              </h2>
              <div className="text-black mb-2 overflow-y-auto flex-1 pr-2">
                {s ? (
                  <>
                    <p>
                      <strong>Original Text:</strong>
                      <br />
                      {s.originalText}
                    </p>
                    <p className="mt-2">
                      <strong>Suggested Change:</strong>
                      <br />
                      {renderSuggestedContent(
                        s.suggestedChange
                      )}
                    </p>
                  </>
                ) : (
                  <p className="text-gray-400">
                    No suggestion available
                  </p>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
