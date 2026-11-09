import { Activity, ArrowRight, Boxes, BrainCircuit, Cable, ChevronLeft, Database, House, Menu, Network, ShieldCheck, Ticket } from 'lucide-react';
import { useState, type ReactNode } from 'react';

export type SolorPage = 'overview' | 'links' | 'devices' | 'itsm' | 'inventory' | 'ai' | 'sources';
export const pageLabels: Record<SolorPage, string> = { overview: 'Visão geral', links: 'Links', devices: 'Dispositivos', itsm: 'Indicadores ITSM', inventory: 'Inventário', ai: 'Análise IA', sources: 'Fontes e configurações' };
const items = [
  { page: 'overview', icon: House }, { page: 'links', icon: Cable }, { page: 'devices', icon: Network },
  { page: 'itsm', icon: Ticket }, { page: 'inventory', icon: Boxes }, { page: 'ai', icon: BrainCircuit },
] as const;

export function SolorShell({ page, onNavigate, children, logo = '', logoScale = 100 }: { page: SolorPage; onNavigate: (page: SolorPage) => void; children: ReactNode; logo?: string; logoScale?: number }) {
  const [collapsed, setCollapsed] = useState(false);
  return <div className={`solor-layout${collapsed ? ' solor-layout--collapsed' : ''}`}>
    <a className="solor-skip" href="#solor-main">Ir para o conteúdo</a>
    <aside className="solor-nav" aria-label="Navegação principal">
      <div className="solor-logo-row"><button className={`solor-logo${logo ? ' solor-logo--custom' : ''}`} onClick={() => onNavigate('overview')} aria-label="Empresa — Visão geral">{logo ? <span className="company-logo-frame"><img src={logo} alt="" width={112} height={42} style={{ width: logoScale + '%', height: logoScale + '%' }} /></span> : 'solor'}</button><button className="solor-collapse" onClick={() => setCollapsed(!collapsed)} aria-label={collapsed ? 'Expandir navegação' : 'Recolher navegação'} aria-expanded={!collapsed}><ChevronLeft size={19} /></button></div>
      <span className="solor-nav-label">OPERAÇÕES / NOC</span>
      <nav>{items.map(({ page: target, icon: Icon }) => <button key={target} onClick={() => onNavigate(target)} className={page === target ? 'solor-nav-item is-active' : 'solor-nav-item'} aria-current={page === target ? 'page' : undefined} title={pageLabels[target]} aria-label={pageLabels[target]}><span className="solor-nav-icon"><Icon size={19} /></span><span className="solor-nav-text">{pageLabels[target]}</span>{page === target && <i />}</button>)}</nav>
      <span className="solor-nav-label">DADOS E PREFERÊNCIAS</span>
      <button onClick={() => onNavigate('sources')} className={`solor-nav-item${page === 'sources' ? ' is-active' : ''}`} aria-current={page === 'sources' ? 'page' : undefined} title="Fontes e configurações" aria-label="Fontes e configurações"><span className="solor-nav-icon"><Database size={19} /></span><span className="solor-nav-text">Fontes e configurações</span></button>
      <div className="solor-nav-bottom"><span className="solor-nav-icon"><ShieldCheck size={21} /></span><div><strong>Ambiente local</strong><small>Seus arquivos neste navegador</small></div><span className="solor-status-dot" /></div>
    </aside>
    <div className="solor-workspace"><header className="solor-topbar"><button className="solor-menu-button" onClick={() => setCollapsed(!collapsed)} aria-label="Alternar navegação"><Menu size={20} /></button><div className="solor-breadcrumb">OperaDash <span>/</span> <strong>{pageLabels[page]}</strong></div><span className="solor-local"><span className="solor-status-dot" />Processamento local</span><span className="solor-product-mark"><Activity size={17} /></span></header>
      <main id="solor-main" className="solor-content">{children}</main>
      <footer className="solor-footer">Solor Tecnologia <span>·</span> OperaDash — Inteligência operacional</footer>
    </div>
  </div>;
}

export function OverviewCard({ title, description, value, onClick, icon }: { title: string; description: string; value: string; onClick: () => void; icon: ReactNode }) {
  return <button className="solor-module" onClick={onClick}><div className="solor-module-top"><span className="solor-module-icon">{icon}</span><div><h3>{title}</h3><p>{description}</p></div><strong className="solor-module-value">{value}</strong></div><div className="solor-module-bottom"><span>Explorar indicadores</span><span><ArrowRight size={17} /></span></div></button>;
}
