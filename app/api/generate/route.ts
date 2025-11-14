import { NextResponse } from "next/server";
import axios from "axios";
import jsdom from "jsdom";
import { Readability } from "@mozilla/readability";
import { GoogleGenerativeAI } from "@google/generative-ai";

type Suggestion = { originalText: string; suggestedChange: string };
type ParagraphEmbedding = { idx: number; emb: number[] };

function isValidHttpUrl(u: string) {
  try {
    const url = new URL(u);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

async function fetchHtml(url: string) {
  const res = await axios.get(url, {
    headers: { "User-Agent": "AI-LinkSuggestionTool" },
    timeout: 10000,
  });
  return res.data as string;
}

function extractArticle(html: string, baseUrl: string) {
  const dom = new jsdom.JSDOM(html, { url: baseUrl });
  const reader = new Readability(dom.window.document);
  return reader.parse() || { textContent: "" };
}

function splitParagraphs(text: string) {
  return text
    .replace(/\r\n/g, "\n")
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter((p) => p.length > 30);
}

function cosine(a: number[], b: number[]) {
  let dot = 0,
    na = 0,
    nb = 0;
  for (let i = 0; i < a.length && i < b.length; i++) {
    dot += a[i] * b[i];
    na += a[i] * a[i];
    nb += b[i] * b[i];
  }
  return dot / (Math.sqrt(na) * Math.sqrt(nb) + 1e-12);
}

export async function POST(req: Request) {
  try {
    const { sourceUrl, targetUrl, anchorText } = await req.json();

    if (!isValidHttpUrl(sourceUrl) || !isValidHttpUrl(targetUrl)) {
      return NextResponse.json({ error: "Invalid URLs" }, { status: 400 });
    }

    // Fetch both pages
    const [sHtml, tHtml] = await Promise.all([
      fetchHtml(sourceUrl),
      fetchHtml(targetUrl),
    ]);

    // Extract readable article content
    const sArticle = extractArticle(sHtml, sourceUrl);
    const tArticle = extractArticle(tHtml, targetUrl);

    const sText = sArticle.textContent || "";
    const tText = tArticle.textContent || "";

    const paragraphs = splitParagraphs(sText);
    if (paragraphs.length === 0) {
      return NextResponse.json(
        { error: "No valid paragraphs found in source article" },
        { status: 400 }
      );
    }

    // ---- Initialize Gemini ----
    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);

    // ---- EMBEDDINGS (using text-embedding-004) ----
    const embedModel = genAI.getGenerativeModel({
      model: "text-embedding-004",
    });

    // Embed target page
    const targetEmbedRes = await embedModel.embedContent(
      //@ts-ignore
      `${tArticle.title || ""}\n${tText.slice(0, 2000)}`
    );
    const targetVector = targetEmbedRes.embedding.values;

    // Embed each paragraph
    const paraEmbeds: ParagraphEmbedding[] = [];
    for (let i = 0; i < paragraphs.length; i++) {
      const r = await embedModel.embedContent(paragraphs[i]);
      paraEmbeds.push({ idx: i, emb: r.embedding.values });
    }

    // Rank paragraphs by similarity
    const scored = paraEmbeds
      .map((p) => ({
        idx: p.idx,
        text: paragraphs[p.idx],
        score: cosine(targetVector, p.emb),
      }))
      .sort((a, b) => b.score - a.score)
      .slice(0, 6);

    const candidateBlocks = scored
      .map((c, i) => `CANDIDATE_${i + 1}:\n${c.text}`)
      .join("\n\n---\n\n");

    // ---- LLM Prompt ----
    const prompt = `
You suggest natural hyperlink insertions.

Anchor Text: "${anchorText}"
Target URL: ${targetUrl}

Target Article Summary:
${tText.slice(0, 800)}

Candidate paragraphs from source:
${candidateBlocks}

Rules:
- Return ONLY JSON in this format:
[
  { "originalText": "...", "suggestedChange": "..." }
]
- 1 to 3 suggestions only.
- Each suggestedChange MUST include:
  <a href="${targetUrl}">${anchorText}</a>
`;

    // ---- Call Gemini LLM ----
    const llm = genAI.getGenerativeModel({
      model: "gemini-2.5-flash",
    });

    const result = await llm.generateContent(prompt);
    const rawText = result.response.text().trim();

    // Attempt JSON parse
    let suggestions: Suggestion[] = [];
    try {
      suggestions = JSON.parse(rawText);
    } catch {
      const match = rawText.match(/\[[\s\S]*\]/);
      if (match) suggestions = JSON.parse(match[0]);
    }

    // Sanitize & limit
    suggestions = (suggestions || [])
      .filter(
        (s) =>
          s &&
          typeof s.originalText === "string" &&
          typeof s.suggestedChange === "string"
      )
      .slice(0, 3);

    return NextResponse.json({ suggestions });
  } catch (err: any) {
    console.error(err);
    return NextResponse.json(
      { error: err.message || "Server error" },
      { status: 500 }
    );
  }
}
