import { useEffect, useRef, useState } from 'react';
import { Download, KeyRound, LoaderCircle, ShieldCheck, Sparkles, X } from 'lucide-react';
import { getDeepSeekModels, requestDeepSeekAnalysis } from '../lib/deepseek';
import type { LocalAiMessage } from '../types/local-ai';

function errorText(error: unknown) {
  if (error instanceof DOMException && (error.name === 'AbortError' || error.name === 'TimeoutError')) return 'Solicitação interrompida ou tempo de resposta excedido. Tente novamente.';
  if (error instanceof TypeError) return 'Não foi possível acessar a DeepSeek. Confira a conexão e se o navegador ou a rede permitem acesso à API (CORS).';
  return error instanceof Error ? error.message : 'Não foi possível completar a solicitação.';
}

export function DeepSeekApiPanel({ messages, hasData, renderAnswer }: { messages: LocalAiMessage[]; hasData: boolean; renderAnswer: (answer: string) => string }) {
  const [key, setKey] = useState('');
  const [models, setModels] = useState<string[]>([]);
  const [model, setModel] = useState('');
  const [connecting, setConnecting] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [answer, setAnswer] = useState('');
  const [question, setQuestion] = useState('');
  const [consent, setConsent] = useState(false);
  const connectionController = useRef<AbortController | null>(null);
  const analysisController = useRef<AbortController | null>(null);
  const signature = JSON.stringify(messages);
  useEffect(() => { analysisController.current?.abort(); setAnswer(''); setLoading(false); }, [signature]);
  useEffect(() => () => { connectionController.current?.abort(); analysisController.current?.abort(); }, []);

  const connect = async () => {
    const controller = new AbortController(); connectionController.current = controller;
    const timeout = setTimeout(() => controller.abort(), 20000);
    setConnecting(true); setError(''); setModels([]); setModel('');
    try { const available = await getDeepSeekModels(key, fetch, controller.signal); if (!controller.signal.aborted) { setModels(available); setModel(available.includes('deepseek-flash') ? 'deepseek-flash' : ''); } }
    catch (cause) { if (connectionController.current === controller) setError(errorText(cause)); }
    finally { clearTimeout(timeout); if (connectionController.current === controller) setConnecting(false); }
  };
  const disconnect = () => {
    connectionController.current?.abort(); connectionController.current = null;
    analysisController.current?.abort(); analysisController.current = null;
    setKey(''); setModels([]); setModel(''); setConnecting(false); setLoading(false); setAnswer(''); setError(''); setConsent(false);
  };
  const analyze = async () => {
    if (!consent || !models.includes(model) || !hasData) return;
    const controller = new AbortController(); analysisController.current = controller;
    const timeout = setTimeout(() => { controller.abort(); setError('A DeepSeek excedeu o tempo de resposta. Tente novamente com um recorte menor.'); }, 120000);
    setLoading(true); setError(''); setAnswer('');
    try {
      const content = await requestDeepSeekAnalysis(key, model, question.trim() ? [...messages, { role: 'user', content: question.trim() }] : messages, fetch, controller.signal);
      if (!controller.signal.aborted) setAnswer(content);
    } catch (cause) { if (analysisController.current === controller && !controller.signal.aborted) setError(errorText(cause)); }
    finally { clearTimeout(timeout); if (analysisController.current === controller) setLoading(false); }
  };
  const download = () => {
    const url = URL.createObjectURL(new Blob([answer], {type:'text/markdown;charset=utf-8'}));
    const link = document.createElement('a'); link.href = url; link.download = 'operadash-relatorio-deepseek.md'; link.click(); URL.revokeObjectURL(url);
  };
  return <section className="deepseek-panel" aria-labelledby="deepseek-title"><div className="solor-section-heading"><div><span className="solor-kicker">ANÁLISE ONLINE</span><h3 id="deepseek-title">Conectar DeepSeek API</h3><p>Gere o relatório do recorte atual usando sua conta DeepSeek.</p></div><span className="solor-section-badge">{models.length ? 'Conectada' : 'Não conectada'}</span></div>
    <p className="deepseek-privacy"><ShieldCheck size={15} />A chave é usada somente em memória nesta seção e enviada apenas para api.deepseek.com. Ao gerar a análise, o resumo agregado, os filtros, os nomes dos rankings e sua pergunta serão enviados à DeepSeek. Arquivos completos e comentários brutos não são enviados. O uso pode consumir créditos da sua conta.</p>
    <div className="deepseek-connect"><label><span><KeyRound size={14} />Chave DeepSeek</span><input type="password" aria-label="Chave da API DeepSeek" autoComplete="off" spellCheck={false} maxLength={512} value={key} disabled={connecting || models.length > 0} onChange={event => { setKey(event.target.value); setError(''); }} placeholder="Cole sua chave da API" /></label><button className="button button--primary" onClick={() => void connect()} disabled={connecting || !key.trim() || models.length > 0}>{connecting ? <LoaderCircle size={15} className="local-ai-spinner" /> : <KeyRound size={15} />}{connecting ? 'Conectando…' : 'Conectar DeepSeek'}</button>{(models.length > 0 || connecting) && <button className="button button--quiet" onClick={disconnect}><X size={14} />Desconectar</button>}</div>
    {models.length > 0 && <div className="deepseek-analysis"><label><span>Modelo DeepSeek</span><select aria-label="Modelo DeepSeek" value={model} onChange={event=>{setModel(event.target.value);setAnswer('');}} disabled={loading}><option value="">Selecione um modelo…</option>{models.map(id=><option key={id} value={id}>{id}</option>)}</select></label><label><span>Pergunta adicional (opcional)</span><textarea aria-label="Pergunta para DeepSeek" rows={2} maxLength={1200} value={question} disabled={loading} onChange={event=>setQuestion(event.target.value)} placeholder="Qual ponto da operação você quer investigar?" /></label><label className="deepseek-consent"><input type="checkbox" checked={consent} disabled={loading} onChange={event=>setConsent(event.target.checked)} />Autorizo enviar o resumo agregado e minha pergunta à DeepSeek ao gerar o relatório.</label><button className="button button--primary" disabled={!hasData || !model || !consent || loading} onClick={()=>void analyze()}>{loading ? <LoaderCircle size={15} className="local-ai-spinner" /> : <Sparkles size={15} />}{loading ? 'Gerando relatório…' : 'Analisar com DeepSeek'}</button>{!hasData && <p className="mapping-description">Importe os alertas para preparar o resumo operacional.</p>}</div>}
    {error && <p className="source-warning" role="alert">{error}</p>}{answer && <div className="deepseek-answer"><div className="solor-section-heading"><h3>Relatório DeepSeek · recorte atual</h3><button className="button button--quiet" onClick={download}><Download size={14} />Baixar relatório</button></div><div className="local-ai-answer__content" dangerouslySetInnerHTML={{__html:renderAnswer(answer)}} /></div>}
    <a className="deepseek-docs" href="https://api-docs.deepseek.com/" target="_blank" rel="noreferrer">Documentação oficial da DeepSeek ↗</a>
  </section>;
}
