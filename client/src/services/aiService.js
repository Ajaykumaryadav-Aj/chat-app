export const getSmartReplies = async (axios, selectedUserId) => {
  const { data } = await axios.post("/api/ai/smart-replies", { selectedUserId });
  return data;
};

export const rewriteMessage = async (axios, text, tone) => {
  const { data } = await axios.post("/api/ai/rewrite", { text, tone });
  return data;
};

export const summarizeChat = async (axios, selectedUserId) => {
  const { data } = await axios.post("/api/ai/summary", { selectedUserId });
  return data;
};

export const getImageAnalysisStatus = async (axios) => {
  const { data } = await axios.get("/api/ai/image-analysis/status");
  return data;
};

export const analyzeImage = async (axios, messageId) => {
  const { data } = await axios.post("/api/ai/image-analysis", { messageId });
  return data;
};
