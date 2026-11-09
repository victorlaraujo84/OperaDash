import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { formatNumber, monthKey } from '../lib/analytics';
import type { getSubtaskReasons } from '../lib/subtask-reasons';

const categories = [
  { key: 'links', label: 'Links', color: '#3169b6' },
  { key: 'devices', label: 'Dispositivos', color: '#0d888e' },
  { key: 'unknown', label: 'Outros / sem categoria', color: '#647993' },
] as const;

export function SubtaskReasonsPanel({ analysis }: { analysis: ReturnType<typeof getSubtaskReasons> }) {
  const months = new Map<string, { month: string; links: number; devices: number; unknown: number }>();
  for (const ticket of analysis.rows) {
    if (!ticket.reason?.trim() || !ticket.createdAt || Number.isNaN(ticket.createdAt.getTime())) continue;
    const month = monthKey(ticket.createdAt);
    const row = months.get(month) ?? { month, links: 0, devices: 0, unknown: 0 };
    row[ticket.category]++;
    months.set(month, row);
  }
  const coverage = analysis.rows.length ? new Intl.NumberFormat('pt-BR', { style: 'percent', maximumFractionDigits: 1 }).format(analysis.classified / analysis.rows.length) : '—';
  return <section className="panel solor-chart subtask-reasons">
    <div className="solor-section-heading"><div>
      <h3>Motivos de alarme nas subtarefas</h3>
      <p>Contagem por chave e data de criação da subtarefa. Inclui registros sem incidente vinculado.</p>
    </div></div>
    <dl className="subtask-reasons__metrics">
      <div><dt>Subtarefas no recorte</dt><dd>{formatNumber(analysis.rows.length)}</dd></div>
      <div><dt>Com motivo</dt><dd>{formatNumber(analysis.classified)}</dd></div>
      <div><dt>Sem motivo</dt><dd>{formatNumber(analysis.rows.length - analysis.classified)}</dd></div>
      <div><dt>Cobertura dos motivos</dt><dd>{coverage}</dd></div>
    </dl>
    {analysis.undated > 0 && <p className="solor-chart-note">{formatNumber(analysis.undated)} subtarefas sem data válida na categoria selecionada. Elas aparecem no recorte somente sem restrição de período.</p>}
    {analysis.classified ? <div className="subtask-reasons__charts">
      <div><h4>Frequência por motivo</h4>
        <ul className="subtask-reasons__list">{analysis.reasons.map(reason => <li key={reason.name}>
          <div><strong>{reason.name}</strong><span>{formatNumber(reason.total)}</span></div>
          <div className="subtask-reasons__bar" aria-hidden="true">{categories.map(({ key, color }) =>
            <span key={key} style={{ width: `${reason[key] / analysis.reasons[0].total * 100}%`, backgroundColor: color }} />)}
          </div>
          <small>{categories.filter(({ key }) => reason[key]).map(({ key, label }) => `${label} ${formatNumber(reason[key])}`).join(' · ')}</small>
        </li>)}</ul>
      </div>
      <div><h4>Subtarefas com motivo por mês</h4>
        {months.size ? <ResponsiveContainer width="100%" height={248}><BarChart data={[...months.values()].sort((a, b) => a.month.localeCompare(b.month))}>
          <CartesianGrid stroke="#e8edf4" vertical={false} />
          <XAxis dataKey="month" tick={{ fontSize: 11 }} />
          <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
          <Tooltip />
          <Legend wrapperStyle={{ fontSize: 11 }} />
          {categories.map(({ key, label, color }) => <Bar key={key} dataKey={key} name={label} stackId="category" fill={color} maxBarSize={40} isAnimationActive={false} />)}
        </BarChart></ResponsiveContainer> : <p className="solor-chart-note">Os registros com motivo precisam de data de criação para aparecer na série mensal.</p>}
      </div>
    </div> : <p className="solor-chart-note">Nenhum motivo preenchido neste recorte. Confira a coluna “Motivo do alarme” no mapeamento da fonte.</p>}
  </section>;
}
