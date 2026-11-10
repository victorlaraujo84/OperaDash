import { useEffect, useMemo, useState } from "react";
import { ArrowDownToLine, ChevronLeft, ChevronRight, CircleCheck, FileText } from "lucide-react";
import type { AlarmCategory, AlarmRecord, ItsmJoinMatch } from "../types/operadora";
import { formatDate, formatMinutes, formatNumber } from "../lib/analytics";
import { itsmMatchLabel, itsmResolutionLabel } from "../lib/itsm-join";
import { jiraIssueSearchUrl } from "../lib/jira";

interface AlarmTableProps {
  records: AlarmRecord[];
  category: AlarmCategory;
  onExport: () => void;
  jiraBaseUrl?: string;
}

const PAGE_SIZE = 20;

function TicketCell({ match }: { match: ItsmJoinMatch | null | undefined }) {
  if (!match) return <span className="muted-cell">Aguardando ITSM</span>;
  const tone = match.status === "matched-key" || match.status === "matched-internal" ? "matched" : match.status === "ambiguous" ? "ambiguous" : "unmatched";
  const ticket = match.ticket;
  return (
    <details className="itsm-detail">
      <summary><span className={`itsm-badge itsm-badge--${tone}`}>{itsmMatchLabel(match)}</span>{ticket ? <span className="itsm-detail__key">{ticket.key}</span> : null}</summary>
      <div className="itsm-detail__body">
        {ticket ? (
          <>
            <p className="itsm-detail__method">{itsmResolutionLabel(match)} · {match.matchField}</p>
            <dl>
              <div><dt>Resumo</dt><dd>{ticket.summary || "—"}</dd></div>
              <div><dt>Responsável ITSM</dt><dd>{ticket.responsible || "—"}</dd></div>
              <div><dt>Status</dt><dd>{ticket.status || "—"}</dd></div>
              <div><dt>Criado</dt><dd>{ticket.createdAt ? formatDate(ticket.createdAt) : "—"}</dd></div>
              <div><dt>Atualizado(a)</dt><dd>{ticket.updatedAt ? formatDate(ticket.updatedAt) : "—"}</dd></div>
              <div><dt>Data limite</dt><dd>{ticket.dueAt ? formatDate(ticket.dueAt) : "—"}</dd></div>
              <div><dt>Resolvido</dt><dd>{ticket.resolvedAt ? formatDate(ticket.resolvedAt) : "—"}</dd></div>
              <div><dt>Dispositivo × Resumo</dt><dd><span className={`summary-check summary-check--${match.summaryCheck}`}>{match.summaryCheck === "compatible" ? "Compatível" : match.summaryCheck === "different" ? "Divergente" : "Não conferido"}</span></dd></div>
            </dl>
          </>
        ) : (
          <>
            <p className="itsm-detail__method">{itsmResolutionLabel(match)}</p>
            <div className="itsm-candidates"><strong>Chaves encontradas no Comentário</strong><span>{match.commentKeys.length ? match.commentKeys.join(", ") : "Nenhuma"}</span></div>
            {match.candidateKeys.length ? <div className="itsm-candidates"><strong>Tickets candidatos</strong><span>{match.candidateKeys.join(", ")}</span></div> : null}
            <p className="itsm-detail__hint">Nenhum dado de responsável ou status foi atribuído automaticamente.</p>
          </>
        )}
      </div>
    </details>
  );
}

