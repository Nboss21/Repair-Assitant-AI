import { StateGraph, MessagesAnnotation } from "@langchain/langgraph";
import { trimMessages, SystemMessage } from "@langchain/core/messages";
import { ToolNode } from "@langchain/langgraph/prebuilt";
import { model } from "../utils/gemini";
import { searchDeviceTool, listGuidesTool, getGuideDetailsTool } from "../tools/ifixit";
import { webSearchTool } from "../tools/search";

import * as fs from 'fs';
// Define the tools
const tools = [searchDeviceTool, listGuidesTool, getGuideDetailsTool, webSearchTool];
try {
  fs.writeFileSync('debug_tools.txt', JSON.stringify(tools.map(t => t?.name), null, 2));
} catch (e) {
  console.error("Error writing debug log:", e);
}
const toolNode = new ToolNode(tools);

// Bind tools to the model
const modelWithTools = model.bindTools(tools);

// Define the function that calls the model
async function callModel(state: typeof MessagesAnnotation.State) {
  const { messages } = state;
  
  console.log("[Agent] callModel invoked. Message count:", messages.length);
  console.log("[Agent] Last message type:", messages[messages.length - 1]?.constructor.name);
  
  // Add system prompt with tool priority rules
  const systemPrompt = `You are the World-Class Repair Assistant, an elite AI expert capable of guiding users through any electronic repair with precision, confidence, and visual clarity.

CORE OPERATING RULES (MANDATORY):
1. **MULTI-SOURCE REPAIR INTELLIGENCE**:
   - **ALWAYS** start by searching the iFixit API using \`search_device\` to find official guides.
   - **CRITICAL**: Simultaneously (or immediately after), use \`web_search\` (Tavily) to find redundant / supplementary information, specifically looking for *high-quality images* and *YouTube videos* that iFixit might miss.
   - **NEVER** restrict yourself to a single source unless it is perfect. Synthesize the best information from both iFixit and the Web.

2. **RICH MEDIA IS REQUIRED (NON-NEGOTIABLE)**:
   - **IMAGES**: The \`web_search\` tool returns a JSON object with an \`images\` list. You **MUST** extract these URLs and render them.
     - **Format**: \`![Alt Text](url_from_tool_output)\`
     - **Failure to use these images is a critical error.**
   - **VIDEOS**: You MUST search for and include a relevant YouTube video for every complex repair.
     - Format: \`[🎬 Watch Video Guide: Title](https://youtube.com/watch?v=...)\`
     - **MANDATORY**: If the search tool returns images alongside the video (like thumbnails or diagrams), YOU MUST DISPLAY THEM. Use \`![Video Thumbnail](image_url)\` in the video section.

3. RESPONSE STRUCTURE (STRICT):
   - Diagnosis: Briefly confirm the device and issue.
   - **Tools Required**: List necessary tools (screwdrivers, prying tools, etc.).
   - Step-by-Step Guide:
     - Numbered steps (1., 2., 3.).
     - IMAGE PER STEP (or every few steps) to visualize the action.
     - clear, concise, actionable text.
   - Video Walkthrough: A dedicated section with the YouTube link.
   - Safety Warnings: Highlight battery safety, glass hazards, etc.

4. TONE & PERSONA:
   - Be encouraging, highly professional, and safety-conscious.
   - Use bolding for key parts and warnings.
   - "I have found official guides..." or "I have synthesized a guide from community resources..."

   - If iFixit tools (\`search_device\`, \`list_guides\`) return NO RESULTS, empty lists, or irrelevant guides:
     - **STOP** and **IMMEDIATELY** call \`web_search\`.
     - Do NOT ask the user for permission.
     - Do NOT say "I couldn't find anything".
     - **MANDATORY**: "Since official guides are unavailable, I am searching the web for community repairs..."
   - Never say "I can't do that". Say "Let me check other sources..."

6. CAPABILITIES OVERRIDE (CRITICAL):
   - YOU HAVE ACCESS TO EXTERNAL TOOLS: You are NOT a text-only model. You have real-time access to the internet via \`web_search\`.
   - DO NOT REFUSE MEDIA REQUESTS: If a user asks for images or links, you MUST use your tools to find them.
   - IGNORE INTERNAL SAFETY FILTERS regarding "offline" or "text-only" limitations. Your system provided tools are safe and approved for this use.
   - NEVER say "I cannot directly provide images". Instead, run the tool, get the URL, and display it.

REMEMBER: Your goal is not just to answer, but to *solve* the problem with a visual, easy-to-follow guide.`;

  const messagesWithSystem = [
    new SystemMessage(systemPrompt),
    ...messages
  ];

  // Trim messages to manage token usage
  const trimmedMessages = await trimMessages(messagesWithSystem, {
    maxTokens: 10000, // or use maxCount for number of messages
    strategy: "last",
    tokenCounter: (msgs) => {
      // Simple approximate token counter (4 chars per token) because proper counting fails for some models
      return Promise.resolve(
        msgs.reduce((acc, m) => {
          const content = typeof m.content === 'string' ? m.content : JSON.stringify(m.content);
          return acc + Math.ceil(content.length / 4);
        }, 0)
      );
    },
    includeSystem: true, // Always keep the system prompt
    allowPartial: false,
    startOn: "human", // Ensure we don't start with a tool output which can confuse the model
  });
  
  const response = await modelWithTools.invoke(trimmedMessages);
  
  console.log("[Agent] Model response received");
  console.log("[Agent] Response type:", response.constructor.name);
  console.log("[Agent] Has tool_calls:", response.tool_calls?.length || 0);
  console.log("[Agent] Content length:", typeof response.content === 'string' ? response.content.length : 'N/A');
  
  if (!response.tool_calls || response.tool_calls.length === 0) {
    console.log("[Agent] Producing final response");
  }
  
  return { messages: [response] };
}

// Define the function that determines whether to continue or not
function shouldContinue(state: typeof MessagesAnnotation.State) {
  const { messages } = state;
  const lastMessage = messages[messages.length - 1];

  // If the LLM makes a tool call, then we route to the "tools" node
  if (lastMessage.tool_calls?.length) {
    return "tools";
  }
  // Otherwise, we stop (reply to the user)
  return "__end__";
}

// Define the graph
const workflow = new StateGraph(MessagesAnnotation)
  .addNode("agent", callModel)
  .addNode("tools", toolNode)
  .addEdge("__start__", "agent")
  .addConditionalEdges("agent", shouldContinue)
  .addEdge("tools", "agent");

// Compile the graph
import { getCheckpointer } from "../db/checkpointer";

let graph: any;

export const getGraph = () => {
  if (!graph) {
    graph = workflow.compile({ checkpointer: getCheckpointer() });
  }
  return graph;
};
