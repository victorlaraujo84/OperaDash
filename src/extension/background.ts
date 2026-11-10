import { getGroqChatModelIds, isSupportedGroqChatModelId, PREFERRED_GROQ_MODEL_ID } from "../lib/groq-models";
import { describeAiResponseShape, extractAiText } from "../lib/ai-response";
import type { LocalAiBridgeRequest, LocalAiBridgeResponse, LocalAiMessage } from "../types/local-ai";

const LOCAL_API_BASE = "http://127.0.0.1:8080/v1";
const LOCAL_HOST_PERMISSION = "http://127.0.0.1/*";
const GROQ_API_BASE = "https://api.groq.com/openai/v1";
const GROQ_HOST_PERMISSION = "https://api.groq.com/*";
const FALLBACK_MODEL_ID = "LLaMA_CPP";
const MAX_CONTEXT_CHARACTERS = 18_000;

function isMessageList(value: unknown): value is LocalAiMessage[] {
  return Array.isArray(value) && value.every((message) => message && typeof message === "object"
    && ((message as LocalAiMessage).role === "system" || (message as LocalAiMessage).role === "user")
    && typeof (message as LocalAiMessage).content === "string");
}

function isValidApiKey(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0 && value.length <= 512 && !/[\r\n]/.test(value);
}

function isValidCustomEndpoint(value: unknown): value is string {
  if (typeof value !== "string" || value.length > 500) return false;
  try {
    const url = new URL(value);
    return url.protocol === "https:" || url.hostname === "127.0.0.1" || url.hostname === "localhost";
  } catch {
    return false;
  }
}

function isLocalAiRequest(value: unknown): value is LocalAiBridgeRequest {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Record<string, unknown>;
  if (candidate.channel !== "operadash-local-ai") return false;
  if (candidate.action === "models") return true;
  if (candidate.action === "chat") return isMessageList(candidate.messages);
  if (candidate.action === "groq-models") return isValidApiKey(candidate.apiKey);
  if (candidate.action === "custom-chat") return isValidCustomEndpoint(candidate.endpoint)
    && isValidApiKey(candidate.apiKey) && typeof candidate.modelId === "string" && candidate.modelId.length <= 200 && isMessageList(candidate.messages);
  return candidate.action === "groq-chat" && isValidApiKey(candidate.apiKey)
    && isSupportedGroqChatModelId(candidate.modelId) && isMessageList(candidate.messages);
}

async function readError(response: Response): Promise<string> {
  const text = await response.text().catch(() => "");
  return text.trim().slice(0, 500) || `Resposta HTTP ${response.status}`;
}

async function fetchWithTimeout(url: string, init: RequestInit, timeoutMs: number): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: controller.signal, cache: "no-store" });
  } finally {
    clearTimeout(timer);
  }
}

function withinContextLimit(messages: LocalAiMessage[]): boolean {
  return messages.length <= 4 && messages.reduce((total, message) => total + message.content.length, 0) <= MAX_CONTEXT_CHARACTERS;
}

async function handleLocalAiRequest(request: Extract<LocalAiBridgeRequest, { action: "models" | "chat" }>): Promise<LocalAiBridgeResponse> {
  const permitted = await chrome.permissions.contains({ origins: [LOCAL_HOST_PERMISSION] });
  if (!permitted) return { ok: false, error: "A extensão precisa da permissão local; clique em Conectar llamafile e permita o acesso ao serviço." };

  try {
    if (request.action === "models") {
      const response = await fetchWithTimeout(`${LOCAL_API_BASE}/models`, { headers: { Accept: "application/json" } }, 8_000);
      if (!response.ok) return { ok: false, error: await readError(response) };
      const payload = await response.json() as { data?: Array<{ id?: unknown }> };
      const modelId = payload.data?.find((model) => typeof model.id === "string" && model.id.trim())?.id;
      return { ok: true, modelId: typeof modelId === "string" ? modelId : FALLBACK_MODEL_ID };
    }

    if (!withinContextLimit(request.messages)) return { ok: false, error: "O resumo enviado à IA excede o limite local de contexto." };
    const response = await fetchWithTimeout(`${LOCAL_API_BASE}/chat/completions`, {
      method: "POST",
      headers: { Accept: "application/json", "Content-Type": "application/json" },
      body: JSON.stringify({ model: FALLBACK_MODEL_ID, messages: request.messages, temperature: 0.2, max_tokens: 700, stream: false }),
    }, 120_000);
    if (!response.ok) return { ok: false, error: await readError(response) };
    const payload = await response.json() as { choices?: Array<{ message?: { content?: unknown } }> };
    const content = payload.choices?.[0]?.message?.content;
    if (typeof content !== "string" || !content.trim()) return { ok: false, error: "O servidor local respondeu, mas não retornou texto de análise." };
    return { ok: true, content: content.trim() };
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") return { ok: false, error: "O modelo local demorou demais. Tente novamente com um recorte menor." };
    const message = error instanceof Error ? error.message : "Falha ao acessar o serviço local.";
    return { ok: false, error: `Não foi possível acessar http://127.0.0.1:8080. Inicie o llamafile e tente novamente. (${message})` };
  }
}

