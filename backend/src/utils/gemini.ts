import { ChatGoogleGenerativeAI } from "@langchain/google-genai";
import dotenv from "dotenv";

dotenv.config();

export const model = new ChatGoogleGenerativeAI({
  modelName: "gemini-2.5-flash-lite",
  maxOutputTokens: 2048,
  apiKey: process.env.GOOGLE_API_KEY!,
});
