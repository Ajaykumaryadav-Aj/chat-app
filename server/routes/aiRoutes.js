import express from "express";
import { protectRoute } from "../middleware/auth.js";
import {
  analyzeImage,
  getImageAnalysisStatus,
  getSmartReplies,
  rewriteMessage,
  summarizeChat,
} from "../controllers/aiController.js";

const aiRouter = express.Router();
const rateLimitStore = new Map();

const aiRequestLogger = (req, res, next) => {
  console.log(`[AI] ${req.method} ${req.originalUrl} user=${req.user?._id || "anonymous"}`);
  next();
};

const aiRateLimiter = (req, res, next) => {
  const key = req.user?._id?.toString() || req.ip;
  const now = Date.now();
  const windowMs = 60 * 1000;
  const maxRequests = 20;
  const record = rateLimitStore.get(key) || { count: 0, resetAt: now + windowMs };

  if (now > record.resetAt) {
    record.count = 0;
    record.resetAt = now + windowMs;
  }

  record.count += 1;
  rateLimitStore.set(key, record);

  if (record.count > maxRequests) {
    return res.status(429).json({
      success: false,
      message: "Too many AI requests. Please wait a minute and try again.",
    });
  }

  next();
};

aiRouter.use(protectRoute, aiRequestLogger, aiRateLimiter);

aiRouter.post("/smart-replies", getSmartReplies);
aiRouter.post("/rewrite", rewriteMessage);
aiRouter.post("/summary", summarizeChat);
aiRouter.get("/image-analysis/status", getImageAnalysisStatus);
aiRouter.post("/image-analysis", analyzeImage);

export default aiRouter;
