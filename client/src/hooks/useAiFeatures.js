import { useCallback, useContext, useEffect, useState } from "react";
import toast from "react-hot-toast";
import { AuthContext } from "../../context/AuthContext";
import {
  analyzeImage,
  getImageAnalysisStatus,
  getSmartReplies,
  rewriteMessage,
  summarizeChat,
} from "../services/aiService";

export const REWRITE_TONES = [
  "Professional",
  "Friendly",
  "Short",
  "Grammar Correct",
  "Hinglish to English",
];

const useAiFeatures = (selectedUserId) => {
  const { axios } = useContext(AuthContext);
  const [smartReplies, setSmartReplies] = useState([]);
  const [summary, setSummary] = useState("");
  const [imageAnalyses, setImageAnalyses] = useState({});
  const [visionAvailable, setVisionAvailable] = useState(false);
  const [loading, setLoading] = useState({
    smartReplies: false,
    rewrite: false,
    summary: false,
    imageId: null,
  });

  const runAiAction = useCallback(async (key, action) => {
    setLoading((prev) => ({ ...prev, [key]: true }));
    try {
      return await action();
    } catch (error) {
      toast.error(error.response?.data?.message || error.message);
      return null;
    } finally {
      setLoading((prev) => ({ ...prev, [key]: false }));
    }
  }, []);

  const refreshSmartReplies = useCallback(async () => {
    if (!selectedUserId) return;
    const data = await runAiAction("smartReplies", () =>
      getSmartReplies(axios, selectedUserId)
    );
    if (data?.success) {
      const suggestions = data.suggestions || [];
      setSmartReplies(suggestions);
      if (!suggestions.length) toast.error("No smart replies available yet");
    }
  }, [axios, runAiAction, selectedUserId]);

  const rewriteInput = useCallback(async (text, tone) => {
    if (!text.trim()) {
      toast.error("Type a message to rewrite");
      return "";
    }

    const data = await runAiAction("rewrite", () =>
      rewriteMessage(axios, text, tone)
    );
    return data?.success ? data.rewrittenText : "";
  }, [axios, runAiAction]);

  const generateSummary = useCallback(async () => {
    if (!selectedUserId) return "";
    const data = await runAiAction("summary", () =>
      summarizeChat(axios, selectedUserId)
    );
    if (data?.success) {
      setSummary(data.summary);
      return data.summary;
    }
    return "";
  }, [axios, runAiAction, selectedUserId]);

  const analyzeImageMessage = useCallback(async (messageId) => {
    setLoading((prev) => ({ ...prev, imageId: messageId }));
    try {
      const data = await analyzeImage(axios, messageId);
      if (data.success) {
        setImageAnalyses((prev) => ({ ...prev, [messageId]: data.analysis }));
      } else {
        toast.error(data.message);
      }
    } catch (error) {
      toast.error(error.response?.data?.message || error.message);
    } finally {
      setLoading((prev) => ({ ...prev, imageId: null }));
    }
  }, [axios]);

  useEffect(() => {
    setSmartReplies([]);
    setSummary("");
    setImageAnalyses({});
  }, [selectedUserId]);

  useEffect(() => {
    const checkVision = async () => {
      const data = await getImageAnalysisStatus(axios);
      setVisionAvailable(Boolean(data.available));
    };

    checkVision().catch(() => setVisionAvailable(false));
  }, [axios]);

  return {
    smartReplies,
    summary,
    imageAnalyses,
    visionAvailable,
    loading,
    refreshSmartReplies,
    rewriteInput,
    generateSummary,
    analyzeImageMessage,
  };
};

export default useAiFeatures;
