import { Router } from "express";
import { chat, getHistory, getConversations, deleteConversation } from "../controllers/chatController";
import { authMiddleware } from "../middleware/auth";

const router = Router();



router.post("/chat", authMiddleware, chat);
router.get("/conversations", authMiddleware, getConversations);
router.get("/chat/history/:threadId", authMiddleware, getHistory);
router.delete("/conversations/:threadId", authMiddleware, deleteConversation);



export default router;
