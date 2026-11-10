import { ChartExport } from './ChartExport';
import { Bar, BarChart, CartesianGrid, Cell, Legend, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { BarChart3, CheckCircle2, Clock3, Ticket, TrendingUp, Zap } from "lucide-react";
import type { ItsmOperationalSummary } from "../types/operadora";
import { formatMinutes, formatNumber } from "../lib/analytics";
import { MetricCard } from "./MetricCard";

interface ItsmIndicatorsPanelProps {
  summary: ItsmOperationalSummary;
  hasItsm: boolean;
  categoryLabel: string;
  periodLabel: string;
}

export function ItsmIndicatorsPanel({ summary, hasItsm, categoryLabel, periodLabel }: ItsmIndicatorsPanelProps) {
  const reasonColors = ["#146c94", "#008f91", "#e08e0b", "#9b4dca", "#d85b5b", "#4c7aa6", "#5d9b70", "#8b9aa8"];
  return (
    <section className="itsm-indicators-panel" aria-labelledby="itsm-indicators-title">
      <div className="section-title-row itsm-indicators-heading">
        <div><span className="section-kicker">GESTÃO DE INCIDENTES E FILA</span><h2 id="itsm-indicators-title">Indicadores ITSM</h2><p className="itsm-indicators-subtitle">{categoryLabel} · {periodLabel} · calculado sobre o recorte atual</p></div>
        <span className="period-context"><span className="context-pip" />{hasItsm ? "ITSM conciliado" : "Aguardando arquivo ITSM"}</span>
      </div>

      {!hasItsm ? (
        <div className="itsm-indicators-empty panel"><Ticket size={18} /><div><strong>Importe a planilha ITSM para ativar esta aba</strong><p>O painel usa a conciliação entre alarmes e tickets, sem enviar os arquivos para um servidor.</p></div></div>
      ) : (
        <>
          <div className="metrics-grid itsm-metrics-grid" aria-label="Cards de indicadores ITSM">
            <MetricCard label="Tickets abertos" value={formatNumber(summary.ticketsOpened)} detail="Tickets únicos conciliados ao recorte" icon={<Ticket size={17} />} tone="blue" footnote="Chaves ITSM sem duplicação" />
            <MetricCard label="Tickets resolvidos" value={formatNumber(summary.ticketsResolved)} detail="Tickets com data de resolução" icon={<CheckCircle2 size={17} />} tone="green" footnote={`${formatNumber(summary.ticketsResolved)} de ${formatNumber(summary.ticketsOpened)} tickets`} />
            <MetricCard label="Tempo médio de solução" value={formatMinutes(summary.averageResolutionMinutes, true)} detail="Criado até Resolvido" icon={<Clock3 size={17} />} tone="amber" footnote={`${formatNumber(summary.resolutionSamples)} tickets com duas datas válidas`} />
            <MetricCard label="Alarmes de oscilação" value={formatNumber(summary.oscillationUnder40)} detail="Alarmes com duração inferior a 40 minutos" icon={<Zap size={17} />} tone="cyan" footnote="Faixas cumulativas por duração" />
          </div>

          <div className="itsm-indicators-grid">
            <section className="panel itsm-volume-panel" aria-labelledby="itsm-volume-title">
              {summary.monthly.length > 0 && <ChartExport title="Alarmes e tickets abertos" />}
              <div className="panel-heading">
                <div className="panel-heading__icon"><TrendingUp size={16} /></div>
                <div className="panel-heading__copy"><h2 id="itsm-volume-title">Alarmes × tickets abertos</h2><p>Volume mensal dos alarmes filtrados e tickets com data de abertura</p></div>
              </div>
              {summary.monthly.length ? <div className="itsm-volume-chart"><ResponsiveContainer width="100%" height="100%"><BarChart data={summary.monthly} margin={{ top: 12, right: 10, bottom: 0, left: -12 }}><CartesianGrid vertical={false} stroke="rgba(18, 53, 91, 0.11)" /><XAxis dataKey="label" axisLine={false} tickLine={false} tick={{ fill: "#52677b", fontSize: 10 }} /><YAxis allowDecimals={false} axisLine={false} tickLine={false} tick={{ fill: "#60758b", fontSize: 9 }} tickFormatter={(value: number) => formatNumber(value)} /><Tooltip cursor={{ fill: "rgba(18, 53, 91, 0.045)" }} contentStyle={{ background: "#ffffff", border: "1px solid rgba(18, 53, 91, 0.18)", borderRadius: 10, color: "#18324b", fontSize: 11 }} labelStyle={{ color: "#12355b", fontWeight: 600, marginBottom: 4 }} formatter={(value, name) => [formatNumber(Number(value)), name === "alarms" ? "Alarmes" : "Tickets abertos"]} /><Legend wrapperStyle={{ fontSize: 10, color: "#52677b" }} formatter={(value) => value === "alarms" ? "Alarmes" : "Tickets abertos"} /><Bar dataKey="alarms" fill="#2f68a3" radius={[4, 4, 0, 0]} maxBarSize={24} /><Bar dataKey="ticketsOpened" fill="#00a6a6" radius={[4, 4, 0, 0]} maxBarSize={24} /></BarChart></ResponsiveContainer></div> : <div className="chart-empty"><span className="empty-mark">—</span><p>Nenhum alarme datado atende aos filtros atuais.</p></div>}
              <div className="panel-footnote">Abertos são tickets únicos conciliados aos alarmes filtrados com data de criação ITSM. O recorte preserva operadora, localidade, categoria e filtros de evento.</div>
            </section>

            <section className="panel oscillation-panel" aria-labelledby="oscillation-title">
              <ChartExport title="Alarmes de oscilação" />
              <div className="panel-heading"><div className="panel-heading__icon"><Zap size={16} /></div><div className="panel-heading__copy"><h2 id="oscillation-title">Alarmes de oscilação</h2><p>Contagens cumulativas por duração do alarme</p></div></div>
              <div className="oscillation-total"><strong>{formatNumber(summary.oscillationUnder40)}</strong><span>abaixo de 40 min</span></div>
              <div className="oscillation-list">
                <div><span>Até 10 minutos</span><strong>{formatNumber(summary.oscillationUpTo10)}</strong></div>
                <div><span>Até 25 minutos</span><strong>{formatNumber(summary.oscillationUpTo25)}</strong></div>
                <div><span>Até 40 minutos</span><strong>{formatNumber(summary.oscillationUpTo40)}</strong></div>
              </div>
              <p className="panel-footnote">As faixas são cumulativas: um alarme de 8 minutos aparece nas três faixas. O card principal considera duração estritamente menor que 40 minutos.</p>
            </section>

            <section className="panel itsm-reasons-panel" aria-labelledby="itsm-reasons-title">
              {summary.reasonBreakdown.length > 0 && <ChartExport title="Classificação dos tickets" />}
              <div className="panel-heading"><div className="panel-heading__icon"><BarChart3 size={16} /></div><div className="panel-heading__copy"><h2 id="itsm-reasons-title">Classificação dos tickets</h2><p>Distribuição por motivo ou tipo informado no Jira</p></div></div>
              {summary.reasonBreakdown.length ? <div className="itsm-reasons-content">
                <div className="itsm-reasons-chart"><ResponsiveContainer width="100%" height="100%"><PieChart><Pie data={summary.reasonBreakdown} dataKey="tickets" nameKey="reason" cx="50%" cy="50%" innerRadius="56%" outerRadius="82%" paddingAngle={2} stroke="#ffffff" strokeWidth={2}>{summary.reasonBreakdown.map((entry, index) => <Cell key={`${entry.reason}-${index}`} fill={reasonColors[index % reasonColors.length]} />)}</Pie><Tooltip formatter={(value, _name, item) => [`${formatNumber(Number(value))} tickets · ${Number(item.payload.sharePercent).toFixed(1)}%`, item.payload.reason]} contentStyle={{ background: "#ffffff", border: "1px solid rgba(18, 53, 91, 0.18)", borderRadius: 10, color: "#18324b", fontSize: 10 }} /></PieChart></ResponsiveContainer></div>
                <div className="itsm-reasons-legend">{summary.reasonBreakdown.map((entry, index) => <div className="itsm-reason-item" key={entry.reason}><span className="itsm-reason-swatch" style={{ background: reasonColors[index % reasonColors.length] }} /><span title={entry.reason}>{entry.reason}</span><strong>{formatNumber(entry.tickets)}</strong><small>{entry.sharePercent.toFixed(1)}%</small></div>)}</div>
              </div> : <div className="chart-empty"><span className="empty-mark">—</span><p>Nenhum ticket com motivo no recorte atual.</p></div>}
              <div className="panel-footnote">A coluna <strong>Motivo</strong> tem prioridade. Quando ela não existe ou está vazia, o painel usa <strong>Tipo de item</strong> — padrão da planilha ITSM — para descrever a classificação do ticket, sem confirmar a causa da queda. Valores vazios e categorias fora dos principais são agrupados em <strong>Outros</strong>; a contagem usa tickets únicos conciliados.</div>
            </section>
          </div>

          <section className="panel oscillation-offenders-panel" aria-labelledby="oscillation-offenders-title">
            {summary.oscillationOffenders.length > 0 && <ChartExport title="Ofensores de oscilação" />}
            <div className="panel-heading"><div className="panel-heading__icon"><BarChart3 size={16} /></div><div className="panel-heading__copy"><h2 id="oscillation-offenders-title">Ofensores de oscilação</h2><p>Ativos que concentram mais ocorrências e minutos abaixo de 40 min</p></div><span className="panel-tag">TOP {summary.oscillationOffenders.length}</span></div>
            {summary.oscillationOffenders.length ? <div className="oscillation-offenders-table"><div className="oscillation-offenders-table__head"><span>Ativo · operadora · localidade</span><span>Ocorrências</span><span>Minutos</span><span>Participação</span></div>{summary.oscillationOffenders.map((offender) => <div className="oscillation-offender-row" key={`${offender.name}\u0000${offender.operator}\u0000${offender.locality}`}><div className="oscillation-offender-row__identity"><strong title={offender.name}>{offender.name}</strong><small>{offender.operator} · {offender.locality}</small></div><strong>{formatNumber(offender.alarms)}</strong><span>{formatMinutes(offender.totalMinutes, true)}<small>{formatMinutes(offender.averageMinutes, true)} / ocorrência</small></span><div className="oscillation-offender-row__share"><div className="oscillation-offender-row__bar"><i style={{ width: `${Math.min(100, Math.max(2, offender.sharePercent))}%` }} /></div><strong>{offender.sharePercent.toFixed(1)}%</strong></div></div>)}</div> : <div className="chart-empty"><span className="empty-mark">—</span><p>Nenhum ofensor de oscilação no recorte atual.</p></div>}
            <div className="panel-footnote">Ordenação prioriza quantidade de oscilações; os minutos e a participação mostram onde concentrar investigação. O tempo médio por ocorrência ajuda a separar repetição curta de impacto acumulado.</div>
          </section>

          <section className="panel itsm-resolution-panel" aria-label="Volume de tickets resolvidos por mês">
            {summary.monthly.length > 0 && <ChartExport title="Tickets resolvidos por mês" />}
            <div className="panel-heading"><div className="panel-heading__icon"><CheckCircle2 size={16} /></div><div className="panel-heading__copy"><h2>Tickets resolvidos</h2><p>Distribuição mensal conforme a data Resolvido da planilha ITSM</p></div></div>
            <div className="itsm-resolution-strip">{summary.monthly.length ? summary.monthly.map((month) => <div className="itsm-resolution-month" key={month.key}><span>{month.label}</span><strong>{formatNumber(month.ticketsResolved)}</strong><small>resolvidos</small></div>) : <p className="chart-empty">Sem datas de resolução no recorte.</p>}</div>
          </section>
        </>
      )}
    </section>
  );
}
