export function extractAiText(payload: unknown): string {
  if (typeof payload === "string") return payload.trim();
  if (!payload || typeof payload !== "object") return "";

  const value = payload as Record<string, unknown>;
  if (typeof value.output_text === "string") return value.output_text.trim();
  for (const key of ["response", "result", "answer", "generated_text", "generation", "message"]) {
    if (typeof value[key] === "string" && value[key].trim()) return value[key].trim();
    if (value[key] && typeof value[key] === "object") {
      const nestedText = extractAiText(value[key]);
      if (nestedText) return nestedText;
    }
  }

  const choices = Array.isArray(value.choices) ? value.choices : [];
  for (const choice of choices) {
    if (!choice || typeof choice !== "object") continue;
    const message = (choice as Record<string, unknown>).message;
    const text = extractAiText(message);
    if (text) return text;
  }

  const messageContent = value.content;
  if (Array.isArray(messageContent)) {
    const parts = messageContent.map((part) => extractAiText(part)).filter(Boolean);
    if (parts.length) return parts.join("\n").trim();
  }
  if (typeof messageContent === "string") return messageContent.trim();

  const candidates = Array.isArray(value.candidates) ? value.candidates : [];
  for (const candidate of candidates) {
    const text = extractAiText(candidate);
    if (text) return text;
  }

  const parts = Array.isArray(value.parts) ? value.parts : [];
  const partText = parts.map((part) => extractAiText(part)).filter(Boolean);
  if (partText.length) return partText.join("\n").trim();

  if (typeof value.text === "string") return value.text.trim();

  const output = Array.isArray(value.output) ? value.output : [];
  const outputText = output.map((item) => extractAiText(item)).filter(Boolean);
  if (outputText.length) return outputText.join("\n").trim();
  if (typeof value.output === "string") return value.output.trim();

  const data = Array.isArray(value.data) ? value.data : [];
  const dataText = data.map((item) => extractAiText(item)).filter(Boolean);
  return dataText.join("\n").trim();
}

export function describeAiResponseShape(payload: unknown): string {
  if (!payload || typeof payload !== "object") return typeof payload;
  return Object.keys(payload as Record<string, unknown>).slice(0, 12).join(", ") || "objeto vazio";
}
