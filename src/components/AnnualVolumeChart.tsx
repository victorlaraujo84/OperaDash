import { ChartExport } from './ChartExport';
import { Bar, BarChart, CartesianGrid, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { CalendarRange } from "lucide-react";
import type { AnnualAlarmVolume } from "../types/operadora";
import { formatNumber } from "../lib/analytics";
import { getRelativeTrend, trendGlyph } from "../lib/month-comparison";

interface SelectedPeriodComparison {
  currentLabel: string;
  previousLabel: string;
  currentAlarms: number;
  previousAlarms: number;
  hasPreviousData: boolean;
}

interface AnnualVolumeChartProps {
  year: number;
  years: number[];
  yearPinned: boolean;
  periodConstrained: boolean;
  onYearChange: (year: number) => void;
  volume: AnnualAlarmVolume;
  history?: AnnualAlarmVolume;
  selectedPeriodComparison?: SelectedPeriodComparison | null;
}

function formatMedian(value: number): string {
  return new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 1 }).format(value);
}

export function AnnualVolumeChart({ year, years, yearPinned, periodConstrained, onYearChange, volume, history = volume, selectedPeriodComparison }: AnnualVolumeChartProps) {
  const { months, median } = volume;
  const monthlyTrends = history.months.map((month, index) => {
    const previousMonth = index > 0 ? history.months[index - 1] : null;
    const trend = previousMonth ? getRelativeTrend(month.alarms, previousMonth.alarms) : null;
    const tone = !trend ? "neutral" : trend.direction === "up" || trend.direction === "new" ? "negative" : trend.direction === "down" ? "positive" : "neutral";
    return { ...month, previousMonth, trend, tone };
  });
  const selectedPeriodTrend = selectedPeriodComparison
    ? selectedPeriodComparison.hasPreviousData
      ? getRelativeTrend(selectedPeriodComparison.currentAlarms, selectedPeriodComparison.previousAlarms)
      : { direction: "unavailable" as const, text: "Sem base" }
    : null;
  const selectedPeriodTone = !selectedPeriodTrend ? "neutral" : selectedPeriodTrend.direction === "up" || selectedPeriodTrend.direction === "new" ? "negative" : selectedPeriodTrend.direction === "down" ? "positive" : "neutral";

  return (
    <section className="panel annual-panel">
      <ChartExport title="Volume de alarmes" />
      <div className="panel-heading annual-panel__heading">
        <div className="panel-heading__icon"><CalendarRange size={16} /></div>
        <div className="panel-heading__copy">
          <h2>{periodConstrained ? "Volume no recorte filtrado" : "Volume de alarmes ao longo do ano"}</h2>
          <p>Somente alarmes que atendem aos filtros ativos · linha tracejada: mediana</p>
        </div>
        <label className="year-picker"><span>Ano</span><select value={year} disabled={yearPinned || years.length <= 1} onChange={(event) => onYearChange(Number(event.target.value))} aria-label="Ano do gráfico de volume">
          {years.map((item) => <option key={item} value={item}>{item}</option>)}
        </select></label>
      </div>
      {months.length ? (
        <>
          <div className="annual-volume-chart">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={months} margin={{ top: 12, right: 10, bottom: 0, left: -12 }}>
                <CartesianGrid vertical={false} stroke="rgba(18, 53, 91, 0.11)" />
                <XAxis dataKey="label" axisLine={false} tickLine={false} tick={{ fill: "#52677b", fontSize: 10 }} />
                <YAxis allowDecimals={false} axisLine={false} tickLine={false} tick={{ fill: "#60758b", fontSize: 9 }} tickFormatter={(value: number) => formatNumber(value)} />
                <Tooltip cursor={{ fill: "rgba(18, 53, 91, 0.045)" }} contentStyle={{ background: "#ffffff", border: "1px solid rgba(18, 53, 91, 0.18)", borderRadius: 10, color: "#18324b", fontSize: 11, boxShadow: "0 8px 20px rgba(18, 53, 91, 0.12)" }} labelStyle={{ color: "#12355b", fontWeight: 600, marginBottom: 4 }} labelFormatter={(label) => `${String(label)} · ${year}`} formatter={(value) => [formatNumber(Number(value)), "Alarmes filtrados"]} />
                {median !== null ? <ReferenceLine y={median} stroke="#9b6500" strokeWidth={1.5} strokeDasharray="6 5" /> : null}
                <Bar dataKey="alarms" fill="#00A6A6" radius={[4, 4, 0, 0]} maxBarSize={34} />
              </BarChart>
            </ResponsiveContainer>
          </div>
          {selectedPeriodComparison && selectedPeriodTrend ? (
            <div className="selected-month-comparison" aria-label={`Comparação do período selecionado: ${selectedPeriodComparison.currentLabel} contra ${selectedPeriodComparison.previousLabel}`}>
              <span>Recorte selecionado · {selectedPeriodComparison.currentLabel} vs. {selectedPeriodComparison.previousLabel}</span>
              <strong className={`month-change month-change--${selectedPeriodTone}`}>{trendGlyph(selectedPeriodTrend.direction)} {selectedPeriodTrend.text} alarmes</strong>
              <small>{formatNumber(selectedPeriodComparison.currentAlarms)} alarmes filtrados no recorte atual · {formatNumber(selectedPeriodComparison.previousAlarms)} no mês-base</small>
            </div>
          ) : null}
          <div className="annual-legend"><span className="annual-legend__bar" /><span>Alarmes filtrados por mês</span><span className="annual-legend__line" /><strong>Mediana: {median === null ? "—" : `${formatMedian(median)} alarmes`}</strong></div>
          <div className="panel-footnote">A série e as comparações usam categoria, datas/período, operadora, localidade, responsável, tipo, origem/trap, filtros ITSM e busca selecionados. {periodConstrained ? "As barras mostram somente os meses dentro do recorte temporal." : `Meses cobertos pelo conjunto filtrado (${months[0].label}–${months[months.length - 1].label} de ${year}).`} A linha tracejada é a mediana dos meses exibidos; aumento de alarmes indica maior impacto.</div>
        </>
      ) : (
        <div className="chart-empty"><span className="empty-mark">—</span><p>Nenhum alarme datado atende aos filtros selecionados neste ano.</p></div>
      )}
      {monthlyTrends.length > 0 && <div className="solor-monthly-history"><div className="solor-monthly-history__heading"><strong>Histórico mês a mês · {year}</strong><small>Independente do mês e das datas selecionadas</small></div><div className="annual-month-trends" aria-label="Valores mensais e variação em relação ao mês anterior">{monthlyTrends.map(item => <div className="annual-month-trends__item" key={item.key}><strong>{item.label}</strong><b>{formatNumber(item.alarms)}</b><span>alarmes</span><small className={'month-change month-change--' + item.tone}>{item.trend ? trendGlyph(item.trend.direction) + ' ' + item.trend.text : '— sem mês-base'}</small></div>)}</div><p>Preserva categoria, operadora, localidade e os demais filtros. Meses sem eventos dentro da cobertura aparecem como zero.</p></div>}
    </section>
  );
}
