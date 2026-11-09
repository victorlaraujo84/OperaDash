import { useMemo, useState } from 'react';
import { AlertTriangle, ArrowDownToLine, GitBranch, Link2, Search, Ticket, Zap } from 'lucide-react';
import type { AlarmRecord, DashboardFilters, ItsmImportResult } from '../types/operadora';
import { correlateItsm, uniqueTickets } from '../lib/itsm-correlation';
import { extractIssueKeys, normalizeIssueKey } from '../lib/itsm-join';
import { dateInPeriod, formatDate, formatMinutes, formatNumber, normalizeLocalityKey } from '../lib/analytics';
import { SubtaskReasonsPanel } from './SubtaskReasonsPanel';
import { categoryFromType, getSubtaskReasons, type SubtaskCategoryFilter } from '../lib/subtask-reasons';
import { MetricCard } from './MetricCard';

function downloadRows(rows: ReturnType<typeof correlateItsm>['rows']) {
  const quote = (value: unknown) => `"${String(value ?? '').replaceAll('"', '""')}"`;
  const data = [['Ativo', 'Início', 'Duração (min)', 'Incidentes', 'Subtarefas', 'Motivos', 'Validação'], ...rows.map(row => [row.alert.device, row.alert.startedAt?.toISOString() ?? '', row.durationMinutes, row.incidentKeys.join(' | '), row.subtaskKeys.join(' | '), row.reasons.join(' | '), row.reasonStatus])];
  const url = URL.createObjectURL(new Blob(['\uFEFF' + data.map(row => row.map(quote).join(';')).join('\r\n')], { type: 'text/csv;charset=utf-8' }));
  const link = document.createElement('a'); link.href = url; link.download = 'operadash-correlacao-itsm.csv'; link.click(); URL.revokeObjectURL(url);
}

function filterOptions(values: (string | undefined)[]) {
  return [...new Map(values.flatMap(value => value?.trim() ? [[normalizeLocalityKey(value), value.trim()] as const] : [])).values()]
    .sort((a, b) => a.localeCompare(b, 'pt-BR'));
}

