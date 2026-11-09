import { useEffect, useState } from 'react';
import { Check, ChevronDown, RotateCcw, SlidersHorizontal } from 'lucide-react';
import type { DetectedColumn } from '../types/operadora';
import type { ColumnMapping, MappingField } from '../lib/column-mapping';

export function ColumnMappingPanel({ title, fileName, sheetName, totalRows, columns, mapping = {}, fields, busy, onApply }: { title: string; fileName: string; sheetName: string; totalRows: number; columns: DetectedColumn[]; mapping?: ColumnMapping; fields: MappingField[]; busy: boolean; onApply: (mapping: ColumnMapping) => void }) {
  const [draft, setDraft] = useState<ColumnMapping>(mapping);
  const [changed, setChanged] = useState(false);
  useEffect(() => { setDraft(mapping); setChanged(false); }, [mapping]);
  return <details className="sidebar-discovery column-mapping-panel" open>
    <summary><span><SlidersHorizontal size={15} />{title}</span><small>{Object.values(mapping).filter(value => value !== null).length} campos</small><ChevronDown size={14} className="sidebar-discovery__chevron" /></summary>
    <p className="mapping-file">{fileName} · {sheetName} · {totalRows.toLocaleString('pt-BR')} linhas</p>
    <p className="mapping-description">Mantivemos a detecção automática. Selecione outra coluna para ajustar cada campo; cabeçalhos repetidos são identificados pela posição.</p>
    <div className="mapping-fields">{fields.map(field => <label key={field.key}><span>{field.label}</span><select aria-label={`${title}: ${field.label}`} value={draft[field.key] ?? ''} disabled={busy} onChange={event => { setDraft(current => ({ ...current, [field.key]: event.target.value === '' ? null : Number(event.target.value) })); setChanged(true); }}><option value="">Não utilizar / ausente</option>{columns.map((column, index) => <option key={index} value={index}>{column.column} · coluna {index + 1}</option>)}</select></label>)}</div>
    <div className="mapping-actions"><button className="button button--quiet button--small" onClick={() => onApply({})} disabled={busy}><RotateCcw size={13} />Restaurar padrão</button><button className="button button--primary button--small" onClick={() => onApply(draft)} disabled={busy || !changed}><Check size={14} />{busy ? 'Aplicando…' : 'Aplicar mapeamento'}</button></div>
    <p className="mapping-description">{changed ? 'Há alterações pendentes. Aplique para recalcular os dados.' : 'O mapeamento aplicado é salvo com o arquivo.'}</p>
  </details>;
}
