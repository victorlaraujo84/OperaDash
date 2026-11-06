import type { MtfbRow } from "../lib/analytics";
import { formatMinutes, formatNumber } from "../lib/analytics";
import { Clock3 } from "lucide-react";

interface MtfbPanelProps {
  rows: MtfbRow[];
  categoryLabel: string;
}

export function MtfbPanel({ rows, categoryLabel }: MtfbPanelProps) {
  return (
    <section className="panel mtfb-panel" aria-label="MTFB por operadora e localidade">
      <div className="panel-heading">
        <div className="panel-heading__icon" aria-hidden="true"><Clock3 size={16} /></div>
        <div className="panel-heading__copy">
          <h2>MTFB por operadora e localidade</h2>
          <p>Tempo médio entre falhas consecutivas no recorte filtrado · {categoryLabel}</p>
        </div>
        <span className="panel-tag">MTFB</span>
      </div>
      {rows.length ? (
        <div className="mtfb-table-wrap">
          <table className="mtfb-table">
            <thead><tr><th scope="col">Operadora</th><th scope="col">Localidade</th><th scope="col">Falhas</th><th scope="col">Intervalos</th><th scope="col">MTFB médio</th><th scope="col">Mediana</th><th scope="col">Qualidade</th></tr></thead>
            <tbody>
              {rows.map((row) => (
                <tr key={`${row.operator}\u0000${row.locality}`}>
                  <td title={row.operator}>{row.operator}</td>
                  <td title={row.locality}>{row.locality}</td>
                  <td>{formatNumber(row.failures)}</td>
                  <td>{formatNumber(row.intervals)}</td>
                  <td className={row.mtfbMinutes === null ? "mtfb-value mtfb-value--muted" : "mtfb-value"}>{formatMinutes(row.mtfbMinutes, true)}</td>
                  <td className={row.medianMinutes === null ? "mtfb-value mtfb-value--muted" : "mtfb-value"}>{formatMinutes(row.medianMinutes, true)}</td>
                  <td><span className={`mtfb-quality mtfb-quality--${row.quality === "base suficiente" ? "good" : row.quality === "amostra pequena" ? "warn" : "muted"}`}>{row.quality}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : <div className="chart-empty"><span className="empty-mark">—</span><p>São necessárias pelo menos duas falhas datadas no mesmo grupo para calcular o MTFB.</p></div>}
      <div className="panel-footnote">Menor MTFB indica falhas mais frequentes. A mediana reduz o efeito de intervalos extremos. Cada linha datada é um evento; sem ID único de incidente, o indicador é uma aproximação operacional.</div>
    </section>
  );
}
