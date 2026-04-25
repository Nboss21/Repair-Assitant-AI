import { Request, Response } from "express";
import { getGraph } from "../agent/graph";
import { HumanMessage, AIMessage, ToolMessage } from "@langchain/core/messages";
import { AuthRequest } from "../middleware/auth";
import { getDb } from "../db";
import { v4 as uuidv4 } from "uuid";
import { countMessageTokens, countTextTokens } from "../utils/tokenCounter";
import { summarizeIfNeeded } from "../utils/summarizer";


export const chat = async (req: AuthRequest, res: Response) => {
  const { message, threadId } = req.body;
  const userId = req.userId;

  console.log(`[Chat] Request received. User: ${userId}, Thread: ${threadId}, Message: ${message?.substring(0, 20)}...`);

  if (!message) {
    return res.status(400).json({ error: "Message is required" });
  }

  if (!userId) {
    return res.status(401).json({ error: "User not authenticated" });
  }

  // Set headers for SSE (Server-Sent Events)
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");

  // Generate or use existing thread ID
  const actualThreadId = threadId || uuidv4();
  const config = { configurable: { thread_id: actualThreadId } };

  try {
    const db = getDb();
    const graph = getGraph();

    console.log('[Chat] Checking/Creating conversation in DB...');
    // Create or update conversation record
    const existingConvResult = await db.query(
      "SELECT * FROM conversations WHERE thread_id = $1", 
      [actualThreadId]
    );
    
    if (existingConvResult.rows.length === 0) {
      await db.query(
        "INSERT INTO conversations (id, user_id, thread_id, title) VALUES ($1, $2, $3, $4)",
        [uuidv4(), userId, actualThreadId, message.substring(0, 50)]
      );
      console.log('[Chat] New conversation created.');
    } else {
      await db.query(
        "UPDATE conversations SET updated_at = CURRENT_TIMESTAMP WHERE thread_id = $1",
        [actualThreadId]
      );
      console.log('[Chat] Conversation updated.');
    }

    // Get conversation history and check if summarization is needed
    const state = await graph.getState(config);
    let conversationMessages = state?.values?.messages || [];
    
    // Apply summarization if needed
    conversationMessages = await summarizeIfNeeded(conversationMessages);

    // Count input tokens

    let outputTokens = 0;
    let fullResponse = "";

    console.log('[Chat] Starting graph stream...');

    const stream = await graph.stream(
      { messages: [new HumanMessage(message)] },
      config
    );

    for await (const chunk of stream) {
      console.log('[Chat] Received chunk:', JSON.stringify(chunk).substring(0, 100)); // Log chunk structure
      
      const nodes = Object.keys(chunk);
      for (const node of nodes) {
        const update = chunk[node];
        if (update.messages) {
          const lastMsg = update.messages[update.messages.length - 1];

          if (lastMsg instanceof AIMessage) {
            // Stream tool calls if any
            if (lastMsg.tool_calls?.length) {
              const toolName = lastMsg.tool_calls[0].name;
              console.log(`[Chat] Streaming tool start: ${toolName}`);
              res.write(
                `data: ${JSON.stringify({ type: "tool_start", tool: toolName })}\n\n`
              );
            }
            // Stream the content (changed from else-if to if)
            if (lastMsg.content) {
              let contentStr = '';
              
              // Handle different content formats
              if (typeof lastMsg.content === 'string') {
                contentStr = lastMsg.content;
              } else if (Array.isArray(lastMsg.content)) {
                // Extract text from structured content, ignoring function calls
                contentStr = lastMsg.content
                  .filter((part: any) => part.type === 'text' || typeof part === 'string')
                  .map((part: any) => typeof part === 'string' ? part : part.text)
                  .join('');
              } else {
                contentStr = JSON.stringify(lastMsg.content);
              }
              
              if (contentStr) {
                console.log(`[Chat] Streaming content: ${contentStr.substring(0, 50)}`);
                fullResponse += contentStr;
                console.log(`[Chat] fullResponse length now: ${fullResponse.length}`);
                res.write(
                  `data: ${JSON.stringify({ type: "token", content: contentStr })}\n\n`
                );
              }
            }
          } else if (lastMsg instanceof ToolMessage) {
            console.log('[Chat] Tool execution finished.');
            // When tool execution finishes
            res.write(`data: ${JSON.stringify({ type: "tool_end" })}\n\n`);
          }
        }
      }
    }

    // Correctly count input tokens: Conversation History + System Prompt (Buffer) + New Message
    // Buffer of ~800 tokens accounts for the system prompt and function specifications injected by LangGraph
    const historyTokens = await countMessageTokens(conversationMessages);
    const SYSTEM_PROMPT_BUFFER = 800; 
    const inputTokens = historyTokens + SYSTEM_PROMPT_BUFFER + (await countTextTokens(message));

    // Count output tokens
    outputTokens = await countTextTokens(fullResponse);
    const totalTokens = inputTokens + outputTokens;
    
    console.log(`[Chat] Stream finished. fullResponse length: ${fullResponse.length}, Output tokens: ${outputTokens}, Total Input: ${inputTokens}`);

    // Save token usage to database
    await db.query(
      "INSERT INTO token_usage (user_id, thread_id, input_tokens, output_tokens, total_tokens) VALUES ($1, $2, $3, $4, $5)",
      [userId, actualThreadId, inputTokens, outputTokens, totalTokens]
    );


    res.write(`data: ${JSON.stringify({ type: "done", threadId: actualThreadId })}\n\n`);
    res.end();
  } catch (error: any) {
    console.error("Error in chat:", error);
    res.write(
      `data: ${JSON.stringify({ type: "error", content: error.message })}\n\n`
    );
    res.end();
  }
};

