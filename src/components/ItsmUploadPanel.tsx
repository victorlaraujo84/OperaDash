import { AlertTriangle, ChevronDown, FileSpreadsheet, Link2, RefreshCw, ShieldCheck, Upload, X } from "lucide-react";
import type { ItsmImportResult, ItsmJoinSummary } from "../types/operadora";
import { formatNumber } from "../lib/analytics";

interface ItsmUploadPanelProps {
  fileName: string | null;
  result: ItsmImportResult | null;
  summary: ItsmJoinSummary | null;
  busy: boolean;
  error: string;
  onSelect: () => void;
  onRemove: () => void;
  onSheetChange: (sheetName: string) => void;
}

export function ItsmUploadPanel({ fileName, result, summary, busy, error, onSelect, onRemove, onSheetChange }: ItsmUploadPanelProps) {
  const matched = summary ? summary.matchedByPrimary + summary.matchedByInternal : 0;
  const unmatched = summary ? summary.notFound + summary.noKey : 0;
  return (
    <section className="itsm-upload-panel panel" aria-labelledby="itsm-panel-title">
      <div className="itsm-upload-panel__header">
        <span className="itsm-panel-icon"><Link2 size={16} /></span>
        <div className="panel-heading__copy">
          <span className="section-kicker">JIRA · NOC SOLOR</span>
          <h2 id="itsm-panel-title">Incidentes · Jira</h2>
          <p>Importe os incidentes em CSV ou XLSX para correlacionar as chaves dos alertas.</p>
        </div>
        <div className="itsm-upload-panel__actions">
          {fileName ? <button className="button button--quiet button--small" onClick={onSelect} disabled={busy}><RefreshCw size={13} />Trocar ITSM</button> : null}
          {fileName ? <button className="icon-button icon-button--remove" onClick={onRemove} disabled={busy} aria-label="Remover planilha ITSM"><X size={14} /></button> : null}
          {!fileName ? <button className="button button--quiet button--small" onClick={onSelect} disabled={busy}><Upload size={14} />{busy ? "Lendo ITSM…" : "Selecionar incidentes"}</button> : null}
        </div>
      </div>

      {busy ? <div className="itsm-loading"><span className="loading-pip" />Lendo o arquivo ITSM localmente…</div> : null}
      {error ? <div className="itsm-message itsm-message--error" role="alert"><AlertTriangle size={14} /><span>{error}</span></div> : null}

      {result && fileName ? (
        <div className="itsm-upload-panel__body">
          <div className="itsm-file-summary"><span className="file-status-icon"><FileSpreadsheet size={16} /></span><div><strong>{fileName}</strong><p><span className="success-dot" />{formatNumber(result.totalRows)} tickets · aba {result.sheetName}</p></div></div>
          {result.sheetNames.length > 1 ? <label className="filter-field sidebar-sheet-field"><span>Aba ITSM</span><span className="select-wrap"><select value={result.sheetName} onChange={(event) => onSheetChange(event.target.value)}>{result.sheetNames.map((sheet) => <option key={sheet} value={sheet}>{sheet}</option>)}</select><ChevronDown size={13} /></span></label> : null}
          {summary ? (
            <div className="itsm-link-summary" aria-label="Resumo do join ITSM">
              <span><strong>{formatNumber(matched)}</strong><small>vinculados</small></span>
              <span><strong>{formatNumber(summary.matchedByPrimary)}</strong><small>por chave</small></span>
              <span><strong>{formatNumber(summary.matchedByInternal)}</strong><small>por link interno</small></span>
              <span className={summary.ambiguous ? "itsm-stat--warning" : ""}><strong>{formatNumber(summary.ambiguous)}</strong><small>ambíguos</small></span>
              <span><strong>{formatNumber(unmatched)}</strong><small>sem vínculo</small></span>
              {summary.summaryMismatch ? <span className="itsm-stat--warning"><strong>{formatNumber(summary.summaryMismatch)}</strong><small>Resumo divergente</small></span> : null}
            </div>
          ) : (
            <div className="itsm-waiting"><ShieldCheck size={14} />Aguardando a planilha de alarmes para executar o join.</div>
          )}
          {result.warnings.length ? <details className="itsm-warnings"><summary><AlertTriangle size={13} />{formatNumber(result.warnings.length)} aviso(s) da planilha ITSM</summary><ul>{result.warnings.map((warning) => <li key={warning}>{warning}</li>)}</ul></details> : null}
        </div>
      ) : null}
    </section>
  );
}
