import { tool } from "@langchain/core/tools";
import { z } from "zod";
import dotenv from 'dotenv';


dotenv.config();

const searchSchema = z.object({
  query: z.string().describe("The search query for the repair problem."),
});

const webSearchImpl = async ({ query }: z.infer<typeof searchSchema>) => {
  try {
    const apiKey = process.env.TAVILY_API_KEY;
    if (!apiKey) {
      console.log('[WebSearch] TAVILY_API_KEY not configured');
      return JSON.stringify({
        error: "Web search is not configured. Please set TAVILY_API_KEY environment variable.",
        suggestion: "You can get a free API key from https://tavily.com or ask the user to search manually."
      });
    }
    
    const response = await fetch("https://api.tavily.com/search", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        api_key: apiKey,
        query: query,
        search_depth: "basic",
        include_answer: true,
        include_images: true,
        max_results: 8
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.log(`[WebSearch] Tavily API error: ${response.status} - ${errorText}`);
      throw new Error(`Tavily API returned ${response.status}: ${response.statusText}`);
    }

    const data = await response.json();
    console.log(`[WebSearch] Found ${data.images?.length || 0} images`);
    return JSON.stringify({
      answer: data.answer,
      images: data.images || [], // Return images found by Tavily
      results: data.results.map((r: any) => ({
        title: r.title,
        url: r.url,
        content: r.content?.slice(0, 1000) || "" // Optimizae token usage: Truncate content
      }))
    });

  } catch (error: any) {
    console.log(`[WebSearch] Error: ${error.message}`);
    return JSON.stringify({
      error: `Web search failed: ${error.message}`,
      suggestion: "Unable to perform web search. Please try rephrasing your question or search manually."
    });
  }
};

export const webSearchTool = tool(webSearchImpl as any, {
  name: "web_search",
  description: "Use this tool to find repair information from the web. ESSENTIAL for finding IMAGES, DIAGRAMS, and YOUTUBE VIDEOS. Use this when iFixit lacks visuals or to supplement text guides with rich media.",
  schema: searchSchema,
});