export const getHistory = async (req: AuthRequest, res: Response) => {
  const { threadId } = req.params;
  const userId = req.userId;

  if (!userId) {
    return res.status(401).json({ error: "User not authenticated" });
  }

  try {
    const config = { configurable: { thread_id: threadId } };
    const graph = getGraph();
    const state = await graph.getState(config);
    const messages = state?.values?.messages || [];

    const formattedMessages = messages.map((msg: any) => {
      let role = "assistant";
      if (msg instanceof HumanMessage) role = "user";
      else if (msg instanceof AIMessage) role = "assistant";
      else if (msg instanceof ToolMessage) return null; // Skip tool messages in frontend history for now

      // Skip tool calls that don't have content (intermediate steps)
      if (role === "assistant" && !msg.content && msg.tool_calls?.length) return null;

      return {
        role,
        content: msg.content as string
      };
    }).filter(Boolean);


    res.json({ messages: formattedMessages });
  } catch (error: any) {
    console.error("Error fetching history:", error);
    res.status(500).json({ error: "Failed to fetch history" });
  }
};

export const getConversations = async (req: AuthRequest, res: Response) => {
  const userId = req.userId;

  if (!userId) {
    return res.status(401).json({ error: "User not authenticated" });
  }

  try {
    const db = getDb();
    const result = await db.query(
      "SELECT thread_id, title, created_at, updated_at FROM conversations WHERE user_id = $1 ORDER BY updated_at DESC",
      [userId]
    );

    res.json({ conversations: result.rows });
  } catch (error: any) {
    console.error("Error fetching conversations:", error);
    res.status(500).json({ error: "Failed to fetch conversations" });
  }
};

export const deleteConversation = async (req: AuthRequest, res: Response) => {
  const { threadId } = req.params;
  const userId = req.userId;

  if (!userId) {
    return res.status(401).json({ error: "User not authenticated" });
  }

  try {
    const db = getDb();
    
    // 1. Delete from token_usage
    await db.query("DELETE FROM token_usage WHERE thread_id = $1 AND user_id = $2", [threadId, userId]);
    
    // 2. Delete from conversations (verified by user_id for security)
    const result = await db.query(
      "DELETE FROM conversations WHERE thread_id = $1 AND user_id = $2 RETURNING *", 
      [threadId, userId]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ error: "Conversation not found or unauthorized" });
    }

    // 3. Optional: Clean up LangGraph checkpoints (if sticking to SQL persistence, the checkpointer tables handle this, 
    // but without direct access to delete checkpoint rows, the state effectively becomes orphaned which is acceptable)
    
    console.log(`[Chat] Deleted conversation ${threadId} for user ${userId}`);
    res.json({ success: true, message: "Conversation deleted" });

  } catch (error: any) {
    console.error("Error deleting conversation:", error);
    res.status(500).json({ error: "Failed to delete conversation" });
  }
};