export function ItsmCorrelationPanel({ alerts, allAlerts, incidents, subtasks, hasAlerts, filters }: { alerts: AlarmRecord[]; allAlerts: AlarmRecord[]; incidents: ItsmImportResult | null; subtasks: ItsmImportResult | null; hasAlerts: boolean; filters: DashboardFilters }) {
  const [view, setView] = useState<'alerts' | 'incidents' | 'subtasks'>('alerts');
  const [category, setCategory] = useState<SubtaskCategoryFilter>('all');
  const [unitType, setUnitType] = useState('');
  const [unitName, setUnitName] = useState('');
  const [query, setQuery] = useState('');
  const [page, setPage] = useState(1);
  const [showAllTickets, setShowAllTickets] = useState(false);
  const result = useMemo(() => {
    const keys = new Set(alerts.flatMap(alert => [...extractIssueKeys(alert.ticket), ...extractIssueKeys(alert.comment)]));
    const inPeriod = dateInPeriod(filters);
    const scoped = (incidents?.records ?? []).filter(record => hasAlerts ? keys.has(normalizeIssueKey(record.key)) : ((filters.month === 'all' && !filters.from && !filters.to) || inPeriod(record.createdAt)) && (!filters.itsmStatus || record.status === filters.itsmStatus) && (!filters.itsmResponsible || record.responsible === filters.itsmResponsible) && (!filters.search || [record.key, record.summary, record.reason, record.status, record.responsible].join(' ').toLocaleLowerCase('pt-BR').includes(filters.search.toLocaleLowerCase('pt-BR'))));
    return correlateItsm(alerts, incidents?.records ?? [], subtasks?.records ?? [], new Set(scoped.map(record => normalizeIssueKey(record.key))));
  }, [alerts, incidents, subtasks, hasAlerts, filters]);
  const allSubtasks = useMemo(() => uniqueTickets(subtasks?.records ?? []), [subtasks]);
  const subtaskOptions = useMemo(() => ({
    categories: filterOptions(allSubtasks.map(ticket => ticket.sourceType).filter(type => categoryFromType(type) === 'unknown')),
    unitTypes: filterOptions(allSubtasks.map(ticket => ticket.unitType)),
    unitNames: filterOptions(allSubtasks.map(ticket => ticket.unitName)),
  }), [allSubtasks]);
  const analysis = useMemo(() => getSubtaskReasons(result.subtasks, incidents?.records ?? [], allAlerts, filters, category, { unitType, unitName }), [result.subtasks, incidents, allAlerts, filters, category, unitType, unitName]);
  const search = query.toLocaleLowerCase('pt-BR');
  const alertRows = result.rows.filter(row => [row.alert.device, ...row.incidentKeys, ...row.subtaskKeys, ...row.reasons].join(' ').toLocaleLowerCase('pt-BR').includes(search));
  const ticketRows = (view === 'incidents' ? (showAllTickets ? uniqueTickets(incidents?.records ?? []) : result.incidents) : (showAllTickets ? allSubtasks : analysis.rows)).filter(row => [row.key, row.parentKey, row.summary, row.reason, row.responsible, row.status, row.sourceType, row.unitType, row.unitName].join(' ').toLocaleLowerCase('pt-BR').includes(search));
  const rowCount = view === 'alerts' ? alertRows.length : ticketRows.length;
  const totalPages = Math.max(1, Math.ceil(rowCount / 20));
  const currentPage = Math.min(page, totalPages);
  const start = (currentPage - 1) * 20;
  const changeView = (next: typeof view) => { setView(next); setShowAllTickets(false); setPage(1); };
  return <div className="correlation-panel">
    <div className="solor-section-heading"><div><span className="solor-kicker">DO ALERTA À CAUSA</span><h2>Alertas, incidentes e subtarefas</h2><p>{hasAlerts ? 'Recorte pela data do alerta. Tickets e subtarefas são vinculados por chaves explícitas.' : 'Sem alertas: incidentes selecionados pela data de criação. Importe o AlarmReport para correlacionar eventos.'}</p></div></div>
    <div className="metrics-grid correlation-metrics"><MetricCard label="Alertas no recorte" value={hasAlerts ? formatNumber(alerts.length) : '—'} detail="Eventos do TelcoManager" icon={<Zap size={19} />} tone="cyan" /><MetricCard label="Incidentes no recorte" value={incidents ? formatNumber(result.incidents.length) : '—'} detail={incidents ? `${formatNumber(uniqueTickets(incidents.records).length)} únicos na fonte` : 'Importe NOC SOLOR'} icon={<Ticket size={19} />} tone="blue" /><MetricCard label="Subtarefas vinculadas" value={subtasks ? formatNumber(result.linkedSubtasks) : '—'} detail={subtasks ? `${formatNumber(allSubtasks.length)} únicas na fonte` : 'Importe NOC SUBTAREFAS'} icon={<GitBranch size={19} />} tone="blue" /><MetricCard label="Alertas com incidente" value={hasAlerts && incidents ? `${alerts.length ? Math.round(result.linkedAlerts / alerts.length * 100) : 0}%` : '—'} detail={`${formatNumber(result.linkedAlerts)} com chave encontrada`} icon={<Link2 size={19} />} tone="cyan" /></div>
    <div className="solor-audit-banner"><AlertTriangle size={18} /><div><strong>Qualidade da correlação</strong><p>{formatNumber(result.confirmedAlerts)} alertas com motivo único · {formatNumber(result.conflictingIncidents)} incidentes com motivos conflitantes · {formatNumber(result.ambiguousSubtasks)} subtarefas com parentesco ambíguo na fonte · {formatNumber(result.rows.filter(row => row.reasonStatus === 'missing').length)} alertas sem causa estruturada.</p><small>Comentários e “Tipo de item” não comprovam a causa. Relações genéricas do Jira não são tratadas como parentesco.</small></div></div>
    {((incidents?.totalRows ?? 0) === 10000 || (subtasks?.totalRows ?? 0) === 10000) && <p className="source-warning"><AlertTriangle size={15} />Há uma fonte com exatamente 10.000 linhas. Confira se a exportação do Jira foi limitada.</p>}
    {result.reasons.length > 0 && <section className="panel solor-chart"><h3>Motivos por incidente</h3><p className="solor-chart-note">Incidentes distintos por motivo. Categorias podem se sobrepor.</p><div className="solor-reason-tags">{result.reasons.map(reason => <span key={reason.name}>{reason.name}<strong>{formatNumber(reason.incidents)} incidentes</strong></span>)}</div></section>}
    <section className="panel solor-evidence"><div className="solor-section-heading"><div><h3>Explore as evidências</h3><p>Consulte as chaves e a origem de cada motivo.</p></div><button className="button button--quiet" onClick={() => downloadRows(alertRows)} disabled={!alertRows.length}><ArrowDownToLine size={15} />Exportar correlação</button></div><div className="solor-evidence-toolbar"><div className="solor-segmented">{(['alerts', 'incidents', 'subtasks'] as const).map((target, i) => <button key={target} className={view === target ? 'is-active' : ''} onClick={() => changeView(target)} aria-pressed={view === target}>{['Alertas', 'Incidentes', 'Subtarefas'][i]}</button>)}</div><label className="search-field"><Search size={16} /><input placeholder="Buscar ativo, chave ou motivo…" aria-label="Buscar evidências ITSM" value={query} onChange={event => { setQuery(event.target.value); setPage(1); }} /></label></div>
    {view === 'subtasks' && subtasks && <div className="subtask-analysis">
      <div className="subtask-analysis__filters">
        <label className="filter-field"><span>Categoria (TIPO)</span><select value={category} onChange={event => { setCategory(event.target.value as SubtaskCategoryFilter); setPage(1); }}>
          <option value="all">Todas as categorias</option><option value="links">Links</option><option value="devices">Dispositivos</option><option value="unknown">Outros / sem categoria</option>
          {subtaskOptions.categories.map(value => <option key={value} value={`tipo:${normalizeLocalityKey(value)}`}>{value}</option>)}
        </select></label>
        <label className="filter-field"><span>Tipo de unidade (TIPO_UND)</span><select value={unitType} onChange={event => { setUnitType(event.target.value); setPage(1); }}>
          <option value="">Todos os tipos</option>{subtaskOptions.unitTypes.map(value => <option key={value}>{value}</option>)}
        </select></label>
        <label className="filter-field"><span>Nome da unidade (UND_NOME)</span><select value={unitName} onChange={event => { setUnitName(event.target.value); setPage(1); }}>
          <option value="">Todas as unidades</option>{subtaskOptions.unitNames.map(value => <option key={value}>{value}</option>)}
        </select></label>
      </div>
      <p className="solor-chart-note">O período acima e estes três filtros definem o recorte das subtarefas. Os demais filtros operacionais se aplicam à correlação de alertas e incidentes.</p>
      <SubtaskReasonsPanel analysis={analysis} />
    </div>}
    {view !== "alerts" && <label className="solor-show-all"><input type="checkbox" checked={showAllTickets} onChange={event => { setShowAllTickets(event.target.checked); setPage(1); }} /> Mostrar todos os tickets da fonte, incluindo os sem vínculo ou fora do recorte (somente nesta tabela)</label>}<div className="solor-table-scroll"><table className="solor-data-table"><thead><tr>{(view === 'alerts' ? ['Ativo / início', 'Incidentes', 'Subtarefas', 'Motivo da queda', 'Validação'] : view === 'subtasks' ? ['Chave / criação', 'Incidente pai', 'Categoria', 'Tipo de unidade', 'Nome da unidade', 'Responsável', 'Status', 'Motivo estruturado'] : ['Chave', 'Resumo', 'Responsável', 'Status', 'Motivo estruturado']).map(heading => <th key={heading}>{heading}</th>)}</tr></thead><tbody>{view === 'alerts' ? alertRows.slice(start, start + 20).map(row => <tr key={row.alert.id}><td><strong>{row.alert.device}</strong><small>{formatDate(row.alert.startedAt)} · {formatMinutes(row.durationMinutes)}</small></td><td>{row.incidentKeys.join(', ') || 'Sem vínculo'}</td><td>{row.subtaskKeys.join(', ') || '—'}</td><td>{row.reasons.join(' / ') || 'Não informado'}</td><td><span className={`solor-pill solor-pill--${row.reasonStatus}`}>{row.reasonStatus === 'confirmed' ? 'Motivo único' : row.reasonStatus === 'conflicting' ? 'Conflitante' : 'Pendente'}</span></td></tr>) : ticketRows.slice(start, start + 20).map(row => <tr key={row.key}><td><strong>{row.key}</strong>{view === 'subtasks' && <small>{formatDate(row.createdAt)}</small>}</td><td>{view === 'subtasks' ? row.parentKey || 'Não informado' : row.summary}</td>{view === 'subtasks' && <><td>{row.sourceType || '—'}</td><td>{row.unitType || '—'}</td><td>{row.unitName || '—'}</td></>}<td>{row.responsible || 'Não atribuído'}</td><td>{row.status || 'Não informado'}</td><td>{row.reason || 'Não informado'}</td></tr>)}{!rowCount && <tr><td colSpan={view === 'subtasks' ? 8 : 5} className="solor-table-empty">Nenhum registro neste recorte. Confira as fontes e os filtros.</td></tr>}</tbody></table></div><div className="solor-pagination"><span>{formatNumber(rowCount)} registros · Página {currentPage} de {totalPages}</span><div><button className="button button--quiet button--small" disabled={currentPage <= 1} onClick={() => setPage(currentPage - 1)}>Anterior</button><button className="button button--quiet button--small" disabled={currentPage >= totalPages} onClick={() => setPage(currentPage + 1)}>Próxima</button></div></div></section>
  </div>;
}
