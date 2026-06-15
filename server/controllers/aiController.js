import Message from "../models/Message.js";
import {
  generateFromImage,
  generateText,
  getAvailableVisionModel,
  getGeminiTimeoutMs,
  imageUrlToBase64,
} from "../services/geminiService.js";

const VALID_REWRITE_TONES = new Set([
  "Professional",
  "Friendly",
  "Short",
  "Grammar Correct",
  "Hinglish to English",
]);

const isValidObjectId = (value) => /^[a-f\d]{24}$/i.test(value || "");

const getRecentConversationMessages = async (currentUserId, selectedUserId, limit = 20) => {
  const messages = await Message.find({
    $or: [
      { senderId: currentUserId, receiverId: selectedUserId },
      { senderId: selectedUserId, receiverId: currentUserId },
    ],
  })
    .sort({ createdAt: -1 })
    .limit(limit)
    .lean();

  return messages.reverse();
};

const formatConversation = (messages, currentUserId) =>
  messages
    .map((message) => {
      const speaker =
        message.senderId.toString() === currentUserId.toString() ? "Me" : "Other person";
      const content = message.text || (message.image ? "[Image message]" : "");
      return `${speaker}: ${content}`;
    })
    .join("\n");

const stripOuterQuotes = (value) =>
  String(value || "")
    .trim()
    .replace(/^["']|["']$/g, "")
    .trim();

const trimToWordLimit = (value, limit) => {
  const words = stripOuterQuotes(value).split(/\s+/).filter(Boolean);
  return words.slice(0, limit).join(" ");
};

const parseReplySuggestions = (rawText) => {
  const cleaned = rawText
    .replace(/```json|```/gi, "")
    .trim();

  try {
    const parsed = JSON.parse(cleaned);
    const suggestions = Array.isArray(parsed) ? parsed : parsed.suggestions;
    if (Array.isArray(suggestions)) {
      return suggestions
        .map((item) => trimToWordLimit(item, 15))
        .filter(Boolean)
        .slice(0, 3);
    }
  } catch {
    // Fall back to line parsing when the model ignores JSON formatting.
  }

  return cleaned
    .split(/\r?\n/)
    .map((line) => line.replace(/^[-\d.\s"]+|["]+$/g, ""))
    .map((line) => trimToWordLimit(line, 15))
    .filter(Boolean)
    .slice(0, 3);
};

const ensureThreeSuggestions = (suggestions) => {
  const fallbackSuggestions = [
    "Sounds good, tell me more.",
    "Okay, I will check.",
    "Thanks for sharing this.",
  ];
  const uniqueSuggestions = [...new Set(suggestions.map((item) => trimToWordLimit(item, 15)))];

  for (const fallback of fallbackSuggestions) {
    if (uniqueSuggestions.length >= 3) break;
    uniqueSuggestions.push(fallback);
  }

  return uniqueSuggestions.slice(0, 3);
};

export const getSmartReplies = async (req, res) => {
  try {
    const { selectedUserId } = req.body;
    if (!isValidObjectId(selectedUserId)) {
      return res.status(400).json({ success: false, message: "Valid selectedUserId is required" });
    }

    const messages = await getRecentConversationMessages(req.user._id, selectedUserId, 12);
    if (!messages.length) {
      return res.json({ success: true, suggestions: [] });
    }

    const prompt = `Conversation:\n${formatConversation(messages, req.user._id)}\n\nGenerate exactly 3 natural, context-aware reply suggestions for Me. Each suggestion must be under 15 words. Return only minified JSON in this shape: {"suggestions":["reply 1","reply 2","reply 3"]}`;
    const rawText = await generateText({
      system: "You write concise chat reply suggestions. Return valid JSON only.",
      prompt,
      options: {
        temperature: 0.25,
        num_predict: 90,
      },
      timeoutMs: getGeminiTimeoutMs(),
    });

    const suggestions = ensureThreeSuggestions(parseReplySuggestions(rawText));
    res.json({ success: true, suggestions });
  } catch (error) {
    console.error("AI smart reply error:", error.message);
    res.status(500).json({ success: false, message: error.message });
  }
};

export const rewriteMessage = async (req, res) => {
  try {
    const { text, tone } = req.body;
    const normalizedTone = tone === "Hinglish to English" ? "Hinglish to English" : tone;

    if (!text || typeof text !== "string" || text.trim().length > 2000) {
      return res.status(400).json({ success: false, message: "Message text is required" });
    }

    if (!VALID_REWRITE_TONES.has(normalizedTone)) {
      return res.status(400).json({ success: false, message: "Invalid rewrite option" });
    }

    const prompt = `Rewrite this chat message in the "${normalizedTone}" style. Return only the rewritten text, no labels or quotes.\n\nMessage:\n${text.trim()}`;
    const rewrittenText = await generateText({
      system: "You rewrite chat messages. Return only the rewritten message text.",
      prompt,
      options: {
        temperature: 0.2,
        num_predict: 120,
      },
      timeoutMs: getGeminiTimeoutMs(),
    });

    res.json({ success: true, rewrittenText: stripOuterQuotes(rewrittenText) });
  } catch (error) {
    console.error("AI rewrite error:", error.message);
    res.status(500).json({ success: false, message: error.message });
  }
};

export const summarizeChat = async (req, res) => {
  try {
    const { selectedUserId } = req.body;
    if (!isValidObjectId(selectedUserId)) {
      return res.status(400).json({ success: false, message: "Valid selectedUserId is required" });
    }

    const messages = await getRecentConversationMessages(req.user._id, selectedUserId, 30);
    if (!messages.length) {
      return res.json({ success: true, summary: "No recent messages to summarize." });
    }

    const prompt = `Summarize this chat using these sections: Key discussion points, Important decisions, Action items. Keep it concise.\n\nConversation:\n${formatConversation(messages, req.user._id)}`;
    const summary = await generateText({
      system: "You summarize chats into clear, concise sections.",
      prompt,
      options: {
        temperature: 0.25,
        num_predict: 260,
      },
      timeoutMs: getGeminiTimeoutMs(),
    });

    res.json({ success: true, summary });
  } catch (error) {
    console.error("AI summary error:", error.message);
    res.status(500).json({ success: false, message: error.message });
  }
};

export const getImageAnalysisStatus = async (req, res) => {
  try {
    const model = await getAvailableVisionModel();
    res.json({ success: true, available: Boolean(model), model });
  } catch (error) {
    console.error("AI vision status error:", error.message);
    res.json({ success: true, available: false, model: null });
  }
};

export const analyzeImage = async (req, res) => {
  try {
    const { messageId } = req.body;
    if (!isValidObjectId(messageId)) {
      return res.status(400).json({ success: false, message: "Valid messageId is required" });
    }

    const message = await Message.findById(messageId).lean();
    if (!message || !message.image) {
      return res.status(404).json({ success: false, message: "Image message not found" });
    }

    const userId = req.user._id.toString();
    if (message.senderId.toString() !== userId && message.receiverId.toString() !== userId) {
      return res.status(403).json({ success: false, message: "Not authorized for this image" });
    }

    const model = await getAvailableVisionModel();
    if (!model) {
      return res.status(409).json({
        success: false,
        message: "Gemini image analysis is unavailable.",
      });
    }

    const imageData = await imageUrlToBase64(message.image);
    const analysis = await generateFromImage({
      model,
      imageBase64: imageData.data,
      mimeType: imageData.mimeType,
      prompt:
        "Describe the image content, extract visible text if possible, and return a concise summary.",
    });

    res.json({ success: true, analysis, model });
  } catch (error) {
    console.error("AI image analysis error:", error.message);
    res.status(500).json({ success: false, message: error.message });
  }
};
