import { ChevronDown, FileSpreadsheet } from "lucide-react";
import { formatNumber } from "../lib/analytics";
import type { DetectedColumn } from "../types/operadora";

interface DetectedColumnsPanelProps {
  title: string;
  fileName: string;
  sheetName: string;
  totalRows: number;
  columns: DetectedColumn[];
}

export function DetectedColumnsPanel({ title, fileName, sheetName, totalRows, columns }: DetectedColumnsPanelProps) {
  if (!columns.length) return null;
  const mapped = columns.filter((column) => column.field).length;

  return (
    <details className="sidebar-discovery">
      <summary>
        <span><FileSpreadsheet size={13} />{title}</span>
        <small>{formatNumber(mapped)}/{formatNumber(columns.length)} mapeadas</small>
        <ChevronDown size={13} className="sidebar-discovery__chevron" />
      </summary>
      <div className="sidebar-discovery__meta">{fileName} · aba {sheetName} · {formatNumber(totalRows)} linhas</div>
      <ul>
        {columns.map((item, index) => (
          <li key={`${item.column}-${index}`} className={item.field ? "is-mapped" : "is-unmapped"}>
            <span title={item.column}>{item.column}</span>
            <strong>{item.field ?? "Não mapeada"}</strong>
          </li>
        ))}
      </ul>
    </details>
  );
}
