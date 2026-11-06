import { ArrowRight, Boxes, Cable, CheckCheck, Database, FileUp, Network, Ticket } from 'lucide-react';
import type { AlarmRecord, InventoryImportResult, ItsmImportResult, ImportResult } from '../types/operadora';
import { filterByCategoryAll, formatNumber } from '../lib/analytics';
import { uniqueTickets } from '../lib/itsm-correlation';
import { OverviewCard, type SolorPage } from './SolorShell';

export function Overview({ data, incidents, subtasks, inventory, onNavigate }: { data: ImportResult | null; incidents: ItsmImportResult | null; subtasks: ItsmImportResult | null; inventory: InventoryImportResult | null; onNavigate: (page: SolorPage) => void }) {
  const rows: AlarmRecord[] = data?.records ?? [];
  const sources = [
    { name: 'Alertas', detail: 'TelcoManager · AlarmReport', result: data },
    { name: 'Incidentes', detail: 'Jira · NOC SOLOR', result: incidents },
    { name: 'Subtarefas', detail: 'Jira · Motivos das quedas', result: subtasks },
    { name: 'Inventário', detail: 'Ativos monitorados', result: inventory },
  ];
  const loaded = sources.filter(source => source.result).length;
  return <div className="solor-overview">
    <section className="solor-hero"><div className="solor-hero-copy"><span className="solor-hero-tag"><Network size={13} />OPERAÇÕES CONECTADAS</span><h1>Uma visão clara<br />da sua operação.</h1><p>Alertas, atendimento e disponibilidade.<br />Transforme suas fontes em decisões para o NOC.</p><button className="solor-hero-action" onClick={() => onNavigate('sources')}><FileUp size={17} />{loaded ? 'Gerenciar fontes' : 'Importar meus arquivos'}<ArrowRight size={16} /></button></div><div className="solor-hero-visual" aria-hidden="true"><div className="solor-orbit solor-orbit--outer" /><div className="solor-orbit solor-orbit--inner" /><div className="solor-orbit-core"><Network size={45} strokeWidth={1.3} /></div><span className="orbit-node orbit-node--a"><Cable size={21} /></span><span className="orbit-node orbit-node--b"><Ticket size={21} /></span><span className="orbit-node orbit-node--c"><Boxes size={21} /></span><span className="orbit-caption">OPERAÇÃO EM PERSPECTIVA</span></div></section>
    <section className="solor-summary-strip" aria-label="Resumo das fontes"><div><span className="solor-summary-icon"><Database size={20} /></span><div><strong>{loaded} de 4 fontes carregadas</strong><small>Arquivos processados neste navegador</small></div></div><button onClick={() => onNavigate('sources')}>Conferir fontes <ArrowRight size={16} /></button></section>
    <div className="solor-section-heading"><div><span className="solor-kicker">CENTRAL DE OPERAÇÕES</span><h2>Explore sua operação</h2><p>Do evento ao motivo da queda, acompanhe cada etapa.</p></div><span className="solor-section-badge"><CheckCheck size={14} />Dados locais</span></div>
    <div className="solor-modules-grid">
      <OverviewCard title="Links" description="Disponibilidade, recorrência e operadoras com maior impacto." value={data ? formatNumber(filterByCategoryAll(rows, 'links').length) : '—'} icon={<Cable size={23} />} onClick={() => onNavigate('links')} />
      <OverviewCard title="Dispositivos" description="Saúde dos ativos, duração dos eventos e atuação do NOC." value={data ? formatNumber(filterByCategoryAll(rows, 'devices').length) : '—'} icon={<Network size={23} />} onClick={() => onNavigate('devices')} />
      <OverviewCard title="Indicadores ITSM" description="Correlacione alertas, incidentes e subtarefas. Entenda as causas." value={incidents ? formatNumber(uniqueTickets(incidents.records).length) : '—'} icon={<Ticket size={23} />} onClick={() => onNavigate('itsm')} />
      <OverviewCard title="Inventário" description="Cobertura de ativos e base de cálculo da disponibilidade." value={inventory ? formatNumber(inventory.uniqueHosts) : '—'} icon={<Boxes size={23} />} onClick={() => onNavigate('inventory')} />
    </div>
    <section className="solor-source-overview"><div className="solor-section-heading"><div><h2>Suas fontes de informação</h2><p>Confira a base disponível antes de analisar os indicadores.</p></div></div><div className="solor-source-list">{sources.map(source => <div key={source.name}><span className={`solor-source-dot${source.result ? ' is-loaded' : ''}`} /><div><strong>{source.name}</strong><small>{source.result?.fileName ?? source.detail}</small></div><span>{source.result ? 'Carregada' : 'Aguardando arquivo'}</span><button onClick={() => onNavigate('sources')} aria-label={`Gerenciar ${source.name}`}><ArrowRight size={16} /></button></div>)}</div></section>
  </div>;
}
