import { AlertTriangle, ChevronDown, FileSpreadsheet, RefreshCw, Upload, X } from "lucide-react";
import { formatNumber } from "../lib/analytics";
import type { ImportResult } from "../types/operadora";

interface AlarmUploadPanelProps {
  result: ImportResult | null;
  busy: boolean;
  error: string;
  dragging: boolean;
  onSelect: () => void;
  onRemove: () => void;
  onSheetChange: (sheetName: string) => void;
  onFileDrop: (file: File) => void;
  onDragChange: (dragging: boolean) => void;
}

export function AlarmUploadPanel({ result, busy, error, dragging, onSelect, onRemove, onSheetChange, onFileDrop, onDragChange }: AlarmUploadPanelProps) {
  return (
    <section
      className={`sidebar-source-panel panel${dragging ? " sidebar-source-panel--dragging" : ""}`}
      aria-labelledby="alarm-source-title"
      onDragOver={(event) => { event.preventDefault(); onDragChange(true); }}
      onDragLeave={(event) => { if (!event.currentTarget.contains(event.relatedTarget as Node | null)) onDragChange(false); }}
      onDrop={(event) => { event.preventDefault(); onDragChange(false); const file = event.dataTransfer.files?.[0]; if (file) onFileDrop(file); }}
    >
      <div className="sidebar-source-panel__header">
        <span className="itsm-panel-icon"><FileSpreadsheet size={15} /></span>
        <div><span className="section-kicker">TELCOMANAGER · EVENTOS</span><h2 id="alarm-source-title">Alertas · TelcoManager</h2></div>
        <div className="sidebar-source-panel__actions">
          {result ? <button type="button" className="button button--quiet button--small" onClick={onSelect} disabled={busy}><RefreshCw size={12} />Trocar</button> : null}
          {result ? <button type="button" className="icon-button icon-button--remove" onClick={onRemove} disabled={busy} aria-label="Remover planilha de alarmes"><X size={13} /></button> : null}
        </div>
      </div>
      {busy ? <div className="itsm-loading sidebar-loading"><span className="loading-pip" />Lendo a planilha localmente…</div> : null}
      {error ? <div className="itsm-message itsm-message--error sidebar-error" role="alert"><AlertTriangle size={13} /><span>{error}</span></div> : null}
      {result ? (
        <div className="sidebar-source-panel__body">
          <strong className="sidebar-file-name" title={result.fileName}>{result.fileName}</strong>
          <p>{formatNumber(result.totalRows)} registros · {result.sheetNames.length} {result.sheetNames.length === 1 ? "aba" : "abas"} · leitura local</p>
          {result.sheetNames.length > 1 ? <label className="filter-field sidebar-sheet-field"><span>Aba de alarmes</span><span className="select-wrap"><select value={result.sheetName} onChange={(event) => onSheetChange(event.target.value)}>{result.sheetNames.map((sheet) => <option key={sheet} value={sheet}>{sheet}</option>)}</select><ChevronDown size={13} /></span></label> : <p className="sidebar-sheet-note">Aba: {result.sheetName}</p>}
        </div>
      ) : (
        <div className="sidebar-source-panel__empty">
          <p>Importe o AlarmReport em CSV ou XLSX.</p>
          <button type="button" className="button button--primary button--small" onClick={onSelect} disabled={busy}><Upload size={13} />Selecionar alarmes</button>
          <small>ou arraste o arquivo para esta área</small>
        </div>
      )}
    </section>
  );
}
