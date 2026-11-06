import { AlertTriangle, CloudDownload, ShieldCheck } from "lucide-react";
import { useState } from "react";
import { inferSharePointFileName, looksLikeXlsx, parseSharePointFileUrl, withDownloadHint } from "../lib/sharepoint-link";

interface SharePointPublicFilePanelProps {
  onFile: (file: File) => void;
}

function isChromeExtensionContext(): boolean {
  return typeof chrome !== "undefined" && Boolean(chrome.runtime?.id && chrome.permissions?.request);
}

export function SharePointPublicFilePanel({ onFile }: SharePointPublicFilePanelProps) {
  const [url, setUrl] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function downloadFile() {
    setMessage("");
    setError("");
    const parsedUrl = parseSharePointFileUrl(url);
    if (!parsedUrl) {
      setError("Informe um link HTTPS de um arquivo em um host SharePoint válido. Links de outras origens não são aceitos.");
      return;
    }
    if (!isChromeExtensionContext()) {
      setError("Esta fonte sem login está disponível somente na extensão Chrome.");
      return;
    }

    setBusy(true);
    try {
      const originPermission = `${parsedUrl.origin}/*`;
      const granted = await chrome.permissions.request({ origins: [originPermission] });
      if (!granted) {
        setError("O acesso ao domínio SharePoint não foi autorizado. Nenhum arquivo foi lido.");
        return;
      }

      const candidates = [parsedUrl, withDownloadHint(parsedUrl)];
      let response: Response | null = null;
      let buffer: ArrayBuffer | null = null;
      let selectedUrl = parsedUrl;
      for (const candidate of candidates) {
        const candidateResponse = await fetch(candidate.toString(), { cache: "no-store", redirect: "follow" });
        const candidateBuffer = await candidateResponse.arrayBuffer();
        if (candidateResponse.ok && looksLikeXlsx(candidateBuffer)) {
          response = candidateResponse;
          buffer = candidateBuffer;
          selectedUrl = candidate;
          break;
        }
      }
      if (!response || !buffer) {
        throw new Error("O link não entregou um XLSX diretamente. No SharePoint, use Copiar link de um arquivo .xlsx, não o link de uma pasta ou de uma página de visualização.");
      }

      const fileName = inferSharePointFileName(selectedUrl, response.headers.get("content-disposition"));
      onFile(new File([buffer], fileName, { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }));
      setMessage(`Arquivo ${fileName} baixado e enviado ao parser local. O conteúdo não foi enviado ao SharePoint ou a outro serviço.`);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Não foi possível baixar o arquivo SharePoint.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="sharepoint-link-panel panel" aria-labelledby="sharepoint-link-title">
      <div className="sharepoint-link-panel__header">
        <span className="itsm-panel-icon"><CloudDownload size={15} /></span>
        <div><span className="section-kicker">EXTENSÃO · SEM LOGIN</span><h2 id="sharepoint-link-title">Arquivo SharePoint</h2></div>
      </div>
      <p className="sharepoint-link-panel__intro">Importe um arquivo XLSX por link público somente para leitura. O link pode ser encaminhado por qualquer pessoa que o possua; não use esta opção para dados sensíveis.</p>
      <label className="sharepoint-link-panel__field">Link do arquivo XLSX<input value={url} onChange={(event) => setUrl(event.target.value)} placeholder="https://empresa.sharepoint.com/.../alarmes.xlsx" disabled={busy} inputMode="url" /></label>
      <button type="button" className="button button--quiet button--small" onClick={() => void downloadFile()} disabled={busy || !url.trim()}>{busy ? "Baixando…" : "Baixar arquivo"}</button>
      <p className="sharepoint-link-panel__note"><ShieldCheck size={12} />Permissão solicitada somente para o domínio informado e somente após este clique. O painel aceita arquivo, não pasta.</p>
      {message ? <p className="sharepoint-link-panel__message" role="status">{message}</p> : null}
      {error ? <p className="sharepoint-link-panel__error" role="alert"><AlertTriangle size={12} />{error}</p> : null}
    </section>
  );
}
