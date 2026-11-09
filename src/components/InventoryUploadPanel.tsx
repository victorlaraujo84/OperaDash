import { AlertTriangle, ChevronDown, Database, FileSpreadsheet, RefreshCw, Upload, X } from "lucide-react";
import type { InventoryImportResult } from "../types/operadora";
import { formatNumber } from "../lib/analytics";

interface InventoryUploadPanelProps {
  fileName: string | null;
  result: InventoryImportResult | null;
  busy: boolean;
  error: string;
  onSelect: () => void;
  onRemove: () => void;
  onSheetChange: (sheetName: string) => void;
  onHostColumnChange: (columnIndex: number) => void;
  onCategoryColumnChange: (columnIndex: number | null) => void;
  onOperatorColumnChange: (columnIndex: number | null) => void;
  onLocalityColumnChange: (columnIndex: number | null) => void;
}

export function InventoryUploadPanel({ fileName, result, busy, error, onSelect, onRemove, onSheetChange, onHostColumnChange, onCategoryColumnChange, onOperatorColumnChange, onLocalityColumnChange }: InventoryUploadPanelProps) {
  const links = result?.assets.filter((asset) => asset.categories.includes("links")).length ?? 0;
  const devices = result?.assets.filter((asset) => asset.categories.includes("devices")).length ?? 0;

  return (
    <section className="itsm-upload-panel panel inventory-upload-panel" aria-labelledby="inventory-panel-title">
      <div className="itsm-upload-panel__header">
        <span className="itsm-panel-icon"><Database size={16} /></span>
        <div className="panel-heading__copy">
          <span className="section-kicker">BASE DO DENOMINADOR</span>
          <h2 id="inventory-panel-title">Inventário de hosts</h2>
          <p>Importe ativos, links monitorados e, para calcular por cidade, a coluna de localidade.</p>
        </div>
        <div className="itsm-upload-panel__actions">
          {fileName ? <button className="button button--quiet button--small" onClick={onSelect} disabled={busy}><RefreshCw size={13} />Trocar inventário</button> : null}
          {fileName ? <button className="icon-button icon-button--remove" onClick={onRemove} disabled={busy} aria-label="Remover inventário de hosts"><X size={14} /></button> : null}
          {!fileName ? <button className="button button--quiet button--small" onClick={onSelect} disabled={busy}><Upload size={14} />{busy ? "Lendo inventário…" : "Selecionar inventário"}</button> : null}
        </div>
      </div>

      {busy ? <div className="itsm-loading"><span className="loading-pip" />Lendo o inventário localmente…</div> : null}
      {error ? <div className="itsm-message itsm-message--error" role="alert"><AlertTriangle size={14} /><span>{error}</span></div> : null}

      {result && fileName ? (
        <div className="itsm-upload-panel__body inventory-upload-panel__body">
          <div className="itsm-file-summary"><span className="file-status-icon"><FileSpreadsheet size={16} /></span><div><strong>{fileName}</strong><p>{formatNumber(result.uniqueHosts)} hosts únicos · aba {result.sheetName} · processado localmente</p></div></div>
          <div className="itsm-link-summary" aria-label="Contagem única do inventário">
            <span><strong>{formatNumber(result.uniqueHosts)}</strong><small>hosts únicos</small></span>
            <span><strong>{formatNumber(links)}</strong><small>links</small></span>
            <span><strong>{formatNumber(devices)}</strong><small>dispositivos</small></span>
            {result.duplicateRows ? <span><strong>{formatNumber(result.duplicateRows)}</strong><small>linhas repetidas consolidadas</small></span> : null}
          </div>

          <div className="inventory-selectors">
            {result.sheetNames.length > 1 ? <label className="filter-field"><span>Aba do inventário</span><span className="select-wrap"><select value={result.sheetName} onChange={(event) => onSheetChange(event.target.value)}><option value="">Selecione uma aba</option>{result.sheetNames.map((sheet) => <option key={sheet} value={sheet}>{sheet}</option>)}</select><ChevronDown size={13} /></span></label> : null}
            <label className="filter-field"><span>Coluna do host / ativo</span><span className="select-wrap"><select value={result.hostColumnIndex === null ? "" : String(result.hostColumnIndex)} onChange={(event) => { if (event.target.value !== "") onHostColumnChange(Number(event.target.value)); }}><option value="">Selecione a coluna identificadora</option>{result.columns.map((column) => <option key={column.index} value={column.index}>{column.label} · {formatNumber(column.populatedRows)} preenchidos</option>)}</select><ChevronDown size={13} /></span></label>
            <label className="filter-field"><span>Coluna de tipo (opcional)</span><span className="select-wrap"><select value={result.categoryColumnIndex === null ? "" : String(result.categoryColumnIndex)} onChange={(event) => onCategoryColumnChange(event.target.value === "" ? null : Number(event.target.value))}><option value="">Inferir pelo prefixo LINK</option>{result.columns.filter((column) => column.index !== result.hostColumnIndex).map((column) => <option key={column.index} value={column.index}>{column.label}</option>)}</select><ChevronDown size={13} /></span></label>
            <label className="filter-field"><span>Coluna da operadora (opcional)</span><span className="select-wrap"><select value={result.operatorColumnIndex === null ? "" : String(result.operatorColumnIndex)} onChange={(event) => onOperatorColumnChange(event.target.value === "" ? null : Number(event.target.value))}><option value="">Sem operadora no inventário</option>{result.columns.filter((column) => column.index !== result.hostColumnIndex && column.index !== result.categoryColumnIndex && column.index !== result.localityColumnIndex).map((column) => <option key={column.index} value={column.index}>{column.label} · {formatNumber(column.populatedRows)} preenchidos</option>)}</select><ChevronDown size={13} /></span></label>
            <label className="filter-field"><span>Coluna da localidade (opcional)</span><span className="select-wrap"><select value={result.localityColumnIndex === null ? "" : String(result.localityColumnIndex)} onChange={(event) => onLocalityColumnChange(event.target.value === "" ? null : Number(event.target.value))}><option value="">Sem localidade no inventário</option>{result.columns.filter((column) => column.index !== result.hostColumnIndex && column.index !== result.categoryColumnIndex && column.index !== result.operatorColumnIndex).map((column) => <option key={column.index} value={column.index}>{column.label} · {formatNumber(column.populatedRows)} preenchidos</option>)}</select><ChevronDown size={13} /></span></label>
          </div>

          {!result.assets.length ? <div className="itsm-waiting inventory-waiting"><AlertTriangle size={14} />Selecione a coluna que identifica cada host/ativo para completar o inventário.</div> : null}
          {result.emptyHostRows ? <p className="inventory-note">{formatNumber(result.emptyHostRows)} linha(s) sem identificador de host não entram na contagem.</p> : null}
          {result.warnings.length ? <details className="itsm-warnings inventory-warnings"><summary><AlertTriangle size={13} />{formatNumber(result.warnings.length)} aviso(s) do inventário</summary><ul>{result.warnings.map((warning) => <li key={warning}>{warning}</li>)}</ul></details> : null}
        </div>
      ) : null}
    </section>
  );
}