export function AlarmTable({ records, category, onExport, jiraBaseUrl }: AlarmTableProps) {
  const [page, setPage] = useState(1);
  const sortedRows = useMemo(() => [...records].sort((a, b) => (b.startedAt?.getTime() ?? 0) - (a.startedAt?.getTime() ?? 0)), [records]);
  const pages = Math.max(1, Math.ceil(sortedRows.length / PAGE_SIZE));
  const currentPage = Math.min(page, pages);
  const visibleRows = sortedRows.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  useEffect(() => setPage(1), [records]);

  return (
    <section className="panel alarm-table-panel">
      <div className="panel-heading table-heading">
        <div className="panel-heading__icon"><FileText size={17} /></div>
        <div className="panel-heading__copy">
          <h2>Alarmes do período</h2>
          <p>Registros que correspondem ao recorte selecionado</p>
        </div>
        <div className="table-heading__actions">
          <span className="record-count"><strong>{formatNumber(records.length)}</strong> alarmes</span>
          <button className="button button--quiet button--small" onClick={onExport} disabled={!records.length}>
            <ArrowDownToLine size={15} /> Exportar CSV
          </button>
        </div>
      </div>

      {visibleRows.length ? (
        <>
          <div className="table-scroll">
            <table className="alarm-table">
              <caption className="visually-hidden">Alarmes da aba {category === "links" ? "Links" : "Dispositivos"} no recorte atual</caption>
              <thead>
                <tr>
                  <th scope="col">Evento / Alarme</th>
                  <th scope="col">{category === "links" ? "Link" : "Dispositivo"}</th>
                  <th scope="col">TIPO</th>
                  <th scope="col">Operadora</th>
                  <th scope="col">Localidade</th>
                  <th scope="col">Responsável do alarme</th>
                  <th scope="col">Ticket ITSM</th>
                  <th scope="col">Técnico responsável</th>
                  <th scope="col">Início</th>
                  <th scope="col" className="numeric-cell">Indisponibilidade</th>
                </tr>
              </thead>
              <tbody>
                {visibleRows.map((record) => {
                  const acted = record.responsible.toLocaleLowerCase("pt-BR").includes("noc-solor");
                  return (
                    <tr key={record.id}>
                      <td className="alarm-cell">
                        <span className="alarm-cell__title" title={record.alarm}>{record.alarm}</span>
                        <span className="alarm-cell__meta">{record.ticket !== "—" ? `Ticket ${record.ticket}` : `Linha ${record.sourceRow}`}</span>
                      </td>
                      <td className="mono-cell" title={record.device}><span className="asset-cell"><span>{record.device}</span>{jiraIssueSearchUrl(record.device, jiraBaseUrl) ? <a className="jira-link" href={jiraIssueSearchUrl(record.device, jiraBaseUrl) ?? undefined} target="_blank" rel="noreferrer" aria-label={`Consultar ${record.device} no Jira ITSM`}>Jira</a> : null}</span></td>
                      <td className="mono-cell">{record.sourceType || "—"}</td>
                      <td>{record.operator}</td>
                      <td><span className="location-chip">{record.locality}</span></td>
                      <td>{acted ? <span className="responsible-chip responsible-chip--active"><CircleCheck size={12} />{record.responsible}</span> : <span className="muted-cell">{record.responsible}</span>}</td>
                      <td className="itsm-table-cell"><TicketCell match={record.itsmMatch} /></td>
                      <td className="itsm-technician-cell">
                        {record.itsmMatch?.ticket ? (
                          <span className="itsm-technician" title={record.itsmMatch.ticket.responsible || "Técnico não informado no ITSM"}>
                            {record.itsmMatch.ticket.responsible || "Não informado"}
                          </span>
                        ) : (
                          <span className="muted-cell">
                            {!record.itsmMatch ? "Aguardando ITSM" : record.itsmMatch.status === "ambiguous" ? "Ambíguo" : "Sem vínculo"}
                          </span>
                        )}
                      </td>
                      <td className="mono-cell date-cell">{formatDate(record.startedAt)}</td>
                      <td className="numeric-cell duration-cell">{formatMinutes(record.durationMinutes)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div className="table-pagination">
            <span>Exibindo <strong>{formatNumber((currentPage - 1) * PAGE_SIZE + 1)}–{formatNumber(Math.min(currentPage * PAGE_SIZE, sortedRows.length))}</strong> de {formatNumber(sortedRows.length)}</span>
            <div className="pagination-controls">
              <button className="icon-button" aria-label="Página anterior" disabled={currentPage <= 1} onClick={() => setPage((value) => Math.max(1, value - 1))}><ChevronLeft size={16} /></button>
              <span className="page-indicator">{currentPage} / {pages}</span>
              <button className="icon-button" aria-label="Próxima página" disabled={currentPage >= pages} onClick={() => setPage((value) => Math.min(pages, value + 1))}><ChevronRight size={16} /></button>
            </div>
          </div>
        </>
      ) : (
        <div className="table-empty"><span className="empty-mark">0</span><div><strong>Nenhum alarme neste recorte</strong><p>Amplie o período ou limpe um ou mais filtros.</p></div></div>
      )}
    </section>
  );
}
