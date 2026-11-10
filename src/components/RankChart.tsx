import { ChartExport } from './ChartExport';
import { ArrowUpRight, ChevronDown } from 'lucide-react';
import type { ReactNode } from 'react';
import type { RankedEntity } from '../types/operadora';
import { formatMinutes, formatNumber } from '../lib/analytics';
import { getRankComparisonSample, getRelativeTrend, hasRankMetricBaseline, trendGlyph } from '../lib/month-comparison';
import { jiraIssueSearchUrl } from '../lib/jira';
interface RankChartProps {
  title: string; description: string; rows: RankedEntity[]; metric: 'downtime' | 'alarms'; icon: ReactNode;
  emptyLabel?: string; metricLabel?: string; footnote?: string; currentComparisonRows?: RankedEntity[];
  comparisonRows?: RankedEntity[]; comparisonLabel?: string | null; comparisonHasBaseline?: boolean;
  comparisonRecordCount?: number; jiraBaseUrl?: string;
}
export function RankChart({ title, description, rows, metric, icon, emptyLabel = 'Sem dados para este recorte.', metricLabel, footnote, currentComparisonRows = rows, comparisonRows = [], comparisonLabel, comparisonHasBaseline = false, comparisonRecordCount = comparisonRows.length, jiraBaseUrl }: RankChartProps) {
  const hasBaseline = hasRankMetricBaseline(comparisonHasBaseline, metric, comparisonRows, comparisonRecordCount);
  const sample = getRankComparisonSample(currentComparisonRows, hasBaseline ? comparisonRows : []);
  const valueOf = (row: RankedEntity | undefined) => row ? metric === 'downtime' ? row.downtimeMinutes : row.alarms : 0;
  const display = (value: number) => metric === 'downtime' ? formatMinutes(value, true) : formatNumber(value);
  const maximum = Math.max(1, ...rows.map(valueOf));
  const previousByName = new Map(comparisonRows.map(row => [row.name, row]));
  const showJira = title.startsWith('Links ofensores') || title.startsWith('Dispositivos ofensores');
  const toneFor = (direction: string) => metricLabel === 'Tickets' ? 'neutral' : direction === 'up' || direction === 'new' ? 'negative' : direction === 'down' ? 'positive' : 'neutral';
  return <section className="panel rank-panel solor-rank-panel">{rows.length > 0 && <ChartExport title={title} />}<div className="panel-heading"><div className="panel-heading__icon">{icon}</div><div className="panel-heading__copy"><h2>{title}</h2><p>{description}</p></div><span className="panel-tag">TOP 5</span></div>
    {rows.length ? <ol className="solor-ranking-list">{rows.map((row, index) => {
      const trend = getRelativeTrend(valueOf(row), hasBaseline ? valueOf(previousByName.get(row.name)) : null);
      const jira = showJira ? jiraIssueSearchUrl(row.name, jiraBaseUrl) : null;
      return <li key={row.name}><span className="solor-ranking-number">{String(index + 1).padStart(2, '0')}</span><div className="solor-ranking-item"><div className="solor-ranking-item__top"><strong>{row.name}</strong>{jira && <a href={jira} target="_blank" rel="noreferrer" title="Consultar ativo no Jira" aria-label={'Consultar ' + row.name + ' no Jira'}><ArrowUpRight size={15} /></a>}</div><div className="solor-ranking-value"><strong>{display(valueOf(row))}</strong><span>{metric === 'downtime' ? 'indisponibilidade' : metricLabel?.toLowerCase() ?? 'alarmes'}</span>{comparisonLabel && <span className={'solor-ranking-trend month-change month-change--' + toneFor(trend.direction)} title={'Comparação com ' + comparisonLabel}>{trendGlyph(trend.direction)} {trend.text}</span>}</div><div className="solor-ranking-track" aria-hidden="true"><span style={{width: (valueOf(row) / maximum * 100) + '%'}} /></div>{metric === 'downtime' && <small className="solor-ranking-meta">{formatNumber(row.alarms)} alarmes no recorte</small>}</div></li>;
    })}</ol> : <div className="chart-empty"><span className="empty-mark">—</span><p>{emptyLabel}</p></div>}
    {comparisonLabel && sample.length > 0 && <details className="solor-rank-comparison"><summary><span>Comparar com {comparisonLabel}</span><small>TOP 5 atual + anterior</small><ChevronDown size={15} /></summary><div className="solor-table-scroll"><table className="solor-data-table"><thead><tr><th>Nome / posição</th><th>Atual</th><th>Mês anterior</th><th>Variação</th></tr></thead><tbody>{sample.map(item => {
      const trend = getRelativeTrend(valueOf(item.current ?? undefined), hasBaseline ? valueOf(item.previous ?? undefined) : null);
      return <tr key={item.name}><td><strong>{item.name}</strong><small>{item.currentRank ? 'Atual #' + item.currentRank : 'Fora do TOP 5 atual'} · {hasBaseline ? item.previousRank ? 'Anterior #' + item.previousRank : 'Fora do TOP 5 anterior' : 'Sem base mensurável'}</small></td><td>{display(valueOf(item.current ?? undefined))}</td><td>{hasBaseline ? display(valueOf(item.previous ?? undefined)) : 'Sem base'}</td><td><span className={'month-change month-change--' + toneFor(trend.direction)}>{trendGlyph(trend.direction)} {trend.text}</span></td></tr>;
    })}</tbody></table></div><p>União dos cinco primeiros de cada período. Pode incluir até dez itens; valores ausentes no TOP 5 são consultados na base completa do comparativo.</p></details>}
    {(footnote || rows.length > 0) && <div className="panel-footnote">{footnote ?? (metric === 'downtime' ? 'Duração somada por registro. Barras proporcionais ao maior valor deste ranking.' : 'Contagem de registros do recorte. Barras proporcionais ao maior valor deste ranking.')}</div>}
  </section>;
}
