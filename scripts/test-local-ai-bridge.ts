import assert from "node:assert/strict";
import { choosePreferredGroqModel, getGroqChatModelIds, PREFERRED_GROQ_MODEL_ID, reconcileGroqModelSelection } from "../src/lib/groq-models";
import type { LocalAiBridgeRequest, LocalAiBridgeResponse, LocalAiMessage } from "../src/types/local-ai";

type TestListener = (message: unknown, sender: { id?: string }, sendResponse: (response: unknown) => void) => boolean | undefined;

const listenerRef: { current?: TestListener } = {};
let localPermissionGranted = false;
let groqPermissionGranted = false;
const requests: Array<{ url: string; init: RequestInit }> = [];
const originalFetch = globalThis.fetch;
const groqModelCatalog: { data: Array<{ id: string; active?: boolean | null }> } = {
  data: [
    { id: "llama-3.3-70b-versatile", active: true },
    { id: "qwen/qwen3.8-27b", active: true },
    { id: "openai/gpt-oss-20b", active: true },
    { id: "gemma2-9b-it", active: true },
    { id: "whisper-large-v3", active: true },
    { id: "canopylabs/orpheus-v1-english", active: true },
    { id: "meta-llama/llama-prompt-guard-2-22m", active: true },
    { id: "openai/gpt-oss-safeguard-20b", active: true },
    { id: "llama-3.1-8b-instant" },
    { id: "minimaxai/minimax-m2.7", active: null },
    { id: "llama-preview-inactive", active: false },
  ],
};

const mockChrome = {
  action: { onClicked: { addListener: () => undefined } },
  tabs: { create: async () => undefined },
  runtime: {
    id: "operadash-test-extension",
    getURL: (path: string) => `chrome-extension://operadash-test-extension/${path}`,
    onMessage: { addListener: (callback: TestListener) => { listenerRef.current = callback; } },
  },
  permissions: {
    contains: async ({ origins }: { origins: string[] }) => origins[0] === "http://127.0.0.1/*" ? localPermissionGranted : origins[0] === "https://api.groq.com/*" ? groqPermissionGranted : false,
  },
};

Object.assign(globalThis, { chrome: mockChrome });
globalThis.fetch = async (input: RequestInfo | URL, init: RequestInit = {}) => {
  const url = String(input);
  requests.push({ url, init });
  if (url === "http://127.0.0.1:8080/v1/models") {
    return new Response(JSON.stringify({ data: [{ id: "Qwen3-1.7B-Q4_K_M.gguf" }] }), { status: 200, headers: { "Content-Type": "application/json" } });
  }
  if (url === "http://127.0.0.1:8080/v1/chat/completions") {
    return new Response(JSON.stringify({ choices: [{ message: { content: "O recorte mostra concentração de indisponibilidade." } }] }), { status: 200, headers: { "Content-Type": "application/json" } });
  }
  if (url === "https://api.groq.com/openai/v1/models") {
    return new Response(JSON.stringify(groqModelCatalog), { status: 200, headers: { "Content-Type": "application/json" } });
  }
  if (url === "https://api.groq.com/openai/v1/chat/completions") {
    return new Response(JSON.stringify({ choices: [{ message: { content: "A localidade tem disponibilidade estável no recorte." } }] }), { status: 200, headers: { "Content-Type": "application/json" } });
  }
  throw new Error(`Destino inesperado no teste: ${url}`);
};

async function send(request: LocalAiBridgeRequest): Promise<LocalAiBridgeResponse> {
  const listener = listenerRef.current;
  if (!listener) throw new Error("O worker não registrou o listener de mensagens.");
  return await new Promise((resolve, reject) => {
    const accepted = listener(request, { id: "operadash-test-extension" }, (response) => resolve(response as LocalAiBridgeResponse));
    if (!accepted) reject(new Error("O worker não aceitou a mensagem de teste."));
  });
}

