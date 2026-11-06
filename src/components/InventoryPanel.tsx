import { Cable, MapPin, Network, Server, ShieldCheck } from "lucide-react";
import type { InventoryDimensionRow, InventoryOperationalSummary } from "../types/operadora";
import { formatHours, formatNumber, formatPercent } from "../lib/analytics";

interface InventoryPanelProps {
  summary: InventoryOperationalSummary;
  periodLabel: string;
}

function statusLabel(status: string): string {
  if (status === "available") return "Calculada";
  if (status === "no-operator-column") return "Sem operadora";
  if (status === "no-locality-column") return "Sem localidade";
  if (status === "no-match") return "Sem alarme conciliado · 100% disponível";
  if (status === "no-assets") return "Sem ativos";
  return "Revisar dados";
}

function DimensionTable({ rows, dimension }: { rows: InventoryDimensionRow[]; dimension: "operator" | "locality" }) {
  if (!rows.length) return <div className="inventory-panel__empty"><span>—</span><p>Nenhum agrupamento completo foi identificado no inventário.</p></div>;
  return <div className="inventory-dimension-table" role="table" aria-label={dimension === "operator" ? "Disponibilidade por operadora" : "Disponibilidade por localidade"}>
    <div className="inventory-dimension-table__head" role="row"><span>{dimension === "operator" ? "Operadora" : "Localidade"}</span><span>{dimension === "operator" ? "Links" : "Ativos"}</span><span>Disponibilidade média</span></div>
    {rows.map((row) => <div className="inventory-dimension-table__row" role="row" key={row.name}>
      <div className="inventory-dimension-table__name"><strong title={row.name}>{row.name}</strong><small>{statusLabel(row.availabilityStatus)}{row.downtimeHours ? ` · ${formatHours(row.downtimeHours)} h indisponíveis` : ""}</small></div>
      <span><b>{formatNumber(dimension === "operator" ? row.links : row.assets)}</b><small>{dimension === "operator" ? `${formatNumber(row.assets)} ativos` : `${formatNumber(row.links)} links`}</small></span>
      <strong className={row.availabilityPercent === null ? "inventory-percent inventory-percent--muted" : "inventory-percent"}>{formatPercent(row.availabilityPercent)}</strong>
    </div>)}
  </div>;
}

export function InventoryPanel({ summary, periodLabel }: InventoryPanelProps) {
  return <section className="inventory-panel" aria-labelledby="inventory-title">
    <div className="section-title-row inventory-panel__heading">
      <div><span className="section-kicker">VISÃO DE ATIVOS E COBERTURA</span><h2 id="inventory-title">Inventário operacional</h2><p className="itsm-indicators-subtitle">Relação de ativos e disponibilidade média · {periodLabel}</p></div>
      <span className="period-context"><span className="context-pip" />{summary.hasOperatorColumn && summary.hasLocalityColumn ? "Dimensões mapeadas" : "Revisar mapeamento"}</span>
    </div>
    <div className="metrics-grid inventory-metrics-grid" aria-label="Resumo do inventário">
      <article className="inventory-stat panel"><span className="inventory-stat__icon"><Cable size={16} /></span><div><small>LINKS INVENTARIADOS</small><strong>{formatNumber(summary.totalLinks)}</strong><span>relação por operadora</span></div></article>
      <article className="inventory-stat panel"><span className="inventory-stat__icon"><Server size={16} /></span><div><small>ATIVOS MONITORADOS</small><strong>{formatNumber(summary.totalAssets)}</strong><span>links e dispositivos únicos</span></div></article>
      <article className="inventory-stat panel"><span className="inventory-stat__icon"><Network size={16} /></span><div><small>MÉDIA POR OPERADORA</small><strong>{formatPercent(summary.averageOperatorAvailability)}</strong><span>média simples dos grupos calculados</span></div></article>
      <article className="inventory-stat panel"><span className="inventory-stat__icon"><MapPin size={16} /></span><div><small>MÉDIA POR LOCALIDADE</small><strong>{formatPercent(summary.averageLocalityAvailability)}</strong><span>média simples das cidades calculadas</span></div></article>
    </div>
    {!summary.hasOperatorColumn || !summary.hasLocalityColumn ? <div className="inventory-panel__notice"><ShieldCheck size={14} /><span>Mapeie as colunas de operadora e localidade no arquivo do inventário para liberar todos os percentuais agrupados.</span></div> : null}
    <div className="inventory-dimensions-grid">
      <section className="panel inventory-dimension-panel" aria-labelledby="inventory-operators-title"><div className="panel-heading"><div className="panel-heading__icon"><Network size={16} /></div><div className="panel-heading__copy"><h3 id="inventory-operators-title">Links por operadora</h3><p>Ativos com TIPO = LINK, agrupados por operadora</p></div></div><DimensionTable rows={summary.operators} dimension="operator" /></section>
      <section className="panel inventory-dimension-panel" aria-labelledby="inventory-localities-title"><div className="panel-heading"><div className="panel-heading__icon"><MapPin size={16} /></div><div className="panel-heading__copy"><h3 id="inventory-localities-title">Ativos por localidade</h3><p>Links, hosts e disponibilidade média por cidade</p></div></div><DimensionTable rows={summary.localities} dimension="locality" /></section>
    </div>
    <div className="panel-footnote inventory-panel__footnote">Links são identificados pela coluna TIPO com valor LINK; sem essa coluna, o nome iniciado por LINK é usado como fallback. A disponibilidade agrupada usa o mesmo denominador do painel operacional: 24 horas por dia do período × ativos únicos do inventário. A média exibida é simples entre grupos com percentual calculável; alarmes simultâneos ou repetidos podem superestimar a indisponibilidade.</div>
  </section>;
}
