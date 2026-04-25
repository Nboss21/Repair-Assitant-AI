import { GoogleGenerativeAI } from "@google/generative-ai";
import { BaseMessage } from "@langchain/core/messages";

const genAI = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY!);

export interface TokenCount {
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
}

/**
 * Count tokens in messages using Gemini's token counting API
 */
export async function countMessageTokens(
  messages: BaseMessage[]
): Promise<number> {
  try {
    const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash-exp" });

    // Convert messages to text for counting
    const text = messages
      .map((msg) => {
        if (typeof msg.content === "string") {
          return msg.content;
        }
        return JSON.stringify(msg.content);
      })
      .join("\n");

    const result = await model.countTokens(text);
    return result.totalTokens;
  } catch (error) {
    console.error("Error counting tokens:", error);
    // Fallback: rough estimate (4 chars per token)
    const text = messages.map((m) => String(m.content)).join("");
    return Math.ceil(text.length / 4);
  }
}

/**
 * Count tokens in a single text string
 */
export async function countTextTokens(text: string): Promise<number> {
  try {
    const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash-exp" });
    const result = await model.countTokens(text);
    return result.totalTokens;
  } catch (error) {
    console.error("Error counting tokens:", error);
    return Math.ceil(text.length / 4);
  }
}

/**
 * Estimate token count without API call (faster but less accurate)
 */
export function estimateTokens(text: string): number {
  // Rough estimate: ~4 characters per token for English text
  return Math.ceil(text.length / 4);
}