try {
  assert.deepEqual(getGroqChatModelIds(groqModelCatalog), ["qwen/qwen3.8-27b", "llama-3.3-70b-versatile", "openai/gpt-oss-20b"], "o catálogo exige active=true, filtra IDs sem suporte documentado a chat e prioriza Qwen3.8-27B");
  assert.equal(choosePreferredGroqModel(["llama-3.3-70b-versatile", PREFERRED_GROQ_MODEL_ID]), PREFERRED_GROQ_MODEL_ID, "Qwen é selecionado quando está disponível");
  assert.equal(choosePreferredGroqModel(["llama-3.3-70b-versatile"]), "", "nenhum modelo alternativo é pré-selecionado se Qwen não estiver disponível");
  const initialSelection = reconcileGroqModelSelection("", [PREFERRED_GROQ_MODEL_ID, "llama-3.3-70b-versatile"]);
  assert.equal(initialSelection.modelId, PREFERRED_GROQ_MODEL_ID, "Qwen pode ser pré-selecionado quando a conexão é iniciada e está disponível");
  const preservedSelection = reconcileGroqModelSelection("llama-3.3-70b-versatile", [PREFERRED_GROQ_MODEL_ID, "llama-3.3-70b-versatile"]);
  assert.equal(preservedSelection.modelId, "llama-3.3-70b-versatile", "atualizar catálogo mantém a escolha manual que segue disponível");
  const invalidatedSelection = reconcileGroqModelSelection("llama-3.3-70b-versatile", [PREFERRED_GROQ_MODEL_ID]);
  assert.deepEqual(invalidatedSelection, { modelId: "", requiresManualSelection: true, selectionInvalidated: true }, "se a escolha manual sai do catálogo, limpá-la sem mudar para Qwen");
  const afterInvalidationRefresh = reconcileGroqModelSelection(invalidatedSelection.modelId, [PREFERRED_GROQ_MODEL_ID], invalidatedSelection.requiresManualSelection);
  assert.equal(afterInvalidationRefresh.modelId, "", "atualizações seguintes ainda exigem uma escolha humana");
  assert.equal(afterInvalidationRefresh.requiresManualSelection, true);

  await import("../src/extension/background.ts");
  assert.ok(listenerRef.current, "worker MV3 registrado");

  const invalidMessageAccepted = listenerRef.current?.({ channel: "other-extension", action: "models" }, { id: "operadash-test-extension" }, () => undefined);
  assert.equal(invalidMessageAccepted, false, "mensagens fora do canal Operadash são ignoradas");
  const externalSenderAccepted = listenerRef.current?.({ channel: "operadash-local-ai", action: "models" }, { id: "other-extension" }, () => undefined);
  assert.equal(externalSenderAccepted, false, "mensagens não iniciadas pela própria extensão são ignoradas");

  const denied = await send({ channel: "operadash-local-ai", action: "models" });
  assert.equal(denied.ok, false, "sem permissão, conexão local é negada");
  const deniedGroq = await send({ channel: "operadash-local-ai", action: "groq-models", apiKey: "gsk_test_key" });
  assert.equal(deniedGroq.ok, false, "sem permissão, conexão Groq é negada");
  assert.equal(requests.length, 0, "sem permissão, nenhum fetch ocorre");

  localPermissionGranted = true;
  const localModels = await send({ channel: "operadash-local-ai", action: "models" });
  assert.equal(localModels.ok, true, "o endpoint local de modelos é lido");
  assert.equal(localModels.ok ? localModels.modelId : "", "Qwen3-1.7B-Q4_K_M.gguf");
  const messages: LocalAiMessage[] = [
    { role: "system", content: "Responda em português." },
    { role: "user", content: "Resumo agregado do período." },
  ];
  const beforeUnlisted = requests.length;
  const unlistedModelAccepted = listenerRef.current?.({ channel: "operadash-local-ai", action: "groq-chat", apiKey: "gsk_test_key", modelId: "gemma2-9b-it", messages }, { id: "operadash-test-extension" }, () => undefined);
  assert.equal(unlistedModelAccepted, false, "o worker não aceita IDs fora da lista documentada de chat");
  assert.equal(requests.length, beforeUnlisted, "um ID não suportado é recusado antes de qualquer chamada à API");
  const localAnswer = await send({ channel: "operadash-local-ai", action: "chat", messages });
  assert.equal(localAnswer.ok, true, "a resposta local é retornada");
  assert.equal(localAnswer.ok ? localAnswer.content : "", "O recorte mostra concentração de indisponibilidade.");

  const apiKey = "gsk_test_key_not_persisted";
  groqPermissionGranted = true;
  const groqModels = await send({ channel: "operadash-local-ai", action: "groq-models", apiKey });
  assert.equal(groqModels.ok, true, "a permissão e o catálogo Groq são verificados");
  assert.deepEqual(groqModels.ok ? groqModels.modelIds : [], ["qwen/qwen3.8-27b", "llama-3.3-70b-versatile", "openai/gpt-oss-20b"], "a ponte retorna somente os IDs ativos e documentados para chat");

  const qwenModel = groqModelCatalog.data.find((model) => model.id === "qwen/qwen3.8-27b");
  assert.ok(qwenModel);
  qwenModel.active = false;
  const staleQwen = await send({ channel: "operadash-local-ai", action: "groq-chat", apiKey, modelId: "qwen/qwen3.8-27b", messages });
  assert.equal(staleQwen.ok, false, "um modelo removido/inativo após carregar a lista é bloqueado");
  assert.match(staleQwen.ok ? "" : staleQwen.error, /saiu do catálogo ativo/i);
  qwenModel.active = true;

  const qwenAnswer = await send({ channel: "operadash-local-ai", action: "groq-chat", apiKey, modelId: "qwen/qwen3.8-27b", messages });
  assert.equal(qwenAnswer.ok, true, "a análise Qwen3.8-27B é retornada");
  const firstGroqChatRequest = requests.find(({ url }) => url === "https://api.groq.com/openai/v1/chat/completions");
  assert.ok(firstGroqChatRequest, "a chamada Qwen chega ao endpoint Groq");
  const qwenBody = JSON.parse(String(firstGroqChatRequest.init.body)) as { model: string; messages: unknown[]; reasoning_effort?: string };
  assert.equal(qwenBody.model, "qwen/qwen3.8-27b", "Qwen3.8-27B é enviado como modelo selecionado");
  assert.equal(qwenBody.reasoning_effort, "none", "Qwen usa o modo instruct eficiente documentado");

  const otherModelAnswer = await send({ channel: "operadash-local-ai", action: "groq-chat", apiKey, modelId: "llama-3.3-70b-versatile", messages });
  assert.equal(otherModelAnswer.ok, true, "qualquer modelo de chat ativo devolvido pelo catálogo pode ser utilizado");
  const groqChatRequests = requests.filter(({ url }) => url === "https://api.groq.com/openai/v1/chat/completions");
  assert.equal(groqChatRequests.length, 2, "ambas as escolhas aprovadas chegam ao endpoint Groq");
  const otherBody = JSON.parse(String(groqChatRequests[1].init.body)) as { model: string; messages: unknown[]; reasoning_effort?: string };
  assert.equal(otherBody.model, "llama-3.3-70b-versatile", "a escolha alternativa chega à API sem substituição silenciosa");
  assert.equal(otherBody.reasoning_effort, undefined, "parâmetros específicos de Qwen não são enviados a outros modelos");

  assert.deepEqual(requests.map(({ url }) => url), [
    "http://127.0.0.1:8080/v1/models",
    "http://127.0.0.1:8080/v1/chat/completions",
    "https://api.groq.com/openai/v1/models",
    "https://api.groq.com/openai/v1/models",
    "https://api.groq.com/openai/v1/models",
    "https://api.groq.com/openai/v1/chat/completions",
    "https://api.groq.com/openai/v1/models",
    "https://api.groq.com/openai/v1/chat/completions",
  ], "as requisições usam exclusivamente os dois destinos autorizados");
  const localChatHeaders = requests[1].init.headers as Record<string, string>;
  assert.equal(Object.keys(localChatHeaders).some((key) => key.toLowerCase() === "authorization"), false, "nenhuma chave é enviada ao llamafile");
  const groqHeaders = requests[2].init.headers as Record<string, string>;
  assert.equal(groqHeaders.Authorization, `Bearer ${apiKey}`, "a chave só é anexada às chamadas autenticadas Groq");
  for (const request of requests.slice(2)) assert.equal(request.init.cache, "no-store", "não se usa cache HTTP para chave ou contexto agregado");

  console.log("OK: catálogo Groq ativo e documentado, revalidação antes do chat, seleção alternativa explícita, raciocínio Qwen, permissões separadas e destinos fixos validados.");
} finally {
  globalThis.fetch = originalFetch;
}
