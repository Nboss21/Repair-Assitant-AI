import { BaseMessage, HumanMessage, AIMessage, SystemMessage } from "@langchain/core/messages";
import { model } from "./gemini";
import { countMessageTokens } from "./tokenCounter";

const MAX_CONTEXT_TOKENS = parseInt(process.env.MAX_CONTEXT_TOKENS || "6000");
const SUMMARY_THRESHOLD = MAX_CONTEXT_TOKENS * 0.8; // Summarize at 80% of max

/**
 * Check if conversation needs summarization and create summary if needed
 */
export async function summarizeIfNeeded(
  messages: BaseMessage[]
): Promise<BaseMessage[]> {
  try {
    const tokenCount = await countMessageTokens(messages);

    if (tokenCount < SUMMARY_THRESHOLD) {
      return messages; // No summarization needed
    }

    console.log(`Context size (${tokenCount} tokens) exceeds threshold. Summarizing...`);

    // Keep the most recent messages (last 5 exchanges = 10 messages)
    const recentMessages = messages.slice(-10);
    const oldMessages = messages.slice(0, -10);

    if (oldMessages.length === 0) {
      return messages; // Nothing to summarize
    }

    // Create summary of old messages
    const summary = await createSummary(oldMessages);

    // Return: [summary system message] + [recent messages]
    return [
      new SystemMessage(
        `Previous conversation summary:\n${summary}\n\nContinuing conversation below:`
      ),
      ...recentMessages,
    ];
  } catch (error) {
    console.error("Error in summarization:", error);
    return messages; // Return original on error
  }
}

/**
 * Create a concise summary of messages preserving key context
 */
async function createSummary(messages: BaseMessage[]): Promise<string> {
  const conversationText = messages
    .map((msg) => {
      const role = msg._getType();
      const content = typeof msg.content === "string" ? msg.content : JSON.stringify(msg.content);
      return `${role}: ${content}`;
    })
    .join("\n");

  const summaryPrompt = `Summarize this repair conversation concisely. Preserve:
1. Device name and model
2. Specific problem/issue
3. Repair steps attempted or discussed
4. Current repair progress
5. Any important warnings or notes

Conversation:
${conversationText}

Provide a concise summary (max 300 words):`;

  try {
    const response = await model.invoke([new HumanMessage(summaryPrompt)]);
    return typeof response.content === "string" 
      ? response.content 
      : JSON.stringify(response.content);
  } catch (error) {
    console.error("Error creating summary:", error);
    // Fallback: simple truncation
    return `Earlier conversation about device repair. ${messages.length} messages summarized.`;
  }
}
