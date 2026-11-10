import { AlertTriangle, CheckCircle2, Database, Info } from "lucide-react";
import { formatNumber } from "../lib/analytics";

interface DataQualityPanelProps {
  filteredCount: number;
  durationIncluded: number;
  availabilityStatus: string;
  availabilityExcluded: number;
  unmatchedAssets: number;
  inventoryLoaded: boolean;
  mtfbGroups: number;
  mtfbIntervals: number;
}

function qualityTone(value: boolean, partial = false): "good" | "warn" | "muted" {
  return value ? partial ? "warn" : "good" : "muted";
}

export function DataQualityPanel({ filteredCount, durationIncluded, availabilityStatus, availabilityExcluded, unmatchedAssets, inventoryLoaded, mtfbGroups, mtfbIntervals }: DataQualityPanelProps) {
  const durationCoverage = filteredCount ? durationIncluded / filteredCount : 0;
  const availabilityReady = availabilityStatus === "available";
  const availabilityPartial = availabilityReady && (availabilityExcluded > 0 || unmatchedAssets > 0);
  const mtfbReady = mtfbIntervals > 0;
  const mtfbPartial = mtfbReady && mtfbIntervals < 3;
  const items = [
    { label: "Base do recorte", value: formatNumber(filteredCount), detail: "registros filtrados", icon: <Database size={14} />, tone: filteredCount ? "good" : "muted" },
    { label: "Duração válida", value: `${Math.round(durationCoverage * 100)}%`, detail: `${formatNumber(durationIncluded)} de ${formatNumber(filteredCount)} registros`, icon: <CheckCircle2 size={14} />, tone: qualityTone(durationIncluded > 0, durationCoverage < 0.95) },
    { label: "Disponibilidade", value: availabilityReady ? availabilityPartial ? "Parcial" : "Confiável" : "Não calculável", detail: inventoryLoaded ? `${formatNumber(unmatchedAssets)} ativo(s) sem correspondência` : "inventário não carregado", icon: availabilityReady ? <CheckCircle2 size={14} /> : <AlertTriangle size={14} />, tone: qualityTone(availabilityReady, availabilityPartial) },
    { label: "MTFB", value: mtfbReady ? mtfbPartial ? "Amostra pequena" : "Base suficiente" : "Sem base", detail: `${formatNumber(mtfbGroups)} grupo(s) · ${formatNumber(mtfbIntervals)} intervalo(s)`, icon: mtfbReady ? <Info size={14} /> : <AlertTriangle size={14} />, tone: qualityTone(mtfbReady, mtfbPartial) },
  ] as const;

  return (
    <details className="data-quality-panel panel" open>
      <summary className="panel-heading">
        <div className="panel-heading__icon"><Info size={16} /></div>
        <div className="panel-heading__copy"><h2>Qualidade do recorte</h2><p>Base, cobertura e limitações que afetam os indicadores</p></div>
        <span className="panel-tag">AUDITORIA · OCULTAR</span>
      </summary>
      <div className="data-quality-grid">
        {items.map((item) => <article className={`data-quality-item data-quality-item--${item.tone}`} key={item.label}><div className="data-quality-item__icon">{item.icon}</div><div><span>{item.label}</span><strong>{item.value}</strong><small>{item.detail}</small></div></article>)}
      </div>
    </details>
  );
}
