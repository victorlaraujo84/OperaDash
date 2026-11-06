import { AlertTriangle, Cable, MapPin, Server } from "lucide-react";
import type { AlarmCategory, InventoryAsset } from "../types/operadora";
import { formatHours, formatNumber } from "../lib/analytics";
import { jiraIssueSearchUrl } from "../lib/jira";

interface LocalityInventoryCardsProps {
  locality: string;
  category: AlarmCategory;
  assets: InventoryAsset[];
  hoursPerAsset: number | null;
  totalHours: number | null;
  localityIssueAssets: number;
  hasLocalityColumn: boolean;
  inventoryLoaded: boolean;
  jiraBaseUrl?: string;
}

export function LocalityInventoryCards({ locality, category, assets, hoursPerAsset, totalHours, localityIssueAssets, hasLocalityColumn, inventoryLoaded, jiraBaseUrl }: LocalityInventoryCardsProps) {
  const assetLabel = category === "links" ? "links monitorados" : "hosts monitorados";
  const Icon = category === "links" ? Cable : Server;

  return (
    <section className="locality-inventory panel" aria-label={`Inventário monitorado na localidade ${locality}`}>
      <div className="locality-inventory__header">
        <span className="locality-inventory__icon"><MapPin size={16} /></span>
        <div><span className="section-kicker">ESCOPO DA LOCALIDADE</span><h3>{locality}</h3><p>Inventário da categoria ativa · {assetLabel}</p></div>
      </div>
      <div className="locality-inventory__stats">
        <article><span>ATIVOS IDENTIFICADOS</span><strong>{formatNumber(assets.length)}</strong><small>{assetLabel}</small></article>
        <article><span>HORAS POR ATIVO</span><strong>{hoursPerAsset === null ? "—" : `${formatHours(hoursPerAsset)} h`}</strong><small>24 h × dias do período</small></article>
        <article><span>HORAS MONITORADAS</span><strong>{totalHours === null ? "—" : `${formatHours(totalHours)} h`}</strong><small>denominador da disponibilidade</small></article>
      </div>
      {!inventoryLoaded ? (
        <div className="locality-inventory__warning"><AlertTriangle size={14} />Importe o inventário para identificar quantos ativos pertencem a esta localidade.</div>
      ) : !hasLocalityColumn ? (
        <div className="locality-inventory__warning"><AlertTriangle size={14} />Mapeie a coluna de localidade no inventário; sem ela não é possível delimitar os ativos desta cidade.</div>
      ) : localityIssueAssets > 0 ? (
        <div className="locality-inventory__warning"><AlertTriangle size={14} />{formatNumber(localityIssueAssets)} ativo(s) da categoria estão sem localidade ou associados a cidades conflitantes. O percentual fica oculto até corrigir o inventário.</div>
      ) : null}
      <div className="locality-inventory__list-heading"><strong>{assetLabel[0].toLocaleUpperCase("pt-BR") + assetLabel.slice(1)}</strong><span>{formatNumber(assets.length)} no inventário</span></div>
      {assets.length ? (
        <ul className="locality-inventory__list">
          {assets.map((asset) => { const jiraUrl = jiraIssueSearchUrl(`${asset.id} ${asset.name}`, jiraBaseUrl); return <li key={asset.id}><Icon size={13} /><code>{asset.name}</code>{jiraUrl ? <a className="jira-link" href={jiraUrl} target="_blank" rel="noreferrer" aria-label={`Consultar ${asset.name} no Jira ITSM`}>Jira</a> : null}<span>{category === "links" ? "LINK" : "HOST"}</span></li>; })}
        </ul>
      ) : (
        <p className="locality-inventory__empty">{inventoryLoaded && hasLocalityColumn ? `Nenhum ${category === "links" ? "link" : "host"} associado a ${locality} no inventário selecionado.` : "A lista será exibida após mapear a localidade no inventário."}</p>
      )}
    </section>
  );
}
