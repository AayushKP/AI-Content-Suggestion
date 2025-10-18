import { NextResponse } from "next/server";
import { GoogleGenAI } from "@google/genai";
import axios from "axios";
import * as cheerio from "cheerio";

async function scrapeText(url: string): Promise<string> {
  const { data } = await axios.get(url);
  const $ = cheerio.load(data);
  const text = $("p")
    .map((_, el) => $(el).text())
    .get()
    .join(" ");
  return text.replace(/\s+/g, " ").trim().slice(0, 8000);
}

export async function POST(req: Request) {
  try {
    const { sourceUrl, targetUrl, anchorText } =
      await req.json();

    const sourceText = await scrapeText(sourceUrl);
    const targetText = await scrapeText(targetUrl);

    const prompt = `
You are an AI writing assistant.

Source article:
"${sourceText}"

Target article:
"${targetText}"

We want to add a hyperlink with anchor text "${anchorText}" pointing to ${targetUrl}.

Suggest up to 3 natural insertions.
Respond strictly as JSON in this format:
[
  { "originalText": "...", "suggestedChange": "..." },
  ...
]
`;

    const ai = new GoogleGenAI({
      apiKey: process.env.GEMINI_API_KEY!,
    });

    const result = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: prompt,
    });

    let text: any = result.text;
    text = text?.replace(/(^```json|```$)/g, "").trim();

    let parsed;
    try {
      parsed = JSON.parse(text);
    } catch (e) {
      console.error("Failed to parse JSON:", e);
      console.log("Raw response:", text);
      parsed = []; // fallback
    }

    return NextResponse.json({ suggestions: parsed });
  } catch (error: any) {
    console.error("Gemini Error:", error);
    return NextResponse.json(
      { error: error.message || "Something went wrong" },
      { status: 500 }
    );
  }
}