async function handleCustomRequest(request: Extract<LocalAiBridgeRequest, { action: "custom-chat" }>): Promise<LocalAiBridgeResponse> {
  const origin = new URL(request.endpoint).origin;
  const permitted = await chrome.permissions.contains({ origins: [`${origin}/*`] });
  if (!permitted) return { ok: false, error: "A extensão precisa da permissão para o domínio configurado. Clique em Conectar API e autorize o acesso." };
  if (!withinContextLimit(request.messages)) return { ok: false, error: "O resumo enviado à IA excede o limite de contexto permitido." };
  try {
    const response = await fetchWithTimeout(request.endpoint, {
      method: "POST",
      headers: { Accept: "application/json", "Content-Type": "application/json", Authorization: `Bearer ${request.apiKey}` },
      body: JSON.stringify({ model: request.modelId, messages: request.messages, temperature: 0.2, max_tokens: 900, stream: false }),
    }, 120_000);
    if (!response.ok) return { ok: false, error: `Falha na API personalizada (HTTP ${response.status}): ${await readError(response)}` };
    const payload = await response.json();
    const content = extractAiText(payload);
    if (!content) return { ok: false, error: `A API respondeu, mas não foi encontrado texto. Campos recebidos: ${describeAiResponseShape(payload)}. Verifique o endpoint e o formato da resposta.` };
    return { ok: true, modelId: request.modelId, content };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Falha ao acessar o endpoint configurado.";
    return { ok: false, error: `Não foi possível acessar o endpoint configurado. Confira URL, CORS/permissão e chave. (${message})` };
  }
}

async function handleGroqRequest(request: Extract<LocalAiBridgeRequest, { action: "groq-models" | "groq-chat" }>): Promise<LocalAiBridgeResponse> {
  const permitted = await chrome.permissions.contains({ origins: [GROQ_HOST_PERMISSION] });
  if (!permitted) return { ok: false, error: "A extensão precisa da permissão opcional para api.groq.com; clique em Conectar Groq e autorize o acesso." };
  if (!isValidApiKey(request.apiKey)) return { ok: false, error: "Informe uma chave Groq válida para esta sessão." };

  try {
    const headers = { Accept: "application/json", Authorization: `Bearer ${request.apiKey}` };
    if (request.action === "groq-models") {
      const response = await fetchWithTimeout(`${GROQ_API_BASE}/models`, { headers }, 20_000);
      if (response.status === 401 || response.status === 403) return { ok: false, error: "A Groq recusou a chave. Confira-a e tente novamente." };
      if (!response.ok) return { ok: false, error: `Falha ao verificar os modelos Groq: ${await readError(response)}` };
      const payload: unknown = await response.json();
      const modelIds = getGroqChatModelIds(payload);
      if (!modelIds.length) return { ok: false, error: "A API respondeu, mas não listou modelos ativos compatíveis com Chat Completions para análise textual." };
      return { ok: true, modelIds };
    }

    if (!withinContextLimit(request.messages)) return { ok: false, error: "O resumo enviado à Groq excede o limite de contexto permitido." };
    const latestCatalog = await fetchWithTimeout(`${GROQ_API_BASE}/models`, { headers }, 20_000);
    if (latestCatalog.status === 401 || latestCatalog.status === 403) return { ok: false, error: "A Groq recusou a chave ao atualizar o catálogo. Desconecte e confira a chave." };
    if (!latestCatalog.ok) return { ok: false, error: `Não foi possível revalidar o modelo Groq selecionado: ${await readError(latestCatalog)}` };
    const latestModelIds = getGroqChatModelIds(await latestCatalog.json());
    if (!latestModelIds.includes(request.modelId)) return { ok: false, error: "O modelo saiu do catálogo ativo de chat para esta chave. Atualize a lista e escolha outro modelo." };

    const body: Record<string, unknown> = { model: request.modelId, messages: request.messages };
    if (request.modelId === PREFERRED_GROQ_MODEL_ID) body.reasoning_effort = "none";
    const response = await fetchWithTimeout(`${GROQ_API_BASE}/chat/completions`, {
      method: "POST",
      headers: { ...headers, "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }, 90_000);
    if (response.status === 401 || response.status === 403) return { ok: false, error: "A Groq recusou a chave ou o acesso ao modelo. Desconecte e confira a chave e a disponibilidade do modelo." };
    if (!response.ok) return { ok: false, error: `Falha na análise Groq (${request.modelId}): ${await readError(response)}` };
    const payload = await response.json() as { choices?: Array<{ message?: { content?: unknown } }> };
    const content = payload.choices?.[0]?.message?.content;
    if (typeof content !== "string" || !content.trim()) return { ok: false, error: `A Groq respondeu para ${request.modelId}, mas não retornou texto de análise.` };
    return { ok: true, modelId: request.modelId, content: content.trim() };
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") return { ok: false, error: "A solicitação à Groq demorou demais. Tente novamente com um recorte menor." };
    const message = error instanceof Error ? error.message : "Falha ao acessar a API Groq.";
    return { ok: false, error: `Não foi possível acessar https://api.groq.com. Confira sua conexão e a permissão de host. (${message})` };
  }
}

chrome.action.onClicked.addListener(() => {
  void chrome.tabs.create({ url: chrome.runtime.getURL("index.html") });
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (sender.id !== chrome.runtime.id || !isLocalAiRequest(message)) return false;
  const task = message.action === "groq-models" || message.action === "groq-chat"
    ? handleGroqRequest(message)
    : message.action === "custom-chat"
      ? handleCustomRequest(message)
      : handleLocalAiRequest(message);
  void task.then(sendResponse, (error: unknown) => {
    sendResponse({ ok: false, error: error instanceof Error ? error.message : "Falha inesperada no assistente de IA." } satisfies LocalAiBridgeResponse);
  });
  return true;
});
