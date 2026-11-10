export const PREFERRED_GROQ_MODEL_ID = "qwen/qwen3.8-27b";

/**
 * The Groq /models response identifies active IDs but does not declare endpoint
 * capabilities. Keep this conservative allowlist aligned with the official
 * Supported Models page; refresh it when Groq documents new Chat models.
 */
const DOCUMENTED_GROQ_CHAT_MODEL_IDS = new Set([
  "llama-3.1-8b-instant",
  "llama-3.3-70b-versatile",
  "minimaxai/minimax-m2.7",
  "openai/gpt-oss-120b",
  "openai/gpt-oss-20b",
  PREFERRED_GROQ_MODEL_ID,
]);

const MODEL_ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:/-]{0,127}$/;

export function isValidGroqModelId(value: unknown): value is string {
  return typeof value === "string" && MODEL_ID_PATTERN.test(value);
}

export function isSupportedGroqChatModelId(value: unknown): value is string {
  return isValidGroqModelId(value) && DOCUMENTED_GROQ_CHAT_MODEL_IDS.has(value);
}

export function getGroqChatModelIds(payload: unknown): string[] {
  if (!payload || typeof payload !== "object" || !Array.isArray((payload as { data?: unknown }).data)) return [];

  const models = (payload as { data: unknown[] }).data;
  const unique = new Set<string>();
  for (const entry of models) {
    if (!entry || typeof entry !== "object") continue;
    const model = entry as { id?: unknown; active?: unknown };
    if (model.active !== true || !isSupportedGroqChatModelId(model.id)) continue;
    unique.add(model.id);
  }

  return [...unique].sort((left, right) => {
    if (left === PREFERRED_GROQ_MODEL_ID) return -1;
    if (right === PREFERRED_GROQ_MODEL_ID) return 1;
    return left.localeCompare(right);
  });
}

export function choosePreferredGroqModel(modelIds: string[]): string {
  return modelIds.includes(PREFERRED_GROQ_MODEL_ID) ? PREFERRED_GROQ_MODEL_ID : "";
}

export interface GroqModelSelectionResolution {
  modelId: string;
  requiresManualSelection: boolean;
  selectionInvalidated: boolean;
}

export function reconcileGroqModelSelection(
  currentModelId: string,
  availableModelIds: readonly string[],
  requiresManualSelection = false,
): GroqModelSelectionResolution {
  if (currentModelId) {
    return availableModelIds.includes(currentModelId)
      ? { modelId: currentModelId, requiresManualSelection: false, selectionInvalidated: false }
      : { modelId: "", requiresManualSelection: true, selectionInvalidated: true };
  }
  if (requiresManualSelection) return { modelId: "", requiresManualSelection: true, selectionInvalidated: false };
  return { modelId: choosePreferredGroqModel([...availableModelIds]), requiresManualSelection: false, selectionInvalidated: false };
}
