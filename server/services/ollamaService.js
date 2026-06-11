const DEFAULT_BASE_URL = "http://127.0.0.1:11434";
const DEFAULT_MODEL = "llama3.1:8b";
const DEFAULT_TIMEOUT_MS = 45000;
const DEFAULT_KEEP_ALIVE = "10m";
const VISION_MODEL_CANDIDATES = ["llava", "llama3.2-vision"];

const getBaseUrl = () =>
  (process.env.OLLAMA_BASE_URL || DEFAULT_BASE_URL).replace(/\/$/, "");

const getTextModel = () => process.env.OLLAMA_MODEL || DEFAULT_MODEL;
const getKeepAlive = () => process.env.OLLAMA_KEEP_ALIVE || DEFAULT_KEEP_ALIVE;

const getConnectionErrorMessage = () =>
  `Cannot connect to Ollama at ${getBaseUrl()}. Start Ollama with "ollama serve" and pull the configured model with "ollama pull ${getTextModel()}".`;

const withTimeout = async (callback, timeoutMs = DEFAULT_TIMEOUT_MS) => {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    return await callback(controller.signal);
  } catch (error) {
    if (error.name === "AbortError") {
      throw new Error("Ollama request timed out");
    }
    if (
      error.message === "fetch failed" ||
      error.cause?.code === "ECONNREFUSED" ||
      error.cause?.code === "UND_ERR_SOCKET"
    ) {
      throw new Error(getConnectionErrorMessage());
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
};

const requestOllama = async (path, body, timeoutMs) => {
  const response = await withTimeout(
    (signal) =>
      fetch(`${getBaseUrl()}${path}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
        signal,
      }),
    timeoutMs
  );

  if (!response.ok) {
    const details = await response.text();
    throw new Error(`Ollama error (${response.status}): ${details}`);
  }

  return response.json();
};

export const generateText = async ({
  prompt,
  system,
  model = getTextModel(),
  options = {},
  timeoutMs,
}) => {
  const data = await requestOllama(
    "/api/generate",
    {
      model,
      prompt,
      system,
      stream: false,
      keep_alive: getKeepAlive(),
      options: {
        temperature: 0.4,
        num_ctx: 2048,
        num_predict: 180,
        ...options,
      },
    },
    timeoutMs
  );

  return (data.response || "").trim();
};

export const listModels = async () => {
  const response = await withTimeout((signal) =>
    fetch(`${getBaseUrl()}/api/tags`, { signal })
  );

  if (!response.ok) {
    throw new Error(`Unable to list Ollama models (${response.status})`);
  }

  const data = await response.json();
  return (data.models || []).map((model) => model.name);
};

export const getAvailableVisionModel = async () => {
  const models = await listModels();
  const configuredModel = process.env.OLLAMA_VISION_MODEL;
  const candidates = configuredModel
    ? [configuredModel, ...VISION_MODEL_CANDIDATES]
    : VISION_MODEL_CANDIDATES;

  return (
    candidates.find((candidate) =>
      models.some((model) => model === candidate || model.startsWith(`${candidate}:`))
    ) || null
  );
};

export const generateFromImage = async ({
  prompt,
  imageBase64,
  model,
  timeoutMs = 60000,
}) => {
  const data = await requestOllama(
    "/api/generate",
    {
      model,
      prompt,
      images: [imageBase64],
      stream: false,
      keep_alive: getKeepAlive(),
      options: {
        temperature: 0.2,
        num_ctx: 2048,
        num_predict: 350,
      },
    },
    timeoutMs
  );

  return (data.response || "").trim();
};

export const imageUrlToBase64 = async (imageUrl) => {
  const response = await withTimeout((signal) => fetch(imageUrl, { signal }), 30000);

  if (!response.ok) {
    throw new Error("Unable to download image for analysis");
  }

  const contentType = response.headers.get("content-type") || "";
  if (!contentType.startsWith("image/")) {
    throw new Error("Message image is not a valid image resource");
  }

  const buffer = Buffer.from(await response.arrayBuffer());
  return buffer.toString("base64");
};
