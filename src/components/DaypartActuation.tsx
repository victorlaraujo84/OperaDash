import { ChartExport } from './ChartExport';
import { Clock3 } from "lucide-react";
import type { DaypartActuationRow } from "../types/operadora";
import { formatNumber, formatPercent } from "../lib/analytics";
import { getPercentagePointTrend, trendGlyph } from "../lib/month-comparison";

interface DaypartActuationProps {
  rows: DaypartActuationRow[];
  unclassified: number;
  previousRows?: DaypartActuationRow[];
  comparisonLabel?: string | null;
}

export function DaypartActuation({ rows, unclassified, previousRows = [], comparisonLabel }: DaypartActuationProps) {
  const previousByKey = new Map(previousRows.map((row) => [row.key, row]));
  return (
    <section className="panel daypart-panel">
      <ChartExport title="Atuação por período do dia" />
      <div className="panel-heading">
        <div className="panel-heading__icon"><Clock3 size={16} /></div>
        <div className="panel-heading__copy">
          <h2>Atuação por período do dia</h2>
          <p>Responsável contém noc-solor · ordenado do menor para o maior</p>
        </div>
        <span className="panel-tag">ATUAÇÃO</span>
      </div>
      <ol className="daypart-list">
        {rows.map((row, index) => {
          const previous = previousByKey.get(row.key);
          const trend = comparisonLabel ? getPercentagePointTrend(row.percent, previous?.percent ?? null) : null;
          const tone = !trend ? "neutral" : trend.direction === "up" ? "positive" : trend.direction === "down" ? "negative" : "neutral";
          return (
            <li className="daypart-row" key={row.key}>
              <span className="daypart-row__rank">{String(index + 1).padStart(2, "0")}</span>
              <span className="daypart-row__label"><strong>{row.label}</strong><small>{row.range}</small></span>
              <span className="daypart-row__bar" aria-hidden="true"><i style={{ width: `${row.percent === null ? 0 : Math.max(0, Math.min(100, row.percent))}%` }} /></span>
              <span className="daypart-row__value">
                <strong>{formatPercent(row.percent)}</strong>
                <small>{formatNumber(row.acted)}/{formatNumber(row.total)}</small>
                {trend ? <small className={`month-change month-change--${tone}`} title={`Variação em pontos percentuais vs. ${comparisonLabel}`}>{trendGlyph(trend.direction)} {trend.text}</small> : null}
              </span>
            </li>
          );
        })}
      </ol>
      <div className="panel-footnote">Faixa horária pelo Horário Inicial · alarmes sem horário: {formatNumber(unclassified)} · contagem/atuados{comparisonLabel ? ` · variação em p.p. vs. ${comparisonLabel} (mais atuação é melhor)` : ""}</div>
    </section>
  );
}
