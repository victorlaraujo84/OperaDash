import { extractAiText } from './ai-response';
import type { LocalAiMessage } from '../types/local-ai';
const API_BASE = 'https://api.deepseek.com';

function requireKey(key: string) {
  if (!key.trim() || key.length > 512 || /[\r\n]/.test(key)) throw new Error('Informe uma chave DeepSeek válida.');
}
function requireOk(response: Response) {
  if (response.ok) return;
  if (response.status === 401 || response.status === 403) throw new Error('A DeepSeek recusou a chave ou o acesso. Confira a chave da API.');
  if (response.status === 402) throw new Error('Saldo insuficiente na conta DeepSeek.');
  if (response.status === 429) throw new Error('Limite de solicitações da DeepSeek atingido. Aguarde e tente novamente.');
  throw new Error(`A DeepSeek respondeu HTTP ${response.status}. Tente novamente ou confira a conta do provedor.`);
}

export async function getDeepSeekModels(apiKey: string, transport: typeof fetch = fetch, signal?: AbortSignal): Promise<string[]> {
  requireKey(apiKey);
  const response = await transport(`${API_BASE}/models`, { headers: { Authorization: `Bearer ${apiKey.trim()}`, Accept: 'application/json' }, credentials: 'omit', redirect: 'error', cache: 'no-store', signal: signal ?? AbortSignal.timeout(20000) });
  requireOk(response);
  const payload = await response.json() as { data?: { id?: unknown; input_modalities?: string[]; output_modalities?: string[] }[] };
  const ids = [...new Set((Array.isArray(payload.data) ? payload.data : []).filter(model => (!model.input_modalities || model.input_modalities.includes('text')) && (!model.output_modalities || model.output_modalities.includes('text'))).flatMap(model => typeof model.id === 'string' && model.id.trim() ? [model.id] : []))].sort();
  if (!ids.length) throw new Error('A API não retornou modelos compatíveis com texto para esta chave.');
  return ids;
}

export async function requestDeepSeekAnalysis(apiKey: string, model: string, messages: LocalAiMessage[], transport: typeof fetch = fetch, signal?: AbortSignal): Promise<string> {
  requireKey(apiKey);
  if (!model.trim()) throw new Error('Selecione um modelo DeepSeek.');
  if (!messages.length || messages.length > 4 || messages.some(message => !['system', 'user'].includes(message.role) || typeof message.content !== 'string') || messages.reduce((total, message) => total + message.content.length, 0) > 120000) throw new Error('O resumo está vazio ou excede o limite de contexto desta análise. Reduza o recorte.');
  const response = await transport(`${API_BASE}/chat/completions`, { method: 'POST', headers: { Authorization: `Bearer ${apiKey.trim()}`, 'Content-Type': 'application/json', Accept: 'application/json' }, credentials: 'omit', redirect: 'error', cache: 'no-store', signal: signal ?? AbortSignal.timeout(120000), body: JSON.stringify({ model, messages, stream: false, thinking: { type: 'disabled' }, max_tokens: 4096 }) });
  requireOk(response);
  const payload: unknown = await response.json();
  const answer = extractAiText(payload);
  if (!answer) throw new Error('A DeepSeek respondeu sem texto de análise. Tente novamente.');
  return answer;
}
