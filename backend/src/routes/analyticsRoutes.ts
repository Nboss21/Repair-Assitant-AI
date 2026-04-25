import { Router } from "express";
import { getAnalytics } from "../controllers/analyticsController";
import { authMiddleware } from "../middleware/auth";

const router = Router();

router.get("/usage", authMiddleware, getAnalytics);

export default router;
