import { Request, Response } from "express";
import { getDb } from "../db";
import { AuthRequest } from "../middleware/auth";

export const getAnalytics = async (req: AuthRequest, res: Response) => {
  const userId = req.userId;

  if (!userId) {
    return res.status(401).json({ error: "User not authenticated" });
  }

  try {
    const db = getDb();

    // Get total token usage for this user
    const totalUsageResult = await db.query(
      `SELECT 
        SUM(input_tokens) as total_input,
        SUM(output_tokens) as total_output,
        SUM(total_tokens) as total,
        COUNT(*) as message_count
      FROM token_usage 
      WHERE user_id = $1`,
      [userId]
    );

    const totalUsage = totalUsageResult.rows[0];

    // Get usage by conversation
    const conversationUsageResult = await db.query(
      `SELECT 
        c.thread_id,
        c.title,
        SUM(t.total_tokens) as tokens,
        COUNT(t.id) as messages,
        MAX(t.created_at) as last_activity
      FROM conversations c
      LEFT JOIN token_usage t ON c.thread_id = t.thread_id
      WHERE c.user_id = $1
      GROUP BY c.thread_id, c.title
      ORDER BY last_activity DESC
      LIMIT 10`,
      [userId]
    );
    // Added c.title to GROUP BY to be standard SQL compliant

    res.json({
      total_input_tokens: totalUsage?.total_input || 0,
      total_output_tokens: totalUsage?.total_output || 0,
      total_tokens: totalUsage?.total || 0,
      total_messages: totalUsage?.message_count || 0,
      conversations: conversationUsageResult.rows,
    });
  } catch (error: any) {
    console.error("Analytics error:", error);
    res.status(500).json({ error: "Error fetching analytics" });
  }
};
