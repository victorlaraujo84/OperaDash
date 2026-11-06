import { Bar, BarChart, CartesianGrid, LabelList, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { RankedEntity } from "../types/operadora";
import { formatMinutes, formatNumber } from "../lib/analytics";
import { getRankComparisonSample, getRelativeTrend, hasRankMetricBaseline, trendGlyph } from "../lib/month-comparison";
import { jiraIssueSearchUrl } from "../lib/jira";

interface RankChartProps {
  title: string;
  description: string;
  rows: RankedEntity[];
  metric: "downtime" | "alarms";
  icon: React.ReactNode;
  emptyLabel?: string;
  metricLabel?: string;
  footnote?: string;
  currentComparisonRows?: RankedEntity[];
  comparisonRows?: RankedEntity[];
  comparisonLabel?: string | null;
  comparisonHasBaseline?: boolean;
  comparisonRecordCount?: number;
  jiraBaseUrl?: string;
}

function shortName(value: string, max = 23): string {
  return value.length > max ? `${value.slice(0, max - 1)}…` : value;
}

export function RankChart({ title, description, rows, metric, icon, emptyLabel = "Sem dados para este recorte.", metricLabel, footnote, currentComparisonRows = rows, comparisonRows = [], comparisonLabel, comparisonHasBaseline = false, comparisonRecordCount = comparisonRows.length, jiraBaseUrl }: RankChartProps) {
  const hasMetricBaseline = hasRankMetricBaseline(comparisonHasBaseline, metric, comparisonRows, comparisonRecordCount);
  const comparisonSample = getRankComparisonSample(currentComparisonRows, hasMetricBaseline ? comparisonRows : []);
  const chartRows = rows.map((row) => ({
    name: shortName(row.name),
    fullName: row.name,
    value: metric === "downtime" ? row.downtimeMinutes : row.alarms,
    display: metric === "downtime" ? formatMinutes(row.downtimeMinutes, true) : formatNumber(row.alarms),
    alarms: row.alarms,
    downtimeMinutes: row.downtimeMinutes,
  }));
  const color = metric === "alarms" ? "#9b6500" : "#00A6A6";

  return (
    <section className="panel rank-panel">
      <div className="panel-heading">
        <div className="panel-heading__icon">{icon}</div>
        <div className="panel-heading__copy">
          <h2>{title}</h2>
          <p>{description}</p>
        </div>
        <span className="panel-tag">TOP 5</span>
      </div>
      {chartRows.length ? (
        <div className="rank-chart">
          <ResponsiveContainer width="100%" height={Math.max(206, chartRows.length * 43)}>
            <BarChart data={chartRows} layout="vertical" margin={{ top: 5, right: 58, bottom: 0, left: 0 }} barCategoryGap={12}>
              <CartesianGrid horizontal={false} stroke="rgba(18, 53, 91, 0.11)" />
              <XAxis
                type="number"
                axisLine={false}
                tickLine={false}
                tick={{ fill: "#60758b", fontSize: 10 }}
                tickFormatter={(value: number) => metric === "downtime" ? formatMinutes(value, true) : formatNumber(value)}
              />
              <YAxis
                type="category"
                dataKey="name"
                width={112}
                axisLine={false}
                tickLine={false}
                tick={{ fill: "#35536e", fontSize: 10 }}
              />
              <Tooltip
                cursor={{ fill: "rgba(18, 53, 91, 0.045)" }}
                contentStyle={{ background: "#ffffff", border: "1px solid rgba(18, 53, 91, 0.18)", borderRadius: 10, color: "#18324b", fontSize: 12, boxShadow: "0 8px 20px rgba(18, 53, 91, 0.12)" }}
                labelStyle={{ color: "#12355b", fontWeight: 600, marginBottom: 5 }}
                labelFormatter={(_label, payload) => payload?.[0]?.payload?.fullName ?? _label}
                formatter={(value) => [metric === "downtime" ? formatMinutes(Number(value), true) : formatNumber(Number(value)), metric === "downtime" ? "Indisponibilidade" : metricLabel ?? "Alarmes"]}
              />
              <Bar dataKey="value" fill={color} radius={[0, 5, 5, 0]} maxBarSize={20}>
                <LabelList dataKey="display" position="right" fill="#35536e" fontSize={10} fontFamily="IBM Plex Mono, monospace" />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
          {title.startsWith("Links ofensores") || title.startsWith("Dispositivos ofensores") ? (() => { const jiraRows = chartRows.map((row) => ({ ...row, jiraUrl: jiraIssueSearchUrl(row.fullName, jiraBaseUrl) })).filter((row) => row.jiraUrl); return jiraRows.length ? <div className="rank-jira-links"><span>Consultar no Jira ITSM</span>{jiraRows.map((row) => <a key={row.fullName} className="jira-link" href={row.jiraUrl ?? undefined} target="_blank" rel="noreferrer">{shortName(row.fullName, 18)}</a>)}</div> : null; })() : null}
          {comparisonLabel ? (
            <div className="rank-month-comparison" aria-label={`Comparação do TOP 5 atual e do mês-base ${comparisonLabel}`}>
              <div className="rank-month-comparison__heading">{hasMetricBaseline ? "TOP 5 atual + TOP 5 anterior" : "TOP 5 atual · base sem métrica disponível"} <span>vs. {comparisonLabel}</span></div>
              <ul>
                {comparisonSample.map((sample) => {
                  const { name, current: currentRow, previous: previousRow, currentRank, previousRank } = sample;
                  const currentValue = currentRow ? metric === "downtime" ? currentRow.downtimeMinutes : currentRow.alarms : 0;
                  const previousValue = previousRow ? metric === "downtime" ? previousRow.downtimeMinutes : previousRow.alarms : 0;
                  const trend = getRelativeTrend(currentValue, hasMetricBaseline ? previousValue : null);
                  const tone = trend.direction === "up" || trend.direction === "new" ? "negative" : trend.direction === "down" ? "positive" : "neutral";
                  const membership = [currentRank ? `Atual #${currentRank}` : "Fora do TOP 5 atual", hasMetricBaseline ? previousRank ? `Mês-base #${previousRank}` : "Fora do TOP 5 anterior" : "Sem base mensurável"].join(" · ");
                  const formatMetric = (value: number) => metric === "downtime" ? formatMinutes(value, true) : formatNumber(value);
                  const scopeName = metric === "downtime" ? "atual" : metricLabel?.toLowerCase() ?? "alarmes";
                  const unavailableBaseline = comparisonHasBaseline && metric === "downtime" ? "sem duração válida no mês-base" : "mês-base sem dados";
                  const valuesLabel = hasMetricBaseline
                    ? `${formatMetric(currentValue)} ${scopeName} · ${formatMetric(previousValue)} no mês-base`
                    : `${formatMetric(currentValue)} ${scopeName} · ${unavailableBaseline}`;
                  return <li key={name}>
                    <span className="rank-month-comparison__entity" title={name}>
                      <strong>{shortName(name, 22)}</strong>
                      <small>{membership}</small>
                    </span>
                    <span className="rank-month-comparison__result">
                      <strong className={`month-change month-change--${tone}`} aria-label={`${trend.direction === "up" || trend.direction === "new" ? "Aumento" : trend.direction === "down" ? "Redução" : trend.direction === "flat" ? "Sem variação" : "Sem base"}: ${trend.text}`}>{trendGlyph(trend.direction)} {trend.text}</strong>
                      <small>{valuesLabel}</small>
                    </span>
                  </li>;
                })}
              </ul>
              <small className="rank-month-comparison__sampling">Inclui os cinco primeiros de cada período (até 10 itens); os valores absolutos ajudam a interpretar percentuais sobre bases pequenas.</small>
            </div>
          ) : null}
        </div>
      ) : (
        <div className="chart-empty"><span className="empty-mark">—</span><p>{emptyLabel}</p></div>
      )}
      {footnote || rows.length > 0 ? <div className="panel-footnote">{footnote ?? (metric === "downtime" ? "Somatório por registro da planilha · horas-link" : "Contagem de registros da planilha · alarmes")}{comparisonLabel ? " · aumento de alarmes/indisponibilidade indica maior impacto" : ""}</div> : null}
    </section>
  );
}
