import { tool } from "@langchain/core/tools";
import { z } from "zod";

const IFIXIT_API_BASE = "https://www.ifixit.com/api/2.0";

// Helper to fetch JSON
async function fetchJson(url: string) {
  const response = await fetch(url);
  if (!response.ok) {
    if (response.status === 404) return null;
    throw new Error(`iFixit API Error: ${response.statusText}`);
  }
  return response.json();
}

// Cleanup function to reduce token usage
function cleanupGuide(guide: any) {
  if (!guide) return null;
  return {
    title: guide.title,
    url: guide.url,
    category: guide.category,
    steps: guide.steps.map((step: any) => ({
      title: step.title,
      lines: step.lines.map((l: any) => l.text_raw),
      media: step.media?.data?.map((m: any) => m.original || m.standard).filter(Boolean)
    })),
  };
}

export const searchDeviceTool = tool(
  async ({ query }: { query: string }) => {
    try {
      const results = await fetchJson(`${IFIXIT_API_BASE}/search/${encodeURIComponent(query)}?filter=device`);
      if (!results || results.results.length === 0) return "No devices found.";
      // Return top 5 results
      return JSON.stringify(results.results.slice(0, 5).map((r: any) => ({ title: r.title, wiki_url: r.wiki_url })));
    } catch (error: any) {
      return `Error searching device: ${error.message}`;
    }
  },
  {
    name: "search_device",
    description: "Search for a device on iFixit to get its exact name.",
    schema: z.object({
      query: z.string().describe("The name of the device to search for, e.g., 'PS5', 'iPhone 11'"),
    }),
  }
);

export const listGuidesTool = tool(
  async ({ device }: { device: string }) => {
    try {
      const results = await fetchJson(`${IFIXIT_API_BASE}/wikis/CATEGORY/${encodeURIComponent(device)}`);
      if (!results || !Array.isArray(results)) return "No guides found for this device.";
      
      // Filter for guides
      const guides = results.filter((item: any) => item.namespace === "Guide").map((g: any) => ({
        guide_id: g.guide_id,
        title: g.title,
      }));
      
      if (guides.length === 0) return "No repair guides available for this device.";
      
      return JSON.stringify(guides.slice(0, 20)); // Limit to 20
    } catch (error: any) {
      return `Error listing guides: ${error.message}`;
    }
  },
  {
    name: "list_guides",
    description: "List available repair guides for a specific device.",
    schema: z.object({
      device: z.string().describe("The exact name of the device found via search_device."),
    }),
  }
);

export const getGuideDetailsTool = tool(
  async ({ guideId }: { guideId: string }) => {
    try {
      const guide = await fetchJson(`${IFIXIT_API_BASE}/guides/${guideId}`);
      const cleanGuide = cleanupGuide(guide);
      return JSON.stringify(cleanGuide);
    } catch (error: any) {
      return `Error getting guide details: ${error.message}`;
    }
  },
  {
    name: "get_guide_details",
    description: "Get step-by-step instructions for a specific repair guide.",
    schema: z.object({
      guideId: z.string().describe("The ID of the guide to retrieve."),
    }),
  }
);
