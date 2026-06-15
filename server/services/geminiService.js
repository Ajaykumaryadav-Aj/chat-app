const DEFAULT_MODEL = "gemini-3.5-flash";
const DEFAULT_TIMEOUT_MS = 60000;
const GEMINI_BASE_URL = "https://generativelanguage.googleapis.com/v1beta";

const getModel = () => process.env.GEMINI_MODEL || DEFAULT_MODEL;
export const getGeminiTimeoutMs = () =>
  Number(process.env.GEMINI_TIMEOUT_MS || process.env.AI_TIMEOUT_MS) || DEFAULT_TIMEOUT_MS;

const withTimeout = async (callback, timeoutMs = getGeminiTimeoutMs()) => {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    return await callback(controller.signal);
  } catch (error) {
    if (error.name === "AbortError") {
      throw new Error("Gemini request timed out");
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
};

const requestGemini = async ({ parts, system, options = {}, timeoutMs }) => {
  if (!process.env.GEMINI_API_KEY) {
    throw new Error("GEMINI_API_KEY is required");
  }

  const url = `${GEMINI_BASE_URL}/models/${getModel()}:generateContent`;
  const response = await withTimeout(
    (signal) =>
      fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-goog-api-key": process.env.GEMINI_API_KEY,
        },
        body: JSON.stringify({
          systemInstruction: system
            ? {
                parts: [{ text: system }],
              }
            : undefined,
          contents: [
            {
              role: "user",
              parts,
            },
          ],
          generationConfig: {
            temperature: options.temperature ?? 0.3,
            maxOutputTokens:
              options.maxOutputTokens || options.num_predict || options.max_tokens || 180,
          },
        }),
        signal,
      }),
    timeoutMs
  );

  if (!response.ok) {
    const details = await response.text();
    try {
      const parsed = JSON.parse(details);
      const reason = parsed.error?.details?.find((detail) => detail.reason)?.reason;
      const message = parsed.error?.message || details;

      if (reason === "API_KEY_INVALID") {
        throw new Error("Gemini API key is invalid. Create a valid key in Google AI Studio and update GEMINI_API_KEY.");
      }

      throw new Error(`Gemini error (${response.status}): ${message}`);
    } catch (error) {
      if (error.message.startsWith("Gemini")) throw error;
      throw new Error(`Gemini error (${response.status}): ${details}`);
    }
  }

  const data = await response.json();
  return (
    data.candidates?.[0]?.content?.parts
      ?.map((part) => part.text || "")
      .join("")
      .trim() || ""
  );
};

export const generateText = ({ prompt, system, options, timeoutMs }) =>
  requestGemini({
    system,
    parts: [{ text: prompt }],
    options,
    timeoutMs,
  });

export const getAvailableVisionModel = async () => getModel();

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
  return {
    data: buffer.toString("base64"),
    mimeType: contentType.split(";")[0],
  };
};

export const generateFromImage = ({
  prompt,
  imageBase64,
  mimeType = "image/jpeg",
  options,
  timeoutMs,
}) =>
  requestGemini({
    parts: [
      { text: prompt },
      {
        inlineData: {
          mimeType,
          data: imageBase64,
        },
      },
    ],
    options: {
      temperature: 0.2,
      maxOutputTokens: 350,
      ...options,
    },
    timeoutMs,
  });